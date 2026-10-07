import { queryOptions } from "@tanstack/react-query";
import { collection, doc, getDoc, getDocs } from "firebase/firestore";
import { db } from "../firebase";
import { seasonMatchSchema, playerSchema, dropNullFields } from "./schemas";

/**
 * One-shot detail reads (NOT realtime). These back the deep-linkable
 * /matches/$matchId and /jugadores/$playerId routes: a route `loader` calls
 * `queryClient.ensureQueryData(...)` (prefetch, warmed by hover-intent) and the
 * component reads the same `queryKey` via `useQuery(...)`, so it hits the hot
 * cache with no second fetch. The global 60s staleTime is fine — these are
 * by-id snapshots, not subscription-backed, so we do NOT set staleTime:Infinity.
 *
 * Each queryFn mirrors `parseDocs`'s per-doc pattern (validate
 * `{ id, ...dropNullFields(data) }`) and returns `null` for a missing/invalid
 * doc so the page can render a sober not-found state instead of crashing.
 */

/** One-shot match detail by id. Returns null if missing/invalid. */
export const matchDetailQuery = (matchId: string) =>
  queryOptions({
    queryKey: ["match", matchId],
    queryFn: async () => {
      const snap = await getDoc(doc(db, "matches", matchId));
      if (!snap.exists()) return null;
      const r = seasonMatchSchema.safeParse({ id: snap.id, ...dropNullFields(snap.data()) });
      return r.success ? r.data : null;
    },
  });

/** One-shot player detail by id. Returns null if missing/invalid. */
export const playerDetailQuery = (playerId: string) =>
  queryOptions({
    queryKey: ["player", playerId],
    queryFn: async () => {
      const snap = await getDoc(doc(db, "players", playerId));
      if (!snap.exists()) return null;
      const r = playerSchema.safeParse({ id: snap.id, ...dropNullFields(snap.data()) });
      return r.success ? r.data : null;
    },
  });

/** One-shot players name map (playerId → shirt/first name) for match-event labels. */
export const playersNameMapQuery = queryOptions({
  queryKey: ["players", "nameMap"],
  queryFn: async () => {
    const snap = await getDocs(collection(db, "players"));
    const map: Record<string, string> = {};
    for (const d of snap.docs) {
      const r = playerSchema.safeParse({ id: d.id, ...dropNullFields(d.data()) });
      if (r.success) map[d.id] = r.data.shirtName || r.data.firstName || "—";
    }
    return map;
  },
});
