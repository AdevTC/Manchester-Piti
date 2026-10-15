// When a member may answer the convocatoria, fill in the porra and vote the MVP: the same windows
// firestore.rules enforces (upcoming() for availability and predictions, mvpOpen() for votes), so a
// control is never offered when the write would be refused.
import { dateMillis, isVisibleMatch } from "../../../functions/src/matchEngine";

/**
 * «open» until kick-off; «closed» once its date has come (or it is under way / over); «undated» while the
 * match has no date yet; «unavailable» for a future match that is not scheduled (called off, postponed, or
 * a legacy one without a status): the rules refuse it, but it did not «close» at any time.
 */
export type KickoffWindow = "open" | "closed" | "undated" | "unavailable";

/** The convocatoria and the porra: a scheduled match before its date (rules: upcoming()). */
export function kickoffWindow(match: { status?: string; date?: unknown }, now: number): KickoffWindow {
  if (!isVisibleMatch(match)) return "unavailable";
  const at = dateMillis(match.date);
  if (!Number.isFinite(at)) return "undated";
  if (match.status === "scheduled") return at > now ? "open" : "closed";
  return at > now && match.status !== "live" && match.status !== "finished" ? "unavailable" : "closed";
}

/** The MVP vote: a finished match with its 48 h window still running (rules: mvpOpen()). */
export function mvpVoteOpen(match: { status?: string; voteClosesAt?: number | null }, now: number): boolean {
  return isVisibleMatch(match) && match.status === "finished" && typeof match.voteClosesAt === "number" && now < match.voteClosesAt;
}

/** Who can be voted: everyone who played (rules: ledger.played), most voted first, then by name. */
export function mvpCandidates(
  ledger: Record<string, { played?: boolean }> | undefined,
  counts: Record<string, number> | undefined,
  nameOf: (id: string) => string,
): string[] {
  return Object.entries(ledger ?? {})
    .filter(([, row]) => row.played)
    .map(([id]) => id)
    .sort((a, b) => (counts?.[b] ?? 0) - (counts?.[a] ?? 0) || nameOf(a).localeCompare(nameOf(b), "es"));
}
