// The replay's clock (see replay.ts): while playing, each paso holds for its beat and the next one comes
// (round again at the end when looping); a hidden tab pauses it and the tab coming back resumes it; when
// the 3D stadium plays the jugada, the engine drives the pasos instead. Every move the clock or the user
// makes is told first (onMove), so the board can start the cromos' glide from where they are drawn. Each
// press of the transport acts at once, from where the replay really is.
import { useEffect, useRef, useState } from "react";
import { hide, holdMs, replay0, seek as seekTo, show, stepBy, tick, toggle as toggleOf, type ReplayState } from "./replay";

export type ReplayMove = "tick" | "wrap" | "user";

export interface ReplayArgs {
  /** The board + jugada on screen: another one starts paused at its first paso. */
  key: string;
  /** Pasos of the jugada. */
  n: number;
  slow: boolean;
  loop: boolean;
  /** The clock stands still: the 3D engine plays the jugada (and reports the pasos), or the jugada is
   *  not on screen. */
  frozen: boolean;
  /** A new key starts playing (the jugadas opened from a link, untouched yet). */
  autoplay?: boolean;
  onMove: (to: number, how: ReplayMove) => void;
}

export interface ReplayApi {
  frame: number;
  playing: boolean;
  toggle: () => void;
  play: () => void;
  pause: () => void;
  /** Straight to paso i (pauses). `n` = how many pasos the jugada has now, when it just changed. */
  seek: (i: number, n?: number) => void;
  step: (d: 1 | -1) => void;
  /** The engine reached paso i (nothing glides: the 2D board is hidden meanwhile). */
  reached: (i: number) => void;
  /** Start `key` over, playing or not, from its first paso (a jugada picked, a deep link) or from
   *  `frame` (the same jugada under a new id: a built-in one just made yours). */
  reset: (key: string, playing: boolean, frame?: number) => void;
}

export function useReplay({ key, n, slow, loop, frozen, autoplay = false, onMove }: ReplayArgs): ReplayApi {
  const [raw, setRaw] = useState<ReplayState>(() => replay0(key, autoplay));
  let st = raw;
  if (raw.key !== key) {
    st = replay0(key, autoplay);
    setRaw(st);
  }
  const frame = Math.min(st.frame, Math.max(0, n - 1));
  // Where the replay really is: every change goes through here first (the state only draws it), so
  // quick presses of the transport add up even when the board is slow to draw them.
  const now = useRef<ReplayState>(st);
  const latest = useRef({ n, loop, onMove });
  useEffect(() => {
    latest.current = { n, loop, onMove };
  });
  // another board or jugada on screen: it starts from its own state
  useEffect(() => {
    if (now.current.key !== key) now.current = replay0(key, autoplay);
  }, [key, autoplay]);

  /** Moves the replay (from where it really is) and tells the board first. */
  const move = (fn: (s: ReplayState, n: number) => ReplayState, how: ReplayMove | ((from: ReplayState, to: ReplayState) => ReplayMove | null)) => {
    const L = latest.current;
    const from = { ...now.current, frame: Math.min(now.current.frame, Math.max(0, L.n - 1)) };
    const next = fn(from, L.n);
    if (next === from) return;
    now.current = next;
    const told = typeof how === "function" ? how(from, next) : next.frame !== from.frame ? how : null;
    if (told) L.onMove(next.frame, told);
    setRaw(next);
  };
  const moveLatest = useRef(move);
  useEffect(() => {
    moveLatest.current = move;
  });

  // the beat: one paso after another while playing
  useEffect(() => {
    if (!st.playing || frozen || n < 1) return;
    const t = window.setTimeout(() => {
      let wrapped = false;
      moveLatest.current(
        (s, nn) => {
          const r = tick(s, nn, latest.current.loop);
          wrapped = r.wrapped;
          return r.s;
        },
        (a, b) => (b.frame !== a.frame ? (wrapped ? "wrap" : "tick") : null),
      );
    }, holdMs(frame >= n - 1, slow));
    return () => window.clearTimeout(t);
  }, [st.playing, frame, n, slow, frozen, key]);

  // a hidden tab pauses the replay; coming back resumes it
  useEffect(() => {
    if (typeof document === "undefined") return;
    const onVis = () => moveLatest.current((s) => (document.hidden ? hide(s) : show(s)), () => null);
    document.addEventListener("visibilitychange", onVis);
    return () => document.removeEventListener("visibilitychange", onVis);
  }, []);

  /** Play / pause (`only` = only that way); play at the last paso starts over (with the wipe). */
  const flip = (only?: boolean) => {
    let restarted = false;
    move(
      (s, nn) => {
        if (only !== undefined && s.playing === only) return s;
        const r = toggleOf(s, nn);
        restarted = r.restarted;
        return r.s;
      },
      () => (restarted ? "wrap" : null),
    );
  };
  return {
    frame,
    playing: st.playing,
    toggle: () => flip(),
    play: () => flip(true),
    pause: () => move((s) => (s.playing || s.resume ? { ...s, playing: false, resume: false } : s), () => null),
    seek: (i, nNow) => move((s, nn) => seekTo(s, i, nNow ?? nn), "user"),
    step: (d) => move((s, nn) => stepBy(s, d, nn), "user"),
    reached: (i) => move((s, nn) => (s.frame === i ? s : { ...s, frame: Math.max(0, Math.min(nn - 1, i)) }), () => null),
    reset: (k, playing, at = 0) => {
      const s0 = { ...replay0(k, playing), frame: Math.max(0, at) };
      now.current = s0;
      setRaw(s0);
    },
  };
}
