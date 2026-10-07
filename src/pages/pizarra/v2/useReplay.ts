// The replay's clock (see replay.ts): while playing, each paso holds for its beat and the next one comes
// (round again at the end when looping); a hidden tab pauses it and the tab coming back resumes it; when
// the 3D stadium plays the jugada, the engine drives the pasos instead. Every move the clock or the user
// makes is told first (onMove), so the board can start the cromos' glide from where they are drawn.
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
  const cur = { ...st, frame };
  const latest = useRef({ cur, n, loop, onMove });
  useEffect(() => {
    latest.current = { cur, n, loop, onMove };
  });

  // the beat: one paso after another while playing
  useEffect(() => {
    if (!st.playing || frozen || n < 1) return;
    const t = window.setTimeout(() => {
      const L = latest.current;
      const r = tick(L.cur, L.n, L.loop);
      if (r.s.frame !== L.cur.frame) L.onMove(r.s.frame, r.wrapped ? "wrap" : "tick");
      setRaw(r.s);
    }, holdMs(frame >= n - 1, slow));
    return () => window.clearTimeout(t);
  }, [st.playing, frame, n, slow, frozen, key]);

  // a hidden tab pauses the replay; coming back resumes it
  useEffect(() => {
    if (typeof document === "undefined") return;
    const onVis = () => setRaw((s) => (document.hidden ? hide(s) : show(s)));
    document.addEventListener("visibilitychange", onVis);
    return () => document.removeEventListener("visibilitychange", onVis);
  }, []);

  const go = (next: ReplayState) => {
    const L = latest.current;
    if (next.frame !== L.cur.frame) L.onMove(next.frame, "user");
    setRaw(next);
  };
  return {
    frame,
    playing: st.playing,
    toggle: () => {
      const L = latest.current;
      const r = toggleOf(L.cur, L.n);
      if (r.restarted) L.onMove(0, "wrap");
      setRaw(r.s);
    },
    play: () => {
      const L = latest.current;
      if (!L.cur.playing) {
        const r = toggleOf(L.cur, L.n);
        if (r.restarted) L.onMove(0, "wrap");
        setRaw(r.s);
      }
    },
    pause: () => setRaw((s) => (s.playing || s.resume ? { ...s, playing: false, resume: false } : s)),
    seek: (i, nNow) => go(seekTo(latest.current.cur, i, nNow ?? latest.current.n)),
    step: (d) => go(stepBy(latest.current.cur, d, latest.current.n)),
    reached: (i) => setRaw((s) => (s.frame === i ? s : { ...s, frame: Math.max(0, Math.min(latest.current.n - 1, i)) })),
    reset: (k, playing, at = 0) => setRaw({ ...replay0(k, playing), frame: Math.max(0, at) }),
  };
}
