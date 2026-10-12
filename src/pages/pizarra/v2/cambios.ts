// La pizarra «día de partido» — los cambios por tandas. A board plans its cambios as `subs` (at minute
// `min`, `in` takes `out`'s slot); the subs at the same minute are one «tanda» (wave). From them: who is
// on the pitch at any minute (the timeline's scrub, the live view), the minutes each one plays, the fair
// share, who «se come banquillo», and «Repartir minutos», which plans the waves that share the minutes
// out (the portero fixed unless he rotates, each one to his natural line when it can). Pure.
import type { Lineup, Sub, Zone } from "../formations";
import { MATCHDAY_LIMITS } from "../../../lib/schemas";
import { shownAt } from "./takers";

export const SUBS_MAX = MATCHDAY_LIMITS.subs;
/** A match without its own duration lasts 50' (as the match clock reads it, see liveMinute). */
export const DURATION0 = 50;
export const XI = 7;

/** The subs in match order (by minute; the same minute keeps the order they were planned in). */
export function sortSubs(subs: readonly Sub[]): Sub[] {
  return subs
    .map((s, k) => ({ s, k }))
    .sort((a, b) => a.s.min - b.s.min || a.k - b.k)
    .map((x) => x.s);
}

export interface Wave {
  min: number;
  subs: Sub[];
}

/** The tandas: the subs grouped by minute, in match order. */
export function wavesOf(subs: readonly Sub[]): Wave[] {
  const out: Wave[] = [];
  sortSubs(subs).forEach((s) => {
    const last = out[out.length - 1];
    if (last && last.min === s.min) last.subs.push(s);
    else out.push({ min: s.min, subs: [s] });
  });
  return out;
}

/** Who is in each slot at minute `t` (the subs of minute `t` made), and the subs that can't be made
 *  (the one leaving isn't on, the one coming in already is, or it falls outside the match). */
export function seatsAt(L: Pick<Lineup, "slots">, subs: readonly Sub[], t: number, duration = Infinity): { seats: (string | null)[]; broken: Set<string> } {
  const seats = L.slots.map((s) => s.playerId ?? null);
  const broken = new Set<string>();
  sortSubs(subs).forEach((s) => {
    if (s.min < 1 || s.min >= duration) {
      broken.add(s.id);
      return;
    }
    if (s.min > t) return;
    const i = seats.indexOf(s.out);
    if (i < 0 || s.in === s.out || seats.includes(s.in)) broken.add(s.id);
    else seats[i] = s.in;
  });
  return { seats, broken };
}

/** The subs that can't be made as planned (checked over the whole match). */
export const brokenSubs = (L: Pick<Lineup, "slots">, subs: readonly Sub[], duration = Infinity): Set<string> => seatsAt(L, subs, Infinity, duration).broken;

/** The seven at minute `t`, with the galones as they are worn then (the vice-capitán with the brazalete
 *  once the captain is off, each dead-ball galón on the first of its list on the pitch). */
export function lineupAt(L: Lineup, subs: readonly Sub[], t: number): Lineup {
  if (t <= 0 || !subs.length) return L;
  const { seats } = seatsAt(L, subs, t);
  if (seats.every((id, i) => id === (L.slots[i]?.playerId ?? null))) return shownAt(L);
  return shownAt({ ...L, slots: L.slots.map((s, i) => ({ ...s, playerId: seats[i] })) });
}

/** Minutes each one plays as planned, over a match of `duration` (from minute 0, or from `from` with
 *  the minutes already played). */
export function plannedMinutes(L: Pick<Lineup, "slots">, subs: readonly Sub[], duration: number): Map<string, number> {
  const m = new Map<string, number>();
  const add = (id: string | null, d: number) => {
    if (id) m.set(id, (m.get(id) ?? 0) + d);
  };
  const seats = L.slots.map((s) => s.playerId ?? null);
  seats.forEach((id) => add(id, 0));
  const bad = brokenSubs(L, subs, duration);
  let t = 0;
  wavesOf(subs.filter((s) => !bad.has(s.id))).forEach((w) => {
    seats.forEach((id) => add(id, w.min - t));
    t = w.min;
    w.subs.forEach((s) => {
      const i = seats.indexOf(s.out);
      if (i >= 0) seats[i] = s.in;
      add(s.in, 0);
    });
  });
  seats.forEach((id) => add(id, Math.max(0, duration - t)));
  return m;
}

// ── the minutes table ──
export interface MinRow {
  id: string;
  min: number;
  /** % of the match (the bar). */
  pct: number;
  /** Starts the match. */
  starter: boolean;
  /** The fixed keeper (his target is the whole match). */
  keeper: boolean;
  /** Plays nothing: «se come banquillo». */
  eaten: boolean;
  /** Against the fair share: «+6'», «−12'» (empty for the fixed keeper). */
  delta: string;
  /** Well under the fair share (a third short or more), or over it as much. */
  off: "lo" | "hi" | null;
}
export interface MinTable {
  rows: MinRow[];
  /** The fair share of each player (outfield, with the keeper fixed), in minutes. */
  fair: number;
  /** The fair share as % of the match (the target line on the bars). */
  fairPct: number;
  total: number;
  /** «7 × 50' = 350' · 9 de campo a 33' cada uno · el portero fijo». */
  txt: string;
  eaten: string[];
}

/** The planned minutes of every player who can play this match, against the fair share. */
export function minutesTable(L: Pick<Lineup, "slots">, subs: readonly Sub[], pool: readonly string[], duration: number, keeperFixed: boolean): MinTable {
  const mins = plannedMinutes(L, subs, duration);
  const keeper = L.slots[0]?.playerId ?? null;
  const ids = Array.from(new Set([...L.slots.map((s) => s.playerId).filter((x): x is string => !!x), ...pool, ...mins.keys()]));
  const fixed = keeperFixed && !!keeper;
  const rot = ids.filter((id) => !(fixed && id === keeper));
  const room = (fixed ? XI - 1 : XI) * duration;
  const fair = rot.length ? Math.min(duration, room / rot.length) : 0;
  const starters = new Set(L.slots.map((s) => s.playerId).filter(Boolean));
  const rows = ids
    .map<MinRow>((id) => {
      const min = mins.get(id) ?? 0;
      const k = fixed && id === keeper;
      const d = Math.round(min - fair);
      return {
        id,
        min,
        pct: duration ? Math.round((min / duration) * 100) : 0,
        starter: starters.has(id),
        keeper: k,
        eaten: min === 0,
        delta: k ? "" : (d > 0 ? "+" : d < 0 ? "−" : "±") + Math.abs(d) + "′",
        off: k || !fair ? null : min <= fair * (2 / 3) ? "lo" : min >= fair * (4 / 3) ? "hi" : null,
      };
    })
    .sort((a, b) => Number(b.keeper) - Number(a.keeper) || b.min - a.min || Number(b.starter) - Number(a.starter));
  const fr = Math.round(fair);
  const txt =
    XI + " × " + duration + "′ = " + XI * duration + "′" + (rot.length ? " · " + rot.length + (fixed ? " de campo" : "") + " a " + fr + "′ cada uno" : "") + (fixed ? " · el portero, fijo" : "");
  return { rows, fair, fairPct: duration ? Math.round((fair / duration) * 100) : 0, total: XI * duration, txt, eaten: rows.filter((r) => r.eaten).map((r) => r.id) };
}

// ── editing the waves ──
export interface SubCheck {
  ok: boolean;
  why?: string;
}

/** Why a sub can't go at its minute (the minute, who leaves, who comes in), checked on the subs before
 *  it. `name` for the message. */
export function checkSub(L: Pick<Lineup, "slots">, subs: readonly Sub[], s: Sub, duration: number, name: (id: string) => string): SubCheck {
  if (!Number.isInteger(s.min) || s.min < 1 || s.min > duration - 1) return { ok: false, why: "El cambio va entre el 1′ y el " + (duration - 1) + "′" };
  if (s.out === s.in) return { ok: false, why: "Sale y entra el mismo jugador" };
  const before = subs.filter((x) => x.id !== s.id && (x.min < s.min || (x.min === s.min && subs.indexOf(x) < subs.indexOf(s))));
  const { seats } = seatsAt(L, before, s.min);
  if (!seats.includes(s.out)) return { ok: false, why: name(s.out) + " no está en el campo en el " + s.min + "′" };
  if (seats.includes(s.in)) return { ok: false, why: name(s.in) + " ya está en el campo en el " + s.min + "′" };
  return { ok: true };
}

/** The subs with one more (or the same list when there is no room: SUBS_MAX). */
export function addSub(subs: readonly Sub[], s: Sub): Sub[] {
  return subs.length >= SUBS_MAX ? [...subs] : [...subs, s];
}
export const updateSub = (subs: readonly Sub[], id: string, patch: Partial<Omit<Sub, "id">>): Sub[] => subs.map((s) => (s.id === id ? { ...s, ...patch } : s));
export const removeSub = (subs: readonly Sub[], id: string): Sub[] => subs.filter((s) => s.id !== id);
/** A whole tanda to another minute (the marker dragged on the timeline, or moved with the arrows). */
export function moveWave(subs: readonly Sub[], from: number, to: number, duration: number): Sub[] {
  const m = Math.max(1, Math.min(duration - 1, Math.round(to)));
  return subs.map((s) => (s.min === from ? { ...s, min: m } : s));
}

/** The next free minute for a new tanda: halfway through the match, else after the last one. */
export function nextWaveMinute(subs: readonly Sub[], duration: number, from = 0): number {
  const ws = wavesOf(subs).map((w) => w.min).filter((m) => m > from);
  const half = Math.round(duration / 2);
  if (!ws.length) return Math.max(from + 1, Math.min(duration - 1, half > from ? half : from + 1));
  const last = ws[ws.length - 1];
  return Math.min(duration - 1, last + Math.max(1, Math.round((duration - last) / 2)));
}

// ── «Repartir minutos» ──
export interface GenInput {
  /** Who is in each slot at `from` (index 0 = the goal). */
  seats: (string | null)[];
  /** The line of each slot. */
  zones: Zone[];
  /** Who can come on, off the pitch at `from`. */
  pool: string[];
  /** Minutes already played by `from` (live: the acta's; before the match: none). */
  played?: ReadonlyMap<string, number>;
  from: number;
  duration: number;
  /** «Rotar portero»: the goal changes hands too (only with another natural keeper). */
  rotateKeeper: boolean;
  /** His natural line (unknown = fits anywhere). */
  nat: (id: string) => Zone | undefined;
  /** On the pitch but can't go on (lesión): off in the first tanda. */
  out?: ReadonlySet<string>;
  /** Subs that can still be planned (SUBS_MAX minus the ones kept). */
  room?: number;
  newId: () => string;
}

const fitsZone = (nat: Zone | undefined, z: Zone): boolean => nat == null || nat === z;

interface Sim {
  subs: Sub[];
  mins: Map<string, number>;
  cost: number;
}

function simulate(g: GenInput, waveMins: number[], perWave: number): Sim {
  const seats = [...g.seats];
  const mins = new Map<string, number>();
  const all = new Set<string>([...seats.filter((x): x is string => !!x), ...g.pool]);
  all.forEach((id) => mins.set(id, g.played?.get(id) ?? 0));
  const gone = new Set<string>();
  const room = g.room ?? SUBS_MAX;
  const subs: Sub[] = [];
  let t = g.from;
  const keeper0 = seats[0];
  let oop = 0;
  const accrue = (to: number) => {
    seats.forEach((id) => {
      if (id) mins.set(id, (mins.get(id) ?? 0) + (to - t));
    });
    t = to;
  };
  const span = waveMins.length ? (g.duration - g.from) / (waveMins.length + 1) : g.duration;
  waveMins.forEach((w, wi) => {
    accrue(w);
    const changed = new Set<number>();
    const used = new Set<string>();
    const bench = () =>
      Array.from(all)
        .filter((id) => !seats.includes(id) && !gone.has(id) && !used.has(id) && !g.out?.has(id))
        .sort((a, b) => (mins.get(a) ?? 0) - (mins.get(b) ?? 0) || (a < b ? -1 : 1));
    const swap = (i: number, b: string) => {
      const f = seats[i] as string;
      subs.push({ id: "", min: w, out: f, in: b });
      if (!fitsZone(g.nat(b), g.zones[i])) oop++;
      seats[i] = b;
      changed.add(i);
      used.add(b);
      if (g.out?.has(f)) gone.add(f);
    };
    // who can't go on leaves first (with whoever fits his line best, the fewest minutes first)
    if (wi === 0 && g.out?.size) {
      seats.forEach((f, i) => {
        if (!f || !g.out?.has(f) || subs.length >= room) return;
        const cands = bench().filter((b) => (i === 0 ? g.nat(b) === "POR" || !bench().some((x) => g.nat(x) === "POR") : true));
        const b = cands.find((x) => fitsZone(g.nat(x), g.zones[i])) ?? cands[0];
        if (b) swap(i, b);
      });
    }
    for (let n = 0; n < perWave && subs.length < room; n++) {
      const b = bench()[0];
      if (!b) break;
      const nb = g.nat(b);
      const slots = seats
        .map((f, i) => ({ f, i }))
        .filter((x): x is { f: string; i: number } => {
          if (!x.f || changed.has(x.i)) return false;
          if (x.i === 0) return g.rotateKeeper && nb === "POR";
          // with the keeper fixed, a second keeper still plays (on the line he fits)
          return true;
        });
      if (!slots.length) break;
      const top = Math.max(...slots.map((x) => mins.get(x.f) ?? 0));
      const near = slots.filter((x) => (mins.get(x.f) ?? 0) >= top - span / 2);
      const pick =
        (g.rotateKeeper && nb === "POR" ? near.find((x) => x.i === 0) : undefined) ??
        near.filter((x) => x.i !== 0 && fitsZone(nb, g.zones[x.i])).sort((a, b2) => (mins.get(b2.f) ?? 0) - (mins.get(a.f) ?? 0))[0] ??
        slots.filter((x) => x.i !== 0).sort((a, b2) => (mins.get(b2.f) ?? 0) - (mins.get(a.f) ?? 0))[0];
      if (!pick) break;
      // only when it evens the minutes out
      if ((mins.get(pick.f) ?? 0) - (mins.get(b) ?? 0) < Math.max(2, span / 2)) break;
      swap(pick.i, b);
    }
  });
  accrue(g.duration);
  const rot = Array.from(all).filter((id) => !(!g.rotateKeeper && id === keeper0) && !g.out?.has(id));
  const vals = rot.map((id) => mins.get(id) ?? 0);
  const spread = vals.length ? Math.max(...vals) - Math.min(...vals) : 0;
  // out of position costs a little; every cambio too (fewer, calmer tandas win a tie)
  return { subs, mins, cost: spread + subs.length * 1.2 + waveMins.length * 0.5 + oop };
}

/** The tandas that share the minutes out from `from` to the end (the subs, with fresh ids). */
export function generateWaves(g: GenInput): Sub[] {
  const D = g.duration;
  const from = Math.max(0, g.from);
  if (from >= D - 1) return [];
  const rest = D - from;
  const force = !!g.out?.size && g.seats.some((id) => !!id && g.out?.has(id));
  let best: Sim = simulate(g, force ? [from + 1] : [], 3);
  for (let k = 1; k <= 5; k++) {
    let ms = Array.from({ length: k }, (_, j) => from + Math.round(((j + 1) * rest) / (k + 1)));
    if (force) ms = [from + 1, ...ms];
    ms = Array.from(new Set(ms.filter((m) => m > from && m >= 1 && m <= D - 1))).sort((a, b) => a - b);
    if (!ms.length) continue;
    for (let p = 1; p <= 3; p++) {
      const s = simulate(g, ms, p);
      if (s.cost < best.cost - 1e-9 || (Math.abs(s.cost - best.cost) < 1e-9 && s.subs.length < best.subs.length)) best = s;
    }
  }
  return best.subs.map((s) => ({ ...s, id: g.newId() }));
}

// ── the live match: who has played what, from the acta ──
/** Minutes played by `t` from the acta's starters and substitution events (a red card ends his match). */
export function playedFromActa(starters: readonly string[], events: readonly { type: string; minute?: number; playerId?: string; inPlayerId?: string }[], t: number): Map<string, number> {
  const m = new Map<string, number>();
  const since = new Map<string, number>();
  starters.forEach((id) => since.set(id, 0));
  const evs = events.filter((e) => typeof e.minute === "number" && (e.minute as number) <= t).sort((a, b) => (a.minute ?? 0) - (b.minute ?? 0));
  const leave = (id: string, at: number) => {
    const s0 = since.get(id);
    if (s0 == null) return;
    m.set(id, (m.get(id) ?? 0) + Math.max(0, at - s0));
    since.delete(id);
  };
  evs.forEach((e) => {
    const at = e.minute as number;
    if (e.type === "substitution" && e.playerId && e.inPlayerId) {
      leave(e.playerId, at);
      if (!since.has(e.inPlayerId)) since.set(e.inPlayerId, at);
    } else if ((e.type === "red_card" || e.type === "double_yellow") && e.playerId) leave(e.playerId, at);
  });
  since.forEach((_, id) => leave(id, t));
  return m;
}

/**
 * «Recalcular»: the plan from minute `from` on, from who is actually on the pitch. The planned subs up
 * to `from` stay; then, at `from + 1`, the cambios that bring the plan in line with the pitch (the ones
 * made differently, an expulsión leaves his slot as it is); then the new tandas.
 */
export function replan(a: {
  L: Lineup;
  subs: readonly Sub[];
  from: number;
  duration: number;
  /** On the pitch now (the acta). */
  field: readonly string[];
  /** Called and available to come on (the acta's bench minus the sent off). */
  pool: readonly string[];
  played: ReadonlyMap<string, number>;
  unavailable: ReadonlySet<string>;
  rotateKeeper: boolean;
  nat: (id: string) => Zone | undefined;
  zones: Zone[];
  newId: () => string;
}): Sub[] {
  const keep = a.subs.filter((s) => s.min <= a.from);
  const at = Math.min(a.duration - 1, a.from + 1);
  const { seats } = seatsAt(a.L, keep, a.from);
  const field = new Set(a.field);
  const fix: Sub[] = [];
  // the pitch as it is: whoever the plan has on but isn't, out for whoever is on and the plan hasn't
  const extra = a.field.filter((id) => !seats.includes(id));
  seats.forEach((id, i) => {
    if (!id || field.has(id)) return;
    const z = a.zones[i];
    const k = extra.findIndex((x) => fitsZone(a.nat(x), z));
    const pick = k >= 0 ? extra.splice(k, 1)[0] : extra.shift();
    if (pick && at > a.from) {
      fix.push({ id: a.newId(), min: at, out: id, in: pick });
      seats[i] = pick;
    }
  });
  const room = Math.max(0, SUBS_MAX - keep.length - fix.length);
  const gen = generateWaves({
    seats: seats.map((id) => (id && field.has(id) ? id : null)),
    zones: a.zones,
    pool: a.pool.filter((id) => !field.has(id) && !a.unavailable.has(id)),
    played: a.played,
    from: fix.length ? at : a.from,
    duration: a.duration,
    rotateKeeper: a.rotateKeeper,
    nat: a.nat,
    out: new Set(a.field.filter((id) => a.unavailable.has(id))),
    room,
    newId: a.newId,
  });
  // (a fix and a new sub at the same minute for the same player: the new one follows the fix)
  return [...keep, ...fix, ...gen];
}

/** «SALE TELLO → ENTRA KEVIN». */
export const subTxt = (s: Sub, name: (id: string) => string): string => "Sale " + name(s.out) + " → entra " + name(s.in);

/** The waves as one line each, for the charla, the cartel and the announcer: «25′ · KEVIN por TELLO, ERIK por ADRIÁN». */
export function wavesTxt(subs: readonly Sub[], name: (id: string) => string): string[] {
  return wavesOf(subs).map((w) => w.min + "′ · " + w.subs.map((s) => name(s.in) + " por " + name(s.out)).join(", "));
}
