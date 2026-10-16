// «12 oct» in club time: the one date a medal prints (the detail of derived/achievements and the Logros UI).
import { madridDate, MONTHS_SHORT } from "./madrid";

/** «12 oct», plus the year when it isn't the year of `now` («3 may 2025»); Madrid's calendar. */
export function medalDay(ms: number, now: number): string {
  const [y, mo, d] = madridDate(ms).split("-");
  const label = `${Number(d)} ${MONTHS_SHORT[Number(mo) - 1]}`;
  return y === madridDate(now).slice(0, 4) ? label : `${label} ${y}`;
}
