import { describe, expect, it } from "vitest";
import { DEFAULT_ANALYSIS_PROFILE } from "../../functions/src/narrated/types";
import type { ClubMatch } from "./clubData";
import { createAnalysisExport } from "./analysisExport";

const exportedAt = "2026-10-19T12:00:00.000Z";
const fixture: ClubMatch = {
  id: "m1", seasonId: "s1", status: "finished", date: { seconds: 1792404000 }, duration: 50,
  starters: ["pepe", "luis"], bench: ["ana"],
  events: [{ id: "goal", type: "goal", playerId: "luis", minute: 35, sourceRef: "PRIVATE_LEGACY", byUid: "PRIVATE_ACCOUNT" }],
  narrationSources: [{ id: "source-1", quote: "PRIVATE_QUOTE" }],
  analysis: {
    version: 2, revision: 3, profile: DEFAULT_ANALYSIS_PROFILE,
    observations: [
      { id: "pass-1", kind: "pass", team: "us", actorId: "pepe", receiverId: "luis", order: 1, period: 1, time: { from: 120, to: 120, precision: "exact" }, facts: { outcome: "complete" }, provenance: { outcome: { kind: "deduced", sourceId: "source-1", rule: "reception-confirmed" } } },
      { id: "pass-2", kind: "pass", team: "us", actorId: "luis", receiverId: "ana", order: 2, period: 2, time: { from: 1700, to: 1700, precision: "exact" }, facts: { outcome: "complete" } },
      { id: "rival", kind: "pass", team: "opponent", actorId: "rival-7", receiverId: "rival-8", order: 3, period: 1, facts: { outcome: "complete" } },
    ],
    coverage: [{ family: "pass", team: "us", state: "complete" }],
    issues: [{ id: "private-issue", message: "PRIVATE_QUESTION", eventIds: [] }],
  },
};

describe("public statistics JSON export", () => {
  it("intersects the panel matches with season and match filters and never exports archived records", () => {
    const result = createAnalysisExport({ exportedAt, matches: [fixture, { ...fixture, id: "m2", seasonId: "s2" }, { ...fixture, id: "m3", archived: true }, { ...fixture, id: "m4", individuallyArchived: true }], filters: { seasonIds: ["s1"], matchIds: ["m1", "m2", "m3", "m4"] } });
    expect(result.matches.map(match => match.id)).toEqual(["m1"]);
    expect(result.metadata.matchIds).toEqual(["m1"]);
    expect(result.matches[0].date).toBe(1792404000000);
    const empty = createAnalysisExport({ exportedAt, matches: [fixture], filters: { matchIds: ["not-in-this-panel"] } });
    expect(empty.matches).toEqual([]);
    expect(empty.results.find(metric => metric.id === "067")?.value).toBeNull();
  });

  it("serializes null, coverage, rule versions and evidence while removing private source text recursively", () => {
    const legacyCached = { ...fixture, sources: [{ quote: "PRIVATE_TOP" }], analysis: { ...fixture.analysis!, observations: fixture.analysis!.observations.map(observation => ({ ...observation, sourceRef: "PRIVATE_NESTED" })) } };
    const original = JSON.stringify(legacyCached);
    const output = createAnalysisExport({ exportedAt, matches: [legacyCached] });
    const serialized = JSON.stringify(output);
    expect(serialized).not.toContain("PRIVATE_");
    expect(serialized).not.toContain('"sourceRef"');
    expect(serialized).not.toContain('"sources"');
    expect(serialized).not.toContain('"byUid"');
    expect(JSON.stringify(legacyCached)).toBe(original);
    const roundTrip = JSON.parse(serialized);
    expect(roundTrip.format).toBe("piti-statistics/v1");
    expect(roundTrip.exportedAt).toBe(exportedAt);
    expect(roundTrip.metadata.catalogSourceSha256).toMatch(/^[a-f0-9]{64}$/);
    expect(roundTrip.matches[0].analysis.observations[0].provenance.outcome).toEqual({ kind: "deduced", sourceId: "source-1", rule: "reception-confirmed" });
    expect(roundTrip.coverage).toEqual([{ matchId: "m1", legacy: null, families: [{ family: "pass", team: "us", state: "complete" }] }]);
    expect(roundTrip.results.find((metric: { id: string }) => metric.id === "067")).toMatchObject({ value: 2, unit: "acciones", status: "complete", observed: 2, pending: 0, ruleId: "piti.067", ruleVersion: 1, evidenceEventIds: ["m1:pass-1", "m1:pass-2"] });
    expect(roundTrip.results.find((metric: { id: string }) => metric.id === "070")).toMatchObject({ value: 100, numerator: 2, denominator: 2 });
    expect(roundTrip.results.find((metric: { id: string }) => metric.id === "033")).toMatchObject({ value: null, status: "unknown" });
  });

  it("applies player, team and period to results while retaining receivers and rival context in the acta", () => {
    const result = createAnalysisExport({ exportedAt, matches: [fixture], filters: { playerIds: ["pepe"], team: "us", period: 1 }, view: { analysis: "catalog", metric: "067", family: "Pases" }, people: [{ id: "pepe", name: "Pepe" }, { id: "luis", name: "Luis" }, { id: "ana", name: "Ana" }] });
    expect(result.filters).toMatchObject({ playerIds: ["pepe"], team: "us", period: 1 });
    expect(result.view).toMatchObject({ analysis: "catalog", metric: "067", family: "Pases" });
    expect(result.results.find(metric => metric.id === "067")).toMatchObject({ value: 1, evidenceEventIds: ["m1:pass-1"] });
    expect(result.matches[0].analysis?.observations).toHaveLength(3);
    expect(result.matches[0].analysis?.observations[2]).toMatchObject({ actorId: "rival-7", receiverId: "rival-8" });
    expect(result.matches[0].events).toHaveLength(1);
    expect(result.people.map(person => person.id)).toEqual(["pepe", "luis", "ana"]);
  });
  it("shares the player sample with the cards and table, excluding absent matches and duplicates", () => {
    const absent = { ...fixture, id: "absent", starters: ["ana"], bench: [], analysis: undefined, events: [] };
    const result = createAnalysisExport({ exportedAt, matches: [fixture, fixture, absent], filters: { playerIds: ["pepe"] } });
    expect(result.metadata.matchIds).toEqual(["m1"]);
    expect(result.results.find(m => m.id === "067")).toMatchObject({ value: 1, status: "complete" });
    expect(result.matches[0].analysis?.observations).toHaveLength(3);
    const empty = createAnalysisExport({ exportedAt, matches: [fixture], filters: { playerIds: ["absent-player"] } });
    expect(empty.matches).toEqual([]);
    expect(empty.results.find(m => m.id === "067")).toMatchObject({ value: null, status: "unknown" });
  });
});
