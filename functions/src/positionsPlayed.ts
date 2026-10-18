// «Ha jugado de»: de un acta publicada (su ledger y sus eventos) y de la pizarra oficial del partido,
// cuántos minutos jugó cada uno en cada posición exacta y qué goles, asistencias y tarjetas vinieron
// de ahí. Puro: lo usan saveMatchSheet, el relleno de actas antiguas y sus tests.
import { boardCodeByPlayer, boardSystem, type BoardLike } from "./boardCodes.js";
import type { MatchEvent, Participation } from "./matchEngine.js";
import { SAFE_ID } from "./officialBoard.js";
import type { PosCode } from "./positions.js";

export interface PositionEvents {
  goals: number;
  assists: number;
  yellowCards: number;
  redCards: number;
}
export interface PositionsRow {
  positionsPlayed: Partial<Record<PosCode, number>>;
  positionEvents: Partial<Record<PosCode, PositionEvents>>;
  positionsEstimated: boolean;
}

type LedgerRow = Pick<Participation, "started" | "stints" | "exchanges">;
type EventLike = Pick<MatchEvent, "type" | "playerId" | "assistPlayerId" | "minute" | "elapsedSeconds">;
interface Coded {
  code: PosCode;
  estimated: boolean;
}

const GOALS = new Set<string>(["goal", "goal_penalty", "goal_freekick"]);
const round2 = (n: number): number => Math.round(n * 100) / 100;

/**
 * Per player with at least one coded stint: minutes by exact position and the goals, assists and
 * cards that fell in each. A starter on the board takes his slot's code; one off the board, or every
 * starter without a board, takes his main (estimated); a starter without a main gets no code. A stint
 * that starts later (a substitute, or a player coming back) takes the code of the stint that the
 * player he came in for ends at that minute (or, for a player sent off earlier, his last), «estimado» included; when that one has no code, his own
 * main (estimated). An event counts at the stint that contains its minute (from ≤ t < to) or, when
 * none does, at the one that ends right then (his last minute: a red card, the minute he is
 * substituted, the final whistle); elsewhere (a card on the bench) it is not attributed. At a
 * substitution minute t the one coming in owns t (his stint starts there), so his card at t counts at
 * the position he inherited; the one going off only gets t through the stint that ends there.
 * `positionsEstimated` is set only when an estimated stint gave him minutes.
 */
export function positionsPlayed(
  ledger: Record<string, LedgerRow>,
  events: EventLike[],
  codes: { board: Record<string, PosCode> | null; main: Record<string, PosCode | null> },
): Record<string, PositionsRow> {
  const stintsOf = (pid: string) => {
    const p = ledger[pid];
    return p && Array.isArray(p.stints) ? p.stints : [];
  };
  const ownMain = (pid: string): Coded | null => {
    const m = codes.main[pid];
    return m ? { code: m, estimated: true } : null;
  };
  const starterCode = (pid: string): Coded | null => {
    const b = codes.board?.[pid];
    return b ? { code: b, estimated: false } : ownMain(pid);
  };

  const memo = new Map<string, Coded | null>();
  const resolving = new Set<string>();
  const resolve = (pid: string, i: number): Coded | null => {
    const key = `${pid}\u0000${i}`;
    if (memo.has(key)) return memo.get(key) ?? null;
    if (resolving.has(key)) return null; // a malformed exchange loop: no code rather than forever
    resolving.add(key);
    const p = ledger[pid];
    const stints = stintsOf(pid);
    const s = stints[i];
    let out: Coded | null;
    if (p.started && s.from === 0) out = starterCode(pid);
    else {
      // the k-th stint of his that starts at this minute is the k-th time he came in at it
      const k = stints.slice(0, i).filter((x) => x.from === s.from).length;
      const ins = (Array.isArray(p.exchanges) ? p.exchanges : []).filter((x) => x.direction === "in" && x.minute === s.from);
      const ex = ins[k];
      const theirs = ex ? stintsOf(ex.with) : [];
      let j = -1;
      for (let n = theirs.length - 1; n >= 0; n--)
        // (the one he came in for left right then; or earlier, sent off: his slot waited for him)
        if (theirs[n].to <= s.from && !(ex?.with === pid && n === i)) {
          j = n;
          break;
        }
      const inherited = ex && j >= 0 ? resolve(ex.with, j) : null;
      out = inherited ?? ownMain(pid);
    }
    resolving.delete(key);
    memo.set(key, out);
    return out;
  };

  // resolve is memoised and recursive, so the order stints are visited in does not matter: a chain
  // (a substitute for a substitute) resolves through whoever he replaced.
  const rows: Record<string, PositionsRow> = {};
  const minutes: Record<string, Partial<Record<PosCode, number>>> = {};
  for (const pid of Object.keys(ledger))
    stintsOf(pid).forEach((s, i) => {
      const c = resolve(pid, i);
      if (!c) return;
      const length = Math.max(0, s.to - s.from);
      rows[pid] ??= { positionsPlayed: {}, positionEvents: {}, positionsEstimated: false };
      if (c.estimated && length > 0) rows[pid].positionsEstimated = true;
      const m = (minutes[pid] ??= {});
      m[c.code] = (m[c.code] ?? 0) + length;
    });
  for (const [pid, m] of Object.entries(minutes)) {
    for (const [code, raw] of Object.entries(m) as [PosCode, number][]) {
      const v = round2(raw);
      if (v > 0) rows[pid].positionsPlayed[code] = v;
    }
    // «estimado» only describes minutes he has: never on a row with none listed
    if (Object.keys(rows[pid].positionsPlayed).length === 0) rows[pid].positionsEstimated = false;
  }

  const codeAt = (pid: string | undefined, t: number): PosCode | null => {
    if (!pid || !rows[pid]) return null;
    const stints = stintsOf(pid);
    let i = stints.findIndex((s) => s.from <= t && t < s.to);
    if (i < 0)
      for (let n = stints.length - 1; n >= 0; n--)
        if (stints[n].to === t) {
          i = n;
          break;
        }
    return i >= 0 ? (resolve(pid, i)?.code ?? null) : null;
  };
  const bump = (pid: string | undefined, t: number, key: keyof PositionEvents) => {
    const code = codeAt(pid, t);
    if (!code || !pid) return;
    const pe = rows[pid].positionEvents;
    const cur = (pe[code] ??= { goals: 0, assists: 0, yellowCards: 0, redCards: 0 });
    cur[key]++;
  };
  for (const e of events) {
    const t = e.elapsedSeconds != null ? e.elapsedSeconds / 60 : e.minute;
    if (typeof t !== "number" || !Number.isFinite(t)) continue;
    if (GOALS.has(e.type)) {
      bump(e.playerId, t, "goals");
      bump(e.assistPlayerId, t, "assists");
    } else if (e.type === "assist") bump(e.playerId, t, "assists");
    else if (e.type === "yellow_card") bump(e.playerId, t, "yellowCards");
    else if (e.type === "double_yellow") {
      bump(e.playerId, t, "yellowCards");
      bump(e.playerId, t, "redCards");
    } else if (e.type === "red_card") bump(e.playerId, t, "redCards");
  }
  return rows;
}

/** What a ledger row stores from a {@link PositionsRow}: empty maps and a false «estimado» are left out. */
export function positionFields(row: PositionsRow): Pick<Participation, "positionsPlayed" | "positionEvents" | "positionsEstimated"> {
  return {
    ...(Object.keys(row.positionsPlayed).length ? { positionsPlayed: row.positionsPlayed } : {}),
    ...(Object.keys(row.positionEvents).length ? { positionEvents: row.positionEvents } : {}),
    ...(row.positionsEstimated ? { positionsEstimated: true as const } : {}),
  };
}

const POSITION_KEYS = ["positionsPlayed", "positionEvents", "positionsEstimated"] as const;

type PositionsLedger = Record<string, Pick<Participation, "positionsPlayed" | "positionEvents" | "positionsEstimated">>;
const clearPositions = (players: PositionsLedger) => {
  for (const p of Object.values(players)) for (const key of POSITION_KEYS) delete p[key];
};

/** Puts each player's {@link positionFields} on the ledger, replacing whatever position keys it had. */
export function withPositions(players: PositionsLedger, rows: Record<string, PositionsRow>): void {
  clearPositions(players);
  for (const [pid, row] of Object.entries(rows)) if (players[pid]) Object.assign(players[pid], positionFields(row));
}

/** What decides where a player's minutes and actions fall: if none of it changed, neither did they. */
const ATTRIBUTION_KEYS = ["stints", "exchanges", "goals", "assists", "yellowCards", "redCards"] as const;
type CorrectionLedger = Record<string, PositionsLedger[string] & Partial<Pick<Participation, (typeof ATTRIBUTION_KEYS)[number]>>>;

/**
 * The board could not be read during a correction. A player keeps the position keys his stored row had
 * (a stored ledger from the match doc, possibly missing or odd) only when what places his minutes and
 * actions is unchanged — his stints, exchanges, goals, assists, yellow and red cards; otherwise (or with
 * nothing stored for him) he gets `fallback`'s row: the estimate by preferred position, «estimado».
 */
export function keepStoredPositions(players: CorrectionLedger, stored: unknown, fallback: Record<string, PositionsRow>): void {
  clearPositions(players);
  const old = stored && typeof stored === "object" ? (stored as Record<string, unknown>) : {};
  for (const [pid, p] of Object.entries(players)) {
    const row: unknown = old[pid];
    const r = row && typeof row === "object" ? (row as Record<string, unknown>) : null;
    if (r && ATTRIBUTION_KEYS.every((k) => same(r[k], p[k]))) {
      if (r.positionsPlayed && typeof r.positionsPlayed === "object") p.positionsPlayed = r.positionsPlayed as PositionsLedger[string]["positionsPlayed"];
      if (r.positionEvents && typeof r.positionEvents === "object") p.positionEvents = r.positionEvents as PositionsLedger[string]["positionEvents"];
      if (r.positionsEstimated === true) p.positionsEstimated = true;
    } else if (fallback[pid]) Object.assign(p, positionFields(fallback[pid]));
  }
}

/** Key-order-independent equality for the plain values stored here (absent ≡ null). */
function same(a: unknown, b: unknown): boolean {
  if (a === undefined || a === null || b === undefined || b === null) return (a ?? null) === (b ?? null);
  if (typeof a !== "object" || typeof b !== "object") return a === b;
  const ka = Object.keys(a).filter((k) => (a as Record<string, unknown>)[k] !== undefined);
  const kb = Object.keys(b).filter((k) => (b as Record<string, unknown>)[k] !== undefined);
  return ka.length === kb.length && ka.every((k) => same((a as Record<string, unknown>)[k], (b as Record<string, unknown>)[k]));
}


/** A stored match as the backfill reads it: anything may be missing on an old acta. */
export interface BackfillMatch {
  ledger?: Record<string, unknown> | null;
  events?: unknown;
  system?: unknown;
}
export type PositionKey = (typeof POSITION_KEYS)[number];
/** What changes on a match: per player, each position key that differs (null = delete it), and `system`. */
export interface BackfillPatch {
  ledger: Record<string, Partial<Record<PositionKey, unknown>>>;
  system: string | null;
}

/**
 * The change that brings a stored finished match to what saveMatchSheet would store today, or null
 * when nothing changes — so a second run writes nothing. A player whose id can't safely be a field
 * path segment (SAFE_ID) is left out: the script counts him as «id no válido».
 */
export function backfillPatch(
  match: BackfillMatch,
  board: BoardLike | null,
  mains: Record<string, PosCode | null>,
): BackfillPatch | null {
  const ledger: Record<string, Record<string, unknown>> = {};
  for (const [pid, row] of Object.entries(match.ledger ?? {}))
    if (row && typeof row === "object") ledger[pid] = row as Record<string, unknown>;
  const events = Array.isArray(match.events) ? (match.events as EventLike[]).filter((e) => e && typeof e === "object") : [];
  const rows = positionsPlayed(ledger as unknown as Record<string, LedgerRow>, events, {
    board: board ? boardCodeByPlayer(board) : null,
    main: mains,
  });
  const changes: BackfillPatch["ledger"] = {};
  for (const [pid, stored] of Object.entries(ledger)) {
    if (!SAFE_ID.test(pid)) continue;
    const want: Record<string, unknown> = rows[pid] ? positionFields(rows[pid]) : {};
    for (const key of POSITION_KEYS) if (!same(stored[key], want[key])) (changes[pid] ??= {})[key] = want[key] ?? null;
  }
  const system = board ? boardSystem(board) : null;
  if (Object.keys(changes).length === 0 && same(match.system, system)) return null;
  return { ledger: changes, system };
}

/**
 * A patch as admin-SDK `update(ref, field, value, field, value, …)` pairs: `path("ledger", pid, key)`
 * for each change (null → the injected delete sentinel) and `path("system")` (null stays null). The
 * pids are {@link backfillPatch}'s, which already left out any that fail SAFE_ID.
 */
export function backfillUpdates<P, D>(patch: BackfillPatch, make: { path: (...segments: string[]) => P; del: D }): { pairs: [P, unknown][] } {
  const pairs: [P, unknown][] = [];
  for (const [pid, keys] of Object.entries(patch.ledger))
    for (const key of POSITION_KEYS) if (key in keys) pairs.push([make.path("ledger", pid, key), keys[key] === null ? make.del : keys[key]]);
  pairs.push([make.path("system"), patch.system]);
  return { pairs };
}
