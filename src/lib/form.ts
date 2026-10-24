// The per-match pieces the cromos and the season rating read: a match's length, when a player was on the
// pitch (the ledger's stints) and the goals conceded while he was. The pizarra (pages/pizarra/v2/ratings.ts,
// which re-exports some) and the rating engine (lib/rating) share them; kept apart so neither pulls in the other. Pure.
import type { ClubMatch, MatchEvent } from "./clubData";

const DEFAULT_DURATION = 50;

/** A match's length in minutes (DEFAULT_DURATION when the acta has none). */
export const durationOf = (m: Pick<ClubMatch, "duration">): number => (typeof m.duration === "number" && m.duration > 0 ? m.duration : DEFAULT_DURATION);
const oppGoals = (m: ClubMatch): MatchEvent[] => (m.events ?? []).filter((e) => e.type === "opponent_goal");

/** When a player was on the pitch in a match: the ledger's stints (null = no stints recorded). */
export function stintsOf(m: ClubMatch, id: string): { from: number; to: number }[] | null {
  const st = m.ledger?.[id]?.stints;
  return st && st.length ? st : null;
}

const inStint = (minute: number, s: { from: number; to: number }, d: number) => minute >= s.from && (minute < s.to || (minute === s.to && s.to >= d));

/** Goals the team conceded while he was on the pitch (the stints; without them, his share of the match). */
export function concededOnPitch(m: ClubMatch, id: string, minutes: number): number {
  const d = durationOf(m);
  const st = stintsOf(m, id);
  const opp = oppGoals(m);
  if (st) return opp.filter((e) => typeof e.minute === "number" && st.some((s) => inStint(e.minute as number, s, d))).length;
  const total = opp.length || (typeof m.goalsAgainst === "number" ? m.goalsAgainst : 0);
  return total * Math.min(1, minutes / d);
}
