import { describe, expect, it } from "vitest";
import type { ClubMatch } from "../clubData";
import type { MvpResult } from "../vestuario";
import { mvpOfFrom } from "./mvpOf";

const NOW = 1_000_000;
const m = (id: string, voteClosesAt?: number): ClubMatch => ({ id, status: "finished", ...(voteClosesAt ? { voteClosesAt } : {}) });
const res = (id: string, counts: Record<string, number>): MvpResult => ({ id, counts, total: Object.values(counts).reduce((s, n) => s + n, 0) });

describe("mvpOfFrom: the one MVP reader for the ratings by position", () => {
  const games = [m("a", NOW - 1), m("b", NOW - 1), m("c", NOW + 1), m("d")];
  const results = new Map([
    ["a", res("a", { ana: 3, bea: 1 })],
    ["b", res("b", { ana: 2, bea: 2 })],
    ["c", res("c", { ana: 5 })],
    ["d", res("d", { ana: 5 })],
  ]);
  const mvpOf = mvpOfFrom(results, games, NOW);

  it("the winner once the vote has closed", () => {
    expect(mvpOf("a")).toBe("ana");
    expect(mvpOf("a", "bea")).toBe("ana");
  });
  it("a shared vote counts for each winner asked about", () => {
    expect(mvpOf("b", "ana")).toBe("ana");
    expect(mvpOf("b", "bea")).toBe("bea");
    expect(mvpOf("b", "cris")).toBe("ana");
  });
  it("no MVP while the vote is open, without a closing time, or for a match it was not given", () => {
    expect(mvpOf("c", "ana")).toBeNull();
    expect(mvpOf("d", "ana")).toBeNull();
    expect(mvpOf("x", "ana")).toBeNull();
  });
});
