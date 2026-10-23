// First paint with data: the public collections arrive as one Firestore bundle from Vercel's CDN
// (functions/src/bundle.ts). index.html already started the download (<link rel=preload>), so this
// fetch reuses it; loading it into the local cache makes the listeners' first snapshot immediate.
// A server-rendered page carries the same bundle inside it (<script id="club-bundle">, api/render.js): then
// nothing is downloaded at all.
// Purely an accelerator: if anything fails, the listeners fetch the same data as always. The shared
// listeners open only once it has settled (bundleGate: opened during the load, they start empty).
// Its `Date` header also gives a first estimate of the server's clock (lib/serverTime), but only for
// an answer that came over the network just now: a copy kept by the browser, the service worker
// (stale-while-revalidate) or the CDN (an `Age`) carries the time it was first sent, not now.
import { loadBundle } from "firebase/firestore";
import { db } from "../firebase";
import { recordDateHeader } from "./serverTime";
import { holdListenersFor } from "./bundleGate";

export const BUNDLE_URL = "/datos/club.bundle";

/** The request's timing on the phone's clock, when the browser says it came fresh from the network
 *  (null otherwise: no timing, a cached copy, or a service worker in between). */
export function freshTiming(entry: Pick<PerformanceResourceTiming, "transferSize" | "workerStart" | "requestStart" | "responseStart"> | undefined, origin: number): { sentAt: number; receivedAt: number } | null {
  if (!entry || entry.transferSize <= 0 || entry.workerStart > 0 || entry.requestStart <= 0 || entry.responseStart < entry.requestStart) return null;
  return { sentAt: origin + entry.requestStart, receivedAt: origin + entry.responseStart };
}

/** Records the Date header of a bundle answer that came fresh from the network (see freshTiming). */
export function noteServerDate(r: Response) {
  try {
    if (Number(r.headers.get("age") ?? 0) > 0) return;
    const url = new URL(BUNDLE_URL, window.location.href).href;
    const entries = performance.getEntriesByName(url, "resource") as PerformanceResourceTiming[];
    const t = freshTiming(entries.at(-1), performance.timeOrigin);
    if (t) recordDateHeader(r.headers.get("date"), t.sentAt, t.receivedAt);
  } catch {
    /* no timing API: the callables' answers will tell */
  }
}

/** The longest the public listeners wait for the bundle before opening anyway (see bundleGate). */
export const BUNDLE_WAIT_MS = 4000;

/** The bundle the server put in the page and the instant it painted the page at, taken out of the page (its
 *  text is the page's largest node). */
export function takeInlineBundle(doc: Document = document): { text: string; at: number | null } | null {
  const el = doc.getElementById("club-bundle");
  if (!el) return null;
  const text = el.textContent;
  const at = Number(el.getAttribute("data-at"));
  el.remove();
  return text ? { text, at: Number.isFinite(at) && at > 0 ? at : null } : null;
}

/** Into the local cache: the bundle the page brought (`inline`), or the one downloading since the HTML. */
export function primeFromBundle(inline?: string | null) {
  if (inline) {
    holdListenersFor(loadBundle(db, inline).then(() => undefined, () => undefined), BUNDLE_WAIT_MS);
    return;
  }
  const load = fetch(BUNDLE_URL)
    .then((r) => {
      // The SPA fallback answers unknown paths with index.html: only take a real bundle.
      if (!r.ok || !(r.headers.get("content-type") ?? "").includes("octet-stream")) throw new Error(`bundle ${r.status}`);
      // (the request's timing entry is written once the body is in)
      return r.arrayBuffer().then((body) => {
        noteServerDate(r);
        return body;
      });
    })
    .then((body) => loadBundle(db, body))
    .catch(() => undefined);
  holdListenersFor(load, BUNDLE_WAIT_MS);
}
