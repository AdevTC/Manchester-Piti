// The Vercel cache deletion of htmlCache.ts, pure: tested without the network.

/** One call per instance at most this often: a live match writes every few seconds, the cache lives a minute. */
export const PURGE_GAP_MS = 20_000;

/** The site's own endpoint that deletes its cached pages (api/purge.js; also the identity token's audience). */
export const PURGE_URL = "https://manchester-piti.vercel.app/api/purge";

/** Where a Cloud Function asks for an identity token of its service account, for `audience`. */
export const identityTokenUrl = (audience: string) =>
  `http://metadata.google.internal/computeMetadata/v1/instance/service-accounts/default/identity?audience=${encodeURIComponent(audience)}&format=full`;

/** The request that deletes the server-rendered pages, signed by the functions' identity token. */
export function purgeRequest(idToken: string): { url: string; init: RequestInit } {
  return { url: PURGE_URL, init: { method: "POST", headers: { authorization: `Bearer ${idToken}` } } };
}

/** How long a write at `now` waits before its deletion, the last one having been at `last` (0: none yet): none
 *  when that one is a gap old, else until the gap ends. */
export const purgeWait = (now: number, last: number): number => (last === 0 ? 0 : Math.max(0, PURGE_GAP_MS - (now - last)));

/**
 * One deletion per gap that never drops a write: a write inside the gap waits for its end, and every write that
 * comes while one is waiting joins it (one deletion for all of them, after the last). A write while a deletion is
 * already on its way schedules the next one: that deletion may have left before the write. `run` does the deletion
 * (and what follows it: `waiting()` says whether a later write has already scheduled the next one); the promise of
 * each write ends when the run that covers it has ended (the function has to wait for it: an instance that answered
 * has no CPU left to run a timer).
 */
export function purgeScheduler(run: (waiting: () => boolean) => Promise<void>, now: () => number = Date.now, sleep = (ms: number) => new Promise<void>((r) => setTimeout(r, ms))) {
  let last = 0;
  let waiting: Promise<void> | null = null;
  return (): Promise<void> => {
    if (waiting) return waiting;
    const wait = purgeWait(now(), last);
    // (`then` runs after `waiting` is set, even without a wait)
    const job = (wait > 0 ? sleep(wait) : Promise.resolve()).then(() => {
      last = now();
      waiting = null;
      return run(() => waiting !== null);
    });
    waiting = job;
    return job;
  };
}

/** The site whose pages are deleted and warmed again (PURGE_URL's). */
export const SITE = new URL(PURGE_URL).origin;

/** The public pages visited most (server-rendered: api/render.js PAGES), asked again after each deletion so the next
 *  visitor gets them from the CDN instead of waiting for a render that also rebuilds the bundle (7.7 s measured). */
export const WARM_PAGES: readonly string[] = ["/", "/partidos", "/partidos/tabla", "/estadisticas", "/plantilla", "/club"];
/** The CDN keeps a copy of the data bundle per Accept-Encoding (api/bundle.js varies on it): Chrome's (Android,
 *  desktop) and Safari's (iPhone). The server render's own, Node's fetch, comes with the first page. */
export const WARM_BUNDLE_ENCODINGS: readonly string[] = ["gzip, deflate, br, zstd", "gzip, deflate, br"];
/** The matches written since the last warm whose page (/partidos/<id>, server-rendered too) is warmed: the newest few. */
export const WARM_MATCHES = 3;
/** After a deletion, how long the warm waits for the writes to stop: a live match writes every few seconds, and a
 *  page warmed now would be deleted again at once. The next deletion's warm does it then. */
export const WARM_SETTLE_MS = 8_000;
/** Pages rendered at once while warming. */
export const WARM_AT_ONCE = 3;

/** What a warm asks for, in order: the bundle (every page renders from it), one page (which also brings the server
 *  render's own copy of the bundle), then the rest a few at a time. */
export function warmPlan(matchIds: readonly string[]): { bundle: { url: string; init: RequestInit }[]; first: string; pages: string[] } {
  const ids = matchIds.filter((id) => /^[A-Za-z0-9_-]{1,128}$/.test(id)).slice(-WARM_MATCHES);
  const bundle = WARM_BUNDLE_ENCODINGS.map((enc) => ({ url: `${SITE}/datos/club.bundle`, init: { headers: { "accept-encoding": enc } } }));
  const [first, ...pages] = [...WARM_PAGES, ...ids.map((id) => `/partidos/${id}`)].map((p) => SITE + p);
  return { bundle, first, pages };
}

/** Runs `task` on each item, at most `atOnce` at a time. */
export async function inBatches<T>(items: readonly T[], atOnce: number, task: (item: T) => Promise<void>): Promise<void> {
  let next = 0;
  const lane = async () => {
    while (next < items.length) await task(items[next++]);
  };
  await Promise.all(Array.from({ length: Math.min(atOnce, items.length) }, lane));
}
