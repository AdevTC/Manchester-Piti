// What a screen tells the frame about itself: the title and the line of the phone/tablet header, «‹ Volver»
// (where to and its name: with one, the dock hides) and the tab's title. A screen calls useSalaHead() while it is
// mounted; the deepest one wins (`level`: a screen 2, a layout around screens — the match — 1; on a tie, the last
// registered). Without one the frame uses places.ts' defaults for the address.
import { createContext, useContext, useEffect, useId, useMemo, useSyncExternalStore } from "react";

export interface SalaHead {
  title: string;
  /** The line under the title (phone and tablet; the desktop screen head shows its own). */
  sub?: string;
  /** «‹ Volver»: an address of the sala and its accessible name («Volver a Partidos»). */
  back?: { to: string; label: string };
}

export class HeadStore {
  private list: { id: string; level: number; head: SalaHead }[] = [];
  private top: SalaHead | null = null;
  private listeners = new Set<() => void>();
  set(id: string, head: SalaHead | null, level = 2) {
    const rest = this.list.filter((e) => e.id !== id);
    this.list = head ? [...rest, { id, level, head }] : rest;
    this.top = this.list.reduce<{ level: number; head: SalaHead } | null>((best, e) => (!best || e.level >= best.level ? e : best), null)?.head ?? null;
    this.listeners.forEach((l) => l());
  }
  subscribe = (l: () => void) => {
    this.listeners.add(l);
    return () => {
      this.listeners.delete(l);
    };
  };
  current = (): SalaHead | null => this.top;
}
export const HeadContext = createContext<HeadStore | null>(null);

/** The head a screen registered (null = the address' defaults). */
export function useRegisteredHead(): SalaHead | null {
  const store = useContext(HeadContext);
  const subscribe = useMemo(() => store?.subscribe ?? (() => () => undefined), [store]);
  return useSyncExternalStore(subscribe, () => store?.current() ?? null, () => null);
}

/** A screen's title, line and way back for the frame. Pass null while it does not know yet. `level`: 2 for a
 *  screen (the default), 1 for a layout around screens. */
export function useSalaHead(head: SalaHead | null, level = 2): void {
  const store = useContext(HeadContext);
  const id = useId();
  const title = head?.title;
  const sub = head?.sub;
  const to = head?.back?.to;
  const label = head?.back?.label;
  useEffect(() => {
    store?.set(id, title === undefined ? null : { title, sub, back: to ? { to, label: label ?? "Volver" } : undefined }, level);
  }, [store, id, title, sub, to, label, level]);
  useEffect(() => () => store?.set(id, null), [store, id]);
}
