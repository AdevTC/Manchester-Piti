// The rail's per-device preferences: folded or not (≥ 1200 px; below it the rail is always icon-only) and
// whether its first entrance already played in this session. Storage may be unavailable (private mode,
// blocked site data): every read and write is guarded and the defaults hold.
import { useCallback, useEffect, useRef, useState } from "react";

export const RAIL_KEY = "mp_admin_rail";
export const RAIL_IN_KEY = "mp_admin_rail_in";
/** Below this frame width the rail is icon-only (no fold toggle). */
export const ICON_RAIL_BELOW = 1200;

function read(store: () => Storage, key: string): string | null {
  try {
    return store().getItem(key);
  } catch {
    return null;
  }
}
function write(store: () => Storage, key: string, value: string | null) {
  try {
    if (value === null) store().removeItem(key);
    else store().setItem(key, value);
  } catch {
    /* storage unavailable: the choice lasts this visit only */
  }
}
const local = () => window.localStorage;
const session = () => window.sessionStorage;

/** [folded, setFolded]: remembered on this device. */
export function useRailFolded(): [boolean, (folded: boolean) => void] {
  const [folded, setState] = useState(() => typeof window !== "undefined" && read(local, RAIL_KEY) === "plegado");
  const set = useCallback((next: boolean) => {
    setState(next);
    write(local, RAIL_KEY, next ? "plegado" : null);
  }, []);
  return [folded, set];
}

/**
 * The fold, in phases so it reads as one gesture: folding, the labels fade / slide out first («fold») and
 * then the width shrinks («closed»); unfolding, the width grows first («unfold») and then the labels come
 * back («open»). Without motion it jumps straight to the end.
 */
export type RailPhase = "open" | "fold" | "closed" | "unfold";
/** Labels out (their stagger included) before the width moves; the width's own transition. */
export const FOLD_LABELS_MS = 190;
export const FOLD_WIDTH_MS = 260;
export function useRailFold(animate: boolean) {
  const [folded, setFolded] = useRailFolded();
  const [phase, setPhase] = useState<RailPhase>(folded ? "closed" : "open");
  const timer = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);
  useEffect(() => () => clearTimeout(timer.current), []);
  const toggle = useCallback(() => {
    clearTimeout(timer.current);
    const next = !folded;
    setFolded(next);
    if (!animate) {
      setPhase(next ? "closed" : "open");
      return;
    }
    setPhase(next ? "fold" : "unfold");
    timer.current = setTimeout(() => setPhase(next ? "closed" : "open"), next ? FOLD_LABELS_MS : FOLD_WIDTH_MS);
  }, [animate, folded, setFolded]);
  return { folded, phase, toggle };
}

/** The rail's entrance already played in this session (it plays once). Pure read: mark it with markRailEntrance(). */
export function railEntranceDone(): boolean {
  return typeof window === "undefined" || read(session, RAIL_IN_KEY) === "1";
}
export function markRailEntrance() {
  write(session, RAIL_IN_KEY, "1");
}
