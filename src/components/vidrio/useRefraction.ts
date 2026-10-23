// Turns a glass element into a refracting lens where the browser can (Chromium): measures it, builds (or reuses)
// the filter for its size and sets its backdrop-filter; follows resizes. Elsewhere, under reduced transparency
// and in the design shots it does nothing and the blur glass stays. Server render: nothing.
// A one-off resize rebuilds at once, as it always did; while the size keeps changing frame after frame (a
// transition, a window being dragged) the previous filter stays and the map is built once the size has held
// for a frame (or the element's own transition ends): one map instead of one per frame.
import { useEffect, type RefObject } from "react";
import { canRefract } from "./env";
import { lensBackdrop, lensFilter, type LensOptions } from "./refraction";

export function useRefraction(ref: RefObject<HTMLElement | null>, { bezel = 22, strength = 1.3, blur = 10 }: LensOptions = {}, enabled = true): void {
  useEffect(() => {
    const node = ref.current;
    if (!node || !enabled || !canRefract()) return;
    let last = "";
    const apply = () => {
      const w = node.offsetWidth;
      const h = node.offsetHeight;
      if (!w || !h) return;
      const r = parseFloat(getComputedStyle(node).borderTopLeftRadius) || 0;
      const key = `${w}x${h}x${r}`;
      if (key === last) return;
      last = key;
      const id = lensFilter(w, h, r, bezel, strength);
      if (!id) return;
      const v = lensBackdrop(id, blur);
      node.style.setProperty("backdrop-filter", v);
      node.style.setProperty("-webkit-backdrop-filter", v);
      // (the filter it shows: the lens cache keeps a filter while an element points at it)
      node.dataset.vdLensed = id;
    };
    apply();
    let settling = false;
    let moved = false;
    let raf = 0;
    // (a frame with no resize ends the settling; the first frame after the leading build always waits one more)
    const settle = () => {
      if (moved) {
        moved = false;
        raf = requestAnimationFrame(settle);
        return;
      }
      raf = 0;
      settling = false;
      apply();
    };
    const resized = () => {
      if (settling) {
        moved = true;
        return;
      }
      apply();
      settling = true;
      moved = true;
      raf = requestAnimationFrame(settle);
    };
    const ended = (e: TransitionEvent) => {
      if (e.target === node) apply();
    };
    const ro = typeof ResizeObserver === "function" ? new ResizeObserver(resized) : null;
    ro?.observe(node);
    node.addEventListener("transitionend", ended);
    return () => {
      ro?.disconnect();
      if (raf) cancelAnimationFrame(raf);
      node.removeEventListener("transitionend", ended);
      node.style.removeProperty("backdrop-filter");
      node.style.removeProperty("-webkit-backdrop-filter");
      delete node.dataset.vdLensed;
    };
  }, [ref, bezel, strength, blur, enabled]);
}
