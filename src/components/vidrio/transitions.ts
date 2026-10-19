// One choreography for every place / screen change (BRIEF6 «Transitions»): the outgoing regions exit first
// (160 ms, fade + 8 px slide + a little blur, +30 ms per region), the shared objects morph (their own
// view-transition-name), then the incoming regions enter from the direction of travel (220 ms, +30 ms each).
// Never both states at full opacity. Reduced motion: a 120 ms crossfade. No View Transitions (or the design
// shots): the update just happens. The CSS lives in styles/vidrio/transitions.css.
//
// Mark the regions that change with region(1…6) (each class carries a unique view-transition-name, so one
// element per number per page), the shared objects with morph(name), and run the change with
//   swap("right", () => setPlace("temporada"))
// (`update` runs inside flushSync, so plain setState calls commit before the new state is captured).
import { flushSync } from "react-dom";
import { isShot, prefersReducedMotion, supportsViewTransitions } from "./env";
import "../../styles/vidrio/transitions.css";

export type SwapDirection = "left" | "right" | "up";
export type RegionIndex = 1 | 2 | 3 | 4 | 5 | 6;

interface VTDocument {
  startViewTransition: (cb: () => void) => { finished: Promise<void> };
}

export interface SwapRun {
  /** Resolves when the transition is over (at once without one). */
  finished: Promise<void>;
  /** Whether a View Transition ran. */
  animated: boolean;
}

/** Runs `update` through the choreography. */
export function swap(direction: SwapDirection, update: () => void): SwapRun {
  if (typeof document === "undefined" || !supportsViewTransitions() || isShot()) {
    update();
    return { finished: Promise.resolve(), animated: false };
  }
  const root = document.documentElement;
  root.dataset.vdDir = direction;
  if (prefersReducedMotion()) root.dataset.vdCalm = "";
  else delete root.dataset.vdCalm;
  const done = () => {
    if (root.dataset.vdDir === direction) delete root.dataset.vdDir;
    delete root.dataset.vdCalm;
  };
  try {
    const vt = (document as unknown as VTDocument).startViewTransition(() => {
      flushSync(update);
    });
    return { finished: vt.finished.catch(() => undefined).finally(done), animated: true };
  } catch {
    done();
    update();
    return { finished: Promise.resolve(), animated: false };
  }
}

/** A region's class (exit/enter in order: 1 first). */
export const region = (n: RegionIndex): string => `vd-reg-${n}`;

/** A shared object that morphs between the two states: put the returned class and style on it, with the same
 *  `name` in both states (unique on the page at any time). */
export const morph = (name: string): { className: string; style: { viewTransitionName: string } } => ({ className: "vd-morph", style: { viewTransitionName: name } });
