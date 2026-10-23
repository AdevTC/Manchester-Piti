// Server render of the public pages (built with `vite build --ssr`, run by api/render.js). Same
// providers as main.tsx, a fresh router and cache per request, seeded from the public data bundle so
// the HTML matches what the browser paints once its listeners deliver the same documents.
import { StrictMode } from "react";
import { renderToString } from "react-dom/server";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { createMemoryHistory } from "@tanstack/react-router";
import App from "./App";
import { createAppRouter } from "./router";
import { mapMatch, mapMvp, mapPlayer, mapSeason, mvpPrivateWhileOpen } from "./lib/firestoreMappers";
import { CONTENT_KEY, MATCHES_KEY, MVP_RESULTS_KEY, PLAYERS_KEY, SEASONS_KEY, STANDINGS_KEY, withDefaults } from "./lib/publicData";
import { mapStandings } from "./lib/standings";
import type { ClubContent } from "./lib/clubContentDefaults";
import { inQueryOrder, parseBundle, type BundleDoc } from "./ssr/bundleData";

// The old addresses the server answers with a permanent redirect (api/render.js), from the router's own table.
export { legacyHref } from "./lib/legacyUrls";

const mapAll = <T,>(docs: BundleDoc[], map: (id: string, data: unknown) => T | null) =>
  docs.flatMap((d) => {
    const v = map(d.id, d.data);
    return v === null ? [] : [v];
  });

// On the server the router answers a URL whose search it normalises (a search default, a route that
// rewrites its own search) with a redirect instead of a page. No public route does that today (/stats and
// /matches/$id keep their search optional, no default), but the browser would show that same page at the
// bare URL, so if one does, render the canonical one rather than an empty redirect. (`_serverResult` is
// where router-core 1.171 leaves that answer: no public field yet.)
type ServerResult = { type?: string; redirect?: { options?: { href?: string } } };
async function loadRouter(url: string) {
  const router = createAppRouter(createMemoryHistory({ initialEntries: [url] }));
  await router.load();
  const canonical = (router as unknown as { _serverResult?: ServerResult })._serverResult?.redirect?.options?.href;
  if (!canonical || canonical === url || new URL(canonical, "http://x").pathname !== new URL(url, "http://x").pathname) return router;
  const again = createAppRouter(createMemoryHistory({ initialEntries: [canonical] }));
  await again.load();
  return again;
}

/** The markup of `url` (a path, with the search the server forwards: «/partidos?view=tabla») with the bundle's data, for the inside of `<div id="root">`. */
export async function renderPage(url: string, bundle: Uint8Array): Promise<string> {
  const data = inQueryOrder(parseBundle(bundle));
  const qc = new QueryClient({ defaultOptions: { queries: { staleTime: Infinity, retry: false } } });
  const matches = mapAll(data.matches, mapMatch);
  const visibleIds = new Set(matches.map(m => m.id));
  qc.setQueryData(MATCHES_KEY, matches);
  qc.setQueryData(PLAYERS_KEY, mapAll(data.players, mapPlayer));
  qc.setQueryData(SEASONS_KEY, mapAll(data.seasons, mapSeason));
  qc.setQueryData(MVP_RESULTS_KEY, mvpPrivateWhileOpen(mapAll(data.mvpResults.filter(d => visibleIds.has(d.id)), mapMvp), matches, Date.now()));
  qc.setQueryData(STANDINGS_KEY, mapAll(data.standings, mapStandings));
  qc.setQueryData(CONTENT_KEY, withDefaults(data.content?.data as Partial<ClubContent> | undefined));

  const router = await loadRouter(url);
  return renderToString(
    <StrictMode>
      <QueryClientProvider client={qc}>
        <App router={router} />
      </QueryClientProvider>
    </StrictMode>,
  );
}
