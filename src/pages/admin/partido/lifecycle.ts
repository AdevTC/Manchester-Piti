// «Archivar…» / «Borrar…» of the match on screen: the match's layout owns the one dialog (MatchLifecycleDialog); a
// station that has its own button asks through this (useMatchLifecycle()(request)).
import { createContext, useContext } from "react";
import type { MatchLifecycleRequest } from "../data/archivedMatches";

export const LifecycleContext = createContext<((request: MatchLifecycleRequest) => void) | null>(null);

export function useMatchLifecycle(): (request: MatchLifecycleRequest) => void {
  const open = useContext(LifecycleContext);
  if (!open) throw new Error("useMatchLifecycle() needs the match's layout (partido/PartidoLayout).");
  return open;
}
