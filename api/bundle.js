// The club's public data bundle (functions/src/bundle.ts builds it from Firestore, 1.5–4 s) through Vercel's CDN
// (vercel.json routes /datos/club.bundle here): kept under the tag «club-bundle» (fresh a minute, then served
// once more up to a day while a new one is built: never old data, since it is deleted with the
// pages on every write to the public data (api/purge.js, functions/src/htmlCache.ts), so the browsers and the
// server render (api/render.js) get it from the CDN instead of waiting for Firestore on every visit.
import { brotliCompressSync, constants, gzipSync } from "node:zlib";

export const BUNDLE_FUNCTION = "https://europe-southwest1-futbolmanagement-dc6cb.cloudfunctions.net/clubBundle";

/** How the bundle is answered: compressed, kept on the CDN like the pages (api/render.js PAGE_CDN_CACHE). (Vercel compresses only text types itself, not
 *  application/octet-stream: the function does, once per CDN miss.) */
export const bundleHeaders = {
  "content-type": "application/octet-stream",
  "content-encoding": "gzip",
  // (the CDN keys its copies on Accept-Encoding anyway: a gzip-only client never gets the brotli one)
  vary: "accept-encoding",
  "cache-control": "public, max-age=0, must-revalidate",
  "vercel-cdn-cache-control": "max-age=60, stale-while-revalidate=86400, stale-if-error=86400",
  "vercel-cache-tag": "club-bundle",
};

/** Brotli for whoever accepts it (every current browser): the 1.86 MB of the bundle are 55 KB instead of gzip's 83 KB,
 *  in ~20 ms (quality 9; 11 takes seconds for 5 KB more). Gzip otherwise (Node's fetch in api/render.js asks for gzip). */
export function compress(body, acceptEncoding) {
  if (/\bbr\b/.test(acceptEncoding ?? "")) {
    const params = { [constants.BROTLI_PARAM_QUALITY]: 9, [constants.BROTLI_PARAM_SIZE_HINT]: body.length };
    return { body: brotliCompressSync(body, { params }), encoding: "br" };
  }
  return { body: gzipSync(body, { level: 6 }), encoding: "gzip" };
}

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
    // (uncompressed from the function, compressed once here: the CDN keeps the compressed copies)
    const res = await fetch(BUNDLE_FUNCTION, { cache: "no-store", headers: { "accept-encoding": "identity" } });
    if (!res.ok) throw new Error(`bundle ${res.status}`);
    const body = new Uint8Array(await res.arrayBuffer());
    const packed = compress(body, request?.headers.get("accept-encoding"));
    return new Response(packed.body, { headers: { ...bundleHeaders, "content-encoding": packed.encoding } });
  } catch (error) {
    console.error("bundle", error);
    return new Response(null, { status: 502, headers: { "cache-control": "no-store" } });
  }
}
