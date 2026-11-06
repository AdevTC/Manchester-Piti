// The club's calendar on the web: the one Madrid-day formatter and short month names, shared with the
// backend (functions/src/madrid.ts). «Hoy», la caja and the absences all take them from here, plus the
// day-and-month and the clock time the pages print.
import { madridDate, MONTHS_SHORT } from "../../../functions/src/madrid";

export { madridDate, MONTHS_SHORT };

/** Days since the epoch of the Madrid day `ms` falls on: two of them subtract to calendar days, also across a change
 *  of clocks (a 23- or 25-hour day), where `now + n · 24 h` lands on the day beside. */
export function madridDayNumber(ms: number): number {
  const [y, mo, d] = madridDate(ms).split("-").map(Number);
  return Date.UTC(y, mo - 1, d) / 86_400_000;
}

/** Noon (UTC) of the Madrid day `n` calendar days after the one `ms` falls on: its Madrid date and weekday are that
 *  day's, whatever the clocks did in between. */
export function madridDayAfter(ms: number, n: number): number {
  return (madridDayNumber(ms) + n) * 86_400_000 + 12 * 3_600_000;
}

/** «12» and «oct»: a Madrid day and its short month, apart (a calendar tile prints them on two lines). */
export function madridDayParts(ms: number): { day: string; month: string } {
  const [, mo, d] = madridDate(ms).split("-");
  return { day: String(Number(d)), month: MONTHS_SHORT[Number(mo) - 1] ?? "" };
}

/** «12 oct» in club time. */
export function madridDay(ms: number): string {
  const { day, month } = madridDayParts(ms);
  return `${day} ${month}`;
}

const TIME_FMT = new Intl.DateTimeFormat("es-ES", { timeZone: "Europe/Madrid", hour: "2-digit", minute: "2-digit", hourCycle: "h23" });
/** «12:00» / «09:30» in club time (24 h). */
export const madridTime = (ms: number): string => TIME_FMT.format(ms);

/** A kick-off at 16:00 Madrid or later: the copy may say «esta noche»; earlier, «hoy». Not every match is at night. */
export const isEveningKickoff = (ms: number): boolean => Number.isFinite(ms) && Number(madridTime(ms).slice(0, 2)) >= 16;

/** «esta noche» for an evening kick-off, «hoy» otherwise (unknown: «hoy»). `at` is the kick-off in ms, or its Madrid clock «21:30». */
export function tonightWord(at: number | string | null | undefined): "esta noche" | "hoy" {
  const evening = typeof at === "string" ? Number(at.slice(0, 2)) >= 16 : at != null && isEveningKickoff(at);
  return evening ? "esta noche" : "hoy";
}

/** The same word at the start of a sentence: «Esta noche» / «Hoy». */
export const TonightWord = (at: number | string | null | undefined): "Esta noche" | "Hoy" => (tonightWord(at) === "hoy" ? "Hoy" : "Esta noche");
