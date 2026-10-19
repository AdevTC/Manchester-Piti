// The one light source of the glass: --vd-lx / --vd-ly (0..1) on `ref` follow the pointer, or the phone's tilt,
// at most once a frame. The specular highlight and the rim of every .vd-glass inside read them. Reduced motion
// and the design shots keep the resting light.
import { useEffect, type RefObject } from "react";
import { isShot, prefersReducedMotion } from "./env";

/** Pointer position inside a box → the light (y is damped: the light stays high). */
export function lightFromPointer(x: number, y: number, box: { left: number; top: number; width: number; height: number }): { lx: number; ly: number } {
  const clamp = (v: number) => Math.max(0, Math.min(1, v));
  return { lx: clamp((x - box.left) / (box.width || 1)), ly: clamp((y - box.top) / (Math.min(box.height, 1000) || 1)) * 0.6 };
}

/** Device tilt (gamma, beta in degrees) → the light. */
export function lightFromTilt(gamma: number, beta: number): { lx: number; ly: number } {
  return { lx: Math.max(0, Math.min(1, 0.5 + gamma / 60)), ly: Math.max(0, Math.min(0.6, (beta - 20) / 90)) };
}

export function useLightPointer(ref: RefObject<HTMLElement | null>): void {
  useEffect(() => {
    const root = ref.current;
    if (!root || isShot() || prefersReducedMotion()) return;
    let raf = 0;
    let lx = 0.28;
    let ly = 0;
    const set = () => {
      raf = 0;
      root.style.setProperty("--vd-lx", lx.toFixed(3));
      root.style.setProperty("--vd-ly", ly.toFixed(3));
    };
    const queue = () => {
      if (!raf) raf = requestAnimationFrame(set);
    };
    const move = (e: PointerEvent) => {
      ({ lx, ly } = lightFromPointer(e.clientX, e.clientY, root.getBoundingClientRect()));
      queue();
    };
    const tilt = (e: DeviceOrientationEvent) => {
      if (e.gamma == null || e.beta == null) return;
      ({ lx, ly } = lightFromTilt(e.gamma, e.beta));
      queue();
    };
    root.addEventListener("pointermove", move);
    window.addEventListener("deviceorientation", tilt);
    return () => {
      if (raf) cancelAnimationFrame(raf);
      root.removeEventListener("pointermove", move);
      window.removeEventListener("deviceorientation", tilt);
    };
  }, [ref]);
}
