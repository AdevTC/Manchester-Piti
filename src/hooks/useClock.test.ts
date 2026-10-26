// @vitest-environment jsdom
import { act, renderHook } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { useClock } from "./useClock";
import { useMatchClock } from "./useMatchClock";

describe("useClock", () => {
  beforeEach(() => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-09-25T10:00:30Z"));
  });
  afterEach(() => vi.useRealTimers());

  it("ticks on the minute boundary, not every second, with a 60 s step", () => {
    const { result } = renderHook(() => useClock(60_000));
    const start = result.current;
    act(() => { vi.advanceTimersByTime(20_000); });
    expect(result.current).toBe(start);
    act(() => { vi.advanceTimersByTime(11_000); });
    expect(new Date(result.current).getUTCSeconds()).toBe(0);
    expect(result.current).toBeGreaterThan(start);
  });

  it("keeps a one-second clock by default", () => {
    const { result } = renderHook(() => useClock());
    const start = result.current;
    act(() => { vi.advanceTimersByTime(1_010); });
    expect(result.current).toBeGreaterThan(start);
  });

  it("also ticks on a match boundary between two minute ticks and catches up on focus", () => {
    const kickoff = Date.now() + 12_000;
    const { result } = renderHook(() => useClock(60_000, [kickoff]));
    act(() => { vi.advanceTimersByTime(12_010); });
    expect(result.current).toBeGreaterThanOrEqual(kickoff);
    act(() => { vi.setSystemTime(kickoff + 600_000); window.dispatchEvent(new Event("focus")); });
    expect(result.current).toBe(kickoff + 600_000);
  });

  it("aligns subsequent live minutes to a kickoff with seconds", () => {
    const kickoff = Date.now() + 12_000;
    const matches = [{ date: kickoff, duration: 60 }];
    const { result } = renderHook(() => useMatchClock(matches));
    act(() => { vi.advanceTimersByTime(72_010); });
    expect(result.current).toBeGreaterThanOrEqual(kickoff + 60_000);
  });

  it("a match days away joins the boundaries once it is within a day, and its kickoff still ticks on time", () => {
    const kickoff = Date.now() + 2 * 86_400_000 + 12_000;
    const matches = [{ date: kickoff, duration: 60 }];
    const { result } = renderHook(() => useMatchClock(matches));
    act(() => { vi.setSystemTime(kickoff - 20_000); window.dispatchEvent(new Event("focus")); });
    expect(result.current).toBe(kickoff - 20_000);
    act(() => { vi.advanceTimersByTime(20_010); });
    expect(result.current).toBeGreaterThanOrEqual(kickoff);
    expect(result.current).toBeLessThan(kickoff + 1_000);
  });
});
