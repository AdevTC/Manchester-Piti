import { useMemo } from "react";
import { collection, orderBy, query } from "firebase/firestore";
import { db } from "../../firebase";
import type { MatchLike } from "../../lib/playerStats";
import { suspendedSet } from "./chemistry";
import { useFirestoreCollection } from "../../lib/useFirestoreCollection";
import { mapMatch } from "../../lib/firestoreMappers";

// Shared with MatchCenter/Stats/Expedientes via the CANONICAL
// mapper: ONE realtime subscription to all matches (date desc), full validated
// docs in the cache. seasonMatchSchema is a looseObject, so `events` and `ledger`
// pass through; the per-season filter happens in memory below (NEVER via a
// reduced mapper — that would corrupt the shared cache slot).
const MATCHES_KEY = ["matches"] as const;
const matchesQuery = query(collection(db, "matches"), orderBy("date", "desc"));

export interface PizarraStats {
  /** Players serving a suspension for a sending-off (see chemistry.suspendedSet). */
  suspended: Set<string>;
  loading: boolean;
}

/** Realtime per-season suspensions for the board, from the shared `matches` subscription. */
export function usePizarraStats(seasonId: string): PizarraStats {
  const { data, isPending } = useFirestoreCollection(MATCHES_KEY, matchesQuery, mapMatch);

  const suspended = useMemo(() => {
    const all = data ?? [];
    const inSeason = seasonId === "all" ? all : all.filter((m) => m.seasonId === seasonId);
    // (looseObject docs: `ledger` and `events` come through as stored)
    return suspendedSet(inSeason as MatchLike[]);
  }, [data, seasonId]);

  return useMemo(() => ({ suspended, loading: isPending }), [suspended, isPending]);
}
