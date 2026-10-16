// Shared porra contract and scoring. Count repeated goals, never repeated guesses without a real goal.
import { predictionPoints, type Score } from "./vestuarioLogic.js";
import type { MatchEvent } from "./matchEngine.js";
import { isGuestId } from "./guests.js";

export interface GoalPick {
  playerId: string;
  /** Omitted: no bet on the assist. null: explicitly predicts an unassisted goal. */
  assistPlayerId?: string | null;
}
export interface Prediction extends Score { goals?: GoalPick[]; scoringVersion?: 2 }
export const PORRA_POINTS = { scorer: 2, assist: 1, action: 3, multiple: 2 } as const;

export function predictionOpen(match: { status?: string; clock?: { phase?: string } | null; liveEndedAt?: number; published?: boolean }) {
  return match.published !== false && match.status === "scheduled" && !match.liveEndedAt && (!match.clock || match.clock.phase === "ready");
}
export function predictionsRevealed(match: { status?: string; clock?: { phase?: string } | null; liveEndedAt?: number }) {
  return match.status === "finished" || !!match.liveEndedAt || (!!match.clock && match.clock.phase !== "ready");
}
function hits(predicted: string[], actual: string[]) {
  const remaining = new Map<string, number>();
  for (const key of actual) remaining.set(key, (remaining.get(key) ?? 0) + 1);
  return predicted.reduce((n, key) => {
    const left = remaining.get(key) ?? 0;
    if (!left) return n;
    remaining.set(key, left - 1);
    return n + 1;
  }, 0);
}
export function scorePrediction(prediction: Prediction, result: Score, events: readonly MatchEvent[] = []) {
  const allGoals = events.filter((e) => ["goal", "goal_penalty", "goal_freekick"].includes(e.type) && e.playerId);
  // A guest («guest:g1») is never a pick: his goals score no scorer or action, a member's assist to him
  // counts, and his assist to a member's goal is read as none (the member scored it unassisted).
  const goals = allGoals.filter((e) => !isGuestId(e.playerId));
  const picks = prediction.goals ?? [];
  const scorers = hits(picks.map((p) => p.playerId), goals.map((g) => g.playerId!));
  const assists = hits(picks.flatMap((p) => p.assistPlayerId ? [p.assistPlayerId] : []), allGoals.flatMap((g) => g.assistPlayerId && !isGuestId(g.assistPlayerId) ? [g.assistPlayerId] : []));
  const key = (player: string, assist: string | null) => JSON.stringify([player, assist]);
  const actions = hits(picks.filter((p) => p.assistPlayerId !== undefined).map((p) => key(p.playerId, p.assistPlayerId!)), goals.filter(g=>g.assistReviewed !== false).map((g) => key(g.playerId!, g.assistPlayerId && !isGuestId(g.assistPlayerId) ? g.assistPlayerId : null)));
  const score = predictionPoints(prediction, result);
  const scorerPoints = scorers * PORRA_POINTS.scorer;
  const assistPoints = assists * PORRA_POINTS.assist;
  const actionPoints = actions * PORRA_POINTS.action;
  const multiplePoints = Math.max(0, scorers - 1) * PORRA_POINTS.multiple;
  return { score, scorers, assists, actions, scorerPoints, assistPoints, actionPoints, multiplePoints, total: score + scorerPoints + assistPoints + actionPoints + multiplePoints };
}
