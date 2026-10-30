import { describe, expect, it } from "vitest";
import { DEFAULT_ANALYSIS_PROFILE, type NarratedMatch, type Observation } from "../../functions/src/narrated/types";
import { buildInsightTimeline, buildPassMatrix, insightEvidence } from "./analysisInsights";

const people = [{ id: "a", name: "Álex", number: 1 }, { id: "b", name: "Bruno", number: 8 }, { id: "unused", name: "No jugó" }];
const pass = (id: string, second: number, extra: Partial<Observation> = {}): Observation => ({ id, kind: "pass", team: "us", actorId: "a", receiverId: "b", order: second, period: second < 320 ? 1 : 2, time: { from: second, to: second, precision: "exact" }, facts: { outcome: "complete" }, ...extra });
function game(id = "m", observations: Observation[] = [pass("p", 10)]): NarratedMatch {
  return { id, seasonId: "s", status: "finished", durationSeconds: 600, starters: ["a", "b"], bench: ["unused"], analysis: { version: 2, revision: 0, profile: structuredClone(DEFAULT_ANALYSIS_PROFILE), observations: [
    { id: "half1", kind: "context", team: "us", order: -2, period: 1, facts: { intervalStart: 0, intervalEnd: 320 } },
    { id: "half2", kind: "context", team: "us", order: -1, period: 2, facts: { intervalStart: 320, intervalEnd: 600 } }, ...observations,
  ], coverage: [{ family: "*", team: "us", state: "complete" }, { family: "*", team: "opponent", state: "complete" }] } };
}
const pair = (m: ReturnType<typeof buildPassMatrix>) => m.cells.find(cell => cell.from === "a" && cell.to === "b")!;

describe("interactive game insights", () => {
  it("aligns halves to their actual start and includes final whistle without doubling window boundaries", () => {
    const m = game("m", [pass("before", 299), pass("border", 300), pass("first-whistle", 320, { period: 1 }), pass("second-start", 320), pass("final", 600)]);
    const result = buildInsightTimeline([m]);
    expect(result.segments.map(s => [s.key, s.result.value, s.playedSeconds])).toEqual([["1:0", 1, 300], ["1:1", 2, 20], ["2:0", 2, 280]]);
    expect(result.segments.every(s => s.result.status === "complete")).toBe(true);
    expect(new Set(result.segments.flatMap(s => s.result.evidenceEventIds)).size).toBe(5);
    expect(result.uncertainActions).toBe(0);
  });
  it("pools precision by attempts and discloses the number of contributing matches", () => {
    const a = game("a", [pass("one", 20)]);
    const b = game("b", [pass("one", 20), pass("two", 21, { facts: { outcome: "failed" }, intendedReceiverId: "b" }), pass("three", 22, { facts: { outcome: "failed" }, intendedReceiverId: "b" })]);
    const row = buildInsightTimeline([a, b], {}, "070").segments[0];
    expect(row.result).toMatchObject({ value: 50, numerator: 2, denominator: 4, status: "complete" });
    expect(row.matches).toBe(2); expect(row.completeMatches).toBe(2);
  });
  it("uses match/season/period/player filters and excludes unused substitutes", () => {
    const a = game("a", [pass("first", 20), pass("second", 350)]);
    const b = { ...game("b"), seasonId: "other" };
    const result = buildInsightTimeline([a, b], { seasonIds: ["s"], matchIds: ["a"], period: 2, playerIds: ["a"] });
    expect(result.matchCount).toBe(1); expect(result.segments).toHaveLength(1);
    expect(result.segments[0].result.evidenceEventIds).toEqual(["a:second"]);
    expect(buildInsightTimeline([a], { playerIds: ["unused"] }).segments).toEqual([]);
    expect(buildPassMatrix([a], people).senders.map(p => p.id)).not.toContain("unused");
  });
  it("never assumes 25-minute halves when their actual limits are missing", () => {
    const m = game(); m.analysis!.observations = [pass("p", 350)];
    expect(buildInsightTimeline([m]).segments.every(s => s.period === 0)).toBe(true);
    expect(buildInsightTimeline([m], { period: 2 })).toMatchObject({ segments: [], omittedMatches: 1 });
  });
  it("keeps positive partial observations, but never invents zeros from an uncovered match", () => {
    const m = game(); m.analysis!.coverage = [];
    const rows = buildInsightTimeline([m]).segments;
    expect(rows[0].result).toMatchObject({ value: 1, status: "partial" });
    expect(rows[1].result).toMatchObject({ value: null, status: "unknown" });
    expect(pair(buildPassMatrix([m], people)).volume).toMatchObject({ value: 1, status: "partial" });
  });
  it("excludes imprecise active-metric actions instead of counting context records as uncertainty", () => {
    const m = game("m", [pass("uncertain", 10, { time: undefined }), pass("shot", 10, { kind: "shot", time: undefined })]);
    const data = buildInsightTimeline([m]);
    expect(data.uncertainActions).toBe(1);
    expect(data.segments[0].result).toMatchObject({ value: null, status: "unknown", pending: 1 });
  });
  it("pools each match's pass inclusion rules without suppressing the timeline or matrix", () => {
    const a = game("a", [pass("plain", 20), pass("cross", 21, { facts: { outcome: "complete", subtype: "cross" } })]);
    const b = structuredClone(a); b.id = "b"; b.analysis!.profile.passes.crosses = false;
    const row = buildInsightTimeline([a, b], {}, "070").segments[0];
    expect(row.result).toMatchObject({ value: 100, numerator: 3, denominator: 3, status: "complete" });
    const cell = pair(buildPassMatrix([a, b], people));
    expect(cell).toMatchObject({ attempts: 3, completed: 3, failed: 0, accuracy: { value: 100 }, volume: { value: 3 } });
    expect(cell.volume.evidenceEventIds).toEqual(["a:plain", "a:cross", "b:plain"]);
  });
  it("weights deflected passes with their own acta's rule, regardless of match order", () => {
    const a = game("a", [pass("deflected", 20, { facts: { outcome: "complete", deflected: true } })]);
    const b = game("b", [pass("deflected", 20, { facts: { outcome: "complete", deflected: true } }), pass("failed", 21, { facts: { outcome: "failed" } })]);
    b.analysis!.profile.passes.deflection = "retain";
    for (const matches of [[a, b], [b, a]]) {
      const row = buildInsightTimeline(matches, { period: 1, playerIds: ["a"] }, "070").segments[0];
      expect(row.result).toMatchObject({ numerator: 1, denominator: 3, status: "complete" });
      expect(row.result.value).toBeCloseTo(100 / 3);
      const cell = pair(buildPassMatrix(matches, people, { period: 1, playerIds: ["a"] }));
      expect(cell).toMatchObject({ attempts: 3, completed: 1, failed: 2, accuracy: { numerator: 1, denominator: 3 }, volume: { value: 1 } });
      expect(cell.accuracy.value).toBeCloseTo(100 / 3);
      expect(new Set(cell.volume.evidenceEventIds)).toEqual(new Set(["a:deflected", "b:deflected", "b:failed"]));
    }
  });
  it("keeps directed receivers outside the selected sender and never guesses failed destinations", () => {
    const m = game("m", [pass("out", 10), pass("back", 11, { actorId: "b", receiverId: "a" }), pass("fail", 12, { receiverId: undefined, intendedReceiverId: "b", facts: { outcome: "failed" } }), pass("unassigned", 13, { receiverId: undefined, facts: { outcome: "failed" } })]);
    const matrix = buildPassMatrix([m], people, { playerIds: ["a"] });
    expect(matrix.senders.map(p => p.id)).toEqual(["a"]);
    expect(matrix.receivers.map(p => p.id)).toContain("b");
    expect(pair(matrix)).toMatchObject({ attempts: 2, completed: 1, failed: 1, accuracy: { value: 50, status: "partial" } });
    expect(matrix.unattributed).toBe(1);
    expect(insightEvidence([m], pair(matrix).volume.evidenceEventIds).map(e => e.id)).toEqual(["out", "fail"]);
  });
  it("shows unknown completion instead of zero when all outcomes are unknown", () => {
    const m = game("m", [pass("unknown", 10, { facts: {} })]);
    expect(pair(buildPassMatrix([m], people))).toMatchObject({ attempts: 1, unknown: 1, volume: { value: null, status: "unknown" }, accuracy: { value: null, status: "unknown" } });
  });
  it("permits a known zero when failure is explicit and distinguishes no-opportunity accuracy", () => {
    const m = game("m", [pass("fail", 10, { receiverId: undefined, intendedReceiverId: "b", facts: { outcome: "failed" } })]);
    const matrix = buildPassMatrix([m], people);
    expect(pair(matrix).volume).toMatchObject({ value: 0, status: "complete" });
    expect(matrix.cells.find(c => c.from === "b" && c.to === "a")?.accuracy).toMatchObject({ value: null, status: "no_sample" });
  });
  it("uses opponent identities without resolving them to our roster", () => {
    const m = game("m", [pass("rival", 10, { team: "opponent", actorId: undefined, receiverId: undefined, opponentId: "a", facts: { outcome: "complete", opponentReceiverId: "b" } })]);
    const matrix = buildPassMatrix([m], people, { team: "opponent" });
    expect(matrix.senders).toEqual([{ id: "a", name: "Rival 1" }]);
    expect(matrix.receivers).toEqual([{ id: "b", name: "Rival 2" }]);
    expect(pair(matrix).accuracy.value).toBe(100);
  });
});
