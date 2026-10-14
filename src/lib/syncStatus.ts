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
  /** Epoch ms since which the key has not been in sync with the server (it went to the cache, its listener
   *  stopped, or it never got past the cache); null while it is in sync. A listener that is in sync gets every
   *  change, so the data was current up to this moment, which `since` alone (the last change) can't say. */
  staleAt: number | null;
}

/** After a listener dies (rules, network, quota), the registry reopens it once after this long if it still has readers. */
export const LISTENER_RETRY_MS = 5_000;
/** A key whose automatic retry failed too (a permanent error, e.g. rules) is reopened for new readers at most this often. */
export const REOPEN_MIN_MS = 30_000;

/** The meta key of a TanStack registry entry: its serialized queryKey (the registry's own hash). */
export const metaKeyOf = (queryKey: readonly unknown[]): string => JSON.stringify(queryKey);
const MATCHES_META_KEY = metaKeyOf(["matches"]);

const metas = new Map<string, SnapshotMeta>();
const listeners = new Set<() => void>();
const notify = () => listeners.forEach((l) => l());

/**
 * Failure streaks per key, shared by both registries and outliving their entries. Only a snapshot from the
 * server ends a streak: a cache snapshot arrives before every failure of a key the rules refuse (a fan with
 * cached docs), so counting it as «good» would retry forever.
 */
const failures = new Map<string, { count: number; at: number }>();
/** Notes a listener failure; returns its position in the streak (1 = first since the last server snapshot). */
export function noteListenerFailure(key: string, now: number = Date.now()): number {
  const count = (failures.get(key)?.count ?? 0) + 1;
  failures.set(key, { count, at: now });
  return count;
}
/** How long a new reader must wait before reopening `key`: 0, unless the streak's automatic retry already failed. */
export function reopenDelay(key: string, now: number = Date.now()): number {
  const f = failures.get(key);
  return !f || f.count < 2 ? 0 : Math.max(0, f.at + REOPEN_MIN_MS - now);
}

/** Records the metadata of a snapshot (a server one also ends the key's failure streak). Same values → no notification. */
export function recordSnapshotMeta(key: string, m: { fromCache: boolean; hasPendingWrites: boolean }, now: number = Date.now()): void {
  if (!m.fromCache) failures.delete(key);
  const prev = metas.get(key);
  const since = m.fromCache ? (prev?.since ?? null) : now;
  // (out of sync from the first cache snapshot after being in sync, or from the first snapshot ever)
  const staleAt = !m.fromCache ? null : prev?.fromCache ? prev.staleAt : now;
  if (prev && prev.fromCache === m.fromCache && prev.hasPendingWrites === m.hasPendingWrites && prev.since === since && prev.staleAt === staleAt) return;
  metas.set(key, { fromCache: m.fromCache, hasPendingWrites: m.hasPendingWrites, since, staleAt });
  notify();
}

/** The listener behind `key` stopped (error or closed): whatever it last said is no longer live. Keeps `since`. */
export function markListenerStale(key: string, now: number = Date.now()): void {
  const prev = metas.get(key);
  if (!prev || prev.fromCache) return;
  metas.set(key, { ...prev, fromCache: true, staleAt: now });
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

/** Test-only: forget every recorded metadata and failure streak. */
export function _resetSnapshotMetaForTesting(): void {
  metas.clear();
  failures.clear();
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
  /** Epoch ms since which ["matches"] has not been in sync with the server (null while fresh, or before any
   *  snapshot). With `since` set, the score on screen was current up to this moment. */
  staleAt: number | null;
}

/**
 * Is the score on screen live? Combines `navigator.onLine` with the cache state of the shared ["matches"] listener.
 * It only reads that listener's metadata, it doesn't open it: `fresh` is meaningful while something reads
 * ["matches"] (useClubData — the LiveIsland, the match pages, the admin). With no reader the listener closes after
 * KEEP_WARM_MS and `fresh` turns false.
 */
export function useSyncStatus(): SyncStatus {
  const online = useOnline();
  const meta = useSnapshotMeta(MATCHES_META_KEY);
  return useMemo(() => ({ online, fresh: !!meta && !meta.fromCache, since: meta?.since ?? null, staleAt: meta?.staleAt ?? null }), [online, meta]);
}
