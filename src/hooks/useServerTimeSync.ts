// Fans never call the live callables, so their phones learn the server's clock from /api/now — only
// while a match is being played or waiting for its whistle (no request on any other day), once per
// session and again every 30 min (lib/serverTime.syncServerTime keeps the pace).
import { useEffect } from "react";
import { matchPhase } from "../../functions/src/matchEngine";
import { kickoffState } from "../lib/derived/kickoff";
import { syncServerTime } from "../lib/serverTime";

type SyncMatch = Parameters<typeof kickoffState>[0] & Parameters<typeof matchPhase>[0];

/** True when some match is live or waiting for its whistle: the live minute is on screen somewhere. */
export function liveOrWaiting(matches: readonly SyncMatch[], now: number): boolean {
  return matches.some((m) => matchPhase(m, now) === "playing" || kickoffState(m, now) === "pending_whistle");
}

/** Asks /api/now while `active` (checked again on each tick of `now`; the pace is serverTime's). */
export function useServerTimeSync(active: boolean, now: number): void {
  useEffect(() => {
    if (active) void syncServerTime();
  }, [active, now]);
}
