// A station's one primary action, drawn by the match's layout where law 6 puts it: at the end of the match's head on
// the desktop, pinned above the foot on the phone and the tablet. The station on screen registers it while mounted.
import { createContext, useContext, useEffect, useSyncExternalStore } from "react";
import type { PrimarySpec } from "../shell/Screen";

export class PrimaryStore {
  private spec: PrimarySpec | null = null;
  private listeners = new Set<() => void>();
  set(spec: PrimarySpec | null) {
    this.spec = spec;
    this.listeners.forEach((l) => l());
  }
  subscribe = (l: () => void) => {
    this.listeners.add(l);
    return () => {
      this.listeners.delete(l);
    };
  };
  current = () => this.spec;
}
export const PrimaryContext = createContext<PrimaryStore | null>(null);

export function useStationPrimaryValue(store: PrimaryStore): PrimarySpec | null {
  return useSyncExternalStore(store.subscribe, store.current, () => null);
}

/** The station's primary action (pass a memoized spec, or null for none). */
export function useStationPrimary(spec: PrimarySpec | null): void {
  const store = useContext(PrimaryContext);
  useEffect(() => {
    store?.set(spec);
    return () => store?.set(null);
  }, [store, spec]);
}
