import { useEffect } from "react";
import { onSnapshot, type Query, type QuerySnapshot } from "firebase/firestore";
import { useQuery, useQueryClient, type QueryClient } from "@tanstack/react-query";

export function mapSnapshotDocs<T>(snap: QuerySnapshot, map: (id: string, data: unknown) => T | null): T[] {
  const out: T[] = [];
  for (const d of snap.docs) {
    const result = map(d.id, d.data());
    if (result !== null) out.push(result);
  }
  return out;
}

/**
 * Logs the error and sets the query data to an empty array so that `isPending`
 * becomes false and consumers see an empty list (matching SeasonContext's current
 * error behavior). Exported for unit testing.
 */
export function handleSnapshotError(
  qc: Pick<QueryClient, "setQueryData">,
  key: readonly unknown[],
  err: unknown,
): void {
  console.error("Firestore subscription error:", err);
  qc.setQueryData(key, []);
}

/**
 * Module-level registry of live Firestore subscriptions, keyed by the serialized
 * queryKey. React Query already dedupes the *cache entry* (one Query per
 * queryHash, shared `data`) — but the `onSnapshot` listener lives in each
 * consumer's effect, so N components reading the same key would otherwise open N
 * realtime subscriptions (more listeners, more Firestore reads). This registry
 * ref-counts them: the first subscriber opens `onSnapshot`, the last to leave
 * tears it down → exactly one realtime subscription per collection key, shared
 * across pages. Exported for unit testing.
 */
interface SharedSub {
  count: number;
  unsub: () => void;
}
const sharedSubs = new Map<string, SharedSub>();

/** Test-only: clears the shared-subscription registry so unit tests start from a
 *  clean slate (the registry is module-level, so ref counts would otherwise leak
 *  between tests). Not part of the production API. */
export function _resetSharedSubsForTesting(): void {
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
  const hash = JSON.stringify(key);
  const existing = sharedSubs.get(hash);
  if (existing) {
    existing.count += 1;
  } else {
    const unsub = onSnapshot(
      q,
      (snap) => qc.setQueryData(key, mapSnapshotDocs(snap, map)),
      (err) => handleSnapshotError(qc, key, err),
    );
    sharedSubs.set(hash, { count: 1, unsub });
  }

  return () => {
    const entry = sharedSubs.get(hash);
    if (!entry) return;
    entry.count -= 1;
    if (entry.count <= 0) {
      entry.unsub();
      sharedSubs.delete(hash);
    }
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
 * Snapshot errors are handled by `handleSnapshotError`: logs + sets empty array
 * so `isPending` terminates. `staleTime: Infinity` because Firestore keeps the
 * data fresh via the subscription.
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

  return useQuery<T[]>({
    queryKey: key,
    queryFn: () => new Promise<T[]>(() => {}), // resolved by the snapshot's setQueryData
    staleTime: Infinity,
    enabled,
  });
}
