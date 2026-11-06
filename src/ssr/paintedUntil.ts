// How long a server-rendered page can still be shown as it was painted. Vercel's CDN keeps a page up to a day
// (api/render.js): the data in it is never old (every write to the public data deletes it: api/purge.js), but the
// texts that read the clock are those of the instant it was painted («hoy hay partido», «faltan 3 h», «hace 2 días»).
// The browser corrects them once React takes the page over; until then the first paint must not say something
// that is no longer true. Past this instant the page boots without the server's markup (scripts/ssr-shell.mjs),
// from the data inside it, as a page with a query does.
import { madridDate } from "../../functions/src/madrid";
import { dateMillis } from "../../functions/src/matchEngine";

const MINUTE = 60_000;
const HOUR = 60 * MINUTE;

/** How old a page could always be (a minute fresh, five more served while a new one rendered): near a match, the
 *  clock's texts change by the minute, so a page stays shown only this long, as before. */
export const NEAR_A_MATCH_MS = 6 * MINUTE;
/** A match this close to the painted day (before its kickoff, after it) makes the page's texts change by the minute:
 *  the previa, the countdown, the live minute, «pendiente del acta»… */
const AROUND_A_MATCH_MS = 6 * HOUR;

/** The first instant after `at` that is another Madrid day (to the minute; DST-proof). */
export function nextMadridMidnight(at: number): number {
  const day = madridDate(at);
  let lo = at;
  let hi = at + 26 * HOUR;
  while (hi - lo > MINUTE) {
    const mid = Math.floor((lo + hi) / 2);
    if (madridDate(mid) === day) lo = mid;
    else hi = mid;
  }
  // (the new day starts on a whole minute, in (lo, hi], less than a minute long: the first whole minute after lo)
  return Math.floor(lo / MINUTE) * MINUTE + MINUTE;
}

/** Until when a page painted at `at` with these matches can be shown as it is: the end of its Madrid day (every
 *  «hoy», «mañana», «hace N días» changes then), or six minutes when a match is around that day. */
export function paintedUntil(matches: readonly { date?: unknown }[], at: number): number {
  const midnight = nextMadridMidnight(at);
  const near = matches.some((m) => {
    const kick = dateMillis(m.date);
    return Number.isFinite(kick) && kick - AROUND_A_MATCH_MS < midnight && kick + AROUND_A_MATCH_MS > at;
  });
  return near ? Math.min(midnight, at + NEAR_A_MATCH_MS) : midnight;
}
