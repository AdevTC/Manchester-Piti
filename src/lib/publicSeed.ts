// The public cache from the data bundle, without a Firestore client: the server render (entry-server.tsx)
// and the browser taking that page over (main.tsx) seed it with this same code from the same bundle and the
// same instant, so both render exactly the same page.
import type { QueryClient } from "@tanstack/react-query";
import { mapMatch, mapMvp, mapPlayer, mapSeason, mvpPrivateWhileOpen } from "./firestoreMappers";
import { CONTENT_KEY, MATCHES_KEY, MVP_RESULTS_KEY, PLAYERS_KEY, SEASONS_KEY, STANDINGS_KEY, withDefaults } from "./publicData";
import { mapStandings } from "./standings";
import type { ClubContent } from "./clubContentDefaults";
import { inQueryOrder, parseBundle, type BundleDoc } from "../ssr/bundleData";

const mapAll = <T,>(docs: BundleDoc[], map: (id: string, data: unknown) => T | null) =>
  docs.flatMap((d) => {
    const v = map(d.id, d.data);
    return v === null ? [] : [v];
  });

export function seedPublicData(qc: Pick<QueryClient, "setQueryData">, bundle: Uint8Array, now: number): void {
  const data = inQueryOrder(parseBundle(bundle));
  const matches = mapAll(data.matches, mapMatch);
  const visibleIds = new Set(matches.map((m) => m.id));
  qc.setQueryData(MATCHES_KEY, matches);
  qc.setQueryData(PLAYERS_KEY, mapAll(data.players, mapPlayer));
  qc.setQueryData(SEASONS_KEY, mapAll(data.seasons, mapSeason));
  qc.setQueryData(MVP_RESULTS_KEY, mvpPrivateWhileOpen(mapAll(data.mvpResults.filter((d) => visibleIds.has(d.id)), mapMvp), matches, now));
  qc.setQueryData(STANDINGS_KEY, mapAll(data.standings, mapStandings));
  qc.setQueryData(CONTENT_KEY, withDefaults(data.content?.data as Partial<ClubContent> | undefined));
}
