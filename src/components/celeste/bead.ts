// The capsule's bead (Vidrio chrome): one glass bead per capsule, measured on its current link
// (aria-current="page"), that springs from where the last page left it and stretches like a drop of liquid glass on
// the way. Shared by the web's capsule and tab bar (Chrome.tsx) and the Sala de control's capsule and dock.
import { useLayoutEffect, type RefObject } from "react";
import { prefersReducedMotion } from "../vidrio/env";

/** Where each capsule's bead last sat (per capsule), so the next page's bead starts there and slides over. */
const lastBead = new Map<string, { x: number; w: number }>();

/** The bead travels like a drop of liquid glass: it stretches the way it goes and squeezes, then settles with a
 *  little give, more the further it goes (a tab away barely, across the bar fully). Around itself: its `scale`
 *  composes with the `translate` that carries it (chrome.css). Not with reduced motion. */
function stretch(bead: Element | null, dx: number) {
  if (!(bead instanceof HTMLElement) || typeof bead.animate !== "function" || prefersReducedMotion() || Math.abs(dx) < 3) return;
  const k = Math.min(1, Math.max(0.35, Math.abs(dx) / 300)) * 0.16;
  const s = (x: number, y: number) => `${(1 + x).toFixed(3)} ${(1 + y).toFixed(3)}`;
  bead.animate([{ scale: "1 1" }, { scale: s(k, -k * 0.55), offset: 0.3 }, { scale: s(-k * 0.18, k * 0.12), offset: 0.62 }, { scale: s(k * 0.05, -k * 0.03), offset: 0.82 }, { scale: "1 1" }], {
    duration: 640,
    easing: "cubic-bezier(.3,.7,.4,1)",
  });
}

/** One bead per capsule: measured on the current link, it springs from where the last page left it. */
export function useBead(ref: RefObject<HTMLElement | null>, id: string, active: string | undefined, deps: unknown) {
  useLayoutEffect(() => {
    const box = ref.current;
    if (!box) return;
    // (`travel`: the slide from the last page's place, the one that stretches; a resize only moves it)
    const place = (travel = false) => {
      const on = box.querySelector<HTMLElement>('a[aria-current="page"]');
      if (!on || !on.offsetWidth) {
        box.style.setProperty("--vd-bw", "0px");
        return;
      }
      // (measured against the capsule itself, whatever wraps the link)
      const r = on.getBoundingClientRect();
      const b = box.getBoundingClientRect();
      const x = Math.round(r.left - b.left - box.clientLeft);
      const w = Math.round(r.width);
      const from = lastBead.get(id);
      box.style.setProperty("--vd-bx", `${x}px`);
      box.style.setProperty("--vd-bw", `${w}px`);
      lastBead.set(id, { x, w });
      if (travel && from) stretch(box.querySelector(".vd-bead"), x - from.x);
    };
    const before = lastBead.get(id);
    if (before) {
      // (start where the last page left it, then slide: the bead is one object travelling between pages)
      box.style.setProperty("--vd-bx", `${before.x}px`);
      box.style.setProperty("--vd-bw", `${before.w}px`);
      box.dataset.vdBeadStill = "";
      void box.offsetWidth;
      delete box.dataset.vdBeadStill;
      const raf = requestAnimationFrame(() => place(true));
      const ro = typeof ResizeObserver === "function" ? new ResizeObserver(() => place()) : null;
      ro?.observe(box);
      return () => {
        cancelAnimationFrame(raf);
        ro?.disconnect();
      };
    }
    box.dataset.vdBeadStill = "";
    place();
    const raf = requestAnimationFrame(() => delete box.dataset.vdBeadStill);
    const ro = typeof ResizeObserver === "function" ? new ResizeObserver(() => place()) : null;
    ro?.observe(box);
    return () => {
      cancelAnimationFrame(raf);
      ro?.disconnect();
    };
  }, [ref, id, active, deps]);
}
