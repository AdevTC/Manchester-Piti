// «Ha jugado de»: de un acta publicada (su ledger y sus eventos) y de la pizarra oficial del partido,
// cuántos minutos jugó cada uno en cada posición exacta y qué goles, asistencias y tarjetas vinieron
// de ahí. Puro: lo usan saveMatchSheet, el relleno de actas antiguas y sus tests.
import type { MatchEvent, Participation } from "./matchEngine.js";
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
 * player he came in for ends at that minute, «estimado» included; when that one has no code, his own
 * main (estimated). An event counts at the stint that contains its minute (from ≤ t < to) or, when
 * none does, at the one that ends right then (his last minute: a red card, the minute he is
 * substituted, the final whistle); elsewhere (a card on the bench) it is not attributed.
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
        if (theirs[n].to === s.from && !(ex?.with === pid && n === i)) {
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

  // Every stint in time order, so a chain (a substitute for a substitute) resolves front to back.
  const all = Object.keys(ledger)
    .flatMap((pid) => stintsOf(pid).map((s, i) => ({ pid, i, from: s.from })))
    .sort((a, b) => a.from - b.from);
  const rows: Record<string, PositionsRow> = {};
  const minutes: Record<string, Partial<Record<PosCode, number>>> = {};
  for (const { pid, i } of all) {
    const c = resolve(pid, i);
    if (!c) continue;
    const s = stintsOf(pid)[i];
    rows[pid] ??= { positionsPlayed: {}, positionEvents: {}, positionsEstimated: false };
    if (c.estimated) rows[pid].positionsEstimated = true;
    const m = (minutes[pid] ??= {});
    m[c.code] = (m[c.code] ?? 0) + Math.max(0, s.to - s.from);
  }
  for (const [pid, m] of Object.entries(minutes))
    for (const [code, raw] of Object.entries(m) as [PosCode, number][]) {
      const v = round2(raw);
      if (v > 0) rows[pid].positionsPlayed[code] = v;
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
