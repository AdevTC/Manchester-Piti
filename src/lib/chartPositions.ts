// «Gráficas del juego»: where each player sits on a chart pitch. The narration keeps no coordinates, so this is the
// minute-weighted mean of the positions his actas give him (ledger[pid].positionsPlayed, the same minutes «Ha jugado
// de» reads), placed with the catalogue's own spots (POSITIONS x/y: x 0 left → 100 right, y 0 the rival's goal).
import type { ClubMatch } from "./clubData";
import { POSITIONS, POS_CODES, type PosCode } from "./positions";
import { playedLinesOf } from "./playedSummary";

export interface ChartPosition {
  x: number;
  y: number;
  /** The position with most minutes in the sample. */
  main: PosCode;
  /** Minutes with a position in the sample. */
  minutes: number;
}

export function chartPositions(matches: readonly ClubMatch[]): Map<string, ChartPosition> {
  const sum = new Map<string, { x: number; y: number; w: number; codes: Map<PosCode, number> }>();
  for (const match of matches) {
    for (const [id, row] of Object.entries(match.ledger ?? {})) {
      for (const { code, minutes } of playedLinesOf((row as { positionsPlayed?: unknown }).positionsPlayed)) {
        const spot = POSITIONS[code];
        const acc = sum.get(id) ?? { x: 0, y: 0, w: 0, codes: new Map<PosCode, number>() };
        acc.x += spot.x * minutes; acc.y += spot.y * minutes; acc.w += minutes;
        acc.codes.set(code, (acc.codes.get(code) ?? 0) + minutes);
        sum.set(id, acc);
      }
    }
  }
  const out = new Map<string, ChartPosition>();
  for (const [id, acc] of sum) {
    if (!acc.w) continue;
    const main = [...acc.codes].sort((a, b) => b[1] - a[1] || POS_CODES.indexOf(a[0]) - POS_CODES.indexOf(b[0]))[0][0];
    out.set(id, { x: acc.x / acc.w, y: acc.y / acc.w, main, minutes: acc.w });
  }
  return out;
}

/** Portero first, punta last (by the main position's depth), then by dorsal: the order of a team sheet. */
export function byPosition(positions: ReadonlyMap<string, ChartPosition>, numberOf: (id: string) => number | string | null | undefined) {
  const depth = (id: string) => { const p = positions.get(id); return p ? -POSITIONS[p.main].y : 1; };
  const dorsal = (id: string) => { const n = Number(numberOf(id)); return Number.isFinite(n) ? n : 999; };
  return (a: string, b: string) => depth(a) - depth(b) || dorsal(a) - dorsal(b) || a.localeCompare(b);
}
