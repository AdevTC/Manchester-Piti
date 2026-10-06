// First paint with data: the public collections arrive as one Firestore bundle from Vercel's CDN
// (functions/src/bundle.ts). index.html already started the download (<link rel=preload>), so this
// fetch reuses it; loading it into the local cache makes the listeners' first snapshot immediate.
// Purely an accelerator: if anything fails, the listeners fetch the same data as always.
import { loadBundle } from "firebase/firestore";
import { db } from "../firebase";

export const BUNDLE_URL = "/datos/club.bundle";

export function primeFromBundle() {
  fetch(BUNDLE_URL)
    .then((r) => {
      // The SPA fallback answers unknown paths with index.html: only take a real bundle.
      if (!r.ok || !(r.headers.get("content-type") ?? "").includes("octet-stream")) throw new Error(`bundle ${r.status}`);
      return r.arrayBuffer();
    })
    .then((body) => loadBundle(db, body))
    .catch(() => undefined);
}
