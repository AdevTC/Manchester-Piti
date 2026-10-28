// TEMPORARY (r12, until wave 2 replaces each screen): today's views read what they show from the old addresses'
// parameters (?jugador=, ?nuevo=, ?vista=, ?coste=, ?seccion=, ?j=…). The new addresses name those things in the
// path, so each new screen hands them over here and the old view reads them with useViewSearch() instead of
// useSearch({ strict: false }). Their own navigations to the old addresses still land on the new ones: the router
// redirects every old address (lib/adminUrls). Delete this file with the last old view.
import { createContext, useContext } from "react";
import { useSearch } from "@tanstack/react-router";

export type ViewSearch = Record<string, unknown>;
export const InterimSearchContext = createContext<ViewSearch | null>(null);

/** The address' search parameters, with what the new screen says on top (see above). */
export function useViewSearch<T = ViewSearch>(): T {
  const search = useSearch({ strict: false }) as ViewSearch;
  const given = useContext(InterimSearchContext);
  return (given ? { ...search, ...given } : search) as T;
}
