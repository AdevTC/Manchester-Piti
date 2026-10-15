// The club's calendar: Madrid days, the one formatter both sides use (the absences here; the web's «Hoy»,
// la caja and the absences through src/lib/derived/madrid.ts, which re-exports it).

const DAY_FMT = new Intl.DateTimeFormat("en-CA", { timeZone: "Europe/Madrid", year: "numeric", month: "2-digit", day: "2-digit" });

/** The Madrid calendar date of an instant, `YYYY-MM-DD` (compares as a string; a match at 23:30 is still
 *  that day; DST-proof). */
export const madridDate = (ms: number): string => DAY_FMT.format(ms);

/** The months as the club writes them short: «12 oct», «3 sept». */
export const MONTHS_SHORT: readonly string[] = ["ene", "feb", "mar", "abr", "may", "jun", "jul", "ago", "sept", "oct", "nov", "dic"];
