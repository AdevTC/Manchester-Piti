// Where a tap on a push notice leads (public/push-sw.js `notificationclick`). The service worker is a
// plain script imported by the Workbox one, so it keeps its own copy of this function between the
// «pushRoute» marks; pushRoute.test.ts runs the same cases against both copies.

/** The answers a notice's buttons carry (functions/src/pushLogic.ts RSVP_ACTIONS). */
export type PushRsvp = "yes" | "no";

/** What the notice keeps in its `data` (the server's payload: functions/src/pushLogic.ts pushPayload). */
export interface PushClickData {
  url?: unknown;
  matchId?: unknown;
}

/**
 * The page a tap opens: a «Voy» / «No puedo» button opens the vestuario with the answer
 * (`/vestuario?rsvp=yes&m=<matchId>`, written there by the signed-in app: the worker never writes); a
 * plain tap (or an unknown button, or a notice without its match) opens the notice's own link.
 */
export function pushClickUrl(data: PushClickData | null | undefined, action: string | null | undefined): string {
  const d = data ?? {};
  const matchId = typeof d.matchId === "string" ? d.matchId : "";
  if ((action === "yes" || action === "no") && matchId) return `/vestuario?rsvp=${action}&m=${encodeURIComponent(matchId)}`;
  return typeof d.url === "string" && d.url ? d.url : "/";
}
