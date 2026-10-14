// The «ha jugado de» texts every view shares. Kept apart from positionStats so the positions map (and
// what imports it) does not pull the stats and the form rating into its bundle.
import { POSITIONS, type PosCode } from "./positions";

/** The explicit empty copy of every «ha jugado de» view. */
export const PLAYED_EMPTY = "Aún sin minutos con posición";

/** «Pivote (MCD) 320′ · MC 140′ · DFC 20′»: the first position in full, then codes; lines that round
 *  to 0′ are left out. Without minutes: «Aún sin minutos con posición». Reads only each line's code and
 *  minutes (a PlayerPositions, or the map's own lines). */
export function playedSummary(p: { lines: readonly { code: PosCode; minutes: number }[] }, max = 3): string {
  const shown = p.lines.filter((l) => Math.round(l.minutes) > 0).slice(0, max);
  if (!shown.length) return PLAYED_EMPTY;
  return shown.map((l, i) => (i === 0 ? `${POSITIONS[l.code].name} (${l.code})` : l.code) + ` ${Math.round(l.minutes)}′`).join(" · ");
}
