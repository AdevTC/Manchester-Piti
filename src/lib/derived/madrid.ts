// The club's calendar on the web: the one Madrid-day formatter and short month names, shared with the
// backend (functions/src/madrid.ts). «Hoy», la caja and the absences all take them from here, plus the
// day-and-month and the clock time the pages print.
import { madridDate, MONTHS_SHORT } from "../../../functions/src/madrid";

export { madridDate, MONTHS_SHORT };

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
