// La pizarra «Noche de partido» — the replay of a jugada («REPETICIÓN»), as a small controller: which
// paso is on screen and whether it plays. Playing holds each paso for a beat while the cromos glide to
// it, then moves on; at the end it goes round again (with the crest wipe) or stops. Pure: the hook in
// useReplay.ts gives it a clock, the board draws the paso.

export interface ReplayState {
  /** The jugada (and board) this state is about: a new one starts from the first paso. */
  key: string;
  frame: number;
  playing: boolean;
  /** Paused because the tab went hidden: it plays again when the tab comes back. */
  resume: boolean;
}

export const replay0 = (key: string, playing = false): ReplayState => ({ key, frame: 0, playing, resume: false });

/** How long a paso stays on screen while playing (ms), as designed; the last one a little longer, and
 *  everything 1.9× slower at 0,5×. */
export const holdMs = (atEnd: boolean, slow: boolean): number => (atEnd ? 2600 : 2300) * (slow ? 1.9 : 1);

const clampFrame = (i: number, n: number): number => Math.max(0, Math.min(Math.max(0, n - 1), Number.isFinite(i) ? Math.round(i) : 0));

/** The clock's beat: the next paso, or round again from the first (`wrapped`), or the end (stops). */
export function tick(s: ReplayState, n: number, loop: boolean): { s: ReplayState; wrapped: boolean } {
  if (!s.playing || n < 1) return { s, wrapped: false };
  if (s.frame < n - 1) return { s: { ...s, frame: s.frame + 1 }, wrapped: false };
  if (loop && n > 1) return { s: { ...s, frame: 0 }, wrapped: true };
  return { s: { ...s, playing: false }, wrapped: false };
}

/** Play / pause. Play at the last paso starts again from the first (`restarted`). */
export function toggle(s: ReplayState, n: number): { s: ReplayState; restarted: boolean } {
  if (s.playing) return { s: { ...s, playing: false, resume: false }, restarted: false };
  if (n > 1 && s.frame >= n - 1) return { s: { ...s, frame: 0, playing: true, resume: false }, restarted: true };
  return { s: { ...s, playing: true, resume: false }, restarted: false };
}

/** Straight to a paso (the timeline, the arrows): the replay pauses there. */
export const seek = (s: ReplayState, i: number, n: number): ReplayState => ({ ...s, frame: clampFrame(i, n), playing: false, resume: false });

/** One paso back or forward (pauses; stays put at the ends). */
export const stepBy = (s: ReplayState, d: 1 | -1, n: number): ReplayState => seek(s, s.frame + d, n);

/** The tab went hidden: a playing replay pauses and remembers to go on. */
export const hide = (s: ReplayState): ReplayState => (s.playing ? { ...s, playing: false, resume: true } : s);
/** The tab is back: a replay paused by hiding plays again. */
export const show = (s: ReplayState): ReplayState => (s.resume ? { ...s, playing: true, resume: false } : s);
