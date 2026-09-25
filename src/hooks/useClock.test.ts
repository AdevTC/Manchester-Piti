import { act, renderHook } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { useClock } from "./useClock";

describe("useClock", () => {
  beforeEach(() => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-09-25T10:00:30Z"));
  });
  afterEach(() => vi.useRealTimers());

  it("ticks on the minute boundary, not every second, with a 60 s step", () => {
    const { result } = renderHook(() => useClock(60_000));
    const start = result.current;
    act(() => vi.advanceTimersByTime(20_000));
    expect(result.current).toBe(start);
    act(() => vi.advanceTimersByTime(11_000));
    expect(new Date(result.current).getUTCSeconds()).toBe(0);
    expect(result.current).toBeGreaterThan(start);
  });

  it("keeps a one-second clock by default", () => {
    const { result } = renderHook(() => useClock());
    const start = result.current;
    act(() => vi.advanceTimersByTime(1_010));
    expect(result.current).toBeGreaterThan(start);
  });
});
