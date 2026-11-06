// The public pages are served from Vercel's CDN cache (api/render.js tags them «club-html»). When the public data
// changes (a match, a player, a season, an MVP tally, the standings or the club's content), this asks the site to
// delete them, and the data bundle they're painted from (api/bundle.js), from the cache (api/purge.js): the next visit waits for a fresh render (as every visit did before the
// cache), so an archived or deleted match is never served again, not even once. The call carries an identity token
// of this project's service account from Google's metadata server: no secret to share with Vercel. If it fails,
// the pages refresh on their own within a minute.
// Once the writes stop, the most visited pages are asked for again (warmed), so the next visitor doesn't wait for
// that render: this function runs in Madrid, next to the club's visitors, and Vercel's CDN keeps its copies per
// region.
import { onDocumentWritten } from "firebase-functions/v2/firestore";
import { REGION } from "./common.js";
import { identityTokenUrl, inBatches, PURGE_URL, purgeRequest, purgeScheduler, WARM_AT_ONCE, WARM_SETTLE_MS, warmPlan } from "./htmlCacheLogic.js";

async function deleteCache(): Promise<boolean> {
  try {
    const id = await fetch(identityTokenUrl(PURGE_URL), { headers: { "Metadata-Flavor": "Google" }, signal: AbortSignal.timeout(5_000) });
    if (!id.ok) throw new Error(`identity token ${id.status}`);
    const { url, init } = purgeRequest(await id.text());
    const res = await fetch(url, { ...init, signal: AbortSignal.timeout(8_000) });
    if (!res.ok) console.warn("htmlCache: delete", res.status);
    return res.ok;
  } catch (error) {
    console.warn("htmlCache: delete", error);
    return false;
  }
}

/** The matches written since the last warm (their pages are warmed too). */
const writtenMatches = new Set<string>();

async function ask(url: string, init: RequestInit = {}): Promise<void> {
  try {
    const res = await fetch(url, { ...init, headers: { "user-agent": "piti-warm", ...init.headers }, signal: AbortSignal.timeout(15_000) });
    // (read to the end: the CDN keeps the copy once the response is complete)
    await res.arrayBuffer();
    if (!res.ok) console.warn("htmlCache: warm", url, res.status);
  } catch (error) {
    console.warn("htmlCache: warm", url, error);
  }
}

async function warm(): Promise<void> {
  const plan = warmPlan([...writtenMatches]);
  writtenMatches.clear();
  await Promise.all(plan.bundle.map((b) => ask(b.url, b.init)));
  await ask(plan.first);
  await inBatches(plan.pages, WARM_AT_ONCE, (url) => ask(url));
}

// (one per instance: at most one deletion every PURGE_GAP_MS, the writes inside the gap deleted at its end; then,
// when no later write has come in the meantime, the warm)
const scheduled = purgeScheduler(async (waiting) => {
  if (!(await deleteCache())) return;
  await new Promise((r) => setTimeout(r, WARM_SETTLE_MS));
  if (!waiting()) await warm();
});
// (the emulator has no metadata server and no Vercel cache)
const purge = (): Promise<void> => (process.env.FUNCTIONS_EMULATOR === "true" ? Promise.resolve() : scheduled());

// (the wait for the gap's end, the deletion, the settling and the warm: up to ~1 min)
const on = (document: string, onWrite?: (id: string) => void) =>
  onDocumentWritten({ document, region: REGION, maxInstances: 1, timeoutSeconds: 120 }, (event) => {
    onWrite?.(String(event.params.id ?? ""));
    return purge();
  });

export const htmlCacheMatches = on("matches/{id}", (id) => writtenMatches.add(id));
export const htmlCachePlayers = on("players/{id}");
export const htmlCacheSeasons = on("seasons/{id}");
export const htmlCacheMvp = on("mvpResults/{id}");
export const htmlCacheStandings = on("standings/{id}");
export const htmlCacheContent = on("clubContent/main");
