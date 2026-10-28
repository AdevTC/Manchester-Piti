// The sala's one season picker (r12, pending from the round: «un selector de temporada único en el marco»). The
// season lives in the address as the root's `?season=` (the redirects keep it; memory url-rewrites-keep-season):
// a season the club has picks it, anything else («all», none, an unknown id) is la de ahora. Every screen reads
// the result as useAdmin().season; the frame's account menu is where it changes.
import { useCallback, useSyncExternalStore } from "react";
import { useSetSeason } from "../../../lib/useSetSeason";
import { useAdmin } from "./context";

export { useSeasonParam } from "./salaHref";

export interface SalaSeason {
  /** The season shown (null before the seasons arrive, or with none). */
  season: { id: string; name: string } | null;
  /** La de ahora (the next match's season…). */
  current: { id: string; name: string } | null;
  /** The seasons to pick from, newest first (archived ones last, marked). */
  options: { id: string; name: string; archived: boolean; current: boolean }[];
  pick: (id: string) => void;
}

export function useSalaSeason(): SalaSeason {
  const data = useAdmin();
  const set = useSetSeason();
  const pick = useCallback((id: string) => set(id), [set]);
  const options = [...data.seasons]
    .reverse()
    .sort((a, b) => Number(!!a.archived) - Number(!!b.archived))
    .map((s) => ({ id: s.id, name: s.name, archived: !!s.archived, current: s.id === data.autoSeason?.id }));
  return {
    season: data.season ? { id: data.season.id, name: data.season.name } : null,
    current: data.autoSeason ? { id: data.autoSeason.id, name: data.autoSeason.name } : null,
    options,
    pick,
  };
}

// ---------- the network (M-22: offline, the sala says what is kept here and what needs the network)
const subscribe = (cb: () => void) => {
  window.addEventListener("online", cb);
  window.addEventListener("offline", cb);
  return () => {
    window.removeEventListener("online", cb);
    window.removeEventListener("offline", cb);
  };
};
/** false while the browser says it is offline. */
export function useOnline(): boolean {
  return useSyncExternalStore(
    subscribe,
    () => navigator.onLine,
    () => true,
  );
}
/** What the sala says offline (the banner and the strip at rest). */
export const OFFLINE_LINE = "Lo de la plantilla, la caja y el club se guarda en este dispositivo y se sube solo al volver la red; el acta y la convocatoria necesitan red.";
