// r14 «La pizarra»: the store in React. `usePz()` returns the page's store and re-renders on every change (the
// prototype's subscribe-and-setState idiom, with useSyncExternalStore).
import { createContext, useContext, useSyncExternalStore, type ReactNode } from "react";
import type { PzApi } from "./api";

const PzContext = createContext<PzApi | null>(null);

export function PzProvider({ store, children }: { store: PzApi; children: ReactNode }) {
  return <PzContext.Provider value={store}>{children}</PzContext.Provider>;
}

/** The pizarra's store; the component re-renders when anything in it changes. */
export function usePz(): PzApi {
  const P = useContext(PzContext);
  if (!P) throw new Error("usePz() fuera de la pizarra (falta <PzProvider>)");
  useSyncExternalStore(
    P.subscribe,
    () => P.v,
    () => P.v,
  );
  return P;
}
