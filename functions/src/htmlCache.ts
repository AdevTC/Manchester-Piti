// The public pages are served from Vercel's CDN cache (api/render.js tags them «club-html»). When the public data
// changes (a match, a player, a season, an MVP tally, the standings or the club's content), this deletes them from
// the cache: the next visit waits for a fresh render (as every visit did before the cache), so an archived or
// deleted match is never served again, not even once. Without the token (or the project) configured it does
// nothing: the pages then refresh on their own within a minute.
import { onDocumentWritten } from "firebase-functions/v2/firestore";
import { defineSecret, defineString } from "firebase-functions/params";
import { purgeDue, purgeRequest } from "./htmlCacheLogic.js";

const token = defineSecret("VERCEL_PURGE_TOKEN");
const project = defineString("VERCEL_PROJECT", { default: "" });
const team = defineString("VERCEL_TEAM_ID", { default: "" });

let lastPurge = 0;

async function purge(now = Date.now()): Promise<void> {
  const name = project.value();
  if (!name || !purgeDue(now, lastPurge)) return;
  let bearer = "";
  try {
    bearer = token.value();
  } catch {
    return;
  }
  if (!bearer) return;
  lastPurge = now;
  const { url, init } = purgeRequest(name, team.value(), bearer);
  try {
    const res = await fetch(url, { ...init, signal: AbortSignal.timeout(8_000) });
    if (!res.ok) console.warn("htmlCache: delete", res.status);
  } catch (error) {
    console.warn("htmlCache: delete", error);
  }
}

const on = (document: string) => onDocumentWritten({ document, secrets: [token], maxInstances: 1 }, () => purge());

export const htmlCacheMatches = on("matches/{id}");
export const htmlCachePlayers = on("players/{id}");
export const htmlCacheSeasons = on("seasons/{id}");
export const htmlCacheMvp = on("mvpResults/{id}");
export const htmlCacheStandings = on("standings/{id}");
export const htmlCacheContent = on("clubContent/main");
