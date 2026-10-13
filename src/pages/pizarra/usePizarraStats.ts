import { useMemo } from "react";
import { collection, orderBy, query } from "firebase/firestore";
import { db } from "../../firebase";
import { suspensions, type SanctionHolder, type Suspension, type SuspensionMatch } from "./chemistry";
import { useFirestoreCollection } from "../../lib/useFirestoreCollection";
import { mapMatch } from "../../lib/firestoreMappers";

// Shared with MatchCenter/Stats/Expedientes via the CANONICAL
// mapper: ONE realtime subscription to all matches (date desc), full validated
// docs in the cache. seasonMatchSchema is a looseObject, so `events` and `ledger`
// pass through; the per-season filter happens in memory below (NEVER via a
// reduced mapper — that would corrupt the shared cache slot).
const MATCHES_KEY = ["matches"] as const;
const matchesQuery = query(collection(db, "matches"), orderBy("date", "desc"));
const NOBODY: readonly SanctionHolder[] = [];

export interface PizarraStats {
  /** Players serving a suspension — a sending-off or a sanction set by hand — with what is left (see chemistry.suspensions). */
  suspended: Map<string, Suspension>;
  loading: boolean;
}

/** Realtime per-season suspensions for the board, from the shared `matches` subscription and the players' sanctions. */
export function usePizarraStats(seasonId: string, players: readonly SanctionHolder[] = NOBODY): PizarraStats {
  const { data, isPending } = useFirestoreCollection(MATCHES_KEY, matchesQuery, mapMatch);

  const suspended = useMemo(() => {
    const all = data ?? [];
    const inSeason = seasonId === "all" ? all : all.filter((m) => m.seasonId === seasonId);
    // (looseObject docs: `ledger` and `events` come through as stored)
    return suspensions(inSeason as SuspensionMatch[], players);
  }, [data, seasonId, players]);

  return useMemo(() => ({ suspended, loading: isPending }), [suspended, isPending]);
}
