import { act, renderHook } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { goalClasses, goalStageAt, type GoalMoment } from "./goalMoment";
import { useGoalMoment } from "./useGoalMoment";

describe("goal timeline", () => {
  it("follows PLAN-V: inhale, spring, flood, glint, roll, name, peak, then cools at 4 s", () => {
    expect([0, 119, 120, 200, 320, 450, 700, 900, 3999, 4000].map(goalStageAt)).toEqual(["inhale", "inhale", "spring", "flood", "glint", "roll", "name", "peak", "peak", "cool"]);
  });

  it("classes build up with the stages; the rim stays after", () => {
    const flood = goalClasses("flood", "us");
    expect(flood).toMatchObject({ active: true, root: "vd-goal", lens: "vd-goal-lens", sky: { gold: true, cold: false }, glint: "", digit: "", rim: true });
    const peak = goalClasses("peak", "us");
    expect(peak).toMatchObject({ glint: "vd-glint--sweep", digit: "vd-digit--roll", name: "vd-scorer--set", peak: "vd-peak--rise" });
    expect(goalClasses("cool", "us")).toMatchObject({ active: false, root: "", lens: "", sky: { gold: false }, rim: true });
  });

  it("the rival's goal: a cold flash, no gold, no rim", () => {
    const c = goalClasses("peak", "them");
    expect(c.sky).toEqual({ gold: false, cold: true });
    expect([c.glint, c.name, c.peak]).toEqual(["", "", ""]);
    expect(c.rim).toBe(false);
    expect(c.root).toBe("vd-goal vd-goal--them");
  });
});

describe("useGoalMoment", () => {
  afterEach(() => vi.useRealTimers());

  it("a goal already there on mount doesn't play: only its rim", () => {
    const { result } = renderHook(() => useGoalMoment({ key: "e1", side: "us" }, { reduced: false }));
    expect(result.current.stage).toBe("cool");
    expect(result.current.rim).toBe(true);
  });

  it("a new goal plays through the timeline and cools", () => {
    vi.useFakeTimers();
    const { result, rerender } = renderHook(({ m }: { m: GoalMoment | null }) => useGoalMoment(m, { reduced: false }), { initialProps: { m: null as GoalMoment | null } });
    expect(result.current.stage).toBe("idle");
    rerender({ m: { key: "e9", side: "us" } });
    expect(result.current.stage).toBe("inhale");
    act(() => {
      vi.advanceTimersByTime(460);
    });
    expect(result.current.stage).toBe("roll");
    expect(result.current.sky.gold).toBe(true);
    act(() => {
      vi.advanceTimersByTime(4000);
    });
    expect(result.current.stage).toBe("cool");
    expect(result.current.rim).toBe(true);
    rerender({ m: null });
    expect(result.current.rim).toBe(false);
  });

  it("reduced motion: the number just changes, the rim stays", () => {
    const { result, rerender } = renderHook(({ m }: { m: GoalMoment | null }) => useGoalMoment(m, { reduced: true }), { initialProps: { m: null as GoalMoment | null } });
    rerender({ m: { key: "e9", side: "us" } });
    expect(result.current.stage).toBe("cool");
    expect(result.current.lens).toBe("");
    expect(result.current.rim).toBe(true);
  });
});
