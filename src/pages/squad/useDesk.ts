import { useSyncExternalStore } from "react";

/** The ficha's two-column desktop layout (squad.css switches at the same width). No matchMedia (tests,
 *  old browsers, SSR) counts as the phone sheet. */
const DESK_QUERY = "(min-width: 900px)";
const deskList = (): MediaQueryList | null => (typeof window !== "undefined" && typeof window.matchMedia === "function" ? window.matchMedia(DESK_QUERY) : null);
function subscribeDesk(cb: () => void): () => void {
  const m = deskList();
  if (!m) return () => {};
  m.addEventListener("change", cb);
  return () => m.removeEventListener("change", cb);
}
const deskNow = () => deskList()?.matches ?? false;
export const useDesk = (): boolean => useSyncExternalStore(subscribeDesk, deskNow, () => false);
