// Moving between pages from the capsule or the tab bar (V-Vivo frames «De Inicio a Plantilla»): the page leaves
// first (160 ms, fade + 8 px + a little blur, region by region where the page marks regions), the shared objects
// morph (the capsule's bead, the floating score ↔ Inicio's lens ↔ the match page's scoreboard: one
// view-transition-name each, one mounted at a time), then the next page comes in from the direction of travel
// (220 ms). Never both pages at full opacity. The router runs the View Transition (Link `viewTransition`); this
// only tells the CSS which way to go (html[data-vd-dir] + html[data-vd-page]: styles/vidrio/chrome.css and
// transitions.css). Reduced motion: the 120 ms crossfade. No View Transitions: an instant swap.
import { prefersReducedMotion, supportsViewTransitions } from "../vidrio/env";
import type { SwapDirection } from "../vidrio/transitions";

/** The capsule's order (a page outside it — a match, a ficha, the vestuario — sits after Club). */
const ORDER = ["inicio", "partidos", "plantilla", "stats", "club"];

export function pageDirection(from: string, to: string): SwapDirection {
  const a = ORDER.indexOf(from);
  const b = ORDER.indexOf(to);
  return (b < 0 ? ORDER.length : b) >= (a < 0 ? ORDER.length : a) ? "right" : "left";
}

/** Whether a View Transition is animating now (its pseudo-elements have running animations). */
const transitionRunning = (): boolean =>
  typeof document.getAnimations === "function" && document.getAnimations().some((x) => (x.effect as KeyframeEffect | null)?.pseudoElement?.startsWith("::view-transition") ?? false);

let watch = 0;
/** Marks the direction for the router's View Transition about to run, and clears it once that transition is over:
 *  a page whose code is still downloading starts its transition late, so a fixed timer would clear it too soon. */
export function startPageTransition(direction: SwapDirection): void {
  if (typeof document === "undefined" || !supportsViewTransitions()) return;
  const root = document.documentElement;
  root.dataset.vdDir = direction;
  root.dataset.vdPage = "";
  if (prefersReducedMotion()) root.dataset.vdCalm = "";
  const mine = ++watch;
  const started = performance.now();
  let seen = false;
  const clear = () => {
    if (mine !== watch) return;
    delete root.dataset.vdDir;
    delete root.dataset.vdPage;
    delete root.dataset.vdCalm;
  };
  const tick = () => {
    if (mine !== watch) return;
    const running = transitionRunning();
    if (running) seen = true;
    // over once it ran and stopped; never later than 4 s (a page that never transitions)
    if ((seen && !running) || performance.now() - started > 4000) return clear();
    requestAnimationFrame(tick);
  };
  requestAnimationFrame(tick);
}

/** Whether a page change (not an in-page one) owns the transition attributes right now. */
export const pageTransitionActive = (): boolean => typeof document !== "undefined" && "vdPage" in document.documentElement.dataset;
