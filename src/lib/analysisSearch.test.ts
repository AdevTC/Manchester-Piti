import { describe, expect, it } from "vitest";
import { z } from "zod";
import { analysisSearchSchema, inScope, scopeSeasons, statsScopeSearchFields } from "./analysisSearch";
import { matchSearchSchema } from "./matchTabs";

describe("analysis URL scopes", () => {
  it("accepts arrays and simple shared ids, deduplicating without mutating the selection", () => {
    expect(analysisSearchSchema.parse({ players: [" p2 ", "p1", "p2"], analysis: "catalog", metric: "A12" })).toEqual({ players: ["p2", "p1"], analysis: "catalog", metric: "A12" });
    expect(z.object(statsScopeSearchFields).parse({ seasons: "t2,t1", matches: "j1" })).toEqual({ seasons: ["t2", "t1"], matches: ["j1"] });
  });
  it("rejects malformed values without turning them into ids", () => {
    expect(analysisSearchSchema.parse({ players: [{ id: "p1" }], metric: "../../x", q: {}, excluded: "true" })).toEqual({ players: undefined, metric: undefined, q: undefined, excluded: undefined });
  });
  it("plural seasons override the remembered single season, and unknown ids do not mean all", () => {
    expect(scopeSeasons({ seasons: ["t2", "t3"] }, "t1")).toEqual(["t2", "t3"]);
    expect(scopeSeasons({}, "t1")).toEqual(["t1"]);
    expect(scopeSeasons({ seasons: [] }, "t1")).toEqual([]);
    expect(inScope("j1", ["removed"])).toBe(false);
    expect(inScope("j1", [])).toBe(true);
  });
  it("match links retain the same catalogue state but cannot inject another match scope", () => {
    expect(matchSearchSchema.parse({ tab: "estadisticas", analysis: "catalog", family: "Pases", metric: "067", players: ["p1"], matches: ["j2"] })).toEqual({ tab: "estadisticas", analysis: "catalog", family: "Pases", metric: "067", players: ["p1"] });
  });
  it("team and period are typed, with malformed contexts removed", () => {
    expect(analysisSearchSchema.parse({ team: "opponent", period: "2" })).toEqual({ team: "opponent", period: 2 });
    expect(analysisSearchSchema.parse({ team: "both", period: 0 })).toEqual({ team: undefined, period: undefined });
    expect(analysisSearchSchema.parse({ period: true }).period).toBeUndefined();
  });
});
