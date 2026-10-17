// La mesa's pure model: the screen a phase picks, the clock as la mesa reads it, the score with possible
// duplicates counted once, who is on the pitch and for how long, where each shirt stands, how a play is said,
// and the plays still in this phone's queue merged into the record. useMesa feeds it; the tests run it.
import { EVENT_LABELS, minuteOfPlay, type MatchEvent } from "../../../functions/src/matchEngine";
import { clockReading, type MatchClock } from "../../../functions/src/matchClock";
import { POSITIONS, isPosCode, type PosCode } from "../../../functions/src/positions";
import { lineupField } from "../../lib/derived/lineupField";
import type { MatchLineup } from "../../lib/matchLineup";
import type { MesaClock, MesaEvent, MesaPhase, MesaPlayer, MesaScreen, MesaStint, MesaType } from "./types";

// ---------- the screen
/** The phase picks the screen; `?vista=cronica` asks for «Lo que va pasando» whatever the phase. */
export function pickScreen(phase: MesaPhase | undefined, vista: string | undefined): MesaScreen {
  if (vista === "cronica") return "cronica";
  switch (phase ?? "ready") {
    case "first":
    case "second":
      return "enjuego";
    case "halftime":
      return "descanso";
    case "ended":
      return "final";
    default:
      return "antes";
  }
}

// ---------- the clock
/** Seconds of a half: half the match's duration (50′ → 25′ halves). */
export const halfSecondsOf = (duration: number | undefined): number => Math.round((Number.isFinite(duration) && duration ? Math.max(10, Math.min(150, duration)) : 50) / 2) * 60;
const pad = (n: number) => String(n).padStart(2, "0");
/** «18:42» for seconds of play. */
export const clockText = (s: number): string => `${pad(Math.floor(Math.max(0, s) / 60))}:${pad(Math.floor(Math.max(0, s)) % 60)}`;

/** The server clock as la mesa reads it: a hold inside a half (`heldAt`) freezes it where it stopped. */
export function mesaClock(clock: MatchClock | undefined, now: number, duration?: number): MesaClock {
  const held = clock?.heldAt != null && (clock.phase === "first" || clock.phase === "second");
  const r = clockReading(clock, held ? Math.min(now, clock!.heldAt!) : now);
  const playing = r.playing && !held;
  const periodSeconds = r.period === 1 ? r.firstSeconds : r.secondSeconds;
  const added = clock?.added?.[r.period] ?? 0;
  return {
    phase: r.phase,
    playing,
    held,
    elapsedSeconds: r.elapsedSeconds,
    periodSeconds,
    period: r.period,
    halfSeconds: halfSecondsOf(duration),
    added: Number.isFinite(added) ? Math.max(0, Math.min(15, Math.floor(added))) : 0,
    minute: minuteOfPlay(r.elapsedSeconds, playing),
    text: clockText(r.elapsedSeconds),
    revision: clock?.revision ?? 0,
    breakSeconds: Number.isFinite(r.breakSeconds) ? Math.max(0, r.breakSeconds) : 0,
    kickoffAt: typeof clock?.firstStartedAt === "number" ? clock.firstStartedAt : null,
    secondAt: typeof clock?.secondStartedAt === "number" ? clock.secondStartedAt : null,
  };
}

// ---------- the score
export const OUR_GOALS = new Set<string>(["goal", "goal_penalty", "goal_freekick", "opponent_own_goal"]);
export const THEIR_GOALS = new Set<string>(["opponent_goal", "own_goal"]);
/** A possible duplicate nobody has resolved yet is shown, and counted, as a single play. */
export const counted = (e: Pick<MatchEvent, "dupOf" | "dupOk">): boolean => !(e.dupOf && e.dupOk !== true);
export function goalSide(type: string): "us" | "them" | null {
  return OUR_GOALS.has(type) ? "us" : THEIR_GOALS.has(type) ? "them" : null;
}
/** The score everyone sees: possible duplicates count once. */
export function mesaScore(events: readonly Pick<MatchEvent, "type" | "dupOf" | "dupOk">[] | undefined): { us: number; them: number } {
  let us = 0;
  let them = 0;
  for (const e of events ?? []) {
    if (!counted(e)) continue;
    const g = goalSide(e.type);
    if (g === "us") us++;
    else if (g === "them") them++;
  }
  return { us, them };
}

// ---------- the rival
/** «Atlético Demo» → «ATL», «C.D. Rayo Pruebas» → «RAY»: the first 3 letters of the rival's main word. */
export function rivalShortOf(rival: string, override?: unknown): string {
  if (typeof override === "string" && override.trim()) return override.trim().slice(0, 4).toUpperCase();
  const words = rival.normalize("NFD").replace(/[̀-ͯ]/g, "").split(/[\s.\-/]+/).filter(Boolean);
  const SKIP = new Set(["cd", "cf", "ud", "sd", "fc", "club", "real", "de", "del", "la", "el", "los", "las", "sporting", "deportivo"]);
  const main = words.find((w) => w.length >= 3 && !SKIP.has(w.toLowerCase())) ?? words.find((w) => w.length >= 3) ?? words[0] ?? "RIV";
  return main.slice(0, 3).toUpperCase();
}
/** The crest's letters: the stored ones, else the first letters of two words («Atlético Demo» → «AD»). */
export function rivalInitialsOf(rival: string, stored?: string): string {
  if (stored && stored.trim()) return stored.trim().slice(0, 3).toUpperCase();
  const w = rival.split(/\s+/).filter(Boolean);
  return ((w[0]?.[0] ?? "R") + (w[1]?.[0] ?? w[0]?.[1] ?? "")).toUpperCase();
}

// ---------- who is on, for how long
const secondsOf = (e: Pick<MatchEvent, "elapsedSeconds" | "minute">): number => (typeof e.elapsedSeconds === "number" ? e.elapsedSeconds : (e.minute ?? 0) * 60);
const DISMISS = new Set(["red_card", "double_yellow"]);

/** Every player's stints (seconds of play), from the starters and the plays: a sub closes one and opens
 *  another (rolling subs: a player can come back), a red closes it for good. `now` closes nothing: open
 *  stints keep `to: null`. */
export function stintsOf(starters: readonly string[], events: readonly MatchEvent[]): Map<string, MesaStint[]> {
  const out = new Map<string, MesaStint[]>();
  const open = (id: string, at: number) => {
    const list = out.get(id) ?? [];
    if (!list.some((s) => s.to === null)) list.push({ from: at, to: null });
    out.set(id, list);
  };
  const close = (id: string, at: number) => {
    const s = out.get(id)?.find((x) => x.to === null);
    if (s) s.to = Math.max(s.from, at);
  };
  for (const id of starters) open(id, 0);
  const ordered = events.filter(counted).map((e, i) => ({ e, i })).sort((a, b) => secondsOf(a.e) - secondsOf(b.e) || a.i - b.i);
  for (const { e } of ordered) {
    const at = secondsOf(e);
    if (e.type === "substitution" && e.playerId && e.inPlayerId) {
      close(e.playerId, at);
      open(e.inPlayerId, at);
    } else if (DISMISS.has(e.type) && e.playerId) close(e.playerId, at);
  }
  return out;
}
/** Seconds played by the end of `now` (seconds of play). */
export const secondsPlayed = (stints: readonly MesaStint[] | undefined, now: number): number =>
  (stints ?? []).reduce((t, s) => t + Math.max(0, Math.min(s.to ?? now, now) - s.from), 0);

// ---------- where the shirts stand
/** Spot of a shirt in % of the pitch (x 0 → 100 left → right, y 0 = their goal → 100 = ours), the pizarra's frame. */
export interface Spot {
  x: number;
  y: number;
}
/** The default 2-3-1 by convocatoria order: keeper, the two at the back, the three in the middle, the striker. */
export const DEFAULT_SPOTS: readonly Spot[] = [
  { x: 50, y: 93 },
  { x: 30, y: 74 },
  { x: 70, y: 74 },
  { x: 16, y: 46 },
  { x: 50, y: 52 },
  { x: 84, y: 46 },
  { x: 50, y: 14 },
];
export const KEEPER_CODE: PosCode = "POR";

/** Where each player on the pitch stands and who keeps goal: the official board's codes (one who came on
 *  takes the code of the one he replaced), else the 2-3-1 by order. Two on one code are set apart. */
export function fieldSpots(field: readonly string[], starters: readonly string[], events: readonly MatchEvent[], codes: Readonly<Record<string, string>> | null): { spots: Map<string, Spot>; keeper: string | null } {
  const code = new Map<string, PosCode>();
  if (codes) for (const [id, c] of Object.entries(codes)) if (isPosCode(c)) code.set(id, c);
  // the default codes by order, for whoever the board doesn't place
  const byOrder = new Map<string, number>();
  starters.forEach((id, i) => byOrder.set(id, i));
  for (const e of [...events].filter(counted).sort((a, b) => secondsOf(a) - secondsOf(b))) {
    if (e.type !== "substitution" || !e.playerId || !e.inPlayerId) continue;
    if (code.has(e.playerId) && !code.has(e.inPlayerId)) code.set(e.inPlayerId, code.get(e.playerId)!);
    if (byOrder.has(e.playerId) && !byOrder.has(e.inPlayerId)) byOrder.set(e.inPlayerId, byOrder.get(e.playerId)!);
  }
  const spots = new Map<string, Spot>();
  const used = new Set<number>();
  let keeper: string | null = null;
  const taken: Spot[] = [];
  const place = (id: string, s: Spot) => {
    let p = { ...s };
    // (two shirts on one spot: the second one moves aside)
    for (let k = 0; taken.some((t) => Math.abs(t.x - p.x) < 14 && Math.abs(t.y - p.y) < 10) && k < 6; k++) p = { x: Math.max(10, Math.min(90, s.x + (k % 2 ? -1 : 1) * 20 * (Math.floor(k / 2) + 1))), y: s.y };
    taken.push(p);
    spots.set(id, p);
  };
  const free = () => {
    for (let i = 0; i < DEFAULT_SPOTS.length; i++) if (!used.has(i)) return i;
    return -1;
  };
  const coded = codes && field.some((id) => code.has(id));
  for (const id of field) {
    const c = coded ? code.get(id) : undefined;
    if (c) {
      if (c === KEEPER_CODE && !keeper) keeper = id;
      place(id, { x: POSITIONS[c].x, y: POSITIONS[c].y });
    }
  }
  for (const id of field) {
    if (spots.has(id)) continue;
    let i = byOrder.get(id) ?? -1;
    if (i < 0 || i >= DEFAULT_SPOTS.length || used.has(i)) i = free();
    if (i >= 0) used.add(i);
    if (i === 0 && !keeper) keeper = id;
    place(id, DEFAULT_SPOTS[i >= 0 ? i : 4]);
  }
  return { spots, keeper };
}

/** Where each one on the pitch stands with the match's lineup: his slot's spot now (lineupField: one who
 *  came on takes the slot of the one he replaced), and the keeper is whoever holds the POR slot. Anyone
 *  on the pitch the lineup doesn't place (it shouldn't happen) falls back to fieldSpots. */
export function lineupSpots(field: readonly string[], starters: readonly string[], events: readonly MatchEvent[], lineup: Pick<MatchLineup, "slots">): { spots: Map<string, Spot>; keeper: string | null } {
  const now = lineupField(lineup, events);
  const spots = new Map<string, Spot>();
  for (const s of now.spots) if (field.includes(s.id)) spots.set(s.id, { x: s.x, y: s.y });
  const rest = field.filter((id) => !spots.has(id));
  if (rest.length) {
    const fb = fieldSpots(rest, starters, events, null);
    for (const id of rest) spots.set(id, fb.spots.get(id) ?? { x: 50, y: 50 });
  }
  return { spots, keeper: now.keeper && field.includes(now.keeper) ? now.keeper : null };
}

/** The mesa's link to the pizarra: «desde la mesa» for this match, on its official board when known. */
export function pizarraHref(matchId: string, boardId?: string | null): string {
  const q = new URLSearchParams({ desde: "mesa", partido: matchId });
  if (boardId) q.set("tablero", boardId);
  return "/pizarra?" + q.toString();
}

/** The pizarra's frame (y 14 = the striker … 93 = the keeper) to the pitch card's top % (the canvas: 5 % … 71 %). */
export const pitchTop = (y: number): number => Math.max(2, Math.min(72, 5 + ((y - 14) * 66) / 79));
/** Kept inside the card so a name tag never clips. */
export const pitchLeft = (x: number): number => Math.max(13, Math.min(87, x));

// ---------- how a play is said
const TAGS: Partial<Record<string, string>> = {
  goal: "GOL", goal_penalty: "GOL", goal_freekick: "GOL", opponent_own_goal: "GOL", own_goal: "EN PROPIA",
  woodwork: "PALO", chance: "OCASIÓN", corner: "CÓRNER", foul: "FALTA", foul_received: "FALTA",
  yellow_card: "AMARILLA", double_yellow: "2ª AMARILLA", red_card: "ROJA", injury: "TOCADO", save: "PARADA",
  substitution: "CAMBIO", penalty_received: "PENALTI", penalty_committed: "PENALTI", penalty_saved: "PARADA", penalty_missed: "PENALTI",
  opponent_chance: "OCASIÓN", opponent_corner: "CÓRNER", opponent_foul: "FALTA", opponent_woodwork: "PALO",
  opponent_offside: "FUERA", opponent_yellow: "AMARILLA", opponent_red: "ROJA", opponent_penalty_missed: "PENALTI",
};
export function eventTag(type: string, rivalShort: string): string {
  if (type === "opponent_goal") return `GOL ${rivalShort}`;
  return TAGS[type] ?? (EVENT_LABELS[type as keyof typeof EVENT_LABELS] ?? type).toUpperCase();
}
export function eventSide(type: string): "us" | "them" {
  return type.startsWith("opponent_") ? "them" : "us";
}
/** «Gol de Mario, asistencia de Pablo», «Entra Hugo, sale Pablo», «Falta de Atlético Demo». */
export function eventText(e: Pick<MatchEvent, "type" | "playerId" | "assistPlayerId" | "inPlayerId">, nameOf: (id: string) => string, rival: string): string {
  const p = e.playerId ? nameOf(e.playerId) : "";
  const a = e.assistPlayerId ? nameOf(e.assistPlayerId) : "";
  switch (e.type) {
    case "goal": return p ? `Gol de ${p}${a ? `, asistencia de ${a}` : ""}` : "Gol del Piti, falta decir quién";
    case "goal_penalty": return p ? `Gol de penalti de ${p}` : "Gol de penalti";
    case "goal_freekick": return p ? `Gol de falta de ${p}${a ? `, asistencia de ${a}` : ""}` : "Gol de falta";
    case "opponent_own_goal": return `Autogol de ${rival}`;
    case "own_goal": return p ? `Gol en propia de ${p}` : "Gol en propia";
    case "opponent_goal": return `Gol de ${rival}`;
    case "woodwork": return p ? `Al palo, ${p}` : "Al palo";
    case "chance": return p ? `Ocasión de ${p}` : "Ocasión del Piti";
    case "corner": return p ? `Córner de ${p}` : "Córner del Piti";
    case "foul": return p ? `Falta de ${p}` : "Falta del Piti";
    case "foul_received": return p ? `Falta sobre ${p}` : "Falta a favor";
    case "yellow_card": return p ? `Amarilla a ${p}` : "Amarilla";
    case "double_yellow": return p ? `Segunda amarilla a ${p}` : "Segunda amarilla";
    case "red_card": return p ? `Roja a ${p}` : "Roja";
    case "injury": return p ? `${p}, tocado` : "Tocado";
    case "save": return p ? `Parada de ${p}` : "Parada";
    case "substitution": return e.inPlayerId ? `Entra ${nameOf(e.inPlayerId)}${p ? `, sale ${p}` : ""}` : p ? `Sale ${p}` : "Cambio";
    case "penalty_received": return p ? `Penalti a favor, sobre ${p}` : "Penalti a favor";
    case "penalty_committed": return p ? `Penalti en contra, de ${p}` : "Penalti en contra";
    case "penalty_saved": return p ? `Penalti parado por ${p}` : "Penalti parado";
    case "penalty_missed": return p ? `Penalti fallado por ${p}` : "Penalti fallado";
    case "opponent_chance": return `Ocasión de ${rival}`;
    case "opponent_corner": return `Córner para ${rival}`;
    case "opponent_foul": return `Falta de ${rival}`;
    case "opponent_woodwork": return `Al palo, ${rival}`;
    case "opponent_offside": return `Fuera de juego de ${rival}`;
    case "opponent_yellow": return `Amarilla a ${rival}`;
    case "opponent_red": return `Roja a ${rival}`;
    case "opponent_penalty_missed": return `Penalti fallado por ${rival}`;
    default: return EVENT_LABELS[e.type as keyof typeof EVENT_LABELS] ?? e.type;
  }
}

/** The vibration of a play: our goal two knocks and a long one, theirs one long, a sub two short, the rest a tap. */
export function buzzOf(type: string): number[] {
  if (OUR_GOALS.has(type)) return [40, 60, 140];
  if (THEIR_GOALS.has(type)) return [220];
  if (type === "substitution") return [20, 40, 20];
  return [25];
}

// ---------- the queue merged into the record
/** A play still on this phone, as the record shows it until the realtime doc has it. */
export interface LocalPlay {
  requestId: string;
  /** Its event id when it isn't `live-<requestId>` (a change of a wave: `live-<requestId>-<i>`). */
  id?: string;
  assistReviewed?: boolean;
  type: MesaType;
  playerId?: string;
  assistPlayerId?: string;
  inPlayerId?: string;
  tappedElapsed: number;
  period: 1 | 2;
}
export const liveId = (requestId: string): string => `live-${requestId}`;

export interface EventCtx {
  nameOf: (id: string) => string;
  rival: string;
  rivalShort: string;
  uid: string;
  /** Names of the people who wrote (uid → name), from presence and the scorers. */
  people: ReadonlyMap<string, string>;
}

/** The whole record la mesa shows: the server's plays, then this phone's queued ones not on the server yet. */
export function mesaEvents(server: readonly MatchEvent[] | undefined, local: readonly LocalPlay[], ctx: EventCtx): MesaEvent[] {
  const list = server ?? [];
  const ids = new Set(list.map((e) => e.id));
  const who = (uid: string | undefined) => (uid ? (uid === ctx.uid ? "Tú" : ctx.people.get(uid) ?? "Otro anotador") : null);
  const one = (e: MatchEvent, isLocal: boolean): MesaEvent => {
    const secs = typeof e.elapsedSeconds === "number" ? e.elapsedSeconds : null;
    const minute = secs != null ? minuteOfPlay(secs) : typeof e.minute === "number" ? e.minute : null;
    const g = goalSide(e.type);
    return {
      id: e.id,
      type: e.type,
      side: eventSide(e.type),
      minute,
      elapsedSeconds: secs,
      period: e.period ?? 1,
      playerId: e.playerId ?? null,
      playerName: e.playerId ? ctx.nameOf(e.playerId) : null,
      assistId: e.assistPlayerId ?? null,
      assistName: e.assistPlayerId ? ctx.nameOf(e.assistPlayerId) : null,
      inPlayerId: e.inPlayerId ?? null,
      inName: e.inPlayerId ? ctx.nameOf(e.inPlayerId) : null,
      text: eventText(e, ctx.nameOf, ctx.rival),
      tag: eventTag(e.type, ctx.rivalShort),
      goal: g,
      pendingScorer: g === "us" && e.type === "goal" && !e.playerId,
      assistReviewed: e.assistReviewed === true || !!e.assistPlayerId,
      byUid: e.byUid ?? null,
      byName: who(e.byUid),
      editedByUid: e.editedByUid ?? null,
      editedByName: who(e.editedByUid),
      editedAt: e.editedAt ?? null,
      dupOf: e.dupOf && e.dupOk !== true ? e.dupOf : null,
      queued: e.queued === true || isLocal,
      local: isLocal,
      mine: isLocal || (!!e.byUid && e.byUid === ctx.uid),
    };
  };
  const out = list.map((e) => one(e, false));
  for (const q of local) {
    const id = q.id ?? liveId(q.requestId);
    if (ids.has(id)) continue;
    out.push(one({ id, type: q.type, playerId: q.playerId, assistPlayerId: q.assistPlayerId, inPlayerId: q.inPlayerId, elapsedSeconds: q.tappedElapsed, period: q.period, byUid: ctx.uid, ...(q.assistReviewed ? { assistReviewed: true } : {}) }, true));
  }
  return out;
}

/** The record as plain match events (server + queued), for the line-up and the stickers. */
export function withLocal(server: readonly MatchEvent[] | undefined, local: readonly LocalPlay[], uid: string): MatchEvent[] {
  const list = [...(server ?? [])];
  const ids = new Set(list.map((e) => e.id));
  for (const q of local) {
    const id = q.id ?? liveId(q.requestId);
    if (!ids.has(id)) list.push({ id, type: q.type, playerId: q.playerId, assistPlayerId: q.assistPlayerId, inPlayerId: q.inPlayerId, elapsedSeconds: q.tappedElapsed, period: q.period, byUid: uid, queued: true });
  }
  return list;
}

// ---------- the players
export interface PlayerInfo {
  name: string;
  number: string;
  guest: boolean;
}
/** On the pitch now and on the bench, from the convocatoria and the record (queued plays included). */
export function mesaPlayers(
  starters: readonly string[],
  benchIds: readonly string[],
  events: readonly MatchEvent[],
  nowSeconds: number,
  info: (id: string) => PlayerInfo,
  codes: Readonly<Record<string, string>> | null,
  pendingBy: Readonly<Record<string, number>>,
  lineup: Pick<MatchLineup, "slots"> | null = null,
): { field: MesaPlayer[]; bench: MesaPlayer[] } {
  const stints = stintsOf(starters, events);
  const live = events.filter(counted);
  const sentOff = new Set(live.filter((e) => DISMISS.has(e.type) && e.playerId).map((e) => e.playerId as string));
  const called = [...new Set([...starters, ...benchIds])];
  const onPitch = called.filter((id) => stints.get(id)?.some((s) => s.to === null));
  const { spots, keeper } = lineup ? lineupSpots(onPitch, starters, live, lineup) : fieldSpots(onPitch, starters, live, codes);
  const stickers = (id: string) => {
    const mine = live.filter((e) => e.playerId === id);
    const yellows = mine.filter((e) => e.type === "yellow_card").length;
    return {
      goals: mine.filter((e) => e.type === "goal" || e.type === "goal_penalty" || e.type === "goal_freekick").length,
      assists: live.filter((e) => e.assistPlayerId === id && OUR_GOALS.has(e.type)).length,
      yellow: yellows > 0,
      red: mine.some((e) => DISMISS.has(e.type)) || yellows >= 2,
      injured: mine.some((e) => e.type === "injury"),
    };
  };
  const make = (id: string, onField: boolean): MesaPlayer => {
    const st = stints.get(id) ?? [];
    const last = st[st.length - 1];
    const i = info(id);
    return {
      id,
      name: i.name,
      number: i.number,
      guest: i.guest,
      keeper: onField && id === keeper,
      minutes: Math.floor(secondsPlayed(st, nowSeconds) / 60),
      stickers: stickers(id),
      pending: pendingBy[id] ?? 0,
      played: st.length > 0,
      offAt: !onField && last && last.to !== null ? minuteOfPlay(last.to, false) : null,
      sentOff: sentOff.has(id),
      stints: st.map((s) => ({ ...s })),
      spot: onField ? spots.get(id) ?? null : null,
    };
  };
  // the keeper first, then from the back to the front (the order the shirts are read in)
  const field = onPitch.map((id) => make(id, true)).sort((a, b) => Number(b.keeper) - Number(a.keeper) || (b.spot?.y ?? 0) - (a.spot?.y ?? 0) || (a.spot?.x ?? 0) - (b.spot?.x ?? 0));
  const bench = called.filter((id) => !onPitch.includes(id)).map((id) => make(id, false));
  return { field, bench };
}

/** The planned subs of a board doc (`lineups/{id}.subs`), malformed entries dropped. */
export function plannedSubsOf(raw: unknown): { min?: number; out: string; in: string }[] {
  return Array.isArray(raw)
    ? raw.flatMap((x: unknown) => {
        if (!x || typeof x !== "object") return [];
        const o = x as { min?: unknown; out?: unknown; in?: unknown };
        return typeof o.out === "string" && typeof o.in === "string" ? [{ out: o.out, in: o.in, ...(typeof o.min === "number" ? { min: o.min } : {}) }] : [];
      })
    : [];
}
/** The pizarra's next planned sub that can still be made: its out is on the pitch and its in on the bench. */
export function nextPlannedSub(subs: readonly { min?: number; out: string; in: string }[], field: readonly string[], bench: readonly string[], sentOff: ReadonlySet<string> = new Set()): { inId: string; outId: string } | null {
  const on = new Set(field);
  const off = new Set(bench);
  const next = [...subs].sort((a, b) => (a.min ?? 0) - (b.min ?? 0)).find((s) => on.has(s.out) && off.has(s.in) && !sentOff.has(s.in));
  return next ? { inId: next.in, outId: next.out } : null;
}
