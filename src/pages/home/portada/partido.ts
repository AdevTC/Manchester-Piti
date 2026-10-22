// Inicio, «La portada»: a match as the boards read it, minute by minute. The plays in the club's words
// (playsLog, so a play never reads two ways), each with the boards' kind; who stood in each of the seven spots
// at every minute (the ledger's stints: in F7 a player comes back, in another spot when the one he swaps with
// left from there); the momentum per minute (the ribbon of «La moviola»); the ledger rows (minutes, stints,
// exchanges, goals). Pure: built once per match and minute edge, read by the lens, the pitch, the plays and
// the screens /hoy/campo, /hoy/jugadas and /hoy/lo-tuyo.
import type { ClubMatch, MatchEvent, Participation } from "../../../lib/clubData";
import { calculateLedger } from "../../../../functions/src/matchEngine";
import { settled } from "../../../lib/eventMeta";
import { playsLog } from "../../../lib/derived/vidrio/plays";
import { edgeMinute } from "../../../lib/derived/vidrio/rotation";
import { parseMatchLineup } from "../../../lib/matchLineup";

/** The boards' kinds of play. */
export type PlayK =
  | "gol"
  | "rival"
  | "amarilla"
  | "roja"
  | "rivalAmarilla"
  | "rivalRoja"
  | "cambio"
  | "penalti"
  | "parada"
  | "paradaPenalti"
  | "palo"
  | "ocasion"
  | "rivalOcasion"
  | "corner"
  | "rivalCorner"
  | "falta"
  | "faltaRecibida"
  | "otro";

const KIND: Record<string, PlayK> = {
  goal: "gol",
  goal_penalty: "gol",
  goal_freekick: "gol",
  opponent_own_goal: "gol",
  opponent_goal: "rival",
  own_goal: "rival",
  yellow_card: "amarilla",
  red_card: "roja",
  double_yellow: "roja",
  opponent_yellow: "rivalAmarilla",
  opponent_red: "rivalRoja",
  substitution: "cambio",
  penalty_committed: "penalti",
  save: "parada",
  penalty_saved: "paradaPenalti",
  woodwork: "palo",
  chance: "ocasion",
  penalty_missed: "ocasion",
  opponent_chance: "rivalOcasion",
  opponent_woodwork: "rivalOcasion",
  opponent_penalty_missed: "rivalOcasion",
  corner: "corner",
  opponent_corner: "rivalCorner",
  foul: "falta",
  foul_received: "faltaRecibida",
  penalty_received: "faltaRecibida",
  opponent_foul: "faltaRecibida",
};

/** A play's kind as the boards draw it. */
export const playK = (type: string): PlayK => KIND[type] ?? "otro";

/** The marks the moviola draws and the plays «La jugada anterior / siguiente» stop at. */
export const KEY_PLAY: ReadonlySet<PlayK> = new Set(["gol", "rival", "amarilla", "roja", "rivalAmarilla", "rivalRoja", "penalti", "paradaPenalti", "palo"]);
export const isCard = (k: PlayK) => k === "amarilla" || k === "roja" || k === "rivalAmarilla" || k === "rivalRoja";

export interface Play {
  id: string;
  /** The minute people read (eventMinute, 1-based while live); 0 for a play written without one. */
  m: number;
  k: PlayK;
  /** Ours, or theirs (their plays, and the penalty given against us). */
  side: "us" | "them";
  /** The player it names: the scorer, the one carded, the one who comes in. */
  who: string | null;
  /** A change: the one who goes off. */
  out: string | null;
  assist: string | null;
  /** «Gol de Alcides», «Córner para Orduña fc». */
  title: string;
  /** «Pase de Jordi», «Disparo de Alcides», or "". */
  sub: string;
}

export interface LedgerRow {
  /** Whole minutes on the pitch. */
  min: number;
  /** His stints, in minutes of the match (fractions while the clock ran). */
  st: [number, number][];
  /** His changes: [the minute it happened in, the other player, 1 = he came in]. */
  ex: [number, string, 0 | 1][];
  g: number;
  a: number;
  sv: number;
  /** Minutes by position («Ha jugado de»), when the acta has them. */
  pos: Record<string, number> | null;
}

export interface Slot {
  id: string;
  /** The pizarra's position code (POR, LI, DFC, LD, MC, DC…). */
  code: string;
  /** Left → right, 0–100. */
  x: number;
  /** Their goal (0) → ours (100). */
  y: number;
}

export interface Partido {
  match: ClubMatch;
  duration: number;
  /** The seven the night started with, on the pizarra's spots. */
  lineup: Slot[];
  /** Ascending. */
  plays: Play[];
  ledger: Record<string, LedgerRow>;
  /** Who stands in each spot of `lineup`, minute 0 … duration. */
  onAt: (string | null)[][];
  /** The momentum per minute 0 … duration: + ours, − theirs (−9 … 9). */
  pulse: number[];
}

/** The spots of a 3-2-1 for a match the pizarra never sent (an old acta): the starters in their order. */
const FALLBACK: readonly Omit<Slot, "id">[] = [
  { code: "POR", x: 50, y: 95 },
  { code: "LI", x: 18, y: 72 },
  { code: "DFC", x: 50, y: 74 },
  { code: "LD", x: 82, y: 72 },
  { code: "MC", x: 25, y: 46 },
  { code: "MC", x: 75, y: 46 },
  { code: "DC", x: 50, y: 22 },
];

/** The seven's spots: the pizarra's when the match has a lineup, else the starters on a 3-2-1. */
export function lineupOf(match: Pick<ClubMatch, "starters"> & { lineup?: unknown }): Slot[] {
  const l = parseMatchLineup(match.lineup);
  if (l) return l.slots.map((s) => ({ id: s.playerId, code: s.code, x: s.x, y: s.y }));
  return (match.starters ?? []).slice(0, FALLBACK.length).map((id, i) => ({ id, ...FALLBACK[i] }));
}

/** The ledger of `match` up to `until` (undefined: the whole match). A published acta's own ledger when it has
 *  stints, else its plays walked (as rotationOf walks them). */
export function ledgerOf(match: ClubMatch, until?: number): Record<string, LedgerRow> {
  const list = settled(match.events ?? []);
  const stored = until === undefined && match.status === "finished" && match.ledger && Object.values(match.ledger).some((p) => p.played) && Object.values(match.ledger).every((p) => !p.played || Array.isArray(p.stints)) ? match.ledger : null;
  let players: Record<string, Participation>;
  if (stored) players = stored;
  else {
    const lastMinute = Math.max(0, ...list.map((e) => e.minute ?? 0));
    const duration = Math.max(match.duration ?? 50, lastMinute, Math.ceil(until ?? 0));
    const starters = match.starters ?? [];
    const known = new Set([...starters, ...(match.bench ?? []), ...(match.notCalled ?? [])]);
    const extra = [...new Set(list.flatMap((e) => [e.playerId, e.inPlayerId]).filter((id): id is string => !!id && !known.has(id)))];
    players = calculateLedger(
      { starters, bench: [...(match.bench ?? []), ...extra], notCalled: match.notCalled ?? [], events: list as MatchEvent[], duration, guests: match.guests },
      false,
      { until: until ?? duration, allowUnattributedGoals: true },
    ).players;
  }
  const out: Record<string, LedgerRow> = {};
  const end = match.duration && match.duration > 0 ? Math.round(match.duration) : 50;
  for (const [id, p] of Object.entries(players)) {
    const st = (p.stints ?? []).map((s): [number, number] => [s.from, s.to]).filter((s) => s[1] > s[0]);
    if (!st.length) continue;
    const min = Math.round(st.reduce((t, s) => t + s[1] - s[0], 0));
    // (live, the walk closes whoever is on the pitch at the clock's minute: he is still there, his stint stays
    // open; every reader clips it to the moviola's minute, which never passes the clock)
    const open = until === undefined ? st : st.map((s): [number, number] => (s[1] >= until - 1e-6 ? [s[0], Math.max(end, s[1])] : s));
    out[id] = {
      min,
      st: open,
      ex: (p.exchanges ?? []).map((x): [number, string, 0 | 1] => [edgeMinute(x.minute), x.with, x.direction === "in" ? 1 : 0]),
      g: p.goals ?? 0,
      a: p.assists ?? 0,
      sv: p.saves ?? 0,
      pos: p.positionsPlayed && Object.keys(p.positionsPlayed).length ? (p.positionsPlayed as Record<string, number>) : null,
    };
  }
  return out;
}

/** On the pitch at minute `m` (the minute reached: a change in the 19′ stands at 19). */
export function onFieldAt(row: Pick<LedgerRow, "st"> | undefined, m: number, duration: number): boolean {
  if (!row) return false;
  const t = Math.min(m, duration - 0.01);
  return row.st.some(([a, b]) => a <= t && t < b);
}

/** His stints clipped to minute `m`, and his whole minutes by then. */
export function stintsAt(row: Pick<LedgerRow, "st"> | undefined, m: number): { st: [number, number][]; min: number } {
  if (!row) return { st: [], min: 0 };
  const st = row.st.filter(([a]) => a < m || (a === m && m === 0)).map(([a, b]): [number, number] => [a, Math.min(b, m)]);
  return { st, min: Math.round(st.reduce((t, [a, b]) => t + Math.max(0, b - a), 0)) };
}

/** Who stands in each spot, minute by minute: the one who leaves frees his spot; the one who comes in takes the
 *  spot of the player he swapped with (his exchange that minute), else any free one. */
export function onPitch(lineup: readonly Slot[], ledger: Record<string, LedgerRow>, duration: number): (string | null)[][] {
  const ids = Object.keys(ledger);
  let slots = lineup.map((s) => (onFieldAt(ledger[s.id], 0, duration) ? s.id : null));
  const out = [slots.slice()];
  let prev = new Set(ids.filter((i) => onFieldAt(ledger[i], 0, duration)));
  for (let t = 1; t <= duration; t++) {
    const cur = new Set(ids.filter((i) => onFieldAt(ledger[i], t, duration)));
    const leaving = [...prev].filter((i) => !cur.has(i));
    const entering = [...cur].filter((i) => !prev.has(i) && !slots.includes(i));
    const freed: { k: number; who: string | null }[] = [];
    slots = slots.map((s, k) => {
      if (s && leaving.includes(s)) {
        freed.push({ k, who: s });
        return null;
      }
      return s;
    });
    for (let k = 0; k < slots.length; k++) if (!slots[k] && !freed.some((f) => f.k === k)) freed.push({ k, who: null });
    entering
      .sort((a, b) => a.localeCompare(b))
      .forEach((p) => {
        const ex = ledger[p].ex.find((x) => x[2] === 1 && x[0] <= t && x[0] > t - 1.5);
        let f = ex ? freed.find((x) => x.who === ex[1] && slots[x.k] == null) : undefined;
        if (!f) f = freed.find((x) => slots[x.k] == null);
        if (f) slots[f.k] = p;
      });
    out.push(slots.slice());
    prev = cur;
  }
  return out;
}

const WEIGHT: Partial<Record<PlayK, number>> = { gol: 9, rival: -9, ocasion: 3, rivalOcasion: -3, corner: 2, rivalCorner: -2, parada: -2, paradaPenalti: -3, palo: 3, penalti: -4, faltaRecibida: 1, falta: -1 };

/** The momentum per minute 0 … duration (+ ours, − theirs), each play weighed and smoothed over its neighbours. */
export function pulseOf(plays: readonly Pick<Play, "m" | "k">[], duration: number): number[] {
  const raw = Array.from({ length: duration + 1 }, () => 0);
  for (const p of plays) {
    const w = WEIGHT[p.k];
    if (w) raw[Math.max(0, Math.min(duration, p.m))] += w;
  }
  return raw.map((_, i) => {
    let s = 0;
    for (let d = -3; d <= 3; d++) {
      const v = raw[i + d];
      if (v !== undefined) s += v * Math.exp(-(d * d) / 3.2);
    }
    return Math.max(-9, Math.min(9, Math.round(s * 10) / 10));
  });
}

/** The match's plays in the boards' terms, ascending. */
export function playsOf(match: ClubMatch, nameOf: (id: string) => string): Play[] {
  const log = playsLog(match, nameOf);
  return log.rows
    .slice()
    .reverse()
    .map((r): Play => {
      const e = r.event;
      const k = playK(e.type);
      const sub = k === "cambio";
      // (the boards' words where they say it their way: a goal's second line is the pass only, theirs says «De
      // cabeza», a penalty against us is «Penalti en contra» · «Le pitan a Jordi»)
      const who = e.playerId ? nameOf(e.playerId) : "";
      const rival = match.rival?.trim() || "el rival";
      const BOARD: Partial<Record<PlayK, [string, string]>> = {
        gol: [e.type === "opponent_own_goal" ? `Gol en propia de ${rival}` : who ? `Gol de ${who}` : "Gol del Piti", e.assistPlayerId ? `Pase de ${nameOf(e.assistPlayerId)}` : ""],
        rival: [e.type === "own_goal" ? `Gol en propia de ${who}` : `Gol de ${rival}`, (e as { bodyPart?: string }).bodyPart === "head" ? "De cabeza" : ""],
        amarilla: [`Amarilla a ${who}`, ""],
        roja: [`Roja a ${who}`, ""],
        rivalAmarilla: [`Amarilla a ${rival}`, ""],
        rivalRoja: [`Roja a ${rival}`, ""],
        penalti: ["Penalti en contra", who ? `Le pitan a ${who}` : ""],
        parada: [`Parada de ${who}`, ""],
        paradaPenalti: ["Penalti parado", who],
        palo: ["Al palo", who ? `Disparo de ${who}` : ""],
        ocasion: [who ? `Ocasión de ${who}` : "Ocasión del Piti", ""],
        rivalOcasion: [`Llegada de ${rival}`, ""],
        corner: ["Córner para el Piti", who ? `Lo saca ${who}` : ""],
        rivalCorner: [`Córner para ${rival}`, ""],
        falta: [`Falta de ${who}`, ""],
        faltaRecibida: [who ? `Falta sobre ${who}` : `Falta de ${rival}`, ""],
      };
      const said = sub ? null : BOARD[k];
      // (a play the boards don't name keeps the site's own sentence)
      const usable = said && (!said[0].endsWith(" ") && !/ de $| a $/.test(said[0]));
      const title = usable && said ? said[0] : r.title;
      const line = usable && said ? said[1] : r.sub;
      return {
        id: r.id,
        m: r.minute ?? 0,
        k,
        side: k === "penalti" || k === "rival" || k.startsWith("rival") ? "them" : "us",
        who: (sub ? e.inPlayerId : e.type === "opponent_own_goal" ? null : e.playerId) ?? null,
        out: sub ? (e.playerId ?? null) : null,
        assist: e.assistPlayerId ?? null,
        title,
        sub: line,
      };
    });
}

/** The whole match, read once. `until`: the minute the clock has reached while live (undefined after). */
export function partidoOf(match: ClubMatch, nameOf: (id: string) => string, until?: number): Partido {
  const duration = match.duration && match.duration > 0 ? Math.round(match.duration) : 50;
  const plays = playsOf(match, nameOf).filter((p) => until === undefined || p.m <= Math.ceil(until));
  const lineup = lineupOf(match);
  const ledger = ledgerOf(match, until);
  return { match, duration, lineup, plays, ledger, onAt: onPitch(lineup, ledger, duration), pulse: pulseOf(plays, duration) };
}

/** Our goals and theirs by minute `m`. */
export function scoreAt(plays: readonly Pick<Play, "m" | "k">[], m: number): { us: number; them: number } {
  let us = 0;
  let them = 0;
  for (const p of plays) {
    if (p.m > m) continue;
    if (p.k === "gol") us++;
    if (p.k === "rival") them++;
  }
  return { us, them };
}
