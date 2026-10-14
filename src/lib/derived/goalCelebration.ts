// Which goals of a live match deserve a «¡GOL!»: only the ones that appear after the screen was
// already showing the match AND happened right now (within 2 min of the live clock). A goal that was
// already in the data when the screen opened, or one that arrives late (stale cache, a sync after
// being offline) is just data: the score changes, nothing is celebrated.
import { clockReading, type MatchClock } from "../../../functions/src/matchClock";
import { dateMillis, type MatchEvent } from "../../../functions/src/matchEngine";

/** A goal counts as «live» while its time is within this many seconds of the clock reading. */
export const FRESH_GOAL_SECONDS = 120;

const OURS = new Set(["goal", "goal_penalty", "goal_freekick", "opponent_own_goal"]);
const THEIRS = new Set(["opponent_goal", "own_goal"]);

export interface LiveGoal {
  id: string;
  ours: boolean;
  /** Seconds of play at which it happened (the exact stamp when there is one, else the minute). */
  seconds: number;
}

export type GoalMatch = { date?: unknown; duration?: number; clock?: MatchClock; events?: MatchEvent[] };

/** Every goal in the acta, ours and theirs, with the time it was stamped at. Goals with no time are left out. */
export function goalsOf(events: readonly MatchEvent[] | undefined): LiveGoal[] {
  const goals: LiveGoal[] = [];
  for (const e of events ?? []) {
    const ours = OURS.has(e.type);
    if (!ours && !THEIRS.has(e.type)) continue;
    const seconds = typeof e.elapsedSeconds === "number" ? e.elapsedSeconds : typeof e.minute === "number" ? e.minute * 60 : undefined;
    if (seconds === undefined) continue;
    goals.push({ id: e.id, ours, seconds });
  }
  return goals;
}

/** Seconds of play at `now`: the match clock, or (matches without one) the time since the kickoff. */
function readingSeconds(match: GoalMatch, now: number): number | null {
  if (match.clock) return match.clock.phase === "ready" ? null : clockReading(match.clock, now).elapsedSeconds;
  const start = dateMillis(match.date);
  return Number.isFinite(start) && now >= start ? Math.min(match.duration ?? 50, Math.floor((now - start) / 60_000) + 1) * 60 : null;
}

/** True when the goal is within FRESH_GOAL_SECONDS of the live clock (a goal «in the future» counts: the clocks are not synchronised). */
export function isFreshGoal(goal: Pick<LiveGoal, "seconds">, match: GoalMatch, now: number): boolean {
  const reading = readingSeconds(match, now);
  return reading !== null && reading - goal.seconds <= FRESH_GOAL_SECONDS;
}
