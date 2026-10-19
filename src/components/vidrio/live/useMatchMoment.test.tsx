import { act, renderHook } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { readyClock, transitionClock } from "../../../../functions/src/matchClock";
import type { MatchEvent } from "../../../../functions/src/matchEngine";
import type { ClubMatch } from "../../../lib/clubData";
import type { PlayerDoc } from "../../../lib/schemas";

const PLAYERS = [{ id: "adri", shirtName: "ADRIÁN T.C.", firstName: "Adrián", seasons: ["t1"] }] as unknown as PlayerDoc[];
vi.mock("../../../lib/clubData", async (orig) => ({ ...(await orig<typeof import("../../../lib/clubData")>()), useClubData: () => ({ matches: [], players: PLAYERS, loading: false }) }));
const { useMatchMoment, MOMENT_HOLD_MS } = await import("./useMatchMoment");

const MIN = 60_000;
const KICK = Date.UTC(2026, 9, 18, 17);
const started = transitionClock(readyClock(), "start", KICK);
const ev = (id: string, type: MatchEvent["type"], minute: number, playerId?: string): MatchEvent => ({ id, type, minute: minute - 1, elapsedSeconds: (minute - 1) * 60 + 30, ...(playerId ? { playerId } : {}) }) as MatchEvent;
const match = (events: MatchEvent[], clock = started): ClubMatch => ({ id: "j1", seasonId: "t1", rival: "Orduña FC", date: KICK, duration: 50, status: "scheduled", clock, events });

beforeEach(() => vi.useFakeTimers());
afterEach(() => vi.useRealTimers());

describe("useMatchMoment", () => {
  it("what was there when the match was first shown is just data; a new play that happened now unfolds for the hold, then goes", () => {
    const now = KICK + 21 * MIN;
    const { result, rerender } = renderHook(({ m, t }) => useMatchMoment(m, t), { initialProps: { m: match([ev("g1", "goal", 6, "adri")]), t: now } });
    expect(result.current).toBeNull();
    rerender({ m: match([ev("g1", "goal", 6, "adri"), ev("y1", "yellow_card", 21, "adri")]), t: now });
    expect(result.current).toMatchObject({ id: "y1", kind: "amarilla", title: "AMARILLA · ADRIÁN T.C." });
    act(() => {
      vi.advanceTimersByTime(MOMENT_HOLD_MS - 1);
    });
    expect(result.current?.id).toBe("y1");
    act(() => {
      vi.advanceTimersByTime(1);
    });
    expect(result.current).toBeNull();
  });

  it("a newer play takes the place of the one unfolded and starts the hold again", () => {
    const now = KICK + 22 * MIN;
    const { result, rerender } = renderHook(({ m }) => useMatchMoment(m, now), { initialProps: { m: match([]) } });
    rerender({ m: match([ev("w", "woodwork", 21, "adri")]) });
    expect(result.current?.kind).toBe("palo");
    act(() => {
      vi.advanceTimersByTime(5000);
    });
    rerender({ m: match([ev("w", "woodwork", 21, "adri"), ev("g", "goal", 22, "adri")]) });
    expect(result.current?.kind).toBe("gol");
    act(() => {
      vi.advanceTimersByTime(5000);
    });
    expect(result.current?.kind).toBe("gol");
  });

  it("a play arriving late (an old minute), a play undone, a corner: nothing; not celebrating takes them as seen", () => {
    const now = KICK + 30 * MIN;
    const { result, rerender } = renderHook(({ m, c }) => useMatchMoment(m, now, { celebrate: c }), { initialProps: { m: match([]), c: true } });
    rerender({ m: match([ev("old", "goal", 12, "adri"), ev("c", "corner", 30)]), c: true });
    expect(result.current).toBeNull();
    rerender({ m: match([ev("old", "goal", 12, "adri"), ev("c", "corner", 30), ev("n", "goal", 30, "adri")]), c: false });
    expect(result.current).toBeNull();
    // seen while not celebrating: it doesn't unfold later either
    rerender({ m: match([ev("old", "goal", 12, "adri"), ev("c", "corner", 30), ev("n", "goal", 30, "adri")]), c: true });
    expect(result.current).toBeNull();
    rerender({ m: match([ev("old", "goal", 12, "adri"), ev("n", "goal", 30, "adri"), ev("x", "save", 30, "adri")]), c: true });
    expect(result.current?.id).toBe("x");
    rerender({ m: match([ev("old", "goal", 12, "adri"), ev("n", "goal", 30, "adri")]), c: true });
    expect(result.current).toBeNull();
  });

  it("the clock's turns: half-time as it happens; another match starts clean", () => {
    const half = transitionClock(started, "halftime", KICK + 25 * MIN);
    const { result, rerender } = renderHook(({ m, t }) => useMatchMoment(m, t), { initialProps: { m: match([]) as ClubMatch | undefined, t: KICK + 25 * MIN } });
    rerender({ m: match([], half), t: KICK + 25 * MIN + 10_000 });
    expect(result.current).toMatchObject({ kind: "descanso", said: "Descanso. Piti 0, Orduña FC 0" });
    rerender({ m: { ...match([ev("g", "goal", 3, "adri")]), id: "j2" }, t: KICK + 25 * MIN + 10_000 });
    expect(result.current).toBeNull();
    rerender({ m: undefined, t: KICK + 26 * MIN });
    expect(result.current).toBeNull();
  });
});
