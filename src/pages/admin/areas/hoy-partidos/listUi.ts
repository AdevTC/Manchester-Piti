// HOY Y PARTIDOS · the season list's filter and search: they survive «Nuevo partido» and a visit to a match (one
// tab: module state, an immutable snapshot per change).
import type { Group } from "./matchWords";

export type Filter = "todo" | "toca" | Group;
const ui = { filter: "todo" as Filter, q: "" };
const listeners = new Set<() => void>();
let snap = { ...ui };
export const listUi = {
  get: () => snap,
  subscribe: (l: () => void) => {
    listeners.add(l);
    return () => void listeners.delete(l);
  },
  set: (o: Partial<typeof ui>) => {
    snap = { ...snap, ...o };
    listeners.forEach((l) => l());
  },
};
/** Tests start clean. */
export const resetListUi = () => listUi.set({ filter: "todo", q: "" });
