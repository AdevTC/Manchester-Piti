// The one-time ticket of «Responder desde el aviso»: only the service worker (public/push-sw.js), on a
// tap on a notice's «Voy» / «No puedo», leaves `{ rsvp, m, exp }` at /rsvp/<nonce> in the «mp-rsvp»
// cache and opens /vestuario?rsvp=&m=&n=<nonce>. The vestuario writes the answer only with that ticket
// (used once, same answer and match, not expired): a crafted link alone never answers for a member, it
// only asks («¿Apuntarte como …?»). Same names as the worker's copy.

/** The worker's cache of tickets. */
export const RSVP_CACHE = "mp-rsvp";
/** How long a ticket lasts (the worker stamps `exp` = now + this). */
export const RSVP_TICKET_MS = 10 * 60_000;
/** Where a ticket lives in the cache. */
export const rsvpTicketPath = (nonce: string): string => `/rsvp/${nonce}`;

/** Whether a stored ticket answers this link: same answer and match, and still running. */
export function rsvpTicketValid(ticket: unknown, rsvp: string, m: string, now: number): boolean {
  if (!ticket || typeof ticket !== "object") return false;
  const t = ticket as { rsvp?: unknown; m?: unknown; exp?: unknown };
  return t.rsvp === rsvp && t.m === m && typeof t.exp === "number" && now < t.exp && t.exp <= now + RSVP_TICKET_MS;
}

/**
 * Reads and spends the ticket `nonce` (deleted whatever it says: one use). False when there is none, it
 * was already used, it doesn't match, it expired, or the Cache API isn't there.
 */
export async function consumeRsvpTicket(nonce: string | undefined, rsvp: string, m: string, now: number = Date.now()): Promise<boolean> {
  if (!nonce || typeof caches === "undefined") return false;
  try {
    const cache = await caches.open(RSVP_CACHE);
    const key = rsvpTicketPath(nonce);
    const hit = await cache.match(key);
    if (!hit) return false;
    const ticket: unknown = await hit.json().catch(() => null);
    await cache.delete(key);
    return rsvpTicketValid(ticket, rsvp, m, now);
  } catch {
    return false;
  }
}
