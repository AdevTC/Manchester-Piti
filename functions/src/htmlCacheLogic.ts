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
 * already on its way schedules the next one: that deletion may have left before the write. `run` does the deletion;
 * the promise of each write ends when the deletion that covers it has run (the function has to wait for it: an
 * instance that answered has no CPU left to run a timer).
 */
export function purgeScheduler(run: () => Promise<void>, now: () => number = Date.now, sleep = (ms: number) => new Promise<void>((r) => setTimeout(r, ms))) {
  let last = 0;
  let waiting: Promise<void> | null = null;
  return (): Promise<void> => {
    if (waiting) return waiting;
    const wait = purgeWait(now(), last);
    // (`then` runs after `waiting` is set, even without a wait)
    const job = (wait > 0 ? sleep(wait) : Promise.resolve()).then(() => {
      last = now();
      waiting = null;
      return run();
    });
    waiting = job;
    return job;
  };
}
