// r14 «La pizarra» · Partido: the day of the match as one model (the prototype's PiPartido `model()` / `stageFor()`
// on the app's real data). The match and the boards come from the store; what the store doesn't carry (la mesa's
// lineup, the roll call, the acta's events, the clock's minute, the scorers, the quedada, the forecast, the frozen
// notas) comes in as the place's FEED (feed.ts writes it into the slice "pt-feed"). The acta's events are the one
// truth of who is on the pitch (A-PAR-02: lib/matchLineup lineupWalk); the board's plan is its `subs`. Pure.
import type { MatchEvent } from "../../../../../lib/clubData";
import { isPendingDup } from "../../../../../../functions/src/matchEngine";
import { lineupWalk, type LineupSlot } from "../../../../../lib/matchLineup";
import { OURS, THEIRS } from "../../../../../lib/partidos";
import type { LineupVariant, Sub } from "../../../formations";
import { liveRules, ruleHolds, type CondRuleR14 } from "../../../data/condPlan";
import { versionChanges } from "../../../data/mesa";
import { planRuleText } from "../plan/planView";
import type { PzApi } from "../../store/api";
import type { PzBoard, PzMatch, PzSlot, PzStatus, PzVer, StageSpec, Mark } from "../../store/types";

/** A match without its own length lasts 50′ (two halves of 25′). */
export const DUR0 = 50;

// ── the feed: what the store doesn't carry ───────────────────────────────────────────────────────────────
export interface PtFeed {
  /** The match it was read for (a feed of another match is ignored). */
  matchId: string | null;
  /** matches/{id}.lineup: the seven la mesa has (null = never sent). */
  lineup: { system: string; slots: LineupSlot[]; boardId: string; setAt: number } | null;
  /** «¿Quién ha venido?» (null = not called). */
  present: string[] | null;
  /** The acta's events (la mesa writes them). */
  events: MatchEvent[];
  /** The minute being played (what the acta stamps), 0 before the kick-off. */
  minute: number;
  /** The minute people read (football's 1-based), null before. */
  shown: number | null;
  clock: "ready" | "first" | "halftime" | "second" | "ended" | null;
  /** The clock stopped by la mesa during a half. */
  paused: boolean;
  revision: number | null;
  duration: number;
  /** I am one of the match's scorers (I can send the seven and write the cambios). */
  scorer: boolean;
  /** Who keeps la mesa (its public name). */
  mesaName: string;
  /** The frozen notas, by player. */
  notas: Record<string, number>;
  quedada: { at: number; where: string; note: string } | null;
  /** The quedada as the app keeps it today (matchPrivate.meetingNote), when there is no structured one. */
  meetingNote: string;
  weather: { t: number; sky: string; rain: number | null } | null;
  status: string;
}
export const EMPTY_FEED: PtFeed = { matchId: null, lineup: null, present: null, events: [], minute: 0, shown: null, clock: null, paused: false, revision: null, duration: DUR0, scorer: false, mesaName: "", notas: {}, quedada: null, meetingNote: "", weather: null, status: "" };

// ── the place's own state (slice "partido") ────────────────────────────────────────────────────────────────
export interface PtProp {
  kind: "repartir" | "recalc";
  subs: Sub[];
  /** Minutes each one ends with (the proposal's preview). */
  acc: Record<string, number>;
}
export interface PtUi {
  /** Who can't go on (marked by hand). */
  cant: Record<string, true>;
  confirm: "" | "next" | "desc";
  /** Antes: the pitch shows the minute of this tanda (null = the kick-off). */
  focus: number | null;
  prop: PtProp | null;
  desp: "acabo" | "empezo" | "plan";
  desc: "ahora" | "segunda";
  descOpt: "version" | "plan";
  /** The «Si pasa…» suggestion applied (it becomes the next change). */
  cond: boolean;
  /** Sent to la mesa from here (the sheet's «done»). */
  sent: { at: number } | null;
  rotar: boolean;
  /** A write is on its way (the button waits). */
  busy: boolean;
}
export const UI0: PtUi = { cant: {}, confirm: "", focus: null, prop: null, desp: "acabo", desc: "ahora", descOpt: "version", cond: false, sent: null, rotar: false, busy: false };

export type Phase = "none" | "antes" | "juego" | "descanso" | "despues";
export interface Interval {
  from: number;
  to: number;
}
export interface LiveSub {
  min: number;
  out: string;
  in: string | null;
}
export interface PtLive {
  now: number;
  /** The seven that started (la mesa's lineup). */
  start: string[];
  /** The pitch now: la mesa's slots after the acta (an emptied slot after a red keeps playerId null). */
  slots: PzSlot[];
  marks: Record<string, Mark[]>;
  /** The cambios in the acta. */
  done: LiveSub[];
  /** Cambios and reds (a red: in null). */
  outs: LiveSub[];
  gf: number;
  ga: number;
  field: string[];
  /** The acta's events up to now (pending duplicates out). */
  events: MatchEvent[];
  /** La mesa has no lineup: the pitch is the plan board's titular. */
  fallback: boolean;
}
export interface Tanda extends Sub {
  done: boolean;
  doneMin: number | null;
}
export interface NextChange {
  min: number;
  out: string;
  in: string | null;
  urgent?: boolean;
  cond?: boolean;
  id?: string;
}
export interface PtModel {
  M: PzMatch | null;
  ph: Phase;
  b: PzBoard | null;
  v: PzVer | null;
  st: PzStatus;
  feed: PtFeed;
  ui: PtUi;
  D: number;
  HALF: number;
  planSubs: Sub[];
  tandas: Tanda[];
  L: PtLive | null;
  now: number;
  startPids: (string | null)[];
  decide: boolean;
  ro: boolean;
  yes: string[];
  present: string[];
  field: string[];
  bench: string[];
  reds: string[];
  planIv: Record<string, Interval[]>;
  actIv: Record<string, Interval[]> | null;
  cond: { rule: CondRuleR14; applies: boolean; on: boolean } | null;
  next: NextChange | null;
}

const GOAL_K = new Set(["goal", "goal_penalty", "goal_freekick"]);
const RED_K = new Set(["red_card", "double_yellow"]);

export function phaseOf(M: PzMatch | null): Phase {
  if (!M) return "none";
  if (M.phase === "jugado" || M.played) return "despues";
  if (M.phase === "juego") return "juego";
  if (M.phase === "descanso") return "descanso";
  return "antes";
}

/** The match on screen: ?partido=, else the board's, else the next (the store's match()). */
export function ptMatch(P: PzApi): PzMatch | null {
  const q = P.state.route.q.partido;
  return (q ? P.sel.match(q) : null) ?? P.sel.match();
}

/** The board the day is planned on: the match's official, else the board on screen when it is this match's. */
export function planBoard(P: PzApi, M: PzMatch | null): PzBoard | null {
  const o = P.sel.official();
  if (o && M && o.matchId === M.id) return o;
  const b = P.sel.board();
  if (b && M && b.matchId === M.id) return b;
  return o ?? b ?? null;
}

/** Each one's time on the pitch from `start` and the cambios (a red: in null) up to `T`. */
export function intervals(start: readonly (string | null)[], subs: readonly LiveSub[], T: number): Record<string, Interval[]> {
  const on: Record<string, number> = {};
  const out: Record<string, Interval[]> = {};
  start.forEach((p) => {
    if (p) on[p] = 0;
  });
  subs
    .slice()
    .sort((a, b) => a.min - b.min)
    .forEach((s) => {
      if (s.min > T) return;
      if (s.out && on[s.out] != null) {
        (out[s.out] = out[s.out] ?? []).push({ from: on[s.out], to: s.min });
        delete on[s.out];
      }
      if (s.in && on[s.in] == null) on[s.in] = s.min;
    });
  Object.keys(on).forEach((p) => {
    if (T > on[p]) (out[p] = out[p] ?? []).push({ from: on[p], to: T });
  });
  return out;
}
export const total = (iv: readonly Interval[] | undefined): number => (iv ?? []).reduce((t, x) => t + x.to - x.from, 0);

const minOf = (e: { minute?: number | null }): number => (typeof e.minute === "number" ? e.minute : 0);
const CANWORD: Record<Mark["k"], string> = { amarilla: "Amarilla", tocado: "Tocado", gol: "Gol", roja: "Roja" };

/** The match as la mesa has it now: the pitch, the marks, the score, the cambios in the acta. */
export function liveOf(feed: PtFeed, now: number, fallbackSlots: PzSlot[] | null): PtLive | null {
  const fallback = !feed.lineup;
  const lineup = feed.lineup ?? (fallbackSlots && fallbackSlots.some((s) => s.playerId) ? { slots: fallbackSlots.filter((s): s is PzSlot & { playerId: string } => !!s.playerId).map((s) => ({ playerId: s.playerId, code: s.code, x: s.x, y: s.y })) } : null);
  if (!lineup) return null;
  const events = feed.events.filter((e) => !isPendingDup(e) && minOf(e) <= now);
  const walk = lineupWalk(lineup, events);
  const done: LiveSub[] = [];
  const outs: LiveSub[] = [];
  walk.steps.forEach((s) => {
    if (s.k === "sub") {
      const x = { min: minOf(s.event), out: s.outId, in: s.inId };
      done.push(x);
      outs.push(x);
    } else if (s.k === "red") outs.push({ min: minOf(s.event), out: s.outId, in: null });
  });
  const marks: Record<string, Mark[]> = {};
  let gf = 0;
  let ga = 0;
  events.forEach((e) => {
    if (OURS.has(e.type)) gf++;
    else if (THEIRS.has(e.type)) ga++;
    const k: Mark["k"] | null = GOAL_K.has(e.type) ? "gol" : e.type === "yellow_card" ? "amarilla" : e.type === "injury" ? "tocado" : RED_K.has(e.type) ? "roja" : null;
    if (k && e.playerId) (marks[e.playerId] = marks[e.playerId] ?? []).push({ k, t: CANWORD[k] + " " + minOf(e) + "′" });
  });
  // the pitch keeps la mesa's seven slots: the ones a red emptied stay, without a player
  const slots: PzSlot[] = lineup.slots.map((s0) => {
    const nowS = walk.now.find((n) => n.code === s0.code && n.x === s0.x && n.y === s0.y);
    return { code: s0.code, x: s0.x, y: s0.y, playerId: nowS ? nowS.playerId : null };
  });
  const field = walk.now.map((s) => s.playerId);
  return { now, start: lineup.slots.map((s) => s.playerId), slots, marks, done, outs, gf, ga, field, events, fallback };
}

/** «Si vamos perdiendo por 1 desde el 35′ → ofensiva + entra BRAWAN por ALCIDES». */
/** (the Plan's own words: the same sentence everywhere) */
export const condSentence = (r: CondRuleR14, name: (id: string) => string): string => planRuleText(r, name);

/** The model of the place: everything the regions, the stage, the primary action and the keys read. */
export function ptModel(P: PzApi, feed0: PtFeed, ui: PtUi): PtModel {
  const S = P.state;
  const M = ptMatch(P);
  const me = P.sel.me();
  const ph = phaseOf(M);
  const feed = feed0.matchId && M && feed0.matchId === M.id ? feed0 : { ...EMPTY_FEED, matchId: M?.id ?? null };
  const D = feed.duration > 1 ? feed.duration : DUR0;
  const HALF = Math.round(D / 2);
  const b = planBoard(P, M);
  const v = b ? P.sel.ver(b, "titular") : null;
  const st: PzStatus = v ? P.sel.status(v) : { n: 0, total: 7, full: false, gk: false, missing: [], warns: [] };
  const planSubs = (b?.lineup.subs ?? []).slice().sort((x, y) => x.min - y.min);
  const now = ph === "despues" ? Math.max(D, ...feed.events.map(minOf)) : ph === "descanso" ? Math.max(feed.minute, HALF) : ph === "juego" ? feed.minute : 0;
  const L = M && ph !== "antes" && ph !== "none" ? liveOf(feed, now, v ? v.slots : null) : null;
  const startPids: (string | null)[] = L ? L.start : v ? v.slots.map((s) => s.playerId) : [];
  const decide = !!(me.cap || feed.scorer);
  const ro = S.estado === "error" || S.estado === "cargando";
  const cal = M?.cal;
  const called = cal?.conv ? [...cal.conv.starters, ...cal.conv.bench] : [];
  const yes = S.W.squad.filter((p) => P.sel.rsvp(p.id).v === "yes").map((p) => p.id).concat(S.W.guests.map((g) => g.id));
  const present = feed.present && feed.present.length ? feed.present : called.length ? called : yes;
  const field = L ? L.field : (startPids.filter(Boolean) as string[]);
  const reds = L ? L.outs.filter((o) => !o.in).map((o) => o.out) : [];
  const bench = present.filter((p) => !field.includes(p) && !ui.cant[p] && !reds.includes(p));
  const tandas: Tanda[] = planSubs.map((s) => {
    const d = L ? L.done.find((e) => e.out === s.out && e.in === s.in) : null;
    return { ...s, done: !!d, doneMin: d ? d.min : null };
  });
  const planIv = intervals(startPids, planSubs, D);
  const actIv = L ? intervals(L.start, L.outs, now) : null;
  const playedOf = (p: string) => (actIv ? total(actIv[p]) : 0);
  const plannedOf = (p: string) => total(planIv[p]);
  const slotOf = (p: string) => ((L ? L.slots : v ? v.slots : []).find((s) => s.playerId === p)?.code ?? "") as PzSlot["code"] | "";
  const bestFor = (code: PzSlot["code"] | "") =>
    bench.slice().sort((a, c) => (code ? (P.sel.fit(c, code) ?? 0) - (P.sel.fit(a, code) ?? 0) : 0) || plannedOf(c) - playedOf(c) - (plannedOf(a) - playedOf(a)))[0] ?? null;
  // the conditional plan (Plan › Si pasa…): the first rule (the place shows one; la mesa reads them all)
  const rules = b?.lineup.condPlan ?? [];
  let cond: PtModel["cond"] = null;
  if (rules[0] && L) {
    const r = rules[0];
    cond = { rule: r, applies: ruleHolds(r, now, L.gf, L.ga), on: ui.cond };
  }
  let next: NextChange | null = null;
  if (L && (ph === "juego" || ph === "descanso")) {
    const hurt = field.find((p) => ui.cant[p]);
    if (hurt) next = { min: now, out: hurt, in: bestFor(slotOf(hurt)), urgent: true };
    else if (cond && cond.on) {
      const lr = liveRules([cond.rule], { minute: now, gf: L.gf, ga: L.ga, onPitch: new Set(field) })[0];
      if (lr?.sub) next = { min: now, out: lr.sub.out, in: lr.sub.in, cond: true };
    }
    if (!next) {
      const t = tandas.find((s) => !s.done && field.includes(s.out) && !field.includes(s.in) && !ui.cant[s.in] && !reds.includes(s.in));
      if (t) next = { min: t.min, out: t.out, in: t.in, id: t.id };
    }
  }
  return { M, ph, b, v, st, feed, ui, D, HALF, planSubs, tandas, L, now, startPids, decide, ro, yes, present, field, bench, reds, planIv, actIv, cond, next };
}

export const playedOf = (X: PtModel, p: string): number => (X.actIv ? total(X.actIv[p]) : 0);
export const plannedOf = (X: PtModel, p: string): number => total(X.planIv[p]);
export const slotOf = (X: PtModel, p: string): string => (X.L ? X.L.slots : X.v ? X.v.slots : []).find((s) => s.playerId === p)?.code ?? "";

/** The variant a version id names on a board. */
export const variantOf = (b: PzBoard | null, id: "v2" | "vb"): LineupVariant | null => b?.lineup.variants?.find((x) => x.id === id) ?? null;

/** Descanso: the cambios that make the 2ª parte (the board's «2ª parte» version, or the plan's tandas up to the
 *  break that are still to do). */
export function descPairs(X: PtModel): { out: string; in: string; why: string }[] {
  const L = X.L;
  if (!X.b || !L) return [];
  if (X.ui.descOpt === "plan") return X.tandas.filter((s) => !s.done && s.min <= X.HALF && L.field.includes(s.out) && !L.field.includes(s.in)).map((s) => ({ out: s.out, in: s.in, why: "El plan de minutos: " + s.min + "′" }));
  const v2 = variantOf(X.b, "v2");
  const now = L.slots.filter((s): s is PzSlot & { playerId: string } => !!s.playerId).map((s) => ({ playerId: s.playerId, code: s.code, x: s.x, y: s.y }));
  return versionChanges(now, v2).map((c) => ({ ...c, why: "La versión «2ª parte» · " + (L.slots.find((s) => s.playerId === c.out)?.code ?? "") }));
}

/** La mesa against the plan board: no seven · another seven · this one · live · over. */
export function mesaState(X: PtModel): "none" | "sin" | "otro" | "aldia" | "vivo" | "fin" {
  if (!X.M) return "none";
  if (X.ph === "juego" || X.ph === "descanso") return "vivo";
  if (X.ph === "despues") return "fin";
  const l = X.feed.lineup;
  if (!l) return "sin";
  if (!X.v) return "otro";
  const a = l.slots.map((s) => s.playerId).join(",");
  const c = X.v.slots.map((s) => s.playerId ?? "").join(",");
  return a === c && l.system === (X.v.freeMode ? "libre" : X.v.formation) ? "aldia" : "otro";
}

/** What the pitch says in each phase (the place sets it from an effect, never from a render). */
export function stageFor(P: PzApi, X: PtModel): StageSpec {
  const cam = P.state.stage.camera ?? "grada";
  const base: StageSpec = { camera: cam, editable: false, rival: false };
  const N0 = (id: string | null | undefined) => (id ? P.sel.name(id) : "—");
  const phone = P.state.layout === "phone";
  if (X.ph === "none" || !X.M) return { ...base, source: "siete" };
  if (X.ph === "antes") {
    if (!X.b || !X.v) return { ...base, source: "siete" };
    const f = X.ui.focus;
    if (f != null) {
      const sl = X.v.slots.map((s) => ({ ...s }));
      X.planSubs.filter((s) => s.min < f).forEach((s) => sl.forEach((x) => (x.playerId === s.out ? (x.playerId = s.in) : null)));
      const t = X.planSubs.find((s) => s.min === f);
      return { ...base, source: "ahora", slots: sl, marks: {}, next: t ? { min: t.min, out: t.out, in: t.in } : null, caption: t ? "En el " + t.min + "′ · entra " + N0(t.in) + " por " + N0(t.out) : "" };
    }
    const n = X.st.n;
    const cap = !n ? "Aún sin siete para la J" + (X.M.j ?? "") : (X.b.isOfficial ? "El siete oficial" : "Tu siete") + " · " + X.v.formation + (X.st.full ? " · así sale al pitido" : 7 - n === 1 ? " · falta 1" : " · faltan " + (7 - n));
    return { ...base, source: "siete", boardId: X.b.id, version: "titular", caption: cap };
  }
  const L = X.L;
  if (!L) return { ...base, source: "siete", ...(X.b ? { boardId: X.b.id } : {}) };
  if (X.ph === "descanso" && X.ui.desc === "segunda") {
    const pairs = descPairs(X);
    const sl = L.slots.map((s) => ({ ...s }));
    pairs.forEach((r) => sl.forEach((x) => (x.playerId === r.out ? (x.playerId = r.in) : null)));
    return { ...base, source: "ahora", slots: sl, marks: {}, next: null, entra: false, caption: "2ª parte · " + (pairs.length ? pairs.map((r) => "entra " + N0(r.in)).join(", ") : "los mismos siete") };
  }
  if (X.ph === "despues") {
    const view = X.ui.desp;
    let slots = L.slots;
    const start = X.feed.lineup ? X.feed.lineup.slots.map((s) => ({ code: s.code, x: s.x, y: s.y, playerId: s.playerId as string | null })) : L.slots;
    if (view === "empezo") slots = start;
    if (view === "plan") {
      slots = start.map((s) => ({ ...s }));
      X.planSubs.forEach((s) => slots.forEach((x) => (x.playerId === s.out ? (x.playerId = s.in) : null)));
    }
    const marks: Record<string, Mark[]> = {};
    Object.keys(L.marks).forEach((k) => {
      const g = L.marks[k].filter((m) => m.k === "gol");
      if (g.length) marks[k] = g;
    });
    return { ...base, source: "ahora", slots, marks, next: null, entra: false, caption: phone ? (view === "empezo" ? "Empezaron" : view === "plan" ? "Lo planeado" : "") : (view === "empezo" ? "Empezaron" : view === "plan" ? "Lo planeado para el final" : "Acabaron") + " · " + L.gf + "–" + L.ga + (Object.keys(X.feed.notas).length ? " · las notas, congeladas" : "") };
  }
  if (X.ph === "descanso") return { ...base, source: "ahora", slots: L.slots, marks: L.marks, next: null, caption: phone ? "" : "Descanso · " + L.gf + "–" + L.ga + " · «Cómo sale la 2ª» enseña los cambios" };
  const nx = X.next;
  const cap = phone
    ? ""
    : nx && nx.in
      ? nx.urgent
        ? N0(nx.out) + " no puede seguir · entra " + N0(nx.in)
        : nx.cond
          ? "El plan «Si pasa…» · entra " + N0(nx.in) + " por " + N0(nx.out)
          : "Próximo cambio · " + nx.min + "′ · entra " + N0(nx.in) + " por " + N0(nx.out)
      : L.now + "′ · " + L.gf + "–" + L.ga + " · sin más cambios en el plan";
  return { ...base, source: "ahora", slots: L.slots, marks: L.marks, next: nx && nx.in ? { min: nx.min, out: nx.out, in: nx.in } : null, caption: cap };
}
