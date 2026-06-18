import { useEffect } from "react";
import { onSnapshot, type Query, type QuerySnapshot } from "firebase/firestore";
import { useQuery, useQueryClient } from "@tanstack/react-query";

export function mapSnapshotDocs<T>(snap: QuerySnapshot, map: (id: string, data: unknown) => T): T[] {
  return snap.docs.map((d) => map(d.id, d.data()));
}

/**
 * Subscribes `q` via onSnapshot and pushes results into the React Query cache
 * under `key`. Components read via useQuery → dedupe across mounts, uniform
 * load/error states, realtime data preserved. Reusable primitive for incremental
 * adoption; not yet wired to a specific collection in this phase.
 *
 * Snapshot errors are logged only; callers wiring this to UI should add their
 * own error state. `staleTime: Infinity` because Firestore keeps the data fresh
 * via the subscription (the global gcTime still applies on unmount).
 */
export function useFirestoreCollection<T>(
  key: readonly unknown[],
  q: Query,
  map: (id: string, data: unknown) => T,
) {
  const qc = useQueryClient();
  useEffect(() => {
    const unsub = onSnapshot(
      q,
      (snap) => qc.setQueryData(key, mapSnapshotDocs(snap, map)),
      (err) => console.error("Firestore subscription error:", err),
    );
    return unsub;
    // Deps deliberately narrowed: `key` is serialized for stable comparison and
    // `map` must be a stable reference (module-level fn or useCallback). Including
    // either raw would re-subscribe to Firestore on every render.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [JSON.stringify(key)]);

  return useQuery<T[]>({
    queryKey: key,
    queryFn: () => new Promise<T[]>(() => {}), // resolved by the snapshot's setQueryData
    staleTime: Infinity,
  });
}
