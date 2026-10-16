// «Logros» (Logros.tsx): the pure pieces of its render — the tier in words, the Madrid date, «7 / 10» and
// the earned / next / rest grouping. No clock: the date's year is read against the `now` the host passes.
import type { Achievement } from "../../lib/derived/achievements";
export { medalDay } from "../../lib/derived/medalDay";

/** The tier in words (tier 0 is a single medal: no tier to name). */
export const TIER_WORD: Record<Achievement["tier"], string> = { 0: "", 1: "Bronce", 2: "Plata", 3: "Oro" };

/** «7 / 10» (never past the goal; whole numbers: 999.6 minutes read 999). */
export const progressText = (p: { now: number; goal: number }) => `${Math.floor(Math.min(p.now, p.goal))} / ${p.goal}`;

/** The same count for a screen reader: «7 de 10». */
export const progressWords = (p: { now: number; goal: number }) => `${Math.floor(Math.min(p.now, p.goal))} de ${p.goal}`;

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
