// Turns a glass element into a refracting lens where the browser can (Chromium): measures it, builds (or reuses)
// the filter for its size and sets its backdrop-filter; follows resizes. Elsewhere, under reduced transparency
// and in the design shots it does nothing and the blur glass stays. Server render: nothing.
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
      node.dataset.vdLensed = "1";
    };
    apply();
    const ro = typeof ResizeObserver === "function" ? new ResizeObserver(apply) : null;
    ro?.observe(node);
    return () => {
      ro?.disconnect();
      node.style.removeProperty("backdrop-filter");
      node.style.removeProperty("-webkit-backdrop-filter");
      delete node.dataset.vdLensed;
    };
  }, [ref, bezel, strength, blur, enabled]);
}
