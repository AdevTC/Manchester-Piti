// Server render of the public pages (built with `vite build --ssr`, run by api/render.js). The same tree as
// main.tsx (Root), a fresh router and cache per request, seeded from the public data bundle at one instant: the
// page carries both (api/render.js) and the browser takes it over seeding the same cache from them (main.tsx),
// so its first render is exactly this markup.
import { renderToString } from "react-dom/server";
import { QueryClient } from "@tanstack/react-query";
import { createMemoryHistory } from "@tanstack/react-router";
import { Root } from "./Root";
import { createAppRouter } from "./router";
import { seedPublicData } from "./lib/publicSeed";
import { seedAnalyses } from "./lib/matchAnalyses";
import { setPaintedAt } from "./lib/serverTime";
import { MATCHES_KEY } from "./lib/publicData";
import { paintedUntil } from "./ssr/paintedUntil";

// The old addresses the server answers with a permanent redirect (api/render.js), from the router's own table.
export { legacyHref } from "./lib/legacyUrls";
export { inlineBundle } from "./lib/inlineBundle";
export { needsAnalysesAt } from "./lib/matchAnalyses";

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

/** The markup of `url` (a path, with the search the server forwards: «/partidos?view=tabla») with the bundle's
 *  data at `now` (what the page's clocks read), for the inside of `<div id="root">`. `analyses`: the matches' narrated
 *  analyses' bundle, for a page that shows them (api/render.js ANALYSIS_PAGES; lib/matchAnalyses). */
export async function renderPage(url: string, bundle: Uint8Array, now: number = Date.now(), analyses?: Uint8Array): Promise<string> {
  return (await renderPainted(url, bundle, now, analyses)).markup;
}

/** renderPage, and until when that markup can be shown as it is (ssr/paintedUntil: its clock's texts). */
export async function renderPainted(url: string, bundle: Uint8Array, now: number = Date.now(), analyses?: Uint8Array): Promise<{ markup: string; until: number }> {
  const qc = new QueryClient({ defaultOptions: { queries: { staleTime: Infinity, retry: false } } });
  seedPublicData(qc, bundle, now);
  const until = paintedUntil(qc.getQueryData<readonly { date?: unknown }[]>(MATCHES_KEY) ?? [], now);
  if (analyses) seedAnalyses(qc, analyses);
  const router = await loadRouter(url);
  // (renderToString is synchronous: no other request's render runs in between)
  setPaintedAt(now);
  try {
    return { markup: renderToString(<Root router={router} client={qc} />), until };
  } finally {
    setPaintedAt(null);
  }
}
