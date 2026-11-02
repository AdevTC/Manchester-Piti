// r14 «La pizarra»: which frame the screen gets — desktop ≥ 1100 · tablet 700–1099 · phone < 700 (SHELL-API § Layout).
import { useSyncExternalStore } from "react";
import type { Layout } from "../store/types";

const DESK = "(min-width: 1100px)";
const TAB = "(min-width: 700px)";

export function layoutNow(): Layout {
  if (typeof window === "undefined" || !window.matchMedia) return "desktop";
  return window.matchMedia(DESK).matches ? "desktop" : window.matchMedia(TAB).matches ? "tablet" : "phone";
}
function subscribe(cb: () => void): () => void {
  if (typeof window === "undefined" || !window.matchMedia) return () => undefined;
  const qs = [window.matchMedia(DESK), window.matchMedia(TAB)];
  qs.forEach((q) => q.addEventListener?.("change", cb));
  return () => qs.forEach((q) => q.removeEventListener?.("change", cb));
}
export function useLayout(): Layout {
  return useSyncExternalStore(subscribe, layoutNow, () => "desktop");
}
