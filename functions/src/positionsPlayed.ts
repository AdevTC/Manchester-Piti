/// «Ha jugado de»: de un acta publicada (su ledger y sus eventos) y de la pizarra oficial del partido,
// cuántos minutos jugó cada uno en cada posición exacta y qué goles, asistencias y tarjetas vinieron
// de ahí. Puro: lo usan saveMatchSheet, el relleno de actas antiguas y sus tests.
import { boardCodeByPlayer, boardSystem, type BoardLike } from "./boardCodes.js";
import { eventSeconds } from "./matchAnalysis.js";
import { isPendingDup, type MatchEvent, type Participation } from "./matchEngine.js";
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

type LedgerRow = Pick<Participation, "started" | "stints">;
type EventLike = Pick<MatchEvent, "type" | "playerId" | "assistPlayerId" | "inPlayerId" | "minute" | "elapsedSeconds" | "dupOf" | "dupOk">;
interface Coded {
  code: PosCode;
  estimated: boolean;
}
/** A stretch of one player's minutes at one code (null: a slot nobody could name). */
interface Seg {
  from: number;
  to: number;
  c: Coded | null;
}

const GOALS = new Set<string>(["goal", "goal_penalty", "goal_freekick"]);
const SENT_OFF = new Set<string>(["red_card", "double_yellow"]);
const round2 = (n: number): number => Math.round(n * 100) / 100;

/**
 * Per player with at least one coded stretch: minutes by exact position and the goals, assists and
 * cards that fell in each. The match is walked in the ledger's order (calculateLedger's: by time, then as
 * written; a pending duplicate counts for nothing). A starter on the board takes his slot's code; one off
 * the board, or every starter without a board, takes his main (estimated); a starter without a main gets
 * no code. Whoever comes on takes the code of the one he replaces at that moment (a sub «por» a player
 * sent off earlier takes the code the red left empty), «estimado» included; when that one has no code, his
 * own main (estimated). A «Cambio de sitio» (a recolocación) trades the codes of the two who move from
 * that moment (one without a code takes his own main). An event counts at the stretch that contains its
 * minute (from ≤ t < to) or, when none does, at the one that ends right then (his last minute: a red
 * card, the minute he is substituted, the final whistle); elsewhere (a card on the bench) it is not
 * attributed. At a substitution minute t the one coming in owns t (his stretch starts there), so his card
 * at t counts at the position he inherited — or, recolocated at t, at the one he moved to; the one going
 * off only gets t through the stretch that ends there. `positionsEstimated` is set only when an estimated
 * stretch gave him minutes. The ledger says who started and where each one's last stint ends (the walk
 * closes there).
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

  // ---- the walk: who is on the pitch, at which code, stretch by stretch
  const segs = new Map<string, Seg[]>();
  const on = new Map<string, Seg>();
  /** The code a red left empty, by who was sent off: a substitution «por» him takes it (once). */
  const vacated = new Map<string, Coded | null>();
  /** Sent off: never on again. */
  const off = new Set<string>();
  const open = (pid: string, t: number, c: Coded | null) => {
    const seg: Seg = { from: t, to: t, c };
    on.set(pid, seg);
    const list = segs.get(pid);
    if (list) list.push(seg);
    else segs.set(pid, [seg]);
  };
  const close = (pid: string, t: number) => {
    const seg = on.get(pid);
    if (!seg) return;
    seg.to = Math.max(seg.from, t);
    on.delete(pid);
  };
  for (const [pid, p] of Object.entries(ledger)) if (p?.started) open(pid, 0, starterCode(pid));
  const timeOf = (e: EventLike): number | null => {
    const t = e.elapsedSeconds != null ? e.elapsedSeconds / 60 : e.minute;
    return typeof t === "number" && Number.isFinite(t) ? t : null;
  };
  const counted = events.filter((e) => e && !isPendingDup(e));
  const ordered = counted.map((e, order) => ({ e, order })).sort((a, b) => eventSeconds(a.e) - eventSeconds(b.e) || a.order - b.order);
  for (const { e } of ordered) {
    const t = timeOf(e);
    if (t === null || !e.playerId) continue;
    if (e.type === "substitution") {
      const outId = e.playerId;
      const inId = e.inPlayerId;
      if (!inId || inId === outId || on.has(inId) || off.has(inId) || !ledger[inId]) continue;
      const cur = on.get(outId);
      if (cur) {
        close(outId, t);
        open(inId, t, cur.c ?? ownMain(inId));
      } else if (vacated.has(outId)) {
        const c = vacated.get(outId) ?? null;
        vacated.delete(outId);
        open(inId, t, c ?? ownMain(inId));
      } else if (!ledger[outId]) {
        // (one the ledger doesn't hold — a guest, in a stored acta that keeps members only — went off: whoever came
        // on for him plays at his own main, estimated)
        open(inId, t, ownMain(inId));
      }
    } else if (SENT_OFF.has(e.type)) {
      const cur = on.get(e.playerId);
      if (cur) {
        vacated.set(e.playerId, cur.c);
        close(e.playerId, t);
      }
      off.add(e.playerId);
    } else if (e.type === "position_swap") {
      const a = e.playerId;
      const b = e.inPlayerId;
      const sa = on.get(a);
      const sb = b ? on.get(b) : undefined;
      if (!b || a === b || !sa || !sb) continue;
      close(a, t);
      close(b, t);
      open(a, t, sb.c ?? ownMain(a));
      open(b, t, sa.c ?? ownMain(b));
    }
  }
  // (the final whistle: whoever is still on closes where the ledger's last stint of his ends)
  const end = Math.max(0, ...Object.keys(ledger).flatMap((pid) => stintsOf(pid).map((s) => s.to)));
  for (const pid of [...on.keys()]) {
    const last = stintsOf(pid).at(-1);
    close(pid, last ? last.to : end);
  }

  const rows: Record<string, PositionsRow> = {};
  const minutes: Record<string, Partial<Record<PosCode, number>>> = {};
  for (const [pid, list] of segs)
    for (const seg of list) {
      if (!seg.c) continue;
      const length = Math.max(0, seg.to - seg.from);
      rows[pid] ??= { positionsPlayed: {}, positionEvents: {}, positionsEstimated: false };
      if (seg.c.estimated && length > 0) rows[pid].positionsEstimated = true;
      const m = (minutes[pid] ??= {});
      m[seg.c.code] = (m[seg.c.code] ?? 0) + length;
    }
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
    const list = segs.get(pid) ?? [];
    let seg = list.find((s) => s.from <= t && t < s.to);
    if (!seg)
      for (let n = list.length - 1; n >= 0; n--)
        if (list[n].to === t) {
          seg = list[n];
          break;
        }
    return seg?.c?.code ?? null;
  };
  const bump = (pid: string | undefined, t: number, key: keyof PositionEvents) => {
    const code = codeAt(pid, t);
    if (!code || !pid) return;
    const pe = rows[pid].positionEvents;
    const cur = (pe[code] ??= { goals: 0, assists: 0, yellowCards: 0, redCards: 0 });
    cur[key]++;
  };
  for (const e of counted) {
    const t = timeOf(e);
    if (t === null) continue;
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
 * actions is unchanged — his stints, exchanges, goals, assists, yellow and red cards, and his «Cambio de
 * sitio» plays (`moved`: whom the correction recolocated differently, swapsChanged); otherwise (or with
 * nothing stored for him) he gets `fallback`'s row: the estimate by preferred position, «estimado».
 */
export function keepStoredPositions(players: CorrectionLedger, stored: unknown, fallback: Record<string, PositionsRow>, moved: ReadonlySet<string> = new Set()): void {
  clearPositions(players);
  const old = stored && typeof stored === "object" ? (stored as Record<string, unknown>) : {};
  for (const [pid, p] of Object.entries(players)) {
    const row: unknown = old[pid];
    const r = row && typeof row === "object" ? (row as Record<string, unknown>) : null;
    if (r && !moved.has(pid) && ATTRIBUTION_KEYS.every((k) => same(r[k], p[k]))) {
      if (r.positionsPlayed && typeof r.positionsPlayed === "object") p.positionsPlayed = r.positionsPlayed as PositionsLedger[string]["positionsPlayed"];
      if (r.positionEvents && typeof r.positionEvents === "object") p.positionEvents = r.positionEvents as PositionsLedger[string]["positionEvents"];
      if (r.positionsEstimated === true) p.positionsEstimated = true;
    } else if (fallback[pid]) Object.assign(p, positionFields(fallback[pid]));
  }
}

/** Who a correction recolocated differently: the players whose «Cambio de sitio» plays (when, and with
 *  whom) are not the same in the stored events (`before`, possibly missing or odd) and the new ones. */
export function swapsChanged(before: unknown, after: readonly EventLike[]): Set<string> {
  const sign = (events: readonly unknown[]) => {
    const by = new Map<string, string[]>();
    for (const x of events) {
      const e = x as Partial<EventLike> | null;
      if (!e || e.type !== "position_swap" || typeof e.playerId !== "string" || typeof e.inPlayerId !== "string") continue;
      const at = String(e.elapsedSeconds ?? (typeof e.minute === "number" ? e.minute * 60 : "?"));
      for (const [me, other] of [[e.playerId, e.inPlayerId], [e.inPlayerId, e.playerId]]) {
        const list = by.get(me) ?? [];
        list.push(`${at}:${other}`);
        by.set(me, list);
      }
    }
    return by;
  };
  const was = sign(Array.isArray(before) ? before : []);
  const now = sign(after);
  const out = new Set<string>();
  // (in any order: the same swaps written in another order are the same recolocación)
  const key = (list: readonly string[] | undefined) => [...(list ?? [])].sort().join("|");
  for (const pid of new Set([...was.keys(), ...now.keys()])) if (key(was.get(pid)) !== key(now.get(pid))) out.add(pid);
  return out;
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
