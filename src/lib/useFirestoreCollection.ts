import { useEffect } from "react";
import { onSnapshot, type Query, type QuerySnapshot } from "firebase/firestore";
import { useQuery, useQueryClient, type QueryClient } from "@tanstack/react-query";
import { LISTENER_RETRY_MS, markListenerStale, metaKeyOf, recordSnapshotMeta } from "./syncStatus";

export function mapSnapshotDocs<T>(snap: QuerySnapshot, map: (id: string, data: unknown) => T | null): T[] {
  const out: T[] = [];
  for (const d of snap.docs) {
    const result = map(d.id, d.data());
    if (result !== null) out.push(result);
  }
  return out;
}

/**
 * Logs the error and keeps the last good data. Only when the key never had data
 * does it set an empty array, so that `isPending` becomes false (an error must
 * not wipe a list that was already on screen: that reads as «no data»; the error
 * itself travels in the `[...key, "__error"]` slot). Exported for unit testing.
 */
export function handleSnapshotError(
  qc: Pick<QueryClient, "setQueryData">,
  key: readonly unknown[],
  err: unknown,
): void {
  console.error("Firestore subscription error:", err);
  qc.setQueryData<unknown>(key, (cur: unknown) => cur ?? []);
}

/**
 * Module-level registry of live Firestore subscriptions, keyed by the serialized
 * queryKey. React Query already dedupes the *cache entry* (one Query per
 * queryHash, shared `data`) — but the `onSnapshot` listener lives in each
 * consumer's effect, so N components reading the same key would otherwise open N
 * realtime subscriptions (more listeners, more Firestore reads). This registry
 * ref-counts them: the first subscriber opens `onSnapshot`, the last to leave
 * tears it down → exactly one realtime subscription per collection key, shared
 * across pages.
 *
 * Snapshot metadata (`fromCache`, `hasPendingWrites`) goes to the separate
 * `syncStatus` store: the listener asks for metadata changes, but a snapshot
 * without document changes never touches the query data, so data-only readers
 * don't re-render for it.
 *
 * A Firestore listener that errors is dead. The entry then marks the error,
 * keeps the last data, and reopens: at once when a new reader arrives, or once
 * after `LISTENER_RETRY_MS` while readers remain (one automatic retry per
 * failure streak, so a permanent error can't hot-loop).
 */
interface SharedSub {
  count: number;
  /** The live listener's unsubscribe; null while the listener is dead (after an error). */
  unsub: (() => void) | null;
  idle: ReturnType<typeof setTimeout> | null;
  retry: ReturnType<typeof setTimeout> | null;
  /** The automatic retry was already spent since the last good snapshot. */
  retried: boolean;
  errored: boolean;
  reopen: () => void;
}
const sharedSubs = new Map<string, SharedSub>();
/**
 * After the last consumer leaves, the listener stays open this long: moving between pages that read
 * the same collections (Inicio ↔ Plantilla ↔ Partidos) keeps one live connection instead of closing
 * it and reading every document again.
 */
export const KEEP_WARM_MS = 60_000;

const clearTimers = (sub: SharedSub) => {
  if (sub.idle) clearTimeout(sub.idle);
  if (sub.retry) clearTimeout(sub.retry);
  sub.idle = sub.retry = null;
};

/** Test-only: clears the shared-subscription registry so unit tests start from a
 *  clean slate (the registry is module-level, so ref counts would otherwise leak
 *  between tests). Not part of the production API. */
export function _resetSharedSubsForTesting(): void {
  for (const sub of sharedSubs.values()) clearTimers(sub);
  sharedSubs.clear();
}

/**
 * Subscribe to `q` under `key`, sharing a single underlying `onSnapshot` with any
 * other caller using the same `key`. Returns an unsubscribe that decrements the
 * ref-count and tears the listener down when it reaches zero.
 *
 * The first caller wins the query shape: callers that share a `key` are expected
 * to pass an equivalent `q`/`map` (the canonical keys in this codebase guarantee
 * that). Exported for unit testing.
 */
export function subscribeShared<T>(
  qc: Pick<QueryClient, "setQueryData">,
  key: readonly unknown[],
  q: Query,
  map: (id: string, data: unknown) => T | null,
): () => void {
  const hash = metaKeyOf(key);
  const errorKey = [...key, "__error"];
  let entry = sharedSubs.get(hash);
  if (entry) {
    entry.count += 1;
    if (entry.idle) clearTimeout(entry.idle);
    entry.idle = null;
    // A dead listener: the new reader reopens it now (no need to wait for the retry).
    if (!entry.unsub) entry.reopen();
  } else {
    const sub: SharedSub = { count: 1, unsub: null, idle: null, retry: null, retried: false, errored: false, reopen: () => {} };
    const open = () => {
      if (sub.retry) clearTimeout(sub.retry);
      sub.retry = null;
      // Each listener's first snapshot always writes the data, even an empty list.
      let first = true;
      sub.unsub = onSnapshot(
        q,
        { includeMetadataChanges: true },
        (snap) => {
          if (sharedSubs.get(hash) !== sub) return;
          sub.retried = false;
          if (sub.errored) {
            sub.errored = false;
            qc.setQueryData(errorKey, null);
          }
          if (first || snap.docChanges().length > 0) qc.setQueryData(key, mapSnapshotDocs(snap, map));
          first = false;
          recordSnapshotMeta(hash, snap.metadata);
        },
        (err) => {
          if (sharedSubs.get(hash) !== sub) return;
          sub.unsub = null; // Firestore already closed it
          sub.errored = true;
          qc.setQueryData(errorKey, err);
          handleSnapshotError(qc, key, err);
          markListenerStale(hash);
          if (sub.count === 0) {
            // Nobody is reading (only kept warm): drop it; the next reader starts afresh.
            clearTimers(sub);
            sharedSubs.delete(hash);
            return;
          }
          if (sub.retried) return;
          sub.retried = true;
          sub.retry = setTimeout(() => {
            sub.retry = null;
            if (sharedSubs.get(hash) === sub && sub.count > 0 && !sub.unsub) open();
          }, LISTENER_RETRY_MS);
        },
      );
    };
    sub.reopen = open;
    sharedSubs.set(hash, sub);
    entry = sub;
    open();
  }

  const mine = entry;
  let released = false;
  return () => {
    if (released || sharedSubs.get(hash) !== mine) return;
    released = true;
    mine.count -= 1;
    if (mine.count > 0) return;
    if (!mine.unsub) {
      // Dead listener and no readers: nothing to keep warm.
      clearTimers(mine);
      sharedSubs.delete(hash);
      return;
    }
    mine.idle = setTimeout(() => {
      mine.unsub?.();
      clearTimers(mine);
      sharedSubs.delete(hash);
      markListenerStale(hash);
    }, KEEP_WARM_MS);
  };
}

/**
 * Subscribes `q` via onSnapshot and pushes results into the React Query cache
 * under `key`. Components read via useQuery → dedupe across mounts: both the
 * cache entry AND the realtime subscription are shared (see `subscribeShared`),
 * so multiple pages reading the same collection cost one listener. Uniform
 * load/error states, realtime data preserved across navigation (the global
 * gcTime keeps the cache hot on unmount).
 *
 * Snapshot errors are handled by `handleSnapshotError`: logs, keeps the last
 * data (an empty array only if there was none, so `isPending` terminates) and
 * returns the error in `error`; the registry reopens the listener (see
 * `subscribeShared`). `staleTime: Infinity` because Firestore keeps the data
 * fresh via the subscription. Snapshot metadata: `useSnapshotMeta` /
 * `useSyncStatus` (lib/syncStatus), not this hook.
 */
export function useFirestoreCollection<T>(
  key: readonly unknown[],
  q: Query,
  map: (id: string, data: unknown) => T | null,
  /** When false, no `onSnapshot` is opened and the query is disabled. Lets a
   *  consumer keep calling the hook unconditionally (rules of hooks) while
   *  opting out of the subscription — e.g. the `?preview` localStorage path in
   *  useLineups, which must not touch Firestore. Defaults to true. */
  enabled = true,
) {
  const qc = useQueryClient();
  useEffect(() => {
    if (!enabled) return;
    return subscribeShared(qc, key, q, map);
    // Deps deliberately narrowed: `key` is serialized for stable comparison and
    // `map`/`q` must be stable references (module-level fn / useMemo'd query).
    // Including them raw would re-subscribe to Firestore on every render.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [JSON.stringify(key), enabled]);

  const result = useQuery<T[]>({
    queryKey: key,
    queryFn: () => new Promise<T[]>(() => {}), // resolved by the snapshot's setQueryData
    staleTime: Infinity,
    enabled,
  });
  const { data: subscriptionError } = useQuery<Error | null>({ queryKey: [...key, '__error'], queryFn: () => null, initialData: null, staleTime: Infinity });
  return { ...result, error: subscriptionError ?? result.error };
}
