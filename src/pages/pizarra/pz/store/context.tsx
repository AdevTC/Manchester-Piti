// r14 «La pizarra»: the store in React. `usePz()` returns the page's store and re-renders on every change (the
// prototype's subscribe-and-setState idiom, with useSyncExternalStore).
//
// The app builds with the React Compiler, which memoises a component's work on the identity of what it reads. The
// store itself never changes identity, so `usePz()` hands out a new facade per version: the same store (its methods,
// its live `state`) under a new object, with a new `sel`. A component that only calls `P.sel.*` still re-renders
// with fresh answers. (Read through `P.sel` / `P.state`, never keep a selector's result across renders.)
import { createContext, useContext, useMemo, useSyncExternalStore } from "react";
import type { PzApi } from "./api";

/** The page's store (PzProvider puts it here). */
export const PzContext = createContext<PzApi | null>(null);

/** The store under a new identity (its version's), so memoised renders see a change. */
export function facade(P: PzApi, version: number): PzApi {
  const f = Object.create(P) as PzApi;
  Object.defineProperty(f, "sel", { value: { ...P.sel }, enumerable: true });
  Object.defineProperty(f, "seen", { value: version });
  return f;
}

/** The pizarra's store; the component re-renders when anything in it changes. */
export function usePz(): PzApi {
  const P = useContext(PzContext);
  if (!P) throw new Error("usePz() fuera de la pizarra (falta <PzProvider>)");
  const v = useSyncExternalStore(
    P.subscribe,
    () => P.v,
    () => P.v,
  );
  return useMemo(() => facade(P, v), [P, v]);
}

const noSub = () => () => undefined;
/** usePz() for the toast: it also re-renders when only the toast changed (its own expiry — the store's quiet
 *  version), which redraws nobody else. */
export function usePzToast(): PzApi {
  const P = useContext(PzContext);
  if (!P) throw new Error("usePzToast() fuera de la pizarra (falta <PzProvider>)");
  const v = useSyncExternalStore(
    P.subscribe,
    () => P.v,
    () => P.v,
  );
  const tv = useSyncExternalStore(
    P.subscribeQuiet ?? noSub,
    () => P.tv ?? 0,
    () => P.tv ?? 0,
  );
  // (a new facade for either version: the compiled Toast sees the change)
  return useMemo(() => facade(P, v * 65536 + tv), [P, v, tv]);
}
