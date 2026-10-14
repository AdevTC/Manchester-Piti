// Every phone reads the same live minute: the clocks on screen (useClock, the pizarra's match clock) and
// the minute they show run on the server's clock (lib/serverTime), and the live callables feed it.
import { act, render, renderHook, screen } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { recordServerTime, resetServerTime, serverOffset } from "../lib/serverTime";
import { useClock } from "./useClock";
import { useMatchClock } from "../pages/pizarra/v2/useMatchDay";
import { MatchClockDisplay } from "../components/celeste/MatchClockControl";
import { liveMinute } from "../lib/partidos";
import type { CalMatch } from "../pages/pizarra/v2/boards";

const fx = vi.hoisted(() => ({ answers: {} as Record<string, unknown> }));
vi.mock("../firebase", () => ({ db: {}, functions: {} }));
vi.mock("firebase/functions", () => ({
  httpsCallable: (_f: unknown, name: string) => async () => {
    vi.setSystemTime(Date.now() + 200);
    return { data: fx.answers[name] };
  },
}));

const T0 = Date.UTC(2026, 9, 14, 18, 0, 0);
/** A clock started 17 min 30 s ago on the server's clock (the server stamped firstStartedAt). */
const clock = { phase: "first" as const, revision: 1, firstStartedAt: T0 - 17 * 60_000 - 30_000 };

beforeEach(() => {
  resetServerTime();
  vi.useFakeTimers();
  vi.setSystemTime(T0);
});
afterEach(() => vi.useRealTimers());

describe("the shared clock", () => {
  it("useClock reads the phone's time plus the offset, and a new estimate shows at once", () => {
    const { result } = renderHook(() => useClock(60_000));
    expect(result.current).toBe(T0);
    // this phone is 90 s behind the server
    act(() => recordServerTime(T0 + 90_000, T0, T0));
    expect(result.current).toBe(T0 + 90_000);
    expect(liveMinute({ date: T0, clock }, result.current)).toBe(19);
    expect(liveMinute({ date: T0, clock }, Date.now())).toBe(17);
  });

  it("the minute on screen follows the server's clock, not the phone's", () => {
    render(<MatchClockDisplay match={{ clock }} />);
    expect(screen.getByText(/17:30/)).toBeInTheDocument();
    act(() => recordServerTime(T0 + 90_000, T0, T0));
    expect(screen.getByText(/19:00/)).toBeInTheDocument();
  });

  it("a phone whose clock runs ahead is pulled back too", () => {
    recordServerTime(T0 - 120_000, T0, T0);
    const { result } = renderHook(() => useClock(1000));
    expect(liveMinute({ date: T0, clock }, result.current)).toBe(15);
  });

  it("the pizarra's match clock reads the same server time", () => {
    recordServerTime(T0 + 90_000, T0, T0);
    const m = { id: "m", dateMs: T0 - 10 * 60_000, rival: "R", duration: 50, played: false, status: "scheduled", clock } as unknown as CalMatch;
    const { result } = renderHook(() => useMatchClock(m, 0));
    expect(result.current).toBe(T0 + 90_000);
    act(() => recordServerTime(T0 + 30_000, T0, T0));
    expect(result.current).toBe(T0 + 30_000);
  });
});

describe("the live callables feed it", () => {
  it("liveEvent and controlMatchClock answers carry serverNow: each one is a sample", async () => {
    const api = await import("../lib/clubApi");
    fx.answers.liveEvent = { events: 2, serverNow: T0 + 100 + 60_000 };
    await api.liveEvent({ action: "undo", matchId: "m" });
    expect(serverOffset()).toBe(60_000);
    fx.answers.controlMatchClock = { clock, serverNow: Date.now() + 100 - 5_000 };
    const r = await api.controlMatchClock({ matchId: "m", action: "halftime", revision: 1 });
    expect(r.data.clock).toEqual(clock);
    // same round trip: the newer sample wins
    expect(serverOffset()).toBe(-5_000);
  });

  it("an older server without serverNow leaves the clock alone", async () => {
    const api = await import("../lib/clubApi");
    fx.answers.liveEvent = { events: 2 };
    await api.liveEvent({ action: "undo", matchId: "m" });
    expect(serverOffset()).toBe(0);
  });
});
