// /profile «La carta»: the motion plumbing — reduced motion, the loops that pause offscreen
// ([data-paused] via IntersectionObserver, and the whole page while the tab is hidden), and the living
// card's tilt (pointer always; the phone's gyro when «Brillo al inclinar» is on — on iOS only after the
// permission asked from a tap). Everything writes CSS custom properties: no re-renders.
import { useCallback, useEffect, useRef, useState } from "react";

export function prefersReducedMotion(): boolean {
  try {
    return typeof window !== "undefined" && !!window.matchMedia?.("(prefers-reduced-motion: reduce)").matches;
  } catch {
    return false;
  }
}

/** The device's «reduce motion», live (Ajustes › Animaciones follows it as it changes). */
export function useReducedMotion(): boolean {
  const [rm, setRm] = useState(prefersReducedMotion);
  useEffect(() => {
    let mq: MediaQueryList | undefined;
    try {
      mq = window.matchMedia?.("(prefers-reduced-motion: reduce)");
    } catch {
      return;
    }
    if (!mq) return;
    const on = () => setRm(!!mq?.matches);
    mq.addEventListener?.("change", on);
    return () => mq?.removeEventListener?.("change", on);
  }, []);
  return rm;
}

/** A ref callback: each element it gets pauses its loops ([data-paused]) while it is offscreen. */
export function usePauseOffscreen(): (el: Element | null) => void {
  const io = useRef<IntersectionObserver | null>(null);
  useEffect(() => () => io.current?.disconnect(), []);
  return useCallback((el: Element | null) => {
    if (!el || typeof window === "undefined" || !("IntersectionObserver" in window)) return;
    if (!io.current)
      io.current = new IntersectionObserver((entries) =>
        entries.forEach((e) => {
          if (e.isIntersecting) e.target.removeAttribute("data-paused");
          else e.target.setAttribute("data-paused", "");
        }),
      );
    io.current.observe(el);
  }, []);
}

/** The page's loops also stop while the tab is hidden. */
export function usePauseHidden(root: { current: HTMLElement | null }): void {
  useEffect(() => {
    const sync = () => {
      const el = root.current;
      if (!el) return;
      if (document.hidden) el.setAttribute("data-paused", "");
      else el.removeAttribute("data-paused");
    };
    document.addEventListener("visibilitychange", sync);
    sync();
    return () => document.removeEventListener("visibilitychange", sync);
  }, [root]);
}

const clamp = (v: number) => Math.max(-1, Math.min(1, v));

/**
 * The card follows the pointer and (with `gyro`) the phone: --rx/--ry tilt it, --px/--py move the foil
 * and the glare, --hy is how hard you tilt. Off with reduced motion. Returns the ref for the card.
 */
export function useTilt(opts: { gyro: boolean; rm: boolean; gyroAllowed: boolean }): (el: HTMLElement | null) => void {
  const el = useRef<HTMLElement | null>(null);
  const frame = useRef(0);
  const want = useRef<[number, number, number]>([0, 0, 0]);
  const apply = useCallback(() => {
    frame.current = 0;
    const e = el.current;
    if (!e) return;
    const [px, py, h] = want.current;
    e.style.setProperty("--rx", (py * -9).toFixed(2) + "deg");
    e.style.setProperty("--ry", (px * 12).toFixed(2) + "deg");
    e.style.setProperty("--px", px.toFixed(3));
    e.style.setProperty("--py", py.toFixed(3));
    e.style.setProperty("--hy", h.toFixed(2));
  }, []);
  const tilt = useCallback(
    (px: number, py: number, h: number) => {
      want.current = [px, py, h];
      if (!frame.current) frame.current = requestAnimationFrame(apply);
    },
    [apply],
  );
  const { rm, gyro, gyroAllowed } = opts;
  // The gyro: only with the pref on (and, on iOS, once allowed); off → the card comes back to rest.
  useEffect(() => {
    if (rm || !gyro || !gyroAllowed || typeof window === "undefined" || !("DeviceOrientationEvent" in window)) return;
    const on = (e: DeviceOrientationEvent) => {
      if (e.gamma == null || e.beta == null) return;
      tilt(clamp(e.gamma / 35), clamp((e.beta - 45) / 35), 0.7);
    };
    window.addEventListener("deviceorientation", on);
    return () => {
      window.removeEventListener("deviceorientation", on);
      tilt(0, 0, 0);
    };
  }, [rm, gyro, gyroAllowed, tilt]);
  useEffect(() => () => cancelAnimationFrame(frame.current), []);
  // The pointer, on the card itself.
  const handlers = useRef<{ move: (e: PointerEvent) => void; leave: () => void } | null>(null);
  return useCallback(
    (node: HTMLElement | null) => {
      const prev = el.current;
      if (prev && handlers.current) {
        prev.removeEventListener("pointermove", handlers.current.move);
        prev.removeEventListener("pointerleave", handlers.current.leave);
      }
      el.current = node;
      if (!node || rm) return;
      const move = (e: PointerEvent) => {
        const r = node.getBoundingClientRect();
        if (!r.width || !r.height) return;
        tilt(clamp(((e.clientX - r.left) / r.width) * 2 - 1), clamp(((e.clientY - r.top) / r.height) * 2 - 1), 1);
      };
      const leave = () => tilt(0, 0, 0);
      handlers.current = { move, leave };
      node.addEventListener("pointermove", move);
      node.addEventListener("pointerleave", leave);
    },
    [rm, tilt],
  );
}
