// The public pages are served from Vercel's CDN cache (api/render.js tags them «club-html»). When the public data
// changes (a match, a player, a season, an MVP tally, the standings or the club's content), this asks the site to
// delete them, and the data bundle they're painted from (api/bundle.js), from the cache (api/purge.js): the next visit waits for a fresh render (as every visit did before the
// cache), so an archived or deleted match is never served again, not even once. The call carries an identity token
// of this project's service account from Google's metadata server: no secret to share with Vercel. If it fails,
// the pages refresh on their own within a minute.
import { onDocumentWritten } from "firebase-functions/v2/firestore";
import { REGION } from "./common.js";
import { identityTokenUrl, PURGE_URL, purgeRequest, purgeScheduler } from "./htmlCacheLogic.js";

async function deleteCache(): Promise<void> {
  try {
    const id = await fetch(identityTokenUrl(PURGE_URL), { headers: { "Metadata-Flavor": "Google" }, signal: AbortSignal.timeout(5_000) });
    if (!id.ok) throw new Error(`identity token ${id.status}`);
    const { url, init } = purgeRequest(await id.text());
    const res = await fetch(url, { ...init, signal: AbortSignal.timeout(8_000) });
    if (!res.ok) console.warn("htmlCache: delete", res.status);
  } catch (error) {
    console.warn("htmlCache: delete", error);
  }
}

// (one per instance: at most one deletion every PURGE_GAP_MS, the writes inside the gap deleted at its end)
const scheduled = purgeScheduler(deleteCache);
// (the emulator has no metadata server and no Vercel cache)
const purge = (): Promise<void> => (process.env.FUNCTIONS_EMULATOR === "true" ? Promise.resolve() : scheduled());

const on =(document: string) => onDocumentWritten({ document, region: REGION, maxInstances: 1 }, () => purge());

export const htmlCacheMatches = on("matches/{id}");
export const htmlCachePlayers = on("players/{id}");
export const htmlCacheSeasons = on("seasons/{id}");
export const htmlCacheMvp = on("mvpResults/{id}");
export const htmlCacheStandings = on("standings/{id}");
export const htmlCacheContent = on("clubContent/main");
