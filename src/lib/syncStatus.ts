// Snapshot metadata of the shared realtime listeners (useFirestoreCollection's registry and the vestuario
// `useShared` one), kept apart from the data: a metadata-only snapshot (cache → server, a write acknowledged)
// updates this store and nothing else, so consumers that only read data never re-render for it. Read it
// with `useSnapshotMeta(key)`, or `useSyncStatus()` for the «¿está al día el marcador?» question.
// No window/navigator access at import time: safe for the server render.
import { useMemo, useSyncExternalStore } from "react";

export interface SnapshotMeta {
  /** The last snapshot came from the local cache (offline, or not yet confirmed by the server). */
  fromCache: boolean;
  /** The last snapshot includes local writes the server hasn't acknowledged yet. */
  hasPendingWrites: boolean;
  /** Epoch ms of the last snapshot that came from the server; null if none has (yet). */
  since: number | null;
}

/** After a listener dies (rules, network, quota), the registry reopens it once after this long if it still has readers. */
export const LISTENER_RETRY_MS = 5_000;

/** The meta key of a TanStack registry entry: its serialized queryKey (the registry's own hash). */
export const metaKeyOf = (queryKey: readonly unknown[]): string => JSON.stringify(queryKey);
const MATCHES_META_KEY = metaKeyOf(["matches"]);

const metas = new Map<string, SnapshotMeta>();
const listeners = new Set<() => void>();
const notify = () => listeners.forEach((l) => l());

/** Records the metadata of a snapshot. Same values → no change, no notification. */
export function recordSnapshotMeta(key: string, m: { fromCache: boolean; hasPendingWrites: boolean }, now: number = Date.now()): void {
  const prev = metas.get(key);
  const since = m.fromCache ? (prev?.since ?? null) : now;
  if (prev && prev.fromCache === m.fromCache && prev.hasPendingWrites === m.hasPendingWrites && prev.since === since) return;
  metas.set(key, { fromCache: m.fromCache, hasPendingWrites: m.hasPendingWrites, since });
  notify();
}

/** The listener behind `key` stopped (error or closed): whatever it last said is no longer live. Keeps `since`. */
export function markListenerStale(key: string): void {
  const prev = metas.get(key);
  if (!prev || prev.fromCache) return;
  metas.set(key, { ...prev, fromCache: true });
  notify();
}

export const getSnapshotMeta = (key: string): SnapshotMeta | null => metas.get(key) ?? null;

function subscribeMeta(cb: () => void): () => void {
  listeners.add(cb);
  return () => {
    listeners.delete(cb);
  };
}

/** Live metadata of one shared listener key (null until its first snapshot). Identity changes only when a value does. */
export function useSnapshotMeta(key: string): SnapshotMeta | null {
  return useSyncExternalStore(
    subscribeMeta,
    () => getSnapshotMeta(key),
    () => null,
  );
}

/** Test-only: forget every recorded metadata. */
export function _resetSnapshotMetaForTesting(): void {
  metas.clear();
  notify();
}

// ---------- navigator.onLine
const onlineNow = (): boolean => (typeof navigator === "undefined" ? true : navigator.onLine !== false);
function subscribeOnline(cb: () => void): () => void {
  window.addEventListener("online", cb);
  window.addEventListener("offline", cb);
  return () => {
    window.removeEventListener("online", cb);
    window.removeEventListener("offline", cb);
  };
}
/** Whether the device says it is online (live: the «online» / «offline» events). */
export const useOnline = (): boolean => useSyncExternalStore(subscribeOnline, onlineNow, () => true);

export interface SyncStatus {
  /** The device says it has a connection. */
  online: boolean;
  /** The last ["matches"] snapshot came from the server, not the cache. */
  fresh: boolean;
  /** Epoch ms of the last ["matches"] snapshot from the server (null: none yet). */
  since: number | null;
}

/** Is the score on screen live? Combines `navigator.onLine` with the cache state of the shared ["matches"] listener. */
export function useSyncStatus(): SyncStatus {
  const online = useOnline();
  const meta = useSnapshotMeta(MATCHES_META_KEY);
  return useMemo(() => ({ online, fresh: !!meta && !meta.fromCache, since: meta?.since ?? null }), [online, meta]);
}
