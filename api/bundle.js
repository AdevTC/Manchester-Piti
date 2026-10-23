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

export async function GET() {
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
