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

/** Whether a write at `now` deletes the cache, the last deletion having been at `last` (0: none yet). */
export const purgeDue = (now: number, last: number): boolean => last === 0 || now - last >= PURGE_GAP_MS;
