// The club's public data bundle (functions/src/bundle.ts builds it from Firestore, 1.5–4 s) through Vercel's CDN
// (vercel.json routes /datos/club.bundle here): kept a minute under the tag «club-bundle» and deleted with the
// pages on every write to the public data (api/purge.js, functions/src/htmlCache.ts), so the browsers and the
// server render (api/render.js) get it from the CDN instead of waiting for Firestore on every visit.
import { gzipSync } from "node:zlib";

export const BUNDLE_FUNCTION = "https://europe-southwest1-futbolmanagement-dc6cb.cloudfunctions.net/clubBundle";

/** How the bundle is answered: compressed (~1 MB of JSON text is ~55 KB), cached a minute on the CDN. */
export const bundleHeaders = {
  "content-type": "application/octet-stream",
  "content-encoding": "gzip",
  "cache-control": "public, max-age=0, must-revalidate",
  "vercel-cdn-cache-control": "max-age=60, stale-while-revalidate=300, stale-if-error=86400",
  "vercel-cache-tag": "club-bundle",
};

/** The bundle's one address. Nothing of the site asks it with a query (index.html's preload, lib/bundle.ts, the service
 *  worker and api/render.js all ask exactly this), and the CDN keeps a copy per full URL: «?x=<anything>» would miss
 *  it and rebuild the bundle from Firestore (every match, player, season… read again) on each request. Such a request
 *  is sent here instead, with a redirect the CDN keeps a day. */
export const BUNDLE_PATH = "/datos/club.bundle";

/** The canonical-address redirect for a request that carries a query, or null. */
export function withoutQuery(requestUrl) {
  if (!new URL(requestUrl).search) return null;
  return new Response(null, {
    status: 308,
    headers: { location: BUNDLE_PATH, "cache-control": "public, max-age=86400", "vercel-cdn-cache-control": "max-age=86400" },
  });
}

export async function GET(request) {
  const moved = withoutQuery(request.url);
  if (moved) return moved;
  try {
    // (uncompressed from the function, compressed once here: the CDN keeps the compressed copy)
    const res = await fetch(BUNDLE_FUNCTION, { cache: "no-store", headers: { "accept-encoding": "identity" } });
    if (!res.ok) throw new Error(`bundle ${res.status}`);
    const body = new Uint8Array(await res.arrayBuffer());
    return new Response(gzipSync(body, { level: 6 }), { headers: bundleHeaders });
  } catch (error) {
    console.error("bundle", error);
    return new Response(null, { status: 502, headers: { "cache-control": "no-store" } });
  }
}
