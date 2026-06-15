import { useEffect, useRef, useState } from "react";

function canAnimate(): boolean {
  if (typeof window === "undefined" || typeof IntersectionObserver === "undefined") return false;
  return !window.matchMedia?.("(prefers-reduced-motion: reduce)").matches;
}

/**
 * Counts a number up from 0 to `target` when it scrolls into view.
 * Safe by design: respects reduced-motion, falls back to the final value if
 * IntersectionObserver is unavailable or the element is never seen, and never
 * leaves a blank/zero number stranded. All state writes happen inside async
 * callbacks (rAF / observer / timeout), never synchronously in the effect body.
 */
export function useCountUp(target: number, durationMs = 1100) {
  const [value, setValue] = useState(() => (canAnimate() ? 0 : target));
  const ref = useRef<HTMLSpanElement | null>(null);

  useEffect(() => {
    if (!canAnimate()) return;

    let raf = 0;
    let started = false;

    const run = () => {
      started = true;
      const start = performance.now();
      const step = (now: number) => {
        const t = Math.min(1, (now - start) / durationMs);
        const eased = 1 - Math.pow(1 - t, 3); // ease-out-cubic
        setValue(Math.round(target * eased));
        if (t < 1) raf = requestAnimationFrame(step);
      };
      raf = requestAnimationFrame(step);
    };

    // Safety: if the number never scrolls into view, show the real value anyway.
    const fallback = window.setTimeout(() => {
      if (!started) {
        started = true;
        setValue(target);
      }
    }, 3500);

    const el = ref.current;
    let io: IntersectionObserver | null = null;
    if (el) {
      io = new IntersectionObserver(
        (entries) => {
          for (const entry of entries) {
            if (entry.isIntersecting && !started) {
              run();
              io?.disconnect();
            }
          }
        },
        { threshold: 0.35 },
      );
      io.observe(el);
    }

    return () => {
      io?.disconnect();
      cancelAnimationFrame(raf);
      window.clearTimeout(fallback);
    };
  }, [target, durationMs]);

  return { value, ref };
}
