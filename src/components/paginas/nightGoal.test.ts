import { act, renderHook } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import type { ClubMatch, MatchEvent } from "../../lib/clubData";
import { newestGoal, useNightGoal } from "./nightGoal";

const goal = (id: string, type: MatchEvent["type"], min: number, playerId?: string): MatchEvent => ({ id, type, elapsedSeconds: min * 60, period: 1, playerId });
const m = (events: MatchEvent[]): ClubMatch => ({ id: "j1", seasonId: "t1", status: "scheduled", rival: "Orduña fc", date: 0, events });

describe("newestGoal", () => {
  it("the newest goal that stands, with whose it is", () => {
    expect(newestGoal(m([goal("a", "goal", 6, "alcides"), goal("b", "opponent_goal", 11)]))).toEqual({ key: "b", side: "them", playerId: null });
    expect(newestGoal(m([goal("a", "goal", 6, "alcides"), { ...goal("c", "goal", 9, "jordi"), dupOf: "a" }]))).toEqual({ key: "a", side: "us", playerId: "alcides" });
    expect(newestGoal(m([]))).toBeNull();
  });
});

describe("useNightGoal", () => {
  afterEach(() => vi.useRealTimers());
  it("the goals already there when the data arrives are not news; the next one plays", () => {
    vi.useFakeTimers();
    window.matchMedia ??= ((q: string) => ({ matches: false, media: q, addEventListener() {}, removeEventListener() {} }) as unknown as MediaQueryList);
    const { result, rerender } = renderHook(({ match }: { match: ClubMatch | undefined }) => useNightGoal(match, true), { initialProps: { match: undefined as ClubMatch | undefined } });
    rerender({ match: m([goal("a", "goal", 6, "alcides")]) });
    act(() => void vi.advanceTimersByTime(500));
    expect(result.current.goal).toBeNull();
    expect(result.current.moment.active).toBe(false);
    rerender({ match: m([goal("a", "goal", 6, "alcides"), goal("b", "goal", 21, "adrian")]) });
    act(() => void vi.advanceTimersByTime(500));
    expect(result.current.goal).toEqual({ key: "b", side: "us", playerId: "adrian" });
    expect(result.current.moment.active).toBe(true);
  });
});
