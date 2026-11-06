// The club's public data bundle (functions/src/bundle.ts builds it from Firestore, 1.5–4 s) through Vercel's CDN
// (vercel.json routes /datos/club.bundle here): kept a minute under the tag «club-bundle» and deleted with the
// pages on every write to the public data (api/purge.js, functions/src/htmlCache.ts), so the browsers and the
// server render (api/render.js) get it from the CDN instead of waiting for Firestore on every visit.
import { brotliCompressSync, constants, gzipSync } from "node:zlib";

export const BUNDLE_FUNCTION = "https://europe-southwest1-futbolmanagement-dc6cb.cloudfunctions.net/clubBundle";

/** How the bundle is answered: compressed, cached a minute on the CDN. (Vercel compresses only text types itself, not
 *  application/octet-stream: the function does, once per CDN miss.) */
export const bundleHeaders = {
  "content-type": "application/octet-stream",
  "content-encoding": "gzip",
  // (the CDN keys its copies on Accept-Encoding anyway: a gzip-only client never gets the brotli one)
  vary: "accept-encoding",
  "cache-control": "public, max-age=0, must-revalidate",
  "vercel-cdn-cache-control": "max-age=60, stale-while-revalidate=300, stale-if-error=86400",
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

export async function GET(request) {
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
