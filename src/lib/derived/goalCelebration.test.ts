import { describe, expect, it } from "vitest";
import { transitionClock, readyClock } from "../../../functions/src/matchClock";
import type { MatchEvent } from "../../../functions/src/matchEngine";
import { FRESH_GOAL_SECONDS, goalsOf, isFreshGoal } from "./goalCelebration";

const T0 = Date.UTC(2026, 10, 8, 11);
const clock = transitionClock(readyClock(), "start", T0);
const goal = (id: string, extra: Partial<MatchEvent> = {}): MatchEvent => ({ id, type: "goal", ...extra }) as MatchEvent;

describe("goalsOf", () => {
  it("lists our goals and theirs with their time, the exact stamp first, and skips goals with no time", () => {
    const goals = goalsOf([
      goal("a", { minute: 12, elapsedSeconds: 745 }),
      goal("b", { minute: 20 }),
      { id: "c", type: "opponent_goal", minute: 30 } as MatchEvent,
      { id: "d", type: "yellow_card", minute: 31 } as MatchEvent,
      goal("e"),
    ]);
    expect(goals).toEqual([
      { id: "a", ours: true, seconds: 745 },
      { id: "b", ours: true, seconds: 1200 },
      { id: "c", ours: false, seconds: 1800 },
    ]);
  });
});

describe("isFreshGoal", () => {
  const match = { clock, events: [] };
  it("a goal within 2 minutes of the clock reading is fresh, an older one is not", () => {
    const now = T0 + 20 * 60_000;
    expect(isFreshGoal({ seconds: 20 * 60 - 5 }, match, now)).toBe(true);
    expect(isFreshGoal({ seconds: 20 * 60 - FRESH_GOAL_SECONDS }, match, now)).toBe(true);
    expect(isFreshGoal({ seconds: 20 * 60 - FRESH_GOAL_SECONDS - 1 }, match, now)).toBe(false);
    expect(isFreshGoal({ seconds: 4 * 60 }, match, now)).toBe(false);
  });
  it("a clock that has not started has no reading, so nothing is fresh", () => {
    expect(isFreshGoal({ seconds: 0 }, { clock: readyClock() }, T0)).toBe(false);
  });
  it("a match without a clock reads the minute from the kickoff", () => {
    const legacy = { date: T0, duration: 50 };
    expect(isFreshGoal({ seconds: 19 * 60 }, legacy, T0 + 19.5 * 60_000)).toBe(true);
    expect(isFreshGoal({ seconds: 5 * 60 }, legacy, T0 + 19.5 * 60_000)).toBe(false);
  });
});
