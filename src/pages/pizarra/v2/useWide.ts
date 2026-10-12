// The board's breakpoints in JS, for what is rendered only once where the CSS would show it: the desktop
// bench (the FUT list rows, from 1100 px; the cromo strip below) and the selected player's bar (the
// phone's sheet under 700 px; the pitch's apron above). No matchMedia (tests, old browsers) counts as a
// desktop: the list, the apron. (pizarra-app.css keeps whatever is rendered visible at the edges, where
// the container and the viewport may differ by a scrollbar.)
import { useSyncExternalStore } from "react";

export const WIDE_QUERY = "(min-width: 1100px)";
export const PHONE_QUERY = "(max-width: 699px)";

const mq = (q: string): MediaQueryList | null => (typeof window !== "undefined" && typeof window.matchMedia === "function" ? window.matchMedia(q) : null);

function subscriber(q: string) {
  return (cb: () => void): (() => void) => {
    const m = mq(q);
    if (!m) return () => {};
    if (typeof m.addEventListener === "function") {
      m.addEventListener("change", cb);
      return () => m.removeEventListener("change", cb);
    }
    m.addListener(cb);
    return () => m.removeListener(cb);
  };
}
const subWide = subscriber(WIDE_QUERY);
const subPhone = subscriber(PHONE_QUERY);
const wideNow = (): boolean => mq(WIDE_QUERY)?.matches ?? true;
const phoneNow = (): boolean => mq(PHONE_QUERY)?.matches ?? false;

/** 1100 px and up: the desktop bench. */
export function useWide(): boolean {
  return useSyncExternalStore(subWide, wideNow, () => true);
}
/** Under 700 px: the phone (the selected player's bar sits at the top of the sheet). */
export function usePhone(): boolean {
  return useSyncExternalStore(subPhone, phoneNow, () => false);
}

/** The bench view actually rendered: the list only where it is shown (wide), else the cromos. */
export const shownBench = (view: "lista" | "cromos", wide: boolean): "lista" | "cromos" => (view === "lista" && wide ? "lista" : "cromos");
