// What the browser offers and what the viewer asked for, read safely (the server, tests and old browsers get the
// calm answer: no motion features, no refraction). `window.__SHOT` (the design shots) freezes everything.
import { useSyncExternalStore } from "react";

type ShotWindow = Window & { __SHOT?: unknown };

const query = (q: string): MediaQueryList | null =>
  typeof window !== "undefined" && typeof window.matchMedia === "function" ? window.matchMedia(q) : null;

export const isShot = (): boolean => typeof window !== "undefined" && !!(window as ShotWindow).__SHOT;
export const prefersReducedMotion = (): boolean => !!query("(prefers-reduced-motion: reduce)")?.matches;
export const prefersReducedTransparency = (): boolean => !!query("(prefers-reduced-transparency: reduce)")?.matches;

/** The View Transitions API (same-document). */
export const supportsViewTransitions = (): boolean =>
  typeof document !== "undefined" && typeof (document as Document & { startViewTransition?: unknown }).startViewTransition === "function";

/** Real refraction needs `backdrop-filter: url(#…)` (Chromium). Firefox claims the property but paints no SVG
 *  filter there, so it is ruled out by name; reduced transparency always gets the solid glass. */
export function canRefract(): boolean {
  if (typeof window === "undefined" || typeof CSS === "undefined" || typeof CSS.supports !== "function") return false;
  if (prefersReducedTransparency()) return false;
  const ua = navigator.userAgent;
  return /Chrome\//.test(ua) && !/Firefox\//.test(ua) && CSS.supports("backdrop-filter", "url(#a)");
}

/** A live media query (false on the server and during hydration). */
export function useMedia(q: string): boolean {
  return useSyncExternalStore(
    (on) => {
      const m = query(q);
      if (!m || typeof m.addEventListener !== "function") return () => undefined;
      m.addEventListener("change", on);
      return () => m.removeEventListener("change", on);
    },
    () => !!query(q)?.matches,
    () => false,
  );
}

export const useReducedMotion = (): boolean => useMedia("(prefers-reduced-motion: reduce)");
/** Desktop layout (the chrome's capsule on top; ≥ 1100 px). */
export const useDesktop = (): boolean => useMedia("(min-width: 1100px)");
