// The public collections every club page reads, in one place: the live hooks (clubData,
// SeasonContext, clubContent), the boot that waits for them before replacing server-rendered HTML
// (main.tsx) and the server render (entry-server.tsx) all use the same keys, queries and mappers,
// so the cache shape is identical wherever the data comes from.
import { collection, doc, onSnapshot, orderBy, query } from "firebase/firestore";
import type { QueryClient } from "@tanstack/react-query";
import { db } from "../firebase";
import { mapMatch, mapPlayer, mapSeason } from "./firestoreMappers";
import { subscribeShared } from "./useFirestoreCollection";
import { DEFAULT_CONTENT, type ClubContent } from "./clubContentDefaults";

export const MATCHES_KEY = ["matches"] as const;
export const PLAYERS_KEY = ["players"] as const;
export const SEASONS_KEY = ["seasons"] as const;
export const CONTENT_KEY = ["clubContent"] as const;

export const matchQuery = query(collection(db, "matches"), orderBy("date", "desc"));
export const playerQuery = collection(db, "players");
export const seasonQuery = query(collection(db, "seasons"), orderBy("name", "asc"));

export const withDefaults = (data: Partial<ClubContent> | undefined): ClubContent => ({ ...DEFAULT_CONTENT, ...data });

/** Live club content into the cache (DEFAULT_CONTENT when the document doesn't exist or can't be read). */
export function subscribeClubContent(qc: Pick<QueryClient, "setQueryData">): () => void {
  return onSnapshot(
    doc(db, "clubContent", "main"),
    (snap) => qc.setQueryData(CONTENT_KEY, withDefaults(snap.exists() ? (snap.data() as Partial<ClubContent>) : undefined)),
    () => qc.setQueryData(CONTENT_KEY, (cur: ClubContent | undefined) => cur ?? DEFAULT_CONTENT),
  );
}

/**
 * Opens the public listeners and resolves once each has delivered its first snapshot (from the
 * data bundle already in the local cache, normally) or after `timeoutMs`. The listeners stay with
 * the shared registry, so the page that mounts next reuses them instead of opening its own.
 */
export function primePublicData(qc: QueryClient, timeoutMs: number): Promise<void> {
  const keys = [MATCHES_KEY, PLAYERS_KEY, SEASONS_KEY, CONTENT_KEY];
  const releases = [
    subscribeShared(qc, MATCHES_KEY, matchQuery, mapMatch),
    subscribeShared(qc, PLAYERS_KEY, playerQuery, mapPlayer),
    subscribeShared(qc, SEASONS_KEY, seasonQuery, mapSeason),
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
