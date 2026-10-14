// The season's boards as one shared realtime read: the pizarra (useLineups), the match page and the Sala
// de control all subscribe through here with the same key and query, so they share ONE onSnapshot
// (useFirestoreCollection's registry) instead of opening one each. `lineups` are team-member reads
// (firestore.rules): callers pass `enabled` false for anyone else, and no listener opens.
import { useCallback, useMemo } from "react";
import { collection, query, where } from "firebase/firestore";
import { db } from "../../firebase";
import { mapLineup } from "../../lib/firestoreMappers";
import { useFirestoreCollection } from "../../lib/useFirestoreCollection";
import { officialFor, officialRefOf, type OfficialRef } from "./officialBoard";

// `?preview` injects a mock session but no real Firebase auth token, so the `lineups` rules
// (request.auth != null) would reject the read: preview never opens it (useLineups backs it with
// localStorage instead).
export const PREVIEW =
  import.meta.env.DEV &&
  typeof window !== "undefined" &&
  new URLSearchParams(window.location.search).has("preview");

/** The season's raw `lineups` docs (validated by mapLineup), realtime and shared. */
export function useSeasonLineupDocs(seasonId: string, enabled = true) {
  const lineupsQuery = useMemo(() => query(collection(db, "lineups"), where("seasonId", "==", seasonId)), [seasonId]);
  const lineupsKey = useMemo(() => ["lineups", seasonId], [seasonId]);
  return useFirestoreCollection(lineupsKey, lineupsQuery, mapLineup, enabled && !PREVIEW);
}

/**
 * The official board of each match of a season, for a link to it (`/pizarra?tablero=`). Reads the same
 * shared subscription as the pizarra. `seasonId` absent or `enabled` false (a fan, a signed-out
 * visitor) = no read and no board.
 */
export function useOfficialBoards(seasonId: string | null | undefined, enabled: boolean): (matchId: string) => OfficialRef | null {
  const on = enabled && !!seasonId && seasonId !== "all";
  const { data } = useSeasonLineupDocs(seasonId ?? "", on);
  const refs = useMemo(() => (on ? (data ?? []).map(officialRefOf).filter((d) => d.isOfficial) : []), [on, data]);
  return useCallback((matchId: string) => officialFor(refs, matchId), [refs]);
}
