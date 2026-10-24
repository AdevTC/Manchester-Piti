import { describe, expect, it } from "vitest";
import { DEFAULT_ANALYSIS_PROFILE, type NarratedMatch, type Observation } from "../../functions/src/narrated/types";
import { buildPassingNetwork, buildShotChart } from "./statsCharts";

const people = [{ id: "a", name: "Álex", number: 7 }, { id: "b", name: "Bruno", number: 10 }, { id: "unused", name: "Sin jugar" }];
const pass = (id: string, extra: Partial<Observation> = {}): Observation => ({ id, kind: "pass", team: "us", actorId: "a", receiverId: "b", order: 1, period: 1, time: { from: 10, to: 10, precision: "exact" }, facts: { outcome: "complete" }, ...extra });
const match = (id: string, observations: Observation[]): NarratedMatch => ({ id, seasonId: "s", status: "finished", durationSeconds: 3000, starters: ["a", "b"], bench: ["unused"], analysis: { version: 2, revision: 0, profile: structuredClone(DEFAULT_ANALYSIS_PROFILE), coverage: [{ family: "*", team: "us", state: "complete" }, { family: "*", team: "opponent", state: "complete" }], observations: [
  { id: "first-half", kind: "context", team: "us", order: 0, period: 1, facts: { intervalStart: 0, intervalEnd: 1500 } },
  { id: "second-half", kind: "context", team: "us", order: 0, period: 2, facts: { intervalStart: 1500, intervalEnd: 3000 } }, ...observations,
] } });

describe("shared statistics charts", () => {
  it("retains directed connections and sizes nodes from passes actually exchanged", () => {
    const data = buildPassingNetwork([match("m", [pass("out"), pass("back", { actorId: "b", receiverId: "a" }), pass("failed", { receiverId: undefined, intendedReceiverId: "b", facts: { outcome: "failed" } })])], people);
    expect(data.edges.map(edge => [edge.from, edge.to, edge.completed])).toEqual([["a", "b", 1], ["b", "a", 1]]);
    expect(data.nodes.map(node => [node.id, node.involvement])).toEqual([["a", 2], ["b", 2]]);
    expect(data.completed).toBe(2);
    expect(data.nodes.some(node => node.id === "unused")).toBe(false);
  });
  it("honours season, match, player and period filters while retaining receivers", () => {
    const a = match("a", [pass("first"), pass("second", { period: 2, time: { from: 1600, to: 1600, precision: "exact" } }), pass("back", { actorId: "b", receiverId: "a", period: 2, time: { from: 1700, to: 1700, precision: "exact" } })]);
    const data = buildPassingNetwork([a, { ...match("b", [pass("other")]), seasonId: "other" }], people, { seasonIds: ["s"], matchIds: ["a"], playerIds: ["a"], period: 2 });
    expect(data.matchCount).toBe(1);
    expect(data.edges).toHaveLength(1);
    expect(data.edges[0]).toMatchObject({ from: "a", to: "b", completed: 1, volume: { evidenceEventIds: ["a:second"] } });
    expect(data.nodes.map(node => node.id)).toEqual(["a", "b"]);
  });
  it("does not draw unknown or incompatible-profile passes as successful connections", () => {
    expect(buildPassingNetwork([match("m", [pass("pending", { facts: { outcome: "pending" } })])], people).edges).toEqual([]);
    const a = match("a", [pass("one")]), b = match("b", [pass("two")]);
    b.analysis!.profile.passes.crosses = false;
    expect(buildPassingNetwork([a, b], people).edges).toEqual([]);
  });
  it("stops at the moviola minute without assigning an interval across its boundary", () => {
    const m = match("m", [
      pass("minute20", { time: { from: 1140, to: 1199.999, precision: "interval" } }),
      pass("minute21", { time: { from: 1200, to: 1259.999, precision: "interval" } }),
      pass("crosses-boundary", { time: { from: 1190, to: 1210, precision: "interval" } }),
    ]);
    const data = buildPassingNetwork([m], people, { toSecond: 1200 });
    expect(data.completed).toBe(1);
    expect(data.edges[0].volume.evidenceEventIds).toEqual(["m:minute20"]);
    expect(data.pending).toBeGreaterThan(0);
  });
  it("keeps rival identities separate from similarly named Piti players", () => {
    const data = buildPassingNetwork([match("m", [pass("opponent", { team: "opponent", actorId: undefined, receiverId: undefined, opponentId: "a", facts: { outcome: "complete", opponentReceiverId: "b" } })])], people, { team: "opponent" });
    expect(data.nodes.map(node => node.name)).toEqual(["Rival 1", "Rival 2"]);
  });
  it("explains completed passes missing from the network without counting failed attempts as successes", () => {
    const data = buildPassingNetwork([match("m", [pass("pair"), pass("anonymous", { actorId: undefined }), pass("failed", { receiverId: undefined, facts: { outcome: "failed" } })])], people);
    expect(data).toMatchObject({ completed: 1, totalCompleted: 2, unrepresentedCompleted: 1, unattributed: 2 });
  });
  it("shares catalogue semantics for a goal off the post without creating a second shot", () => {
    const goal = pass("goal", { kind: "goal", receiverId: undefined, facts: { goal: true, woodwork: true, onTarget: true } });
    const data = buildShotChart([match("m", [goal])]);
    const value = (id: string) => data.bars.find(bar => bar.id === id)!.result.value;
    expect([value("029"), value("030"), value("033"), value("015")]).toEqual([1, 1, 1, 1]);
  });
  it("keeps missing shot information distinct from confirmed zero", () => {
    const m = match("m", []); m.analysis!.coverage = [];
    expect(buildShotChart([m]).bars.find(bar => bar.id === "029")?.result).toMatchObject({ value: null, status: "unknown" });
    expect(buildShotChart([match("known", [])]).bars.find(bar => bar.id === "029")?.result).toMatchObject({ value: 0, status: "complete" });
  });
});
