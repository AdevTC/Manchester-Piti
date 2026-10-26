// «El partido» as a broadcast (P- boards, ronda 3): the match turned into what every screen reads, pure. The
// moment of the match day (antes … pendiente), its plays in minute order (the board's two lines: «Gol de
// Alcides» · «Recortamos: 1–7.»), the score at any minute of the moviola, who stood where minute by minute
// (the acta's stints, rolling substitutions included: a player coming on takes the spot of the one he
// replaces, a «Cambio de sitio» trades two spots), the night's marks per player, the pressure line (the narrated analysis, else the plays), the match
// in numbers up to a minute, the light of each minute (the sun over Palomeras) and the result's words.
// No React, no Firebase: the page passes the match, the names and the clock.
import type { ClubMatch, MatchEvent } from "../../../lib/clubData";
import { dateMillis, isCompleted, matchPhase } from "../../../lib/clubData";
import { eventMinute } from "../../../lib/partidos";
import { eventSeconds } from "../../../../functions/src/matchAnalysis";
import { settled } from "../../../lib/eventMeta";
import { kickoffState } from "../../../lib/derived/kickoff";
import { parseMatchLineup } from "../../../lib/matchLineup";
import { rotationOf, type Stint } from "../../../lib/derived/vidrio/rotation";
import { sunPosition } from "../../../lib/derived/sun";
import { F7_SPOTS } from "../../../lib/ficha";

export type Fase = "antes" | "pitido" | "primera" | "descanso" | "segunda" | "final" | "acta" | "despues" | "aplazado" | "pendiente";
export const SCREENS = ["partido", "siete", "numeros", "vestuario"] as const;
export type Screen = (typeof SCREENS)[number];

const LIVE: ReadonlySet<Fase> = new Set(["primera", "descanso", "segunda"]);
const DONE: ReadonlySet<Fase> = new Set(["acta", "despues"]);
const PLAYED: ReadonlySet<Fase> = new Set(["primera", "descanso", "segunda", "final", "acta", "despues"]);
export const isLive = (f: Fase): boolean => LIVE.has(f);
export const isDone = (f: Fase): boolean => DONE.has(f);
export const isPlayed = (f: Fase): boolean => PLAYED.has(f);
export const isPre = (f: Fase): boolean => f === "antes" || f === "pitido";

/** Where the match day stands. `voteOpen`: the MVP vote of a published acta is still open (acta), else después. */
export function faseOf(match: ClubMatch, now: number, voteOpen: boolean): Fase {
  const phase = matchPhase(match, now);
  if (phase === "postponed" || phase === "cancelled") return "aplazado";
  if (isCompleted(match)) return voteOpen ? "acta" : "despues";
  const kick = kickoffState(match, now);
  if (phase === "playing") {
    if (kick === "halftime") return "descanso";
    return match.clock?.phase === "second" ? "segunda" : match.clock?.phase === "first" ? "primera" : now - dateMillis(match.date) >= ((match.duration ?? 50) / 2) * 60_000 ? "segunda" : "primera";
  }
  if (phase === "awaiting_result") return kick === "awaiting_result" ? "pendiente" : "final";
  if (kick === "pending_whistle") return "pitido";
  return "antes";
}

// ---------- the plays
export type PlayK = "gol" | "rival" | "cambio" | "tarjeta" | "roja" | "tarjetaRival" | "penalti" | "parada" | "palo";
export interface Play {
  id: string;
  /** The minute shown (football's: 1-based for a live-stamped play). */
  m: number;
  k: PlayK;
  side: "us" | "them";
  /** Ours: the scorer, the player carded, who came on (cambio), who saved, who hit the post. */
  who?: string;
  assist?: string;
  /** A change: who went off. */
  out?: string;
  title: string;
  sub: string;
}

const OUR_GOALS = new Set(["goal", "goal_penalty", "goal_freekick", "opponent_own_goal"]);
const THEIR_GOALS = new Set(["opponent_goal", "own_goal"]);
const and = (xs: readonly string[]): string => (xs.length < 2 ? (xs[0] ?? "") : `${xs.slice(0, -1).join(", ")} y ${xs[xs.length - 1]}`);
export { and as andList };

/** The plays the broadcast tells, in minute order (the acta's order within a minute). */
export function playsOf(match: Pick<ClubMatch, "events">, nameOf: (id: string) => string, rival: string): Play[] {
  const evs = settled(match.events ?? [])
    .map((e, i) => ({ e, i, m: eventMinute(e) ?? 0 }))
    .sort((a, b) => a.m - b.m || (a.e.elapsedSeconds ?? 0) - (b.e.elapsedSeconds ?? 0) || a.i - b.i);
  const out: Play[] = [];
  let gf = 0;
  let ga = 0;
  evs.forEach(({ e, m }, n) => {
    const base = { id: e.id, m };
    const t = e.type;
    if (THEIR_GOALS.has(t)) {
      const tied = gf === ga;
      ga++;
      const title = ga === 1 && gf === 0 ? `Golpe de ${rival}` : ga === gf ? `Empata ${rival}` : ga > gf && tied ? `${rival} se adelanta` : ga > gf ? `${rival} amplía` : `${rival} recorta`;
      const sub = t === "own_goal" && e.playerId ? `En propia puerta de ${nameOf(e.playerId)}. ${gf}–${ga}.` : `Marca ${rival}. ${gf}–${ga}.`;
      out.push({ ...base, k: "rival", side: "them", title, sub });
    } else if (OUR_GOALS.has(t)) {
      const tied = gf === ga;
      gf++;
      const word = gf === 1 && ga === 0 ? "Primero, el Piti" : gf === ga ? "El empate" : gf > ga && tied ? "Por delante" : gf > ga ? "Más distancia" : "Recortamos";
      const who = t === "opponent_own_goal" ? undefined : e.playerId;
      const title = who ? `Gol de ${nameOf(who)}` : t === "opponent_own_goal" ? `Autogol de ${rival}` : "Gol del Piti";
      const how = t === "goal_penalty" ? "De penalti. " : t === "goal_freekick" ? "De falta. " : "";
      const pass = e.assistPlayerId ? ` Pase de ${nameOf(e.assistPlayerId)}.` : "";
      out.push({ ...base, k: "gol", side: "us", who, assist: e.assistPlayerId, title, sub: `${how}${word}: ${gf}–${ga}.${pass}` });
    } else if (t === "substitution" && e.inPlayerId && e.playerId) {
      out.push({ ...base, k: "cambio", side: "us", who: e.inPlayerId, out: e.playerId, title: `Entra ${nameOf(e.inPlayerId)}, sale ${nameOf(e.playerId)}`, sub: "Cambio" });
    } else if ((t === "yellow_card" || t === "double_yellow" || t === "red_card") && e.playerId) {
      const red = t !== "yellow_card";
      out.push({ ...base, k: red ? "roja" : "tarjeta", side: "us", who: e.playerId, title: `${t === "double_yellow" ? "Segunda amarilla" : red ? "Roja" : "Amarilla"} a ${nameOf(e.playerId)}`, sub: e.note ?? "" });
    } else if (t === "opponent_yellow" || t === "opponent_red") {
      out.push({ ...base, k: "tarjetaRival", side: "them", title: `${t === "opponent_red" ? "Roja" : "Amarilla"} a ${rival}`, sub: "" });
    } else if (t === "penalty_committed") {
      // the goal that followed it (the next of theirs within two minutes)
      const next = evs.slice(n + 1).find((x) => THEIR_GOALS.has(x.e.type) && x.m - m <= 2);
      const who = e.playerId;
      out.push({ ...base, k: "penalti", side: "us", who, title: who ? `Penalti de ${nameOf(who)}` : "Penalti en contra", sub: next ? `Penalti cometido; lo marca ${rival} en el ${next.m}` : "Penalti cometido" });
    } else if (t === "penalty_saved") {
      out.push({ ...base, k: "parada", side: "us", who: e.playerId, title: "Penalti parado", sub: e.playerId ? nameOf(e.playerId) : "" });
    } else if (t === "woodwork") {
      out.push({ ...base, k: "palo", side: "us", who: e.playerId, title: "Al palo", sub: e.playerId ? `Disparo de ${nameOf(e.playerId)}` : "" });
    }
  });
  return out;
}

export interface Score {
  us: number;
  them: number;
}
export function scoreAt(plays: readonly Play[], m: number): Score {
  let us = 0;
  let them = 0;
  for (const p of plays) {
    if (p.m > m) break;
    if (p.k === "gol") us++;
    if (p.k === "rival") them++;
  }
  return { us, them };
}
export function nearestPlay(plays: readonly Play[], m: number): Play | null {
  let best: Play | null = null;
  for (const p of plays) if (p.m <= m && (!best || p.m >= best.m)) best = p;
  return best;
}

/** The moments, the changes of one minute folded into one («3 cambios» · «Entran X, Y y Z; salen …»). */
export function chapters(plays: readonly Play[], nameOf: (id: string) => string): Play[] {
  const out: Play[] = [];
  const byMin = new Map<number, { p: Play; ins: string[]; outs: string[] }>();
  for (const p of plays) {
    if (p.k !== "cambio") {
      out.push(p);
      continue;
    }
    let g = byMin.get(p.m);
    if (!g) {
      g = { p: { id: `c${p.m}`, m: p.m, k: "cambio", side: "us", title: "", sub: "" }, ins: [], outs: [] };
      byMin.set(p.m, g);
      out.push(g.p);
    }
    g.ins.push(nameOf(p.who ?? ""));
    g.outs.push(nameOf(p.out ?? ""));
  }
  for (const g of byMin.values()) {
    g.p.title = g.ins.length === 1 ? `Entra ${g.ins[0]}, sale ${g.outs[0]}` : `${g.ins.length} cambios`;
    g.p.sub = g.ins.length === 1 ? "Cambio" : `Entran ${and(g.ins)}; salen ${and(g.outs)}`;
  }
  return out;
}

// ---------- the result, worded
export interface ResultWords {
  us: number;
  them: number;
  dash: string;
  half: string;
  win: boolean;
  draw: boolean;
  loss: boolean;
  word: "Victoria" | "Empate" | "Derrota";
  verb: "Ganamos" | "Empatamos" | "Perdimos";
}
export function resultWords(fin: Score, half: Score): ResultWords {
  const win = fin.us > fin.them;
  const draw = fin.us === fin.them;
  return {
    us: fin.us,
    them: fin.them,
    dash: `${fin.us}–${fin.them}`,
    half: `${half.us}–${half.them}`,
    win,
    draw,
    loss: !win && !draw,
    word: win ? "Victoria" : draw ? "Empate" : "Derrota",
    verb: win ? "Ganamos" : draw ? "Empatamos" : "Perdimos",
  };
}

const NUMWORD = ["cero", "uno", "dos", "tres", "cuatro", "cinco", "seis", "siete", "ocho", "nueve", "diez"];

/** Until the captain writes the crónica, the acta told in two sentences. */
export function autoCronica(plays: readonly Play[], rival: string, duration: number, nameOf: (id: string) => string): string {
  const half = duration / 2;
  const h = scoreAt(plays, half);
  const f = scoreAt(plays, duration);
  const early = (side: "us" | "them") => plays.filter((p) => p.m <= 11 && (side === "us" ? p.k === "gol" : p.k === "rival")).length;
  const eThem = early("them");
  const eUs = early("us");
  const s1 =
    eThem >= 3
      ? `${rival} marcó ${NUMWORD[eThem] ?? eThem} en los primeros once minutos y se fue ${h.us}–${h.them} al descanso.`
      : eUs >= 3
        ? `El Piti marcó ${NUMWORD[eUs] ?? eUs} en los primeros once minutos y se fue ${h.us}–${h.them} al descanso.`
        : `Al descanso se llegó ${h.us}–${h.them}.`;
  const s2us = f.us - h.us;
  const s2them = f.them - h.them;
  const closer = Math.abs(s2us - s2them) < Math.abs(h.us - h.them);
  const second = plays.filter((p) => p.k === "gol" && p.m > half && p.who);
  const who = second.length ? `: ${and(second.map((p) => `${nameOf(p.who ?? "")} marcó en el ${p.m}`))}` : "";
  const s2 = ` En la segunda parte el partido fue ${closer ? "más igualado" : "parecido"} (${s2us}–${s2them})${who}, y acabó ${f.us}–${f.them}.`;
  return s1 + s2;
}

// ---------- who stood where, minute by minute
export interface Spot {
  id: string;
  code: string;
  x: number;
  y: number;
  /** The minute he came on (null: he started there). */
  cameIn: number | null;
}

export interface StintRow {
  id: string;
  /** First minute he stood on the pitch. */
  from: number;
  /** Minutes on the pitch up to the minute asked. */
  min: number;
  /** His stints up to the minute asked. */
  segs: Stint[];
  /** All his stints in the match. */
  all: Stint[];
}

export interface Tag {
  k: "gol" | "asis" | "amarilla" | "roja" | "parada" | "cambio" | "penalti" | "mvp";
  text: string;
  gold?: boolean;
}

export interface Lineup {
  system: string;
  slots: { id: string; code: string; x: number; y: number }[];
  bench: string[];
  notCalled: string[];
  /** The seven came from the pizarra (published) rather than the convocatoria's order. */
  published: boolean;
}

/** The seven's slots: the published lineup, else the convocatoria's titulares on the orientative 1-3-2-1. */
export function lineupOf(match: ClubMatch): Lineup {
  const l = parseMatchLineup((match as ClubMatch & { lineup?: unknown }).lineup);
  const codes = ["POR", "LI", "DFC", "LD", "MC", "MC", "DC"];
  const slots = l
    ? l.slots.map((s) => ({ id: s.playerId, code: s.code, x: s.x, y: Math.min(s.y, 90) }))
    : (match.starters ?? []).slice(0, 7).map((id, i) => ({ id, code: codes[i] ?? "MC", x: F7_SPOTS[i]?.[0] ?? 50, y: F7_SPOTS[i]?.[1] ?? 50 }));
  const seven = new Set(slots.map((s) => s.id));
  return {
    system: l?.system && l.system !== "libre" ? l.system : (match.system ?? "3-2-1"),
    slots,
    bench: [...(match.starters ?? []).filter((id) => !seven.has(id)), ...(match.bench ?? [])],
    notCalled: match.notCalled ?? [],
    published: !!l,
  };
}

/** One stretch of a player in one spot: from–to in minutes of play, the spot's code. */
export interface PosSeg {
  from: number;
  to: number;
  code: string;
}

/** The changes of one minute (the one shown), with the recolocación that came with them. */
export interface ChangeGroup {
  /** The minute shown (the plays': football's, 1-based for a live-stamped one). */
  m: number;
  /** The first whole minute of the moviola that shows it (25 for a change at the break, shown as the 26′). */
  f: number;
  /** After the break. */
  second: boolean;
  /** The score when it happened. */
  sc: Score;
  subs: { inId: string; outId: string }[];
  /** «Cambio de sitio»: whoever ended the minute in another spot, from which code to which. */
  moves: { id: string; from: string | null; to: string }[];
}

export interface Timeline {
  stints: Record<string, Stint[]>;
  onPitchAt(m: number): Spot[];
  segsAt(id: string, m: number): Stint[];
  stintsAt(m: number): StintRow[];
  tagsAt(m: number): Record<string, Tag[]>;
  /** Where each one played, stretch by stretch, up to the edge. */
  posSegs: Record<string, PosSeg[]>;
  /** The changes and recolocaciones, minute by minute. */
  groups: ChangeGroup[];
}

const SENT_OFF = new Set(["red_card", "double_yellow"]);
/**
 * The pitch walked from the events in play order (the ledger's): a change puts who comes on in the spot of the one
 * who goes off (a change «por» a player sent off fills the spot his red emptied, once), a red empties its spot, a
 * «Cambio de sitio» trades two spots. The frame of each whole minute shows every event up to it (a change at the
 * break, 25:00, is already in the 25′). `upto` stops a match being played at its edge.
 */
export function pitchWalk(lineup: Pick<Lineup, "slots">, events: readonly MatchEvent[], duration: number, upto: number | null): Pick<Timeline, "posSegs" | "groups"> & { frames: Spot[][] } {
  const end = Math.max(0, Math.min(duration, upto ?? duration));
  const halfS = (duration / 2) * 60;
  const evs = settled([...events])
    .map((e, i) => ({ e, i, s: eventSeconds(e), m: eventMinute(e) ?? 0 }))
    .filter((x) => x.s / 60 <= end)
    .sort((a, b) => a.s - b.s || a.i - b.i);
  const cur: (Spot | null)[] = lineup.slots.map((s) => ({ id: s.id, code: s.code, x: s.x, y: s.y, cameIn: null }));
  /** Sent off → the spot his red emptied (a change «por» him takes it). */
  const gone = new Map<string, number>();
  const posSegs: Record<string, PosSeg[]> = {};
  const open = new Map<string, PosSeg>();
  const start = (id: string, t: number, code: string) => {
    const g = { from: t, to: t, code };
    open.set(id, g);
    (posSegs[id] ??= []).push(g);
  };
  const stop = (id: string, t: number) => {
    const g = open.get(id);
    if (!g) return;
    g.to = Math.max(g.from, t);
    open.delete(id);
  };
  for (const s of cur) if (s) start(s.id, 0, s.code);
  const at = (id: string | undefined) => (id ? cur.findIndex((s) => s?.id === id) : -1);

  const groups: ChangeGroup[] = [];
  /** The open group's players before it touched them (their code then), to read the recolocación at its end. */
  let before = new Map<string, string | null>();
  const close = () => {
    const g = groups.at(-1);
    if (!g) return;
    for (const [id, from] of before) {
      const i = at(id);
      if (i >= 0 && cur[i]!.code !== from) g.moves.push({ id, from, to: cur[i]!.code });
    }
    before = new Map();
  };
  const groupFor = (m: number, f: number, s: number, period: number | undefined, sc: Score): ChangeGroup => {
    const last = groups.at(-1);
    if (last && last.m === m) return last;
    close();
    const g: ChangeGroup = { m, f, second: period === 2 || s >= halfS, sc, subs: [], moves: [] };
    groups.push(g);
    return g;
  };

  const frames: Spot[][] = [];
  let k = 0;
  let us = 0;
  let them = 0;
  for (let t = 0; t <= duration; t++) {
    while (k < evs.length && Math.ceil(evs[k].s / 60 - 1e-9) <= t) {
      const { e, s, m } = evs[k++];
      const time = s / 60;
      const f = Math.max(0, Math.ceil(time - 1e-9));
      if (OUR_GOALS.has(e.type)) us++;
      else if (THEIR_GOALS.has(e.type)) them++;
      if (!e.playerId) continue;
      const a = at(e.playerId);
      if (e.type === "substitution" && e.inPlayerId && at(e.inPlayerId) < 0) {
        const slot = a >= 0 ? a : gone.has(e.playerId) && cur[gone.get(e.playerId)!] === null ? gone.get(e.playerId)! : -1;
        if (slot < 0) continue;
        const base = a >= 0 ? cur[a]! : { ...lineup.slots[slot], id: e.playerId, cameIn: null };
        const g = groupFor(m, f, s, e.period, { us, them });
        if (a >= 0) stop(e.playerId, time);
        else gone.delete(e.playerId);
        cur[slot] = { id: e.inPlayerId, code: base.code, x: base.x, y: base.y, cameIn: f };
        start(e.inPlayerId, time, base.code);
        g.subs.push({ inId: e.inPlayerId, outId: e.playerId });
      } else if (SENT_OFF.has(e.type) && a >= 0) {
        stop(e.playerId, time);
        cur[a] = null;
        gone.set(e.playerId, a);
      } else if (e.type === "position_swap" && e.inPlayerId && a >= 0) {
        const b = at(e.inPlayerId);
        if (b < 0 || b === a) continue;
        groupFor(m, f, s, e.period, { us, them });
        const A = cur[a]!;
        const B = cur[b]!;
        for (const x of [A, B]) if (!before.has(x.id)) before.set(x.id, x.code);
        stop(A.id, time);
        stop(B.id, time);
        cur[a] = { ...A, id: B.id, cameIn: B.cameIn };
        cur[b] = { ...B, id: A.id, cameIn: A.cameIn };
        start(B.id, time, A.code);
        start(A.id, time, B.code);
      }
    }
    frames.push(cur.filter((s): s is Spot => s !== null).map((s) => ({ ...s })));
  }
  close();
  for (const id of [...open.keys()]) stop(id, end);
  for (const id of Object.keys(posSegs)) {
    posSegs[id] = posSegs[id].filter((g) => g.to > g.from);
    if (!posSegs[id].length) delete posSegs[id];
  }
  return { frames, posSegs, groups };
}

/** The pitch minute by minute (the walk of the events: changes, reds, «Cambio de sitio»), each player's stints (the
 *  acta's ledger, else the plays walked up to `upto`) and the marks of the night. */
export function timelineOf(match: ClubMatch, lineup: Lineup, plays: readonly Play[], duration: number, upto: number, nameOf: (id: string) => string): Timeline {
  const done = match.status === "finished";
  const rot = rotationOf(match, match.events ?? [], nameOf, done ? undefined : Math.max(0, upto));
  const stints: Record<string, Stint[]> = {};
  for (const r of rot.rows) stints[r.id] = r.stints.filter((s) => s.to > s.from || s.from >= duration);
  // before a whistle (or without any acta) the seven stands for the whole match
  if (!Object.keys(stints).length) for (const s of lineup.slots) stints[s.id] = [{ from: 0, to: duration }];
  const walk = pitchWalk(lineup, match.events ?? [], duration, done ? null : Math.max(0, upto));
  const tl = walk.frames;
  const onPitchAt = (m: number) => (tl[Math.max(0, Math.min(duration, Math.round(m)))] ?? tl[0]).map((c) => ({ ...c }));
  const segsAt = (id: string, m: number) =>
    (stints[id] ?? [])
      .filter((g) => g.from < m || (g.from === 0 && m === 0))
      .map((g) => ({ from: g.from, to: Math.min(g.to, m) }))
      .filter((g) => g.to > g.from);
  const stintsAt = (m: number): StintRow[] =>
    Object.keys(stints)
      .filter((id) => (stints[id] ?? []).some((g) => g.from < m || (m >= duration && g.from <= duration && g.to > g.from)))
      .map((id) => {
        const all = (stints[id] ?? []).filter((g) => g.to > g.from);
        const segs = segsAt(id, m);
        const min = Math.round(segs.reduce((a, g) => a + (g.to - g.from), 0));
        return { id, from: all[0]?.from ?? 0, min, segs, all };
      })
      .filter((r) => r.all.length > 0)
      .sort((a, b) => a.from - b.from || b.min - a.min);
  const tagsAt = (m: number) => {
    const t: Record<string, Tag[]> = {};
    const add = (id: string | undefined, tag: Tag) => {
      if (!id) return;
      (t[id] ??= []).push(tag);
    };
    const upTo = plays.filter((p) => p.m <= m);
    const lastGoal = [...upTo].reverse().find((p) => p.k === "gol")?.id;
    for (const p of upTo) {
      if (p.k === "gol") {
        add(p.who, { k: "gol", text: `${p.m}′`, gold: p.id === lastGoal });
        add(p.assist, { k: "asis", text: `${p.m}′` });
      }
      if (p.k === "tarjeta") add(p.who, { k: "amarilla", text: `${p.m}′` });
      if (p.k === "roja") add(p.who, { k: "roja", text: `${p.m}′` });
      if (p.k === "parada") add(p.who, { k: "parada", text: `${p.m}′` });
      if (p.k === "penalti") add(p.who, { k: "penalti", text: `${p.m}′` });
    }
    if (m < duration)
      for (const [id, gs] of Object.entries(stints)) {
        let last: number | null = null;
        for (const g of gs) if (g.from > 0 && g.from <= m) last = g.from;
        if (last != null) add(id, { k: "cambio", text: `${Math.max(1, Math.ceil(last - 1e-6))}′` });
      }
    return t;
  };
  return { stints, onPitchAt, segsAt, stintsAt, tagsAt, posSegs: walk.posSegs, groups: walk.groups };
}

// ---------- the pressure line (the moviola's ribbon and the acta's signature)
interface Obs {
  kind?: string;
  team?: string;
  validity?: string;
  time?: { from: number };
  facts?: Record<string, unknown>;
}
const observationsOf = (match: ClubMatch): Obs[] => {
  const a = (match as ClubMatch & { analysis?: { observations?: unknown } }).analysis;
  return Array.isArray(a?.observations) ? (a.observations as Obs[]) : [];
};
const PW: Record<string, number> = { pass: 0.3, shot: 1.6, goal: 3, recovery: 0.4, interception: 0.4, dribble: 0.5, carry: 0.3 };

/** −9…9 per minute (0…duration): our weight minus theirs, smoothed over three minutes. From the narrated
 *  analysis when the acta has one, else from the plays (goals, chances, corners, woodwork). */
export function pulseOf(match: ClubMatch, duration: number): number[] {
  const P = Array.from({ length: duration }, () => [0, 0]);
  const obs = observationsOf(match);
  if (obs.length) {
    for (const o of obs) {
      if (!o.time || o.validity === "invalid") continue;
      const mm = Math.floor(o.time.from / 60);
      if (mm < 0 || mm >= duration) continue;
      const w = PW[o.kind ?? ""] ? PW[o.kind ?? ""] * (o.kind === "pass" && o.facts?.outcome !== "complete" ? 0.2 : 1) : 0;
      P[mm][o.team === "us" ? 0 : 1] += w;
    }
  } else {
    for (const e of settled(match.events ?? [])) {
      const m = Math.min(duration - 1, Math.max(0, (eventMinute(e) ?? 1) - 1));
      const t = e.type;
      const side = ["opponent_goal", "opponent_chance", "opponent_corner", "opponent_woodwork", "save", "penalty_saved"].includes(t) ? 1 : 0;
      const w = OUR_GOALS.has(t) || THEIR_GOALS.has(t) ? 3 : t.includes("woodwork") ? 1.6 : t.includes("chance") || t === "shot" ? 1.2 : t.includes("corner") ? 0.5 : t === "save" || t === "penalty_saved" ? 1 : 0;
      const real = t === "own_goal" ? 1 : t === "opponent_own_goal" ? 0 : side;
      P[m][real] += w;
    }
  }
  const raw = P.map((x) => x[0] - x[1]);
  const sm = raw.map((v, i) => (raw[i - 1] ?? v) * 0.25 + v * 0.5 + (raw[i + 1] ?? v) * 0.25);
  const mx = Math.max(...sm.map(Math.abs)) || 1;
  const out = sm.map((v) => Math.round((v / mx) * 9 * 10) / 10);
  out.push(0);
  return out;
}

// ---------- the match in numbers up to a minute
export interface NumKind {
  k: string;
  label: string;
  icon: string;
}
export interface NumRow extends NumKind {
  us: number;
  them: number;
  usW: number;
  themW: number;
}
const KINDS_NARRATED: NumKind[] = [
  { k: "gol", label: "Goles", icon: "ball" },
  { k: "remate", label: "Remates", icon: "bolt" },
  { k: "apuerta", label: "A puerta", icon: "post" },
  { k: "pase", label: "Pases buenos", icon: "arrow" },
  { k: "recup", label: "Recuperaciones", icon: "swap" },
  { k: "perdida", label: "Pérdidas", icon: "close" },
  { k: "corner", label: "Córners", icon: "flag" },
  { k: "falta", label: "Faltas hechas", icon: "whistle" },
  { k: "tarjeta", label: "Tarjetas", icon: "card" },
  { k: "parada", label: "Paradas", icon: "glove" },
];
const KINDS_MESA: NumKind[] = [
  { k: "gol", label: "Goles", icon: "ball" },
  { k: "ocasion", label: "Ocasiones", icon: "bolt" },
  { k: "palo", label: "Al palo", icon: "post" },
  { k: "corner", label: "Córners", icon: "flag" },
  { k: "falta", label: "Faltas hechas", icon: "whistle" },
  { k: "tarjeta", label: "Tarjetas", icon: "card" },
  { k: "parada", label: "Paradas", icon: "glove" },
];
interface NumHit {
  m: number;
  k: string;
  side: "us" | "them";
}
export function numHitsOf(match: ClubMatch): { kinds: NumKind[]; hits: NumHit[]; narrated: boolean } {
  const obs = observationsOf(match);
  const hits: NumHit[] = [];
  if (obs.length) {
    for (const o of obs) {
      if (!o.time || o.validity === "invalid") continue;
      const m = Math.floor(o.time.from / 60) + 1;
      const side = o.team === "us" ? "us" : "them";
      const f = o.facts ?? {};
      const push = (k: string) => hits.push({ m, k, side });
      if (o.kind === "shot" || o.kind === "goal") push("remate");
      if ((o.kind === "shot" && f.outcome === "saved") || o.kind === "goal") push("apuerta");
      if (o.kind === "pass" && f.outcome === "complete") push("pase");
      if (o.kind === "recovery" || o.kind === "interception") push("recup");
      if (o.kind === "loss") push("perdida");
      if (o.kind === "save") push("parada");
      if (o.kind === "restart" && f.subtype === "corner" && f.stage === "executed") push("corner");
      if (o.kind === "discipline" && (f.subtype === "foul" || f.subtype === "penalty_committed")) push("falta");
      if (o.kind === "discipline" && f.subtype === "yellow_card") push("tarjeta");
    }
    return { kinds: KINDS_NARRATED, hits, narrated: true };
  }
  const MAP: Record<string, [string, "us" | "them"]> = {
    chance: ["ocasion", "us"],
    shot: ["ocasion", "us"],
    opponent_chance: ["ocasion", "them"],
    woodwork: ["palo", "us"],
    opponent_woodwork: ["palo", "them"],
    corner: ["corner", "us"],
    opponent_corner: ["corner", "them"],
    foul: ["falta", "us"],
    penalty_committed: ["falta", "us"],
    opponent_foul: ["falta", "them"],
    yellow_card: ["tarjeta", "us"],
    double_yellow: ["tarjeta", "us"],
    red_card: ["tarjeta", "us"],
    opponent_yellow: ["tarjeta", "them"],
    opponent_red: ["tarjeta", "them"],
    save: ["parada", "us"],
    penalty_saved: ["parada", "us"],
  };
  for (const e of settled(match.events ?? [])) {
    const hit = MAP[e.type];
    if (hit) hits.push({ m: eventMinute(e) ?? 0, k: hit[0], side: hit[1] });
  }
  return { kinds: KINDS_MESA, hits, narrated: false };
}
export function numbersAt(n: { kinds: NumKind[]; hits: NumHit[] }, plays: readonly Play[], m: number): NumRow[] {
  return n.kinds.map((K) => {
    let us = 0;
    let them = 0;
    if (K.k === "gol") ({ us, them } = scoreAt(plays, m));
    else
      for (const h of n.hits) {
        if (h.k !== K.k || h.m > m) continue;
        if (h.side === "us") us++;
        else them++;
      }
    const mx = Math.max(us, them, 1);
    return { ...K, us, them, usW: Math.round((us / mx) * 100), themW: Math.round((them / mx) * 100) };
  });
}

// ---------- the light of each minute
/** 0 (the golden evening) … 1 (the floodlit night) at `ms`: the floodlights come on under 3° of sun. */
export function floodAtMs(ms: number): number {
  if (!Number.isFinite(ms)) return 0;
  const el = sunPosition(ms).elevation;
  return Math.max(0, Math.min(1, Math.round(((3 - el) / 3) * 100) / 100));
}

// ---------- the moviola's minute
/** The live edge: the minute reached (descanso: the half), else the whole match once played, 0 before. */
export function edgeOf(fase: Fase, liveMinute: number | null, duration: number): number {
  if (fase === "descanso") return Math.round(duration / 2);
  if (isLive(fase)) return Math.max(0, Math.min(duration, liveMinute ?? 0));
  return isPlayed(fase) ? duration : 0;
}

/** ?min= read from the address: an integer within the match, else null. */
export function parseMin(v: unknown): number | null {
  const n = typeof v === "number" ? v : typeof v === "string" && /^\d{1,3}$/.test(v) ? Number(v) : NaN;
  return Number.isInteger(n) && n >= 0 && n <= 200 ? n : null;
}

/** The two halves of the stints as segment-in-box widths for drawing («0′–10′» on 50). */
export const pct = (m: number, duration: number): string => ((m / duration) * 100).toFixed(2);

export type { MatchEvent, Stint };
