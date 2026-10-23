// The public collections every club page reads, in one place: the live hooks (clubData,
// SeasonContext, clubContent), the boot that waits for them before replacing server-rendered HTML
// (main.tsx) and the server render (entry-server.tsx) all use the same keys, queries and mappers,
// so the cache shape is identical wherever the data comes from.
import type { QueryClient } from "@tanstack/react-query";
import { withFirebase, type Fb } from "./fb";
import { mapMatch, mapMvp, mapPlayer, mapSeason, MVP_RESULTS_KEY } from "./firestoreMappers";
import { subscribeShared } from "./useFirestoreCollection";
import { DEFAULT_CONTENT, type ClubContent } from "./clubContentDefaults";
import { parseVenues } from "./derived/venue";
import { mapStandings, STANDINGS_KEY } from "./standings";

export const MATCHES_KEY = ["matches"] as const;
export const PLAYERS_KEY = ["players"] as const;
export const SEASONS_KEY = ["seasons"] as const;
export const CONTENT_KEY = ["clubContent"] as const;
/** Every match's MVP tally: in the bundle, seeded by the server render and waited for before React
 *  takes over, so the MVP badges don't pop in after hydration. */
export { MVP_RESULTS_KEY };
/** The league tables (`standings/{seasonId}`): public, in the bundle, so the position paints with the page. */
export { STANDINGS_KEY };

// (built once Firebase is in: lib/fb, useFirestoreCollection QuerySource)
export const matchQuery = (fb: Fb) => fb.query(fb.collection(fb.db, "matches"), fb.orderBy("date", "desc"));
export const playerQuery = (fb: Fb) => fb.collection(fb.db, "players");
export const seasonQuery = (fb: Fb) => fb.query(fb.collection(fb.db, "seasons"), fb.orderBy("name", "asc"));
export const mvpQuery = (fb: Fb) => fb.collection(fb.db, "mvpResults");
export const standingsQuery = (fb: Fb) => fb.collection(fb.db, "standings");

/** The stored content over the defaults (its grounds read defensively: derived/venue parseVenues). */
export const withDefaults = (data: Partial<ClubContent> | undefined): ClubContent => ({ ...DEFAULT_CONTENT, ...data, venues: parseVenues(data?.venues) });

/** Live club content into the cache (DEFAULT_CONTENT when the document doesn't exist or can't be read). */
export function subscribeClubContent(qc: Pick<QueryClient, "setQueryData">): () => void {
  return withFirebase((fb) =>
    fb.onSnapshot(
      fb.doc(fb.db, "clubContent", "main"),
      (snap) => qc.setQueryData(CONTENT_KEY, withDefaults(snap.exists() ? (snap.data() as Partial<ClubContent>) : undefined)),
      () => qc.setQueryData(CONTENT_KEY, (cur: ClubContent | undefined) => cur ?? DEFAULT_CONTENT),
    ),
  );
}

/**
 * Opens the public listeners and resolves once each has delivered its first snapshot (from the
 * data bundle already in the local cache, normally) or after `timeoutMs`. The listeners stay with
 * the shared registry, so the page that mounts next reuses them instead of opening its own. A listener
 * that fails settles its key too (the registry's `handleSnapshotError`: its last data, or `[]`; club
 * content: the defaults), so an error never holds the page for the whole timeout.
 */
export function primePublicData(qc: QueryClient, timeoutMs: number): Promise<void> {
  const keys = [MATCHES_KEY, PLAYERS_KEY, SEASONS_KEY, CONTENT_KEY, MVP_RESULTS_KEY, STANDINGS_KEY];
  const releases = [
    subscribeShared(qc, MATCHES_KEY, matchQuery, mapMatch),
    subscribeShared(qc, PLAYERS_KEY, playerQuery, mapPlayer),
    subscribeShared(qc, SEASONS_KEY, seasonQuery, mapSeason),
    subscribeShared(qc, MVP_RESULTS_KEY, mvpQuery, mapMvp),
    subscribeShared(qc, STANDINGS_KEY, standingsQuery, mapStandings),
    subscribeClubContent(qc),
  ];
  const ready = () => keys.every((k) => qc.getQueryData(k) !== undefined);
  return new Promise<void>((resolve) => {
    let finished = false;
    const done = () => {
      if (finished) return;
      finished = true;
      unwatch();
      clearTimeout(timer);
      // The listeners' own consumers take over; the registry keeps them warm meanwhile. Club content
      // has no registry: its listener closes once the page's own one is open.
      setTimeout(() => releases.forEach((release) => release()), 0);
      resolve();
    };
    const unwatch = qc.getQueryCache().subscribe(() => {
      if (ready()) done();
    });
    const timer = setTimeout(done, timeoutMs);
    if (ready()) done();
  });
}
