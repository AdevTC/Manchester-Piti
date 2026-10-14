// The «ha jugado de» texts every view shares. Kept apart from positionStats so the positions map (and
// what imports it) does not pull the stats and the form rating into its bundle.
import { POSITIONS, POS_CODES, isPosCode, type PosCode } from "./positions";
import { fmtMinutes } from "./derived/minutes";

/** One acta row's `positionsPlayed` as lines: valid codes with minutes > 0, most minutes first (ties in
 *  catalogue order, as positionStats counts a match's code). Anything else stored there is ignored. */
export function playedLinesOf(pp: unknown): { code: PosCode; minutes: number }[] {
  if (!pp || typeof pp !== "object") return [];
  return Object.entries(pp)
    .filter((e): e is [PosCode, number] => isPosCode(e[0]) && typeof e[1] === "number" && Number.isFinite(e[1]) && e[1] > 0)
    .map(([code, minutes]) => ({ code, minutes }))
    .sort((a, b) => b.minutes - a.minutes || POS_CODES.indexOf(a.code) - POS_CODES.indexOf(b.code));
}

/** Where he played most in that match (null: the acta has no position minutes for him). */
export const topPlayedCode = (pp: unknown): PosCode | null => playedLinesOf(pp)[0]?.code ?? null;

/** The explicit empty copy of every «ha jugado de» view. */
export const PLAYED_EMPTY = "Aún sin minutos con posición";

/** «Pivote (MCD) 320′ · MC 140′ · DFC 20′»: the first position in full, then codes; lines that round
 *  to 0′ are left out. Without minutes: «Aún sin minutos con posición». Reads only each line's code and
 *  minutes (a PlayerPositions, or the map's own lines). */
export function playedSummary(p: { lines: readonly { code: PosCode; minutes: number }[] }, max = 3): string {
  const shown = p.lines.filter((l) => Math.round(l.minutes) > 0).slice(0, max);
  if (!shown.length) return PLAYED_EMPTY;
  return shown.map((l, i) => (i === 0 ? `${POSITIONS[l.code].name} (${l.code})` : l.code) + ` ${fmtMinutes(l.minutes)}`).join(" · ");
}
