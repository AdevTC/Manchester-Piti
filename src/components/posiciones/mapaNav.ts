// Pure helpers behind «Mapa de posiciones»: arrow-key navigation between the 13 spots and the texts
// (state of a spot, one-line summary, full description for screen readers).
import { POSITIONS, POS_CODES, type PosCode, type PositionSet } from "../../lib/positions";
import { proposalDiff } from "../../lib/positionsEdit";

/** Height / width of the drawn pitch (portrait). The CSS aspect-ratio (4 / 7) must match. */
export const PITCH_ASPECT = 7 / 4;

/** Smallest pitch width (px) the host may give the map at size m and still get ≥ 44 px targets. */
export const MIN_PITCH_WIDTH = 280;
/** Height of every hit area, in % of the pitch height (CSS: 9 % × 7/4 = 15.75cqw of the pitch width). */
export const HIT_BAND = 9;
/** DFC and LIB are only 8 % apart: DFC's hit area moves up 1 % (its dot stays put) so the bands touch, not overlap. */
export const HIT_NUDGE: Partial<Record<PosCode, number>> = { DFC: -1 };
/** Vertical centre of a spot's hit area, in % of the pitch height. */
export const hitCentre = (code: PosCode): number => POSITIONS[code].y + (HIT_NUDGE[code] ?? 0);

export type Direction = "up" | "down" | "left" | "right";
export type SpotState = "preferida" | "también" | "nada";

/** The closest spot in that direction (distances on the real drawing, within a ~63° cone, off-axis drift
 *  weighs double); null at the edge. Every spot stays reachable from every other with the arrows. */
export function nearestSpot(from: PosCode, dir: Direction): PosCode | null {
  const a = POSITIONS[from];
  let best: PosCode | null = null;
  let bestScore = Infinity;
  for (const code of POS_CODES) {
    if (code === from) continue;
    const b = POSITIONS[code];
    const dx = b.x - a.x;
    const dy = (b.y - a.y) * PITCH_ASPECT;
    const [primary, cross] = dir === "up" ? [-dy, dx] : dir === "down" ? [dy, dx] : dir === "left" ? [-dx, dy] : [dx, dy];
    // only spots really in that direction: ED → right must not jump down to LD (2 % to the right)
    if (primary <= 0 || Math.abs(cross) > 2 * primary) continue;
    const score = primary + 2 * Math.abs(cross);
    if (score < bestScore) {
      bestScore = score;
      best = code;
    }
  }
  return best;
}

export function spotState(set: PositionSet, code: PosCode): SpotState {
  return set.main === code ? "preferida" : set.also.includes(code) ? "también" : "nada";
}

/** «sin marcar» reads better than «nada» out loud. */
export const stateWord = (s: SpotState): string => (s === "nada" ? "sin marcar" : s);

export const DEFAULT_EMPTY = "Sin posición";

/** «Pivote (MCD) · también MC, DFC». */
export function summaryText(set: PositionSet, empty: string = DEFAULT_EMPTY): string {
  const also = set.also.join(", ");
  if (set.main) return `${POSITIONS[set.main].name} (${set.main})${also ? ` · también ${also}` : ""}`;
  return also ? `También ${also}` : empty;
}

const spelled = (codes: readonly PosCode[]) => codes.map((c) => `${POSITIONS[c].name} (${c})`).join(", ");

/** Everything the map shows, in words (the read-only map's accessible name). */
export function fullText(set: PositionSet, compare?: PositionSet, empty: string = DEFAULT_EMPTY): string {
  const parts: string[] = [];
  if (set.main) parts.push(`Preferida: ${spelled([set.main])}.`);
  if (set.also.length) parts.push(`También: ${spelled(set.also)}.`);
  if (!parts.length) parts.push(`${empty}.`);
  if (compare) {
    const diff = proposalDiff(compare, set);
    if (diff.added.length) parts.push(`Añadidas: ${spelled(diff.added)}.`);
    if (diff.removed.length) parts.push(`Quitadas: ${spelled(diff.removed)}.`);
    const from = diff.mainChange?.[0];
    if (from) parts.push(`Preferida antes: ${spelled([from])}.`);
  }
  return parts.join(" ");
}
