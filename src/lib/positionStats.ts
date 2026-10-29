// «Ha jugado de» read back: minutes, events and rating by exact position for a player, the club's owner of
// each position, and the record of each system. Pure, from the finished matches already loaded: each
// acta's ledger[pid].positionsPlayed / positionEvents / positionsEstimated and the match's `system`
// (saveMatchSheet stores them; older actas lack them and simply add nothing).
import type { ClubMatch } from "./clubData";
import { isCompleted } from "../../functions/src/matchEngine";
import { SYSTEM_IDS, isFormationName, systemDef } from "./formations";
import { POS_CODES, isPosCode, type PosCode } from "./positions";
import { notesMean, type MatchNote, type SeasonRatings } from "./rating/season";
import { fixedPositions } from "../../functions/src/rating/fixed";
import { isGuestId } from "./derived/guests";

export interface PosLine {
  code: PosCode;
  minutes: number;
  matches: number;
  goals: number;
  assists: number;
  yellowCards: number;
  redCards: number;
  rating: number | null;
}
export interface PlayerPositions {
  /** Only codes with at least 1′ (rounded), by minutes desc (ties in catalogue order). */
  lines: PosLine[];
  /** The true sum of his position minutes (lines under 1′ included). */
  minutes: number;
  /** Matches where some of his minutes came from his preferida, not an official board. */
  estimatedMatches: number;
  /** Matches with minutes at some position. */
  matches: number;
  top: PosCode | null;
}

const round2 = (n: number) => Math.round(n * 100) / 100;
const order = (c: PosCode) => POS_CODES.indexOf(c);

/** Finished matches with a ledger: the only ones the position stats read. */
const counted = (games: readonly ClubMatch[]) => games.filter((m) => isCompleted(m) && m.ledger && typeof m.ledger === "object");

/** A row's minutes by code: valid codes with > 0 minutes only. */
function minutesByCode(pp: unknown): [PosCode, number][] {
  if (!pp || typeof pp !== "object") return [];
  return Object.entries(pp).filter((e): e is [PosCode, number] => isPosCode(e[0]) && typeof e[1] === "number" && e[1] > 0);
}

type Ev = { goals: number; assists: number; yellowCards: number; redCards: number };
const num = (v: unknown) => (typeof v === "number" && Number.isFinite(v) ? v : 0);
function eventsAt(pe: unknown, code: PosCode): Ev {
  const e = pe && typeof pe === "object" ? (pe as Record<string, unknown>)[code] : undefined;
  if (!e || typeof e !== "object") return { goals: 0, assists: 0, yellowCards: 0, redCards: 0 };
  const r = e as Record<string, unknown>;
  return { goals: num(r.goals), assists: num(r.assists), yellowCards: num(r.yellowCards), redCards: num(r.redCards) };
}

/**
 * A player's minutes, matches and events by exact position over the finished matches of `games`.
 *
 * `rating` is GLOBAL restricted to the matches where that code was his fixed position (where he started, or
 * first came on: the one his nota was rated in; when the acta cannot place him, his most-played code, ties in
 * catalogue order): his notas there (`ratings`: seasonRatings over the same period, so it is the card's own nota
 * of each match) on GLOBAL's scale, with its cushion and its rule for short matches. Null with fewer than 2 such
 * matches with a nota, or without `ratings` (the pages that only read the minutes).
 */
export function playerPositions(pid: string, games: ClubMatch[], ratings?: SeasonRatings): PlayerPositions {
  const lines = new Map<PosCode, PosLine>();
  const notes = new Map<PosCode, MatchNote[]>();
  let minutes = 0;
  let matches = 0;
  let estimatedMatches = 0;
  for (const m of counted(games)) {
    const row = isGuestId(pid) ? undefined : m.ledger?.[pid];
    // only a row that played has minutes anywhere: a stray key on a bench row never counts
    if (!row || row.played !== true) continue;
    const byCode = minutesByCode(row.positionsPlayed);
    if (row.positionsEstimated === true) estimatedMatches++;
    if (!byCode.length) continue;
    matches++;
    for (const [code, min] of byCode) {
      const l = lines.get(code) ?? { code, minutes: 0, matches: 0, goals: 0, assists: 0, yellowCards: 0, redCards: 0, rating: null };
      const e = eventsAt(row.positionEvents, code);
      l.minutes += min;
      l.matches++;
      l.goals += e.goals;
      l.assists += e.assists;
      l.yellowCards += e.yellowCards;
      l.redCards += e.redCards;
      lines.set(code, l);
      minutes += min;
    }
    // the match's nota counts for the rating of his fixed position, the one it was rated in (with minutes there);
    // else of his most-played code
    const note = ratings?.noteOf(m.id, pid);
    if (note) {
      const fixed = fixedPositions(m).get(pid);
      const code = fixed && byCode.some(([c]) => c === fixed) ? fixed : byCode.reduce((a, b) => (b[1] > a[1] || (b[1] === a[1] && order(b[0]) < order(a[0])) ? b : a))[0];
      notes.set(code, [...(notes.get(code) ?? []), note]);
    }
  }
  const list = [...lines.values()]
    .map((l) => {
      const n = notes.get(l.code) ?? [];
      return { ...l, minutes: round2(l.minutes), rating: n.length >= 2 ? Math.round(notesMean(n) * 10) / 10 : null };
    })
    // a line that would read «0′» is not a line (its minutes still count in the total)
    .filter((l) => Math.round(l.minutes) > 0)
    .sort((a, b) => b.minutes - a.minutes || order(a.code) - order(b.code));
  return { lines: list, minutes: round2(minutes), estimatedMatches, matches, top: list[0]?.code ?? null };
}

export { PLAYED_EMPTY, playedSummary } from "./playedSummary";

export interface ClubPosLine {
  code: PosCode;
  minutes: number;
  owner: { id: string; minutes: number } | null;
  players: number;
  goals: number;
  assists: number;
}

/** The club by position: all 13 codes in catalogue order, each with its minutes, events and «dueño» (the
 *  player with the most minutes there; ties by name via `nameOf`, then id). */
export function clubPositions(games: ClubMatch[], nameOf: (id: string) => string = (id) => id): ClubPosLine[] {
  const per = new Map<PosCode, { mins: Map<string, number>; goals: number; assists: number }>(POS_CODES.map((c) => [c, { mins: new Map(), goals: 0, assists: 0 }]));
  for (const m of counted(games))
    for (const [pid, row] of Object.entries(m.ledger ?? {})) {
      if (row?.played !== true || isGuestId(pid)) continue; // as playerPositions: only a member's row that played
      for (const [code, min] of minutesByCode(row.positionsPlayed)) {
        const c = per.get(code)!;
        const e = eventsAt(row.positionEvents, code);
        c.mins.set(pid, (c.mins.get(pid) ?? 0) + min);
        c.goals += e.goals;
        c.assists += e.assists;
      }
    }
  return POS_CODES.map((code) => {
    const c = per.get(code)!;
    const ranked = [...c.mins.entries()]
      .map(([id, min]) => ({ id, minutes: round2(min) }))
      // nobody «owns» or counts at a position with less than 1′ (no «0′» rows)
      .filter((o) => Math.round(o.minutes) > 0)
      .sort((a, b) => b.minutes - a.minutes || nameOf(a.id).localeCompare(nameOf(b.id), "es") || a.id.localeCompare(b.id));
    const sum = round2([...c.mins.values()].reduce((s, v) => s + v, 0));
    const minutes = Math.round(sum) > 0 ? sum : 0;
    return { code, minutes, owner: ranked[0] ?? null, players: ranked.length, goals: c.goals, assists: c.assists };
  });
}

export interface SystemLine {
  id: string;
  label: string;
  name: string;
  played: number;
  won: number;
  drawn: number;
  lost: number;
  gf: number;
  ga: number;
  points: number;
  ppg: number;
}

const LIBRE = "libre";
/** Catalogue order for ties ("libre" and anything else after the 15 systems). */
const systemOrder = (id: string) => (isFormationName(id) ? SYSTEM_IDS.indexOf(id) : SYSTEM_IDS.length);
const blankSystem = (id: string): SystemLine => ({
  id,
  ...(isFormationName(id) ? { label: systemDef(id).label, name: systemDef(id).name } : { label: "Libre", name: "Sin sistema fijo" }),
  played: 0,
  won: 0,
  drawn: 0,
  lost: 0,
  gf: 0,
  ga: 0,
  points: 0,
  ppg: 0,
});

/**
 * Each system's record over the finished matches with a ledger: a SYSTEM_IDS id or "libre" (free-mode
 * board, «Libre» · «Sin sistema fijo»). A match without an official board (system null, absent or not
 * a known id) counts in `withoutBoard`. Lines by played desc, then points per game desc.
 */
export function systemRecord(games: ClubMatch[]): { lines: SystemLine[]; withoutBoard: number } {
  const lines = new Map<string, SystemLine>();
  let withoutBoard = 0;
  for (const m of counted(games)) {
    const id = m.system;
    if (typeof id !== "string" || (id !== LIBRE && !isFormationName(id))) {
      withoutBoard++;
      continue;
    }
    const gf = num(m.goalsFor);
    const ga = num(m.goalsAgainst);
    const cur = lines.get(id) ?? blankSystem(id);
    cur.played++;
    cur.gf += gf;
    cur.ga += ga;
    if (gf > ga) cur.won++;
    else if (gf === ga) cur.drawn++;
    else cur.lost++;
    cur.points = cur.won * 3 + cur.drawn;
    cur.ppg = round2(cur.points / cur.played);
    lines.set(id, cur);
  }
  return { lines: [...lines.values()].sort((a, b) => b.played - a.played || b.ppg - a.ppg || systemOrder(a.id) - systemOrder(b.id)), withoutBoard };
}
