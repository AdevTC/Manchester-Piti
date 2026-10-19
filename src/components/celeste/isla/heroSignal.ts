// (Retired with the island: the «Vidrio» live score reads liveDock — components/vidrio/liveDock useLiveDock.
// Until the old Inicio/Partidos heroes that call this are replaced, useIslaHero also declares the hero as the
// page's live lens, so the floating score steps aside there as the island did.)
// «The hero already is the match»: while a page's hero (Inicio's ground, Partidos' night block) is on screen the
// live island steps aside, and it comes back on scroll. A page calls useIslaHero(ref) on its hero; while that
// element intersects the viewport, html[data-isla-hero="1"] is set and styles/isla.css hid the island (it
// stays mounted: its live region still speaks, the score keeps ticking). Several heroes may report at once:
// the flag stays while any of them is in view.
import { useEffect, useSyncExternalStore, type RefObject } from "react";
import { useLiveDock } from "../../vidrio/liveDock";

const inView = new Set<object>();
const listeners = new Set<() => void>();

function publish(): void {
  listeners.forEach((l) => l());
  if (typeof document === "undefined") return;
  const root = document.documentElement;
  if (inView.size) root.dataset.islaHero = "1";
  else delete root.dataset.islaHero;
}

/** Whether some page's hero is on screen now (the island reads it: it doesn't say a play the hero shows). */
export function useIslaHeroShown(): boolean {
  return useSyncExternalStore(
    (on) => {
      listeners.add(on);
      return () => listeners.delete(on);
    },
    () => inView.size > 0,
    () => false,
  );
}

/** Marks `key` as on screen or not, and updates the flag (exported for tests and for pages without a ref). */
export function setIslaHero(key: object, visible: boolean): void {
  if (visible) inView.add(key);
  else inView.delete(key);
  publish();
}

/** While `ref`'s element is in view, the island hides (html[data-isla-hero="1"]). Without IntersectionObserver
 *  (old browsers, tests) the hero counts as on screen while mounted. */
export function useIslaHero(ref: RefObject<Element | null>): void {
  useLiveDock(ref, "lens");
  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const key = {};
    if (typeof IntersectionObserver !== "function") {
      setIslaHero(key, true);
      return () => setIslaHero(key, false);
    }
    // (a sliver of hero at the top edge doesn't count: the island comes back as the score leaves the screen)
    const io = new IntersectionObserver(([entry]) => setIslaHero(key, !!entry?.isIntersecting), { rootMargin: "-56px 0px 0px 0px" });
    io.observe(el);
    return () => {
      io.disconnect();
      setIslaHero(key, false);
    };
  }, [ref]);
}
