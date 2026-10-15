// Where a match stands around its kick-off, and the words every surface uses for it. The rule lives in
// functions/src/matchEngine.ts (the server's push and phases use it too); this is the web's door to it.
import { isVisibleMatch, kickoffState, matchPhase } from "../../../functions/src/matchEngine";

export { kickoffState, whistleDeadline, WHISTLE_GRACE_MS, type KickoffState } from "../../../functions/src/matchEngine";

/** The date has come and nobody has started the clock. */
export const PENDING_WHISTLE = "Pendiente del pitido inicial";
/** The clock never started and the window is over: the match waits for its acta. */
export const AWAITING_ACTA = "Pendiente del acta";

/** The text for a match waiting on someone (the whistle or the acta); null otherwise. */
export function kickoffText(match: Parameters<typeof kickoffState>[0], now: number): string | null {
  if (!isVisibleMatch(match)) return null;
  const k = kickoffState(match, now);
  return k === "pending_whistle" ? PENDING_WHISTLE : k === "awaiting_result" ? AWAITING_ACTA : null;
}

/** Still to be played: before its date (or without one), and not a past kick-off waiting for its acta.
 *  (A played, live or called-off match is not: the season's plan, say, was not its seven.) */
export function toBePlayed(match: Parameters<typeof kickoffState>[0], now: number): boolean {
  if (!isVisibleMatch(match)) return false;
  const phase = matchPhase(match, now);
  return (phase === "scheduled" || phase === "unscheduled") && kickoffState(match, now) !== "awaiting_result";
}
