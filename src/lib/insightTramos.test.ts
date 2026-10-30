import { describe, expect, it } from "vitest";
import { DEFAULT_ANALYSIS_PROFILE, type NarratedMatch, type Observation } from "../../functions/src/narrated/types";
import { buildInsightTimeline } from "./analysisInsights";
import { goalMarks, layoutTramos, type TramoCol } from "./insightTramos";

const goal = (id: string, from: number, to = from, extra: Partial<Observation> = {}): Observation => ({
  id, kind: "goal", team: "us", actorId: "a", order: from, period: 1,
  time: { from, to, precision: from === to ? "exact" : "interval" }, facts: {}, ...extra,
});
function game(id: string, observations: Observation[], first = 320, duration = 600): NarratedMatch {
  return { id, status: "finished", durationSeconds: duration, starters: ["a"], analysis: {
    version: 2, revision: 0, profile: structuredClone(DEFAULT_ANALYSIS_PROFILE), observations: [
      { id: "half1", kind: "context", team: "us", order: -2, period: 1, facts: { intervalStart: 0, intervalEnd: first } },
      { id: "half2", kind: "context", team: "us", order: -1, period: 2, facts: { intervalStart: first, intervalEnd: duration } },
      ...observations,
    ], coverage: [{ family: "*", team: "us", state: "complete" }, { family: "*", team: "opponent", state: "complete" }],
  } };
}
const columns = (matches: NarratedMatch[]) => layoutTramos(buildInsightTimeline(matches).segments, []).cols;
const marks = (matches: NarratedMatch[], cols = columns(matches)) => goalMarks(matches, {}, cols, () => "Álex", id => `Rival ${id}`);
const isInside = (x: number, col: TramoCol) => x >= col.x && x < col.x + col.w;

describe("goals on the tramo timeline", () => {
  it("omits a bounded interval that straddles a tramo, even when it is shorter than five minutes", () => {
    const match = game("m", [goal("crosses", 299, 301), goal("touches-boundary", 299, 300)]);
    expect(marks([match])).toEqual([]);
  });

  it("keeps a wholly contained interval and labels its range instead of inventing an exact second", () => {
    const match = game("m", [goal("range", 200, 250)]);
    const cols = columns([match]);
    const result = marks([match], cols);
    expect(result).toHaveLength(1);
    expect(result[0].label).toBe("Gol del Piti, de Álex · 1.ª parte, entre 3′ 20″ y 4′ 10″");
    expect(isInside(result[0].x, cols[0])).toBe(true);
  });

  it("rejects goals outside the recorded period even if the shared nominal column extends farther", () => {
    const match = game("m", [goal("past-first", 321), goal("crosses-whistle", 319, 321), goal("past-match", 601, 601, { period: 2 })]);
    expect(marks([match])).toEqual([]);
  });

  it("does not place a goal in the previous column when its own tramo is absent", () => {
    const match = game("m", [goal("gap", 310)]);
    const cols = columns([match]).filter(c => c.key !== "1:1");
    expect(marks([match], cols)).toEqual([]);
  });

  it("keeps exact internal boundaries in the next tramo and the period end in the last real tramo", () => {
    const match = game("m", [goal("boundary", 300), goal("whistle", 320)]);
    const cols = columns([match]);
    const result = marks([match], cols);
    const col = cols.find(c => c.key === "1:1")!;
    expect(result.map(g => g.key)).toEqual(["m:boundary", "m:whistle"]);
    expect(result.every(g => isInside(g.x, col))).toBe(true);
  });

  it("uses each match's final boundary when a shared column starts exactly at another match's whistle", () => {
    const shorter = game("short", [goal("same-id", 300)], 300);
    const longer = game("long", [goal("same-id", 300)]);
    const cols = columns([shorter, longer]);
    const result = marks([shorter, longer], cols);
    expect(isInside(result.find(g => g.key === "short:same-id")!.x, cols.find(c => c.key === "1:0")!)).toBe(true);
    expect(isInside(result.find(g => g.key === "long:same-id")!.x, cols.find(c => c.key === "1:1")!)).toBe(true);
  });

  it("keeps intervals ending at the real whistle and uses the second half's recorded start", () => {
    const match = game("m", [goal("before-half", 290, 300), goal("second", 320, 320, { period: 2 }), goal("final", 600, 600, { period: 2 })], 300);
    const result = marks([match]);
    expect(result.map(g => g.label)).toEqual([
      "Gol del Piti, de Álex · 1.ª parte, entre 4′ 50″ y 5′",
      "Gol del Piti, de Álex · 2.ª parte, 0′ 20″",
      "Gol del Piti, de Álex · 2.ª parte, 5′",
    ]);
  });

  it("keeps a separate whole-match clock for a match without period limits in a mixed selection", () => {
    const unknown = game("unknown", [goal("whole-clock", 350, 350, { period: 2 })]);
    unknown.analysis!.observations = unknown.analysis!.observations.filter(e => e.kind !== "context");
    const known = game("known", [goal("second", 350, 350, { period: 2 })]);
    const cols = columns([unknown, known]);
    const result = marks([unknown, known], cols);
    const whole = result.find(g => g.key === "unknown:whole-clock");
    expect(whole?.label).toBe("Gol del Piti, de Álex · 5′ 50″");
    expect(isInside(whole!.x, cols.find(c => c.key === "0:1")!)).toBe(true);
    expect(result.find(g => g.key === "known:second")?.label).toBe("Gol del Piti, de Álex · 2.ª parte, 0′ 30″");
  });

  it("keeps approximate or untimed goals out and does not move stacked markers across a tramo boundary", () => {
    const match = game("m", [
      goal("approximate", 20, 20, { time: { from: 20, to: 20, precision: "approximate" } }),
      goal("untimed", 20, 20, { time: undefined }),
      ...Array.from({ length: 4 }, (_, i) => goal(`late-${i}`, 299)),
    ]);
    const cols = columns([match]);
    const result = marks([match], cols);
    expect(result).toHaveLength(4);
    expect(result.every(g => isInside(g.x, cols[0]))).toBe(true);
  });

  it("preserves scorer, opponent and own-goal labels while filtering the selected period", () => {
    const match = game("m", [goal("first", 100), goal("opponent", 350, 350, { period: 2, team: "opponent" }), goal("own", 360, 360, { period: 2, facts: { ownGoal: true } })]);
    const result = goalMarks([match], { period: 2 }, columns([match]), () => "Álex", () => "Pitutis");
    expect(result.map(g => [g.side, g.label])).toEqual([
      ["them", "Gol de Pitutis · 2.ª parte, 0′ 30″"],
      ["them", "Gol de Pitutis · 2.ª parte, 0′ 40″"],
    ]);
  });
});
