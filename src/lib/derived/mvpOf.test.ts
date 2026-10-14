import { describe, expect, it } from "vitest";
import type { ClubMatch } from "../clubData";
import type { MvpResult } from "../vestuario";
import { mvpOfFrom, votesClosedAt } from "./mvpOf";

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
  it("votesClosedAt only moves when a vote closes, and reads the same MVPs as the clock", () => {
    expect(votesClosedAt(games, NOW)).toBe(NOW - 1);
    // a minute later, nothing closed in between: the same value (the memo keeps its mvpOf)
    expect(votesClosedAt(games, NOW + 60_000 - 2)).toBe(NOW + 1);
    expect(votesClosedAt(games, NOW + 1 + 60_000)).toBe(votesClosedAt(games, NOW + 1));
    expect(votesClosedAt(games, NOW - 2)).toBe(-Infinity);
    expect(votesClosedAt(games, NOW + 1)).toBe(NOW + 1);
    for (const t of [NOW - 2, NOW, NOW + 1, NOW + 60_000]) {
      const a = mvpOfFrom(results, games, t);
      const b = mvpOfFrom(results, games, votesClosedAt(games, t));
      for (const id of ["a", "b", "c", "d"]) for (const pid of ["ana", "bea", undefined]) expect(b(id, pid)).toBe(a(id, pid));
    }
  });
});
