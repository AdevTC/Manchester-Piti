import { renderHook } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import type { ClubMatch } from "../../../lib/clubData";
import type { MvpResult } from "../../../lib/vestuario";
import { useMvpWinners } from "./useBoardData";

// The clock ticks every minute only to close the MVP votes' windows: the winners map (and so the squad
// built from it) keeps its identity until a winner is decided.

const games = [
  { id: "a", voteClosesAt: 1_000 },
  { id: "b", voteClosesAt: 5_000 },
] as unknown as ClubMatch[];
const results = new Map<string, MvpResult>([
  ["a", { id: "a", counts: { tello: 3, evans: 1 }, total: 4 }],
  ["b", { id: "b", counts: { adrian: 2 }, total: 2 }],
]);

describe("useMvpWinners", () => {
  it("the same map while the clock ticks with the same winners, a new one when a vote closes", () => {
    const { result, rerender } = renderHook(({ now }) => useMvpWinners(games, results, now), { initialProps: { now: 2_000 } });
    const first = result.current;
    expect([...first]).toEqual([
      ["a", ["tello"]],
      ["b", []],
    ]);
    rerender({ now: 3_000 });
    rerender({ now: 4_000 });
    expect(result.current).toBe(first);
    // b's vote closes: adrian is its MVP, and the squad has to know
    rerender({ now: 6_000 });
    expect(result.current).not.toBe(first);
    expect(result.current.get("b")).toEqual(["adrian"]);
    const second = result.current;
    rerender({ now: 7_000 });
    expect(result.current).toBe(second);
  });
});
