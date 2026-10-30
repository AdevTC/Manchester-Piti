import { describe, expect, it } from "vitest";
import { evaluateNarrated } from "../../functions/src/narrated/engine";
import { DEFAULT_ANALYSIS_PROFILE, type MetricResult, type NarratedMatch, type Observation } from "../../functions/src/narrated/types";
import { emptyParticipation } from "../../functions/src/matchEngine";
import { ANALYSIS_WORKSPACE_METRICS, ANALYSIS_WORKSPACE_PRESETS, analysisMetricSupportsPlayer, buildAnalysisWorkspace, formatWorkspaceMetric, rankAnalysisRows, selectAnalysisMatches, sortAnalysisRows, workspaceMetricIds, type AnalysisWorkspaceRow } from "./analysisWorkspace";

const people = ["p1", "p2", "p3", "unrelated"].map((id, i) => ({ id, name: `Jugador ${i + 1}` }));
const observation = (id: string, actorId: string, outcome = "complete", second = 10, extra: Partial<Observation> = {}): Observation => ({ id, kind: "pass", actorId, team: "us", order: second, period: second < 50 ? 1 : 2, time: { from: second, to: second, precision: "exact" }, facts: { outcome }, ...extra });
function match(id = "m1", observations: Observation[] = [], extra: Partial<NarratedMatch> = {}): NarratedMatch {
  return { id, seasonId: "s1", status: "finished", durationSeconds: 100, starters: ["p1", "p2"], bench: ["p3"], notCalled: ["unrelated"], analysis: { version: 2, revision: 0, profile: structuredClone(DEFAULT_ANALYSIS_PROFILE), observations, coverage: [{ family: "*", team: "us", state: "complete" }, { family: "*", team: "opponent", state: "complete" }] }, ...extra };
}
const result = (value: number | null, status: MetricResult["status"] = "complete"): MetricResult => ({ id: "067", value, status, unit: "acciones", observed: 1, pending: 0, evidenceEventIds: [], ruleId: "piti.067", ruleVersion: 1, parameters: {}, reason: "" });
const row = (id: string, value: number | null, status?: MetricResult["status"]): AnalysisWorkspaceRow => ({ person: { id, name: id }, results: new Map([["067", result(value, status)]]) });

describe("configurable analysis workspace", () => {
  it("offers every viable definition, including ones without observations", () => {
    expect(ANALYSIS_WORKSPACE_METRICS).toHaveLength(321);
    expect(workspaceMetricIds(["067", "051", "unknown", "067", "A12"])).toEqual(["067", "A12"]);
    expect(ANALYSIS_WORKSPACE_PRESETS.every(p => workspaceMetricIds(p.metricIds).length === p.metricIds.length)).toBe(true);
    const w = buildAnalysisWorkspace([match()], people, {}, ["067", "070", "378"]);
    expect(w.rows.map(r => r.person.id)).toEqual(["p1", "p2"]);
    expect(w.metrics.map(m => m.id)).toEqual(["067", "070", "378"]);
    expect(w.rows[0].results.get("067")).toMatchObject({ value: 0, status: "complete" });
    expect(formatWorkspaceMetric(w.rows[0].results.get("070"))).toBe("-");
    expect(formatWorkspaceMetric(w.rows[0].results.get("378"))).toBe("-");
  });
  it("recalculates a pooled percentage rather than averaging players or matches", () => {
    const a = match("m1", [observation("a", "p1")]);
    const b = match("m2", [observation("b", "p2"), observation("c", "p2", "failed"), observation("d", "p2", "failed")]);
    const w = buildAnalysisWorkspace([a, b], people, {}, ["067", "070"]);
    expect(w.total.get("070")).toMatchObject({ value: 50, numerator: 2, denominator: 4 });
    expect(w.rows[0].results.get("070")?.value).toBe(100);
    expect(w.rows[1].results.get("070")?.value).toBeCloseTo(100 / 3);
    expect(w.total.get("067")?.value).toBe(4);
    const selected = buildAnalysisWorkspace([a, b], people, { playerIds: ["p2"] }, ["070"]);
    expect(selected.rows.map(r => r.person.id)).toEqual(["p2"]);
    expect(selected.total.get("070")?.value).toBeCloseTo(100 / 3);
  });
  it("keeps players from one or both matches and pools each acta's pass policy", () => {
    const a = match("a", [observation("deflected", "p1", "complete", 10, { facts: { outcome: "complete", deflected: true } }), observation("only-first", "p2")], { starters: ["p1", "p2"], bench: [] });
    const b = match("b", [observation("deflected", "p1", "complete", 10, { facts: { outcome: "complete", deflected: true } }), observation("plain", "p1"), observation("only-second", "p3", "failed")], { starters: ["p1", "p3"], bench: [] });
    b.analysis!.profile.passes.deflection = "retain";
    for (const sample of [[a, b], [b, a]]) {
      const w = buildAnalysisWorkspace(sample, people, {}, ["067", "068", "069", "070"]);
      expect(w.rows.map(r => r.person.id)).toEqual(["p1", "p2", "p3"]);
      expect([...w.total.values()].map(r => r.value)).toEqual([5, 3, 2, 60]);
      expect(w.rows[0].results.get("070")).toMatchObject({ numerator: 2, denominator: 3, status: "complete" });
      expect(w.rows[0].results.get("067")?.value).toBe(3);
      expect(w.rows[1].results.get("070")?.value).toBe(100);
      expect(w.rows[2].results.get("070")?.value).toBe(0);
      expect(sortAnalysisRows(w.rows, "070").map(r => r.person.id)).toEqual(["p2", "p1", "p3"]);
      const selected = buildAnalysisWorkspace(sample, people, { playerIds: ["p1"], period: 1 }, ["070"]);
      expect(selected.total.get("070")).toMatchObject({ numerator: 2, denominator: 3 });
    }
  });
  it("keeps contextual metrics out of player cells and keeps opponent rows empty", () => {
    const m = match("m1", [observation("o", "", "complete", 10, { team: "opponent", actorId: undefined, opponentId: "rival" })]);
    const w = buildAnalysisWorkspace([m], people, {}, ["016", "384", "385", "388", "389", "386"]);
    for (const metric of w.metrics) {
      expect(analysisMetricSupportsPlayer(metric)).toBe(false);
      expect(w.rows.every(r => r.results.get(metric.id)?.status === "not_applicable")).toBe(true);
    }
    const opponent = buildAnalysisWorkspace([m], people, { team: "opponent" }, ["067"]);
    expect(opponent.rows).toEqual([]);
    expect(opponent.total.get("067")?.value).toBe(1);
    expect(buildAnalysisWorkspace([m], people, { team: "opponent", playerIds: ["p1"] }, ["067"]).total.get("067")).toMatchObject({ value: null, status: "not_applicable" });
  });
  it("combines season and match filters, excludes archives and deduplicates input matches", () => {
    const a = match("m1", [observation("a", "p1")]);
    const b = match("m2", [observation("b", "p2")], { seasonId: "s2", starters: ["p2"] });
    const archived = match("a", [observation("x", "p1")], { archived: true });
    const individual = Object.assign(match("i"), { individuallyArchived: true });
    const deleting = Object.assign(match("d"), { deleting: true });
    const cancelled = match("c", [], { status: "cancelled" });
    const w = buildAnalysisWorkspace([a, a, b, archived, individual, deleting, cancelled], people, { seasonIds: ["s1"], matchIds: ["m1", "m2", "a", "i", "d", "c"] }, ["067"]);
    expect(w.matchIds).toEqual(["m1"]); expect(w.total.get("067")?.value).toBe(1);
    expect(buildAnalysisWorkspace([a], people, { matchIds: ["missing"] }, ["067"]).rows).toEqual([]);
    const absent = buildAnalysisWorkspace([a], people, { playerIds: ["unrelated"] }, ["067"]);
    expect(absent.rows).toEqual([]);
    expect(formatWorkspaceMetric(absent.total.get("067"))).toBe("-");
  });
  it("finds participants within the actual half, including receivers but not unused substitutes", () => {
    const m = match("m1", [
      observation("first", "p1", "complete", 20), observation("second", "p3", "complete", 60),
      observation("first-period", "", "neutral", 0, { kind: "context", actorId: undefined, facts: { intervalStart: 0, intervalEnd: 50 } }),
      observation("second-period", "", "neutral", 50, { kind: "context", actorId: undefined, facts: { intervalStart: 50, intervalEnd: 100 } }),
      observation("change", "p1", "neutral", 50, { kind: "substitution", facts: { inPlayerId: "p3" } }),
    ]);
    const w = buildAnalysisWorkspace([m], people, { period: 2 }, ["001", "067"]);
    expect(w.rows.map(r => r.person.id)).toEqual(["p2", "p3"]);
    expect(w.total.get("067")?.value).toBe(1);
    expect(w.rows.find(r => r.person.id === "p3")?.results.get("001")?.value).toBeCloseTo(50 / 60);
    const historical = match("old", [observation("p", "p1", "complete", 10, { receiverId: "p2" })], { starters: undefined, bench: undefined });
    expect(buildAnalysisWorkspace([historical], people, {}, ["067"]).rows.map(r => r.person.id)).toEqual(["p1", "p2"]);
    expect(selectAnalysisMatches([historical], { playerIds: ["p2"] }).map(m => m.id)).toEqual(["old"]);
  });
  it("does not let a match the player missed degrade that player's known sample", () => {
    const a = match("a", [observation("p", "p1")], { starters: ["p1"], bench: [] });
    const absent = match("b", [], { starters: ["p2"], bench: [], analysis: undefined });
    const w = buildAnalysisWorkspace([a, absent], people, {}, ["067"]);
    expect(w.rows.find(r => r.person.id === "p1")?.results.get("067")).toMatchObject({ value: 1, status: "complete" });
    expect(w.total.get("067")?.status).toBe("partial");
    expect(buildAnalysisWorkspace([a, absent], people, { playerIds: ["p1"] }, ["067"]).total.get("067")).toMatchObject({ value: 1, status: "complete" });
    expect(selectAnalysisMatches([a, absent], { playerIds: ["p1"] }).map(m => m.id)).toEqual(["a"]);
  });
  it("accepts a labelled action as half participation without inventing its unknown boundary", () => {
    const m = match("m1", [observation("known", "p1", "complete", 60, { receiverId: "p2" }), observation("invalid-bench", "p3", "complete", 65)]);
    const w = buildAnalysisWorkspace([m], people, { period: 2 }, ["001", "067"]);
    expect(w.rows.map(r => r.person.id)).toEqual(["p1", "p2"]);
    expect(formatWorkspaceMetric(w.rows[0].results.get("001"))).toBe("-");
    expect(w.rows[0].results.get("067")?.value).toBe(1);
    expect(selectAnalysisMatches([m], { playerIds: ["p1"], period: 2 }).map(m => m.id)).toEqual(["m1"]);
    expect(selectAnalysisMatches([m], { playerIds: ["p1"], period: 1 })).toEqual([]);
    m.ledger = { p1: { ...emptyParticipation(), played: true, started: true, minutes: 0.5, stints: [{ from: 0, to: 0.5 }] } };
    expect(selectAnalysisMatches([m], { playerIds: ["p1"], period: 2 })).toEqual([]);
  });
  it("preserves official historical minutes without fabricating stints or half attribution", () => {
    const legacy = match("legacy", [observation("known-pass", "p1", "complete", 10)], { starters: undefined, bench: undefined, ledger: { p1: { ...emptyParticipation(), minutes: 50, played: true, started: true, stints: [] } } });
    legacy.durationSeconds = 3000;
    legacy.analysis!.coverage = [];
    const w = buildAnalysisWorkspace([legacy], people, {}, ["001", "004", "067"]);
    expect(w.rows.map(r => r.person.id)).toEqual(["p1"]);
    expect(w.rows[0].results.get("001")).toMatchObject({ value: 50, status: "complete" });
    expect(formatWorkspaceMetric(w.rows[0].results.get("004"))).toBe("-");
    const first = buildAnalysisWorkspace([legacy], people, { period: 1 }, ["001", "067"]);
    expect(first.rows.map(r => r.person.id)).toEqual(["p1"]);
    expect(first.rows[0].results.get("067")?.value).toBe(1);
    expect(formatWorkspaceMetric(first.rows[0].results.get("001"))).toBe("-");
    expect(buildAnalysisWorkspace([legacy], people, { period: 2 }, ["001"]).rows).toEqual([]);
    expect(legacy.ledger!.p1.stints).toEqual([]);
  });
  it("formats unknown values separately from observed zero and partial observations", () => {
    expect(formatWorkspaceMetric(result(0))).toBe("0");
    expect(formatWorkspaceMetric(result(2, "partial"))).toBe("2");
    for (const status of ["unknown", "not_configured", "not_applicable", "no_sample"] as const) expect(formatWorkspaceMetric(result(0, status))).toBe("-");
    expect(formatWorkspaceMetric(result(null))).toBe("-");
    expect(formatWorkspaceMetric({ ...result(37.5), unit: "%" })).toBe("37,5%");
  });
  it("sorts both ways with missing last and ranks competition ties without mutating rows", () => {
    const rows = [row("A", 9), row("B", 5), row("C", 5), row("D", 0), row("E", null), row("F", 10, "unknown")];
    expect(sortAnalysisRows(rows, "067", "asc").map(r => r.person.id)).toEqual(["D", "B", "C", "A", "E", "F"]);
    expect(rankAnalysisRows(rows, "067").map(r => r.rank)).toEqual([1, 2, 2, 4, null, null]);
    expect(rankAnalysisRows(rows, "067", "asc").map(r => r.rank)).toEqual([1, 2, 2, 4, null, null]);
    expect(rows.map(r => r.person.id)).toEqual(["A", "B", "C", "D", "E", "F"]);
  });
  it("calculates only requested IDs while retaining full-mode compatibility and dependencies", () => {
    const m = match("m1", [observation("a", "p1")]);
    expect(evaluateNarrated([m], {}, ["070", "067", "070", "unknown"]).map(r => r.id)).toEqual(["070", "067"]);
    expect(evaluateNarrated([m], {}, [])).toEqual([]);
    expect(evaluateNarrated([m])).toHaveLength(412);
    m.analysis!.observations.push(observation("role", "p1", "neutral", 0, { kind: "lineup", facts: { started: true, role: "CM", intervalStart: 0, intervalEnd: 100 } }));
    Object.assign(m.analysis!.profile.parameters, { ratingWeights: '{"067":2}', ratingScaleMin: 0, ratingScaleMax: 10, ratingBaseline: 1, ratingRole: "CM", ratingMissingPolicy: "require_complete" });
    expect(evaluateNarrated([m], { playerIds: ["p1"] }, ["378"])).toMatchObject([{ id: "378", value: 3, status: "complete" }]);
  });
});
