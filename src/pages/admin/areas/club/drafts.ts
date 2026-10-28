// CLUB · the unsaved work of the rooms saved with a button (Clasificación, Turnos, Equipaciones): it lives here, out
// of the screen, so leaving the room keeps it (B-CLUB-09: the frame's guard asks first; «Salir sin guardar» leaves
// it as a draft for when you come back, «Descartar los cambios» drops it). One per room and season, this tab only.
import { useCallback, useSyncExternalStore } from "react";

const store = new Map<string, unknown>();
const listeners = new Set<() => void>();
const subscribe = (l: () => void) => {
  listeners.add(l);
  return () => {
    listeners.delete(l);
  };
};
const emit = () => listeners.forEach((l) => l());

export function readDraft<T>(key: string): T | null {
  return (store.get(key) as T | undefined) ?? null;
}
export function writeDraft<T>(key: string, value: T | null): void {
  if (value === null) store.delete(key);
  else store.set(key, value);
  emit();
}
/** Tests: forget every draft. */
export function resetRoomDraftsForTests(): void {
  store.clear();
  emit();
}

/** The room's draft for `key` and its setter (null drops it). */
export function useRoomDraft<T>(key: string): [T | null, (next: T | null | ((cur: T | null) => T | null)) => void] {
  const value = useSyncExternalStore(
    subscribe,
    () => readDraft<T>(key),
    () => null,
  );
  const set = useCallback(
    (next: T | null | ((cur: T | null) => T | null)) => {
      const v = typeof next === "function" ? (next as (cur: T | null) => T | null)(readDraft<T>(key)) : next;
      writeDraft(key, v);
    },
    [key],
  );
  return [value, set];
}

/** Whether a room has a draft (the office's doors say «Sin guardar»). */
export function useHasDraft(key: string): boolean {
  return useSyncExternalStore(
    subscribe,
    () => store.has(key),
    () => false,
  );
}
