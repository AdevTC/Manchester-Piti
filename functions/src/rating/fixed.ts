// Each player's fixed position in a match (the «puesto fijo»): where he started — the match's lineup
// (matches/{id}.lineup); without one, the starting codes that make the acta's changes reproduce its minutes by
// position — or, for a substitute, where he first came on (whoever comes on takes the place of whoever goes off, or the
// place a red left empty; a «Cambio de sitio» trades two places), the acta's changes read as its ledger reads them. It
// decides everything the position decides in his nota. Pure, memoized per match object.
import { isPendingDup, type MatchEvent } from "../matchEngine.js";
import { eventSeconds } from "../matchAnalysis.js";
import { isPosCode, type PosCode } from "../positions.js";
import { durationOf, type RatingMatch } from "./types.js";

/** Above this many starting combinations the search keeps each starter's code with the most minutes. */
const MAX_COMBINATIONS = 4096;
const SENT_OFF = new Set(["red_card", "double_yellow"]);

interface Move {
  minute: number;
  type: "in" | "swap" | "off";
  a: string;
  b?: string;
}
function movesOf(m: RatingMatch): Move[] {
  return (m.events ?? [])
    .map((e: MatchEvent, i) => ({ e, i }))
    .filter(({ e }) => !isPendingDup(e) && typeof e.playerId === "string" && (e.type === "substitution" || e.type === "position_swap" || SENT_OFF.has(e.type)))
    .sort((x, y) => eventSeconds(x.e) - eventSeconds(y.e) || x.i - y.i)
    .map(({ e }) => ({ minute: eventSeconds(e) / 60, type: e.type === "substitution" ? ("in" as const) : e.type === "position_swap" ? ("swap" as const) : ("off" as const), a: e.playerId!, b: e.inPlayerId }));
}

/** The match from `start` on: each player's first code, and his minutes at each code. */
function replay(start: ReadonlyMap<string, PosCode>, moves: readonly Move[], duration: number) {
  const code = new Map(start);
  const first = new Map(start);
  const minutes = new Map<string, number>();
  /** The place each red left empty (someone from the bench may take it, once). */
  const vacated = new Map<string, PosCode>();
  let t = 0;
  const flush = (to: number) => {
    const until = Math.max(t, Math.min(duration, to));
    for (const [pid, c] of code) minutes.set(`${pid}|${c}`, (minutes.get(`${pid}|${c}`) ?? 0) + until - t);
    t = until;
  };
  for (const mv of moves) {
    flush(mv.minute);
    const c = code.get(mv.a);
    if (mv.type === "in") {
      const place = c ?? vacated.get(mv.a);
      if (!place || !mv.b || code.has(mv.b)) continue;
      if (c) code.delete(mv.a);
      else vacated.delete(mv.a);
      code.set(mv.b, place);
      if (!first.has(mv.b)) first.set(mv.b, place);
    } else if (mv.type === "swap") {
      const other = mv.b ? code.get(mv.b) : undefined;
      if (c && other && mv.b) {
        code.set(mv.a, other);
        code.set(mv.b, c);
      }
    } else if (c) {
      code.delete(mv.a);
      vacated.set(mv.a, c);
    }
  }
  flush(duration);
  return { first, minutes };
}

/** The lineup's seven, read defensively; none when they are not the acta's starters (an acta that changed the seven
 *  keeps no lineup, as publishSheet does). */
function lineupStart(lineup: unknown, starters: readonly string[]): Map<string, PosCode> | null {
  const slots = lineup && typeof lineup === "object" ? (lineup as { slots?: unknown }).slots : null;
  if (!Array.isArray(slots) || slots.length !== 7) return null;
  const start = new Map<string, PosCode>();
  for (const s of slots) {
    const slot = s && typeof s === "object" ? (s as { playerId?: unknown; code?: unknown }) : null;
    if (!slot || typeof slot.playerId !== "string" || !isPosCode(slot.code) || start.has(slot.playerId)) return null;
    start.set(slot.playerId, slot.code);
  }
  if (starters.length && (starters.length !== start.size || starters.some((id) => !start.has(id)))) return null;
  return start.size === 7 ? start : null;
}

/** Two starts reproduce the acta's minutes equally well when their errors differ by less than this (minutes). */
const TIE = 0.01;

/** Without a lineup: each player's first code under the starts (each starter at one of his acta codes) that best
 *  reproduce the acta's minutes by position — only where every such start agrees: when the acta cannot tell (a swap
 *  right at half-time, say), his minutes in each position decide instead. A starter the acta gives no code (a guest:
 *  the stored ledger holds members only) is left unplaced, and so is whoever comes on for him. */
function inferredFirsts(m: RatingMatch, starters: readonly string[], moves: readonly Move[], duration: number): Map<string, PosCode> {
  const played = (pid: string) =>
    Object.entries(m.ledger?.[pid]?.positionsPlayed ?? {})
      .filter((e): e is [PosCode, number] => isPosCode(e[0]) && typeof e[1] === "number" && e[1] > 0)
      .sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0]));
  const placed = starters.map((pid) => ({ pid, options: played(pid).map(([c]) => c) })).filter((s) => s.options.length);
  if (!placed.length) return new Map();
  const combinations = placed.reduce((n, s) => n * s.options.length, 1);
  const choices = combinations > MAX_COMBINATIONS ? placed.map((s) => [s.options[0]]) : placed.map((s) => s.options);
  const target = Object.entries(m.ledger ?? {}).flatMap(([pid, r]) => Object.entries(r?.positionsPlayed ?? {}).filter(([c, min]) => isPosCode(c) && typeof min === "number").map(([c, min]) => [`${pid}|${c}`, min as number] as const));
  let best = Infinity;
  let agreed = new Map<string, PosCode>();
  const pick: PosCode[] = [];
  const walk = (i: number) => {
    if (i === placed.length) {
      const { first, minutes } = replay(new Map(placed.map((s, k) => [s.pid, pick[k]] as const)), moves, duration);
      const error = target.reduce((s, [k, min]) => s + Math.abs((minutes.get(k) ?? 0) - min), 0);
      if (error < best - TIE) {
        best = error;
        agreed = new Map(first);
      } else if (error <= best + TIE) {
        best = Math.min(best, error);
        for (const [pid, c] of agreed) if (first.get(pid) !== c) agreed.delete(pid);
      }
      return;
    }
    for (const c of choices[i]) {
      pick[i] = c;
      walk(i + 1);
    }
  };
  walk(0);
  return agreed;
}

const memo = new WeakMap<RatingMatch, Map<string, PosCode>>();
/** playerId → his fixed position this match (missing for whoever the acta cannot place). */
export function fixedPositions(m: RatingMatch): Map<string, PosCode> {
  let hit = memo.get(m);
  if (!hit) {
    const duration = typeof m.durationSeconds === "number" && m.durationSeconds > 0 ? m.durationSeconds / 60 : durationOf(m);
    const moves = movesOf(m);
    const starters = (m.starters ?? []).filter((id): id is string => typeof id === "string");
    const start = lineupStart(m.lineup, starters);
    hit = start ? replay(start, moves, duration).first : inferredFirsts(m, starters, moves, duration);
    memo.set(m, hit);
  }
  return hit;
}
