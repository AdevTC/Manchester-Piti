// The Vercel cache deletion of htmlCache.ts, pure: tested without the network.

/** One call per instance at most this often: a live match writes every few seconds, the cache lives a minute. */
export const PURGE_GAP_MS = 20_000;

/** The request that deletes the server-rendered pages (tag «club-html») from Vercel's CDN cache. */
export function purgeRequest(projectIdOrName: string, teamId: string, bearer: string): { url: string; init: RequestInit } {
  const q = new URLSearchParams({ projectIdOrName });
  if (teamId) q.set("teamId", teamId);
  return {
    url: `https://api.vercel.com/v1/edge-cache/dangerously-delete-by-tags?${q}`,
    init: { method: "POST", headers: { authorization: `Bearer ${bearer}`, "content-type": "application/json" }, body: JSON.stringify({ tags: ["club-html"], target: "production" }) },
  };
}

/** Whether a write at `now` deletes the cache, the last deletion having been at `last` (0: none yet). */
export const purgeDue = (now: number, last: number): boolean => last === 0 || now - last >= PURGE_GAP_MS;
