import { useMemo } from "react";
import { collection, orderBy, query } from "firebase/firestore";
import { db } from "../../firebase";
import { computeStats, EMPTY_STATS, type MatchLike, type PlayerStats, type StatEvent } from "../../lib/playerStats";
import { recentForm, squadNorms, suspendedSet, type SquadNorms } from "./chemistry";
import { useFirestoreCollection } from "../../lib/useFirestoreCollection";
import { mapMatch } from "../../lib/firestoreMappers";

// Shared with MatchCenter/Stats/Expedientes/useSeasonMatches via the CANONICAL
// mapper: ONE realtime subscription to all matches (date desc), full validated
// docs in the cache. seasonMatchSchema is a looseObject, so `events` passes
// through; the per-season filter + `{ events }` reduction happens in memory
// below (NEVER via a reduced mapper — that would corrupt the shared cache slot).
const MATCHES_KEY = ["matches"] as const;
const matchesQuery = query(collection(db, "matches"), orderBy("date", "desc"));

export interface PizarraStats {
  statsById: Map<string, PlayerStats>;
  norms: SquadNorms;
  form: Map<string, number>;
  suspended: Set<string>;
  loading: boolean;
}

/** Realtime per-season match stats for the board's chemistry layer. Reads the
 *  shared `matches` subscription (with events, date-desc) and derives the maps
 *  the chemistry needs. Separate from useSeasonMatches (which feeds the official
 *  picker and carries no events) but backed by the SAME cache key + mapper. */
export function usePizarraStats(seasonId: string, players: { id: string; seasonsCount: number }[]): PizarraStats {
  const { data, isPending } = useFirestoreCollection(MATCHES_KEY, matchesQuery, mapMatch);

  // All matches arrive once (date desc); filter to the active season and reduce
  // to the { events } shape the chemistry layer reads, in memory.
  const matches = useMemo<MatchLike[]>(() => {
    const all = data ?? [];
    const inSeason = seasonId === "all" ? all : all.filter((m) => m.seasonId === seasonId);
    return inSeason.map((m) => ({ events: ((m as { events?: StatEvent[] }).events ?? []) }));
  }, [data, seasonId]);

  return useMemo(() => {
    const statsById = new Map<string, PlayerStats>();
    players.forEach((p) => statsById.set(p.id, computeStats(p.id, matches)));
    const norms = squadNorms(players.map((p) => ({ s: statsById.get(p.id) ?? EMPTY_STATS, seasons: p.seasonsCount })));
    return { statsById, norms, form: recentForm(matches), suspended: suspendedSet(matches), loading: isPending };
  }, [matches, players, isPending]);
}
