// Which goals of a live match deserve a «¡GOL!»: only the ones that appear after the screen was
// already showing the match AND happened right now (within 2 min of the live clock). A goal that was
// already in the data when the screen opened, or one that arrives late (stale cache, a sync after
// being offline) is just data: the score changes, nothing is celebrated.
import { clockReading } from "../../../functions/src/matchClock";
import type { MatchEvent } from "../../../functions/src/matchEngine";
import type { ClubMatch } from "../clubData";
import { liveMinute, OURS, THEIRS } from "../partidos";

/** A goal counts as «live» while its time is within this many seconds of the clock reading. */
export const FRESH_GOAL_SECONDS = 120;

export interface LiveGoal {
  id: string;
  ours: boolean;
  /** Seconds of play at which it happened (the exact stamp when there is one, else the minute). */
  seconds: number;
}

export type GoalMatch = Pick<ClubMatch, "date" | "duration" | "clock"> & { events?: MatchEvent[] };

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

/** Seconds of play at `now`: the match clock, or (matches without one) the minute liveMinute reads from the kickoff. */
function readingSeconds(match: GoalMatch, now: number): number | null {
  if (match.clock) return match.clock.phase === "ready" ? null : clockReading(match.clock, now).elapsedSeconds;
  const minute = liveMinute(match, now);
  return minute === null ? null : minute * 60;
}

/** True when the goal is within FRESH_GOAL_SECONDS of the live clock. A goal «in the future» counts too:
 *  `now` is the server's time as this phone estimates it (lib/serverTime), good only to about half a
 *  round trip, and with no estimate yet it is the phone's own clock. */
export function isFreshGoal(goal: Pick<LiveGoal, "seconds">, match: GoalMatch, now: number): boolean {
  const reading = readingSeconds(match, now);
  return reading !== null && reading - goal.seconds <= FRESH_GOAL_SECONDS;
}
