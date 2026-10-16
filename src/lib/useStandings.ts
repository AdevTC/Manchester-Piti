// The season's league table, live (`standings/{seasonId}`): one shared listener on the public collection
// (in the data bundle and seeded by the server render, so the position is there on first paint).
import { standingsQuery } from "./publicData";
import { mapStandings, STANDINGS_KEY, type Standings } from "./standings";
import { useFirestoreCollection } from "./useFirestoreCollection";

export function useStandings(seasonId: string | undefined): { standings: Standings | null; loading: boolean } {
  const q = useFirestoreCollection(STANDINGS_KEY, standingsQuery, mapStandings);
  return { standings: (seasonId && q.data?.find((s) => s.id === seasonId)) || null, loading: q.isPending };
}
