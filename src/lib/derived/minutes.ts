// The one way minutes are shown: whole minutes and «′» («342′», never «342.67′»). The ledgers keep
// two decimals (from secondsPlayed); only the display rounds.

/** Whole minutes (Math.round; 0 when it is not a number). */
export const wholeMinutes = (n: number): number => (Number.isFinite(n) ? Math.round(n) : 0);

/** «342′» — `empty` (default «—») when there is no number. */
export function fmtMinutes(n: number | null | undefined, empty = "—"): string {
  return typeof n === "number" && Number.isFinite(n) ? `${Math.round(n)}′` : empty;
}
