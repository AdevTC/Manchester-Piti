// What the board asks of the device while it runs: reduced motion read live (the setting can change
// with the page open), and when the one 3D stadium is mounted — the first time a 3D moment wants it,
// kept (paused) between moments, and unmounted (the engine disposed, its memory given back) after a
// minute with no 3D moment, to be mounted again on demand.
import { useEffect, useState, useSyncExternalStore } from "react";

const RM = "(prefers-reduced-motion: reduce)";

const rmQuery = (): MediaQueryList | null => {
  try {
    return typeof window !== "undefined" && window.matchMedia ? window.matchMedia(RM) : null;
  } catch {
    return null;
  }
};

function subscribeRm(on: () => void): () => void {
  const q = rmQuery();
  if (!q) return () => {};
  if (q.addEventListener) {
    q.addEventListener("change", on);
    return () => q.removeEventListener("change", on);
  }
  // Safari < 14
  q.addListener?.(on);
  return () => q.removeListener?.(on);
}

/** prefers-reduced-motion, live: a change in the system's setting reaches the board at once. */
export function useReducedMotion(): boolean {
  return useSyncExternalStore(
    subscribeRm,
    () => rmQuery()?.matches ?? false,
    () => false,
  );
}

/** How long the stadium stays mounted with no 3D moment (ms). */
export const STADIUM_IDLE_MS = 60_000;

/**
 * Whether the 3D stadium is mounted: from the first moment that wants it (`wantNow`) while the device can
 * (`can`); it stays between moments (the director pauses it), and after `idleMs` with nothing wanting it
 * it is unmounted — the next moment mounts it again.
 */
export function useStadiumMount(can: boolean, wantNow: boolean, idleMs = STADIUM_IDLE_MS): boolean {
  const [mounted, setMounted] = useState(false);
  if (can && wantNow && !mounted) setMounted(true);
  if (!can && mounted) setMounted(false);
  useEffect(() => {
    if (!mounted || wantNow) return;
    const t = window.setTimeout(() => setMounted(false), idleMs);
    return () => window.clearTimeout(t);
  }, [mounted, wantNow, idleMs]);
  return can && (mounted || wantNow);
}
