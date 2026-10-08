// La charla's clock (see charla.ts): while it plays, each step holds for its beat and the next comes, up
// to «¡A por ellos!»; a hidden tab pauses it and the tab coming back resumes it; while the 3D stadium
// films the seven or the jugada, the engine paces those steps instead (and reports them). Every move the
// clock, the engine or the user makes is told first (onMove), so the board can glide the cromos and
// play the step's sound. Each press of the transport acts at once, from where the charla really is:
// quick presses add up even when the board (or the stadium) is slow to draw them.
import { useEffect, useRef, useState } from "react";
import { advance, charla0, goTo, hide, show, stepMs, toggle as toggleOf, type CharlaState } from "./charla";

export type CharlaMove = "tick" | "engine" | "user";

export interface CharlaArgs {
  /** The charla is on screen (the clock only runs then). */
  on: boolean;
  /** Its last step («¡A por ellos!»). */
  last: number;
  rm: boolean;
  /** Whether the 3D engine paces this step (then the clock waits for its report). */
  engine: (step: number, playing: boolean) => boolean;
  onMove: (to: number, how: CharlaMove) => void;
}

export interface CharlaApi {
  step: number;
  playing: boolean;
  toggle: () => void;
  /** Straight to a step (pauses). */
  seek: (i: number) => void;
  step1: (d: 1 | -1) => void;
  /** The 3D stadium reached a step. */
  reached: (i: number) => void;
  /** From the start again (opening the charla). */
  reset: () => void;
}

const clampTo = (s: CharlaState, last: number): CharlaState => (s.step > last ? { ...s, step: last, playing: false } : s);

export function useCharla({ on, last, rm, engine, onMove }: CharlaArgs): CharlaApi {
  const [raw, setRaw] = useState<CharlaState>(() => charla0(rm));
  // Where the charla really is: every change goes through here first (the state only draws it), so a
  // press never starts from a step that has not been drawn yet.
  const now = useRef<CharlaState>(raw);
  const st = clampTo(raw, last);
  const paced = engine(st.step, st.playing);
  const latest = useRef({ last, rm, onMove });
  useEffect(() => {
    latest.current = { last, rm, onMove };
  });

  /** Moves the charla (from where it really is) and tells the board. */
  const move = (fn: (s: CharlaState, last: number) => CharlaState, how: CharlaMove) => {
    const L = latest.current;
    const from = clampTo(now.current, L.last);
    const next = fn(from, L.last);
    if (next === from) return;
    now.current = next;
    if (next.step !== from.step) L.onMove(next.step, how);
    setRaw(next);
  };
  const moveLatest = useRef(move);
  useEffect(() => {
    moveLatest.current = move;
  });

  // the beat: one step after another while it plays
  useEffect(() => {
    if (!on || !st.playing || paced || st.step >= last) return;
    const t = window.setTimeout(() => moveLatest.current((s, l) => advance(s, l), "tick"), stepMs(st.step, last));
    return () => window.clearTimeout(t);
  }, [on, st.playing, st.step, paced, last]);

  // a hidden tab pauses the charla; coming back resumes it
  useEffect(() => {
    if (!on || typeof document === "undefined") return;
    const onVis = () => moveLatest.current((s) => (document.hidden ? hide(s) : show(s)), "tick");
    document.addEventListener("visibilitychange", onVis);
    return () => document.removeEventListener("visibilitychange", onVis);
  }, [on]);

  return {
    step: st.step,
    playing: st.playing,
    toggle: () => move((s, l) => toggleOf(s, l, latest.current.rm), "user"),
    seek: (i) => move((_s, l) => goTo(i, l), "user"),
    step1: (d) => move((s, l) => goTo(s.step + d, l), "user"),
    reached: (i) => move((s, l) => advance(s, l, i), "engine"),
    reset: () => {
      const s0 = charla0(latest.current.rm);
      now.current = s0;
      setRaw(s0);
    },
  };
}
