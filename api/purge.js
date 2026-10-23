// Deletes the server-rendered pages (tag «club-html», api/render.js) from Vercel's CDN cache when the club's public
// data changes: the project's Cloud Functions call it on every write (functions/src/htmlCache.ts). A Vercel
// function purges its own project's cache without any token; the caller proves who it is with a Google identity
// token of the functions' service account, so nobody else can empty the cache.
import { dangerouslyDeleteByTag } from "@vercel/functions";
import { isGoogleIdToken } from "./_googleIdToken.js";

/** What the token must be issued for (functions/src/htmlCacheLogic.ts PURGE_URL says the same). */
export const PURGE_AUDIENCE = "https://manchester-piti.vercel.app/api/purge";
/** The service account the project's Cloud Functions run as (the default compute one). */
export const PURGE_CALLER = "464828934130-compute@developer.gserviceaccount.com";

export async function POST(request) {
  const auth = request.headers.get("authorization") ?? "";
  const token = auth.startsWith("Bearer ") ? auth.slice(7) : "";
  let allowed = false;
  try {
    allowed = !!token && (await isGoogleIdToken(token, { audience: PURGE_AUDIENCE, email: PURGE_CALLER }));
  } catch (error) {
    console.error("purge: token check", error);
  }
  if (!allowed) return new Response(null, { status: 401, headers: { "cache-control": "no-store" } });
  // (deleted, not marked stale: the next visit waits for a fresh render, so an archived or deleted match is never
  // served again, not even once)
  await dangerouslyDeleteByTag("club-html");
  return new Response(null, { status: 204, headers: { "cache-control": "no-store" } });
}
