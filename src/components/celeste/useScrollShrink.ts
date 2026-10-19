// The phone/tablet tab bar tightens to its icons while you scroll down and comes back as soon as you scroll up or
// stop near the top (PLAN-V §3, iOS 26's tab bar). Reduced motion: it never shrinks. Server: never.
import { useEffect, useState } from "react";
import { prefersReducedMotion } from "../vidrio/env";

/** Down by more than `step` px past `top`: shrink; any move up (or back above `top`): grow. */
export function shrinkNext(prev: boolean, lastY: number, y: number, top = 120, step = 8): boolean {
  if (y <= top) return false;
  if (y - lastY > step) return true;
  if (lastY - y > step) return false;
  return prev;
}

export function useScrollShrink(): boolean {
  const [min, setMin] = useState(false);
  useEffect(() => {
    if (typeof window === "undefined" || prefersReducedMotion()) return;
    let last = window.scrollY;
    let raf = 0;
    const read = () => {
      raf = 0;
      const y = window.scrollY;
      setMin((m) => shrinkNext(m, last, y));
      if (Math.abs(y - last) > 8 || y <= 120) last = y;
    };
    const onScroll = () => {
      if (!raf) raf = requestAnimationFrame(read);
    };
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => {
      if (raf) cancelAnimationFrame(raf);
      window.removeEventListener("scroll", onScroll);
    };
  }, []);
  return min;
}
