// The matches' narrated analyses as a bundle (functions/src/bundle.ts clubAnalysisBundle) through Vercel's CDN
// (vercel.json routes /datos/analisis.bundle here), exactly as api/bundle.js serves the public data: compressed, kept a
// minute under the same tag «club-bundle», so every write to the public data deletes it too (api/purge.js). Only the
// pages that show the analyses ask for it (src/lib/matchAnalyses), and api/render.js for the ones it renders with them.
import { bundleHeaders, compress } from "./bundle.js";

export const ANALYSIS_BUNDLE_FUNCTION = "https://europe-southwest1-futbolmanagement-dc6cb.cloudfunctions.net/clubAnalysisBundle";
export const ANALYSIS_BUNDLE_PATH = "/datos/analisis.bundle";

export async function GET(request) {
  // (one address, like the public bundle's: a query would miss the CDN's copy and rebuild it from Firestore)
  if (new URL(request.url).search) {
    return new Response(null, {
      status: 308,
      headers: { location: ANALYSIS_BUNDLE_PATH, "cache-control": "public, max-age=86400", "vercel-cdn-cache-control": "max-age=86400" },
    });
  }
  try {
    const res = await fetch(ANALYSIS_BUNDLE_FUNCTION, { cache: "no-store", headers: { "accept-encoding": "identity" } });
    if (!res.ok) throw new Error(`analysis bundle ${res.status}`);
    const body = new Uint8Array(await res.arrayBuffer());
    const packed = compress(body, request?.headers.get("accept-encoding"));
    return new Response(packed.body, { headers: { ...bundleHeaders, "content-encoding": packed.encoding } });
  } catch (error) {
    console.error("analysis bundle", error);
    return new Response(null, { status: 502, headers: { "cache-control": "no-store" } });
  }
}
