import { describe, it, expect } from "vitest";
import { squadNorms, teamRating, lineStats, recentForm, suspendedSet } from "./chemistry";
import { EMPTY_STATS, type PlayerStats } from "../../lib/playerStats";

const mk = (o: Partial<PlayerStats>): PlayerStats => ({ ...EMPTY_STATS, ...o });

describe("teamRating", () => {
  it("is 0 for an empty XI", () => {
    const r = teamRating([], 7, { maxGA: 0, maxPJ: 0, maxSeasons: 0, maxCards: 0 });
    expect(r.score).toBe(0);
    expect(r.tier).toBe("Sin once");
  });
  it("flags out-of-position and missing history", () => {
    const norms = { maxGA: 10, maxPJ: 10, maxSeasons: 4, maxCards: 4 };
    const r = teamRating(
      [
        { id: "a", s: mk({ goals: 5, assists: 5, matchesPlayed: 10 }), seasons: 4, zone: "DEL", outOfPosition: true },
        { id: "b", s: EMPTY_STATS, seasons: 0, zone: "DEF", outOfPosition: false },
      ],
      5,
      norms,
    );
    expect(r.oop).toBe(1);
    expect(r.missing).toBe(1);
    expect(r.score).toBeGreaterThan(0);
    expect(r.score).toBeLessThanOrEqual(100);
  });
});

describe("squadNorms", () => {
  it("takes the maxima across the squad", () => {
    const n = squadNorms([
      { s: mk({ goals: 3, assists: 1, matchesPlayed: 8, yellowCards: 2 }), seasons: 2 },
      { s: mk({ goals: 0, matchesPlayed: 2 }), seasons: 5 },
    ]);
    expect(n.maxGA).toBe(4);
    expect(n.maxPJ).toBe(8);
    expect(n.maxSeasons).toBe(5);
    expect(n.maxCards).toBe(2);
  });
});

describe("lineStats", () => {
  it("aggregates G+A per zone", () => {
    const lines = lineStats([
      { id: "a", s: mk({ goals: 2, assists: 1 }), seasons: 0, zone: "DEL", outOfPosition: false },
      { id: "b", s: mk({ goals: 1 }), seasons: 0, zone: "DEF", outOfPosition: false },
    ]);
    expect(lines.find((l) => l.zone === "DEL")?.goals).toBe(2);
    expect(lines.find((l) => l.zone === "DEF")?.goals).toBe(1);
  });
});

describe("recentForm + suspendedSet", () => {
  it("scores recent goals and detects a suspension", () => {
    const matches = [
      { events: [{ type: "goal", playerId: "a" }, { type: "red_card", playerId: "b" }] },
      { events: [{ type: "assist", playerId: "a" }] },
    ];
    const form = recentForm(matches);
    expect(form.get("a")).toBe(3); // 2 (goal) + 1 (assist)
    const susp = suspendedSet(matches);
    expect(susp.has("b")).toBe(true);
    expect(susp.has("a")).toBe(false);
  });
});
