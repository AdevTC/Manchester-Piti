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
    // key is serialized stably by the caller (array of primitives).
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [JSON.stringify(key)]);

  return useQuery<T[]>({
    queryKey: key,
    queryFn: () => new Promise<T[]>(() => {}), // resolved by the snapshot's setQueryData
    staleTime: Infinity,
  });
}
