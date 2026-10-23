// The one light source of the glass: --vd-lx / --vd-ly (0..1) on `ref` follow a mouse or a pen, at most once a
// frame. The specular highlight and the rim of every .vd-glass inside read them. A finger never moves it (on a
// phone the light keeps its resting place, as under reduced motion and in the design shots).
import { useEffect, type RefObject } from "react";
import { isShot, prefersReducedMotion } from "./env";

/** Pointer position inside a box → the light (y is damped: the light stays high). */
export function lightFromPointer(x: number, y: number, box: { left: number; top: number; width: number; height: number }): { lx: number; ly: number } {
  const clamp = (v: number) => Math.max(0, Math.min(1, v));
  return { lx: clamp((x - box.left) / (box.width || 1)), ly: clamp((y - box.top) / (Math.min(box.height, 1000) || 1)) * 0.6 };
}

/** Only a mouse or a pen moves the light (a touch is a tap or a scroll, not a lamp). */
export const movesLight = (pointerType: string): boolean => pointerType !== "touch";

/** Writes the light rounded to 3 decimals, skipping the style write when the rounded value has not changed. */
export function lightWriter(style: Pick<CSSStyleDeclaration, "setProperty">): (lx: number, ly: number) => void {
  let wx = "";
  let wy = "";
  return (lx, ly) => {
    const x = lx.toFixed(3);
    const y = ly.toFixed(3);
    if (x !== wx) style.setProperty("--vd-lx", (wx = x));
    if (y !== wy) style.setProperty("--vd-ly", (wy = y));
  };
}

export function useLightPointer(ref: RefObject<HTMLElement | null>): void {
  useEffect(() => {
    const root = ref.current;
    if (!root || isShot() || prefersReducedMotion()) return;
    const write = lightWriter(root.style);
    let raf = 0;
    let px = 0;
    let py = 0;
    // (the box is read in the frame, once, however many moves came in)
    const set = () => {
      raf = 0;
      const { lx, ly } = lightFromPointer(px, py, root.getBoundingClientRect());
      write(lx, ly);
    };
    const move = (e: PointerEvent) => {
      if (!movesLight(e.pointerType) || document.hidden) return;
      px = e.clientX;
      py = e.clientY;
      if (!raf) raf = requestAnimationFrame(set);
    };
    root.addEventListener("pointermove", move);
    return () => {
      if (raf) cancelAnimationFrame(raf);
      root.removeEventListener("pointermove", move);
    };
  }, [ref]);
}
