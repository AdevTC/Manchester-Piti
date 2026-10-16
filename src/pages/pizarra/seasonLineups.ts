// The season's boards as one shared realtime read (useLineups): the same key and query wherever it is
// opened, so it is ONE onSnapshot (useFirestoreCollection's registry). `lineups` are team-member reads
// (firestore.rules). A link to «the pizarra of this match» doesn't need them: it reads the official's
// scope docs instead (useMatchBoard.ts, useAdminData).
import { useMemo } from "react";
import { collection, query, where } from "firebase/firestore";
import { db } from "../../firebase";
import { mapLineup, mapMatch, mapRawMatch } from "../../lib/firestoreMappers";
import { MATCHES_KEY, matchQuery } from "../../lib/publicData";
import { visibleMatchLinks } from "../../lib/matchVisibility";
import { useFirestoreCollection } from "../../lib/useFirestoreCollection";

// `?preview` injects a mock session but no real Firebase auth token, so the `lineups` rules
// (request.auth != null) would reject the read: preview never opens it (useLineups backs it with
// localStorage instead).
export const PREVIEW =
  import.meta.env.DEV &&
  typeof window !== "undefined" &&
  new URLSearchParams(window.location.search).has("preview");

/** Published parents determine visibility. Only an authenticated admin may also open draft-only boards. */
export function useSeasonLineupDocs(seasonId: string, enabled = true, adminUid: string | null = null) {
  const lineupsQuery = useMemo(() => query(collection(db, "lineups"), where("seasonId", "==", seasonId)), [seasonId]);
  const lineupsKey = useMemo(() => ["lineups", seasonId], [seasonId]);
  const lineups = useFirestoreCollection(lineupsKey, lineupsQuery, mapLineup, enabled && !PREVIEW);
  const matches = useFirestoreCollection(MATCHES_KEY, matchQuery, mapMatch, enabled && !PREVIEW);
  const readDrafts = enabled && !PREVIEW && !!adminUid;
  // Keep the raw parent lookup separate from MATCHES_KEY: archived published parents must
  // override a stale active draft, without admitting archived data to the public cache.
  const parents = useFirestoreCollection(["pizarra", "matchParents"], matchQuery, mapRawMatch, readDrafts);
  const draftsQuery = useMemo(() => query(collection(db, "matchDrafts"), where("seasonId", "==", seasonId)), [seasonId]);
  const drafts = useFirestoreCollection(["pizarra", "matchDrafts", adminUid, seasonId], draftsQuery, mapMatch, readDrafts);
  const data = useMemo(() => {
    if (!lineups.data) return undefined;
    let available = matches.data ?? [];
    if (readDrafts && parents.data && !parents.error) {
      const publishedIds = new Set(parents.data.map(m => m.id));
      available = [...parents.data, ...(drafts.error ? [] : drafts.data ?? []).filter(m => !publishedIds.has(m.id))];
    }
    return visibleMatchLinks(lineups.data, available, l => typeof l.matchId === "string" ? l.matchId : null, true);
  }, [lineups.data, matches.data, readDrafts, parents.data, parents.error, drafts.data, drafts.error]);
  return {
    ...lineups,
    data,
    error: lineups.error || matches.error || (readDrafts && (parents.error || drafts.error)) || null,
    isPending: lineups.isPending || (enabled && !PREVIEW && matches.isPending) || (readDrafts && (parents.isPending || drafts.isPending)),
  };
}
