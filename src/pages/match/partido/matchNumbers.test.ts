import { describe, expect, it } from "vitest";
import { DEFAULT_ANALYSIS_PROFILE, type Observation } from "../../../../functions/src/narrated/types";
import type { ClubMatch } from "../../../lib/clubData";
import { matchNumbers } from "./matchNumbers";

const people = [{ id: "a", name: "Álex", number: 7 }, { id: "b", name: "Bruno", number: 10 }];
const pass = (id: string, extra: Partial<Observation> = {}): Observation => ({ id, kind: "pass", team: "us", actorId: "a", receiverId: "b", order: 1, time: { from: 60, to: 119.999, precision: "interval" }, facts: { outcome: "complete" }, ...extra });
const fixture = (): ClubMatch => ({ id: "m", seasonId: "s", status: "finished", duration: 50, starters: ["a", "b"],
  events: [{ id: "linked", type: "pass", playerId: "a", receiverId: "b", minute: 2, outcome: "complete" }],
  analysis: { version: 2, revision: 1, profile: DEFAULT_ANALYSIS_PROFILE, coverage: [{ family: "pass", team: "us", state: "complete" }], observations: [
    pass("complete", { canonicalEventId: "linked" }),
    pass("failed", { receiverId: undefined, facts: { outcome: "failed" } }),
    pass("unknown", { receiverId: undefined, facts: { outcome: "unknown" } }),
    pass("void", { validity: "void" }),
    pass("throw", { facts: { outcome: "complete", restart: "throw_in" } }),
    pass("hand", { kind: "distribution", facts: { outcome: "complete", bodyPart: "hand" } }),
    pass("anonymous", { actorId: undefined }),
    pass("later", { actorId: "b", receiverId: "a", time: { from: 1600, to: 1600, precision: "exact" } }),
    pass("recovery", { kind: "recovery", facts: {} }),
    pass("interception", { kind: "interception", facts: {} }),
    pass("awarded", { kind: "restart", facts: { subtype: "corner", stage: "awarded", outcome: "complete" } }),
    pass("executed", { kind: "restart", facts: { subtype: "corner", stage: "executed" } }),
  ] },
});

describe("match figures share catalogue calculations", () => {
  it("does not count linked canonicals twice, void actions, hand deliveries or throw-ins as passes", () => {
    const data = matchNumbers(fixture(), people, {}, { us: 0, them: 0 });
    expect(data.rows.find(row => row.k === "pase")?.us).toBe(3);
    expect(data.glance.find(row => row.id === "067")?.n).toBe(5);
    expect(data.glance.find(row => row.id === "070")).toMatchObject({ n: 75, d: "3/4 con resultado conocido" });
    expect(data.rows.find(row => row.k === "recup")?.us).toBe(1);
    expect(data.glance.find(row => row.id === "206")?.n).toBe(1);
    expect(data.rows.find(row => row.k === "corner")?.us).toBe(1);
  });
  it("includes anonymous actions in team figures and represents all tied leaders", () => {
    const data = matchNumbers(fixture(), people, {}, { us: 0, them: 0 });
    const leaders = data.leaders.filter(row => row.what.startsWith("Pases"));
    expect(leaders.map(row => [row.id, row.v])).toEqual([["a", 1], ["b", 1]]);
    expect(leaders.every(row => row.what.endsWith("compartido"))).toBe(true);
    expect(data.results.get("068")?.value).toBe(3);
  });
  it("keeps future play out of both the figures and leaders when the moviola moves back", () => {
    const data = matchNumbers(fixture(), people, { toSecond: 120 }, { us: 0, them: 0 });
    expect(data.rows.find(row => row.k === "pase")?.us).toBe(2);
    expect(data.glance.find(row => row.id === "067")?.n).toBe(4);
    expect(data.leaders.filter(row => row.what.startsWith("Pases")).map(row => row.id)).toEqual(["a"]);
    expect(data.results.get("068")?.evidenceEventIds).not.toContain("m:later");
  });
  it("keeps unknown figures blank, rather than making zero-value bars from absent data", () => {
    const data = matchNumbers(fixture(), people, {}, { us: 0, them: 0 });
    expect(data.rows.find(row => row.k === "remate")).toMatchObject({ us: null, usText: "—", usW: 0, them: null });
    expect(data.glance.find(row => row.id === "029")).toMatchObject({ n: null, display: "—" });
    expect(data.partial).toBe(true);
  });
});
