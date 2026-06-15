import { useEffect } from "react";

/**
 * Scroll-reveal as pure progressive enhancement. Elements marked `data-reveal`
 * are fully visible by default; only when JS runs AND motion is allowed do we
 * hide them and reveal on scroll-in. Reduced-motion / no-IntersectionObserver
 * leaves everything visible. A fallback timer guarantees nothing stays hidden.
 * Re-runs when `trigger` changes (e.g. async data finishes loading).
 */
export function useReveal(trigger?: unknown) {
  useEffect(() => {
    const reduce = window.matchMedia?.("(prefers-reduced-motion: reduce)").matches ?? false;
    if (reduce || typeof IntersectionObserver === "undefined") return;

    const els = Array.from(
      document.querySelectorAll<HTMLElement>("[data-reveal]:not(.mp-rv-in)"),
    );
    if (els.length === 0) return;
    els.forEach((el) => el.classList.add("mp-rv"));

    const io = new IntersectionObserver(
      (entries) => {
        for (const entry of entries) {
          if (entry.isIntersecting) {
            entry.target.classList.add("mp-rv-in");
            io.unobserve(entry.target);
          }
        }
      },
      { threshold: 0.18 },
    );
    els.forEach((el) => io.observe(el));

    const fallback = window.setTimeout(() => {
      els.forEach((el) => el.classList.add("mp-rv-in"));
    }, 4000);

    return () => {
      io.disconnect();
      window.clearTimeout(fallback);
    };
  }, [trigger]);
}
