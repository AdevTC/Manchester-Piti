// @vitest-environment jsdom
// «Números» works out the match's figures once per match, people, scope and score: a re-render that hands a new
// score object with the same numbers (the clock, the header) no longer re-runs the whole catalogue.
import { describe, expect, it, vi } from "vitest";
import { renderHook } from "@testing-library/react";
import type { ClubMatch } from "../../../lib/clubData";

const { matchNumbers } = vi.hoisted(() => ({ matchNumbers: vi.fn((..._args: unknown[]) => ({ rows: [] })) }));
vi.mock("./matchNumbers", () => ({ matchNumbers }));
const { useMatchNumbers } = await import("./useMatchNumbers");

const match = { id: "m1" } as unknown as ClubMatch;
const people = [{ id: "p1", name: "Jordi" }];
const filters = { matchIds: ["m1"] };

describe("useMatchNumbers", () => {
  it("runs the catalogue again only when the score's numbers change", () => {
    const { result, rerender } = renderHook(({ us, them }) => useMatchNumbers(true, match, people, filters, { us, them }), { initialProps: { us: 2, them: 1 } });
    const first = result.current;
    rerender({ us: 2, them: 1 });
    rerender({ us: 2, them: 1 });
    expect(matchNumbers).toHaveBeenCalledTimes(1);
    expect(result.current).toBe(first);
    rerender({ us: 3, them: 1 });
    expect(matchNumbers).toHaveBeenCalledTimes(2);
    expect(matchNumbers).toHaveBeenLastCalledWith(match, people, filters, { us: 3, them: 1 });
  });

  it("has nothing to work out before the match is played", () => {
    matchNumbers.mockClear();
    const { result } = renderHook(() => useMatchNumbers(false, match, people, filters, { us: 0, them: 0 }));
    expect(result.current).toBeNull();
    expect(matchNumbers).not.toHaveBeenCalled();
  });
});
