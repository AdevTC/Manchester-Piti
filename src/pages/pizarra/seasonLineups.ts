// The season's boards as one shared realtime read (useLineups): the same key and query wherever it is
// opened, so it is ONE onSnapshot (useFirestoreCollection's registry). `lineups` are team-member reads
// (firestore.rules). A link to «the pizarra of this match» doesn't need them: it reads the official's
// scope docs instead (useMatchBoard.ts, useAdminData).
import { useMemo } from "react";
import { collection, query, where } from "firebase/firestore";
import { db } from "../../firebase";
import { mapLineup } from "../../lib/firestoreMappers";
import { useFirestoreCollection } from "../../lib/useFirestoreCollection";

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
