import { queryOptions } from "@tanstack/react-query";
import { collection, doc, getDoc, getDocs, query, where } from "firebase/firestore";
import { db } from "../firebase";
import { seasonMatchSchema, playerSchema, dropNullFields, normalizeNickname } from "./schemas";

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

/**
 * One-shot nickname-availability check, cached by the NORMALIZED nickname so
 * re-typing the same value hits the hot cache instead of re-querying Firestore.
 * Mirrors `AuthContext.registerNickname`'s server query EXACTLY
 * (`where("nickname","==",normalized)` → taken if the snapshot is non-empty).
 *
 * Returns `true` when the nickname is AVAILABLE (no existing user holds it).
 * This is UX-only inline feedback; `registerNickname` keeps the authoritative,
 * race-safe check at submit time (two users could claim it between this read
 * and the write). Callers should only run this for a value that already passes
 * `nicknameSchema` (length/regex) — no point querying an invalid nickname.
 */
export const nicknameAvailableQuery = (rawNickname: string) => {
  const normalized = normalizeNickname(rawNickname);
  return queryOptions({
    queryKey: ["nickname-available", normalized],
    queryFn: async () => {
      const snap = await getDocs(
        query(collection(db, "users"), where("nickname", "==", normalized)),
      );
      return snap.empty; // true = available
    },
    // The availability of a nickname is effectively static for the lifetime of
    // this form; cache it so each keystroke that returns to a prior value is free.
    staleTime: 30_000,
  });
};

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
