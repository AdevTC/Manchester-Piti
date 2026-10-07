// The board is an app screen: tapping it never moves the page. Right after a tap or a key on the board,
// a page scroll the user didn't make (focus, a layout change, the browser re-anchoring) is put back.
// Any sign of the user scrolling (wheel, a new touch, scroll keys, the scrollbar) ends the watch.
import { useEffect, type RefObject } from "react";

const WATCH_MS = 1500;
const SCROLL_KEYS = new Set([" ", "PageDown", "PageUp", "Home", "End", "ArrowDown", "ArrowUp"]);

export function useNoScrollJump(root: RefObject<HTMLElement | null>) {
  useEffect(() => {
    const el = root.current;
    if (!el || typeof window === "undefined") return;
    let y = 0;
    let until = 0;
    const watch = () => {
      y = window.scrollY;
      until = Date.now() + WATCH_MS;
    };
    const userScrolls = () => {
      until = 0;
    };
    // Bubbling, so the board's own keys (arrows moving a cromo) have already claimed theirs.
    const onKey = (e: KeyboardEvent) => {
      if (SCROLL_KEYS.has(e.key) && !e.defaultPrevented) userScrolls();
    };
    const onPointer = (e: PointerEvent) => {
      if (!el.contains(e.target as Node)) userScrolls();
    };
    const onScroll = () => {
      if (Date.now() < until && Math.abs(window.scrollY - y) > 1) window.scrollTo({ top: y, behavior: "instant" });
    };
    el.addEventListener("click", watch, true);
    window.addEventListener("wheel", userScrolls, { passive: true });
    window.addEventListener("touchstart", userScrolls, { passive: true });
    window.addEventListener("keydown", onKey);
    window.addEventListener("pointerdown", onPointer, true);
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => {
      el.removeEventListener("click", watch, true);
      window.removeEventListener("wheel", userScrolls);
      window.removeEventListener("touchstart", userScrolls);
      window.removeEventListener("keydown", onKey);
      window.removeEventListener("pointerdown", onPointer, true);
      window.removeEventListener("scroll", onScroll);
    };
  }, [root]);
}
