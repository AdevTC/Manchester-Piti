// When a member may answer the convocatoria, fill in the porra and vote the MVP: the same windows
// firestore.rules enforces (upcoming() for availability and predictions, mvpOpen() for votes), so a
// control is never offered when the write would be refused.
import { dateMillis } from "../../../functions/src/matchEngine";

/** «open» until kick-off; «closed» from its date on; «undated» while the match has no date yet. */
export type KickoffWindow = "open" | "closed" | "undated";

/** The convocatoria and the porra: a scheduled match before its date (rules: upcoming()). */
export function kickoffWindow(match: { status?: string; date?: unknown }, now: number): KickoffWindow {
  const at = dateMillis(match.date);
  if (!Number.isFinite(at)) return "undated";
  return match.status === "scheduled" && at > now ? "open" : "closed";
}

/** The MVP vote: a finished match with its 48 h window still running (rules: mvpOpen()). */
export function mvpVoteOpen(match: { status?: string; voteClosesAt?: number | null }, now: number): boolean {
  return match.status === "finished" && typeof match.voteClosesAt === "number" && now < match.voteClosesAt;
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
