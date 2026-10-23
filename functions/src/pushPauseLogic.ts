// «Pausar» (TU boards, Avisos a medida and the bell's «⋯»): a device stops ringing for a while — «Una hora»,
// «Hasta mañana» (9:00 in Madrid) or «Hasta después del partido» (the next match's expected end) — while the bell
// keeps every notice. Shared by the web (src/lib/push.ts setPushPause) and the backend (pushPause.ts writes
// `pausedUntil` on the device's subscription doc; push.ts sendTo skips a paused device: every notice, the
// match's, the personal ones and the door's, as «Pausar todo» says). No dependencies: the web imports it as is.

/** The longest pause: a week. */
export const MAX_PAUSE_MS = 7 * 24 * 3600_000;
/** A client clock a little ahead is still taken (and clamped to a week). */
export const PAUSE_SKEW_MS = 10 * 60_000;

export type PauseKind = "1h" | "manana" | "partido";

/** Whether a device's `pausedUntil` (ms) silences it at `now`. Anything but a number in the future: not paused. */
export function isPaused(pausedUntil: unknown, now: number): boolean {
  return typeof pausedUntil === "number" && Number.isFinite(pausedUntil) && pausedUntil > now;
}

/**
 * The pause the server keeps for `until` asked at `now`: null resumes; a time in (now, now + a week] stays (a clock a
 * little ahead is clamped to the week); anything else (the past, NaN, further than a week and the skew) is refused.
 */
export function clampPause(until: number | null, now: number): { ok: true; until: number | null } | { ok: false } {
  if (until === null) return { ok: true, until: null };
  if (!Number.isFinite(until) || until <= now || until > now + MAX_PAUSE_MS + PAUSE_SKEW_MS) return { ok: false };
  return { ok: true, until: Math.min(until, now + MAX_PAUSE_MS) };
}

const PARTS = new Intl.DateTimeFormat("en-GB", { timeZone: "Europe/Madrid", year: "numeric", month: "2-digit", day: "2-digit", hour: "2-digit", minute: "2-digit", second: "2-digit", hourCycle: "h23" });

/** Madrid's wall clock at `ms`. */
function madridWall(ms: number): { y: number; mo: number; d: number; h: number; mi: number; s: number } {
  const p: Record<string, number> = {};
  for (const x of PARTS.formatToParts(ms)) if (x.type !== "literal") p[x.type] = Number(x.value);
  return { y: p.year, mo: p.month, d: p.day, h: p.hour, mi: p.minute, s: p.second };
}

/** The instant Madrid's clock reads `h`:00 on the calendar day `y-mo-d` (DST-proof: the offset of that instant). */
function madridAt(y: number, mo: number, d: number, h: number): number {
  const wall = Date.UTC(y, mo - 1, d, h);
  let at = wall;
  for (let i = 0; i < 2; i++) {
    const w = madridWall(at);
    at = wall - (Date.UTC(w.y, w.mo - 1, w.d, w.h, w.mi, w.s) - at);
  }
  return at;
}

/** «Hasta mañana»: 9:00 in Madrid the next morning (in the small hours, the coming 9:00 is already «mañana»). */
export function tomorrowAtNine(now: number): number {
  const w = madridWall(now);
  if (w.h < 5) return madridAt(w.y, w.mo, w.d, 9);
  const next = new Date(Date.UTC(w.y, w.mo - 1, w.d + 1));
  return madridAt(next.getUTCFullYear(), next.getUTCMonth() + 1, next.getUTCDate(), 9);
}

/** The descanso and the time added, after the match's own minutes. */
export const MATCH_TAIL_MIN = 15;

/** «Hasta después del partido»: the match's expected end (its kick-off, its minutes, the descanso and the time
 *  added). `durationMin`: the acta's length (F7: 50). */
export function matchEndAt(kickoff: number, durationMin = 50): number {
  return kickoff + ((durationMin > 0 ? durationMin : 50) + MATCH_TAIL_MIN) * 60_000;
}
