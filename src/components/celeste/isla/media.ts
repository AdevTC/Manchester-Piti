// The two media facts the island draws by: which device layout (phone < 700 px ≤ tablet < 1100 px ≤ desktop) and
// whether the viewer asked for less motion. Read live (a resize or a settings change redraws); without
// matchMedia (tests, the server) it is a phone with motion.
import { useSyncExternalStore } from "react";

export type IslaDevice = "movil" | "tablet" | "escritorio";

const query = (q: string): MediaQueryList | null => (typeof window !== "undefined" && typeof window.matchMedia === "function" ? window.matchMedia(q) : null);

function useMedia(q: string): boolean {
  return useSyncExternalStore(
    (on) => {
      const m = query(q);
      if (!m || typeof m.addEventListener !== "function") return () => undefined;
      m.addEventListener("change", on);
      return () => m.removeEventListener("change", on);
    },
    () => !!query(q)?.matches,
    () => false,
  );
}

export function useIslaDevice(): IslaDevice {
  const desk = useMedia("(min-width: 1100px)");
  const tab = useMedia("(min-width: 700px)");
  return desk ? "escritorio" : tab ? "tablet" : "movil";
}

export const useReducedMotion = (): boolean => useMedia("(prefers-reduced-motion: reduce)");
