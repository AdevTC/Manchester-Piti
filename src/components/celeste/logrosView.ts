// «Logros» (Logros.tsx): the pure pieces of its render — the tier in words, the Madrid date, «7 / 10» and
// the earned / next / rest grouping. No clock: the date's year is read against the `now` the host passes.
import type { Achievement } from "../../lib/derived/achievements";
import { madridDate, MONTHS_SHORT } from "../../lib/derived/madrid";

/** The tier in words (tier 0 is a single medal: no tier to name). */
export const TIER_WORD: Record<Achievement["tier"], string> = { 0: "", 1: "Bronce", 2: "Plata", 3: "Oro" };

/** «12 oct», plus the year when it isn't the year of `now` («3 may 2025»); Madrid's calendar. */
export function medalDay(ms: number, now: number): string {
  const [y, mo, d] = madridDate(ms).split("-");
  const label = `${Number(d)} ${MONTHS_SHORT[Number(mo) - 1]}`;
  return y === madridDate(now).slice(0, 4) ? label : `${label} ${y}`;
}

/** «7 / 10» (never past the goal). */
export const progressText = (p: { now: number; goal: number }) => `${Math.min(p.now, p.goal)} / ${p.goal}`;

export interface LogrosGroups {
  earned: Achievement[];
  next: Achievement[];
  rest: Achievement[];
}
/** Earned (the latest first; those without a match at the end), the ones to chase (as given) and the rest. */
export function groupLogros(list: Achievement[], next: Achievement[]): LogrosGroups {
  const chasing = new Set(next.map((a) => a.id));
  const earned = list.filter((a) => a.earned).sort((a, b) => (b.at?.date ?? -Infinity) - (a.at?.date ?? -Infinity));
  return { earned, next: next.filter((a) => !a.earned), rest: list.filter((a) => !a.earned && !chasing.has(a.id)) };
}
