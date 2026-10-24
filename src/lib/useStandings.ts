// The season's league table, live (`standings/{seasonId}`): one shared listener on the public collection
// (in the data bundle and seeded by the server render, so the position is there on first paint).
import { standingsQuery } from "./publicData";
import { mapStandings, STANDINGS_KEY, type Standings } from "./standings";
import { useFirestoreCollection } from "./useFirestoreCollection";

export function useStandings(seasonId: string | undefined): { standings: Standings | null; loading: boolean } {
  const q = useFirestoreCollection(STANDINGS_KEY, standingsQuery, mapStandings);
  return { standings: (seasonId && q.data?.find((s) => s.id === seasonId)) || null, loading: q.isPending };
}

const NONE: readonly Standings[] = [];
/** Every season's table, on the same listener: GLOBAL reads the rivals' strength from them (one array for
 *  every screen, so the card, the cromos and the mesa print the same number). */
export function useAllStandings(): readonly Standings[] {
  return useFirestoreCollection(STANDINGS_KEY, standingsQuery, mapStandings).data ?? NONE;
}
