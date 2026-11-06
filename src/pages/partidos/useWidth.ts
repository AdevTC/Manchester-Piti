// The page's width for Partidos' boards (their breakpoints); the server guesses a desktop's 1440.
// The width is read from the layout only when it can have changed — the window resizing, or <html> changing size (a
// scrollbar coming or going: a ResizeObserver, whose callback runs with the layout already done) — and kept here;
// the store's snapshot hands back the kept number. Reading clientWidth in the snapshot itself, as before, forced a
// layout of the whole page in the middle of every render of Partidos (and again after its commit): ~100 ms with the
// CPU ×4 on each change of screen, inside the tap's View Transition.
import { useSyncExternalStore } from "react";

let kept = 0;
let listeners = 0;
const read = (): number => document.documentElement.clientWidth || window.innerWidth;

function subscribe(on: () => void): () => void {
  listeners++;
  const update = () => {
    kept = read();
    // (useSyncExternalStore compares the snapshot: the same width re-renders nothing)
    on();
  };
  window.addEventListener("resize", update);
  const ro = typeof ResizeObserver === "function" ? new ResizeObserver(update) : null;
  ro?.observe(document.documentElement);
  return () => {
    window.removeEventListener("resize", update);
    ro?.disconnect();
    // (nobody follows it any more: the next page to ask reads it afresh)
    if (--listeners === 0) kept = 0;
  };
}

const snapshot = (): number => (kept ||= read());
const serverSnapshot = (): number => 1440;

export function useWidth(): number {
  return useSyncExternalStore(subscribe, snapshot, serverSnapshot);
}

/** Test-only. */
export function _resetWidthForTesting(): void {
  kept = 0;
  listeners = 0;
}
