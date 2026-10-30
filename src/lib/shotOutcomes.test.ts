import { describe, expect, it } from "vitest";
import { DEFAULT_ANALYSIS_PROFILE, type Observation } from "../../functions/src/narrated/types";
import type { ClubMatch } from "./clubData";
import { buildShotOutcomes, buildShotTimeline, classifyShot, funnelFigures, goalDots, rivalLabel, shotsByPlayer } from "./shotOutcomes";

const shot = (id: string, team: "us" | "opponent", period: number, from: number, facts: Observation["facts"], extra: Partial<Observation> = {}): Observation => ({ id, kind: "shot", team, period, order: from, time: { from, to: from, precision: "exact" }, facts, ...extra });
const match: ClubMatch = { id: "m", seasonId: "s", rival: "Orduña", date: Date.UTC(2026, 9, 18, 10), status: "finished", duration: 50, starters: ["a", "b"], analysis: { version: 2, revision: 0, profile: DEFAULT_ANALYSIS_PROFILE, coverage: [{ family: "*", team: "us", state: "complete" }, { family: "*", team: "opponent", state: "complete" }], observations: [
  { id: "first", kind: "context", team: "us", period: 1, order: 0, facts: { intervalStart: 0, intervalEnd: 1500 } },
  { id: "second", kind: "context", team: "us", period: 2, order: 1, facts: { intervalStart: 1520, intervalEnd: 3000 } },
  { id: "goal", kind: "goal", team: "us", actorId: "a", period: 1, order: 2, time: { from: 300, to: 300, precision: "exact" }, facts: { goal: true, outcome: "goal", onTarget: true, woodwork: true } },
  shot("saved", "us", 1, 600, { outcome: "saved", onTarget: true }, { actorId: "a" }),
  shot("post", "us", 1, 700, { outcome: "woodwork" }, { actorId: "b" }),
  shot("block", "us", 1, 800, { outcome: "blocked" }, { actorId: "b" }),
  shot("wide", "us", 2, 1820, { outcome: "off_target", outsideArea: true }, { actorId: "a" }),
  shot("vague", "us", 2, 2000, {}, { actorId: "a", time: { from: 2000, to: 2900, precision: "interval" } }),
  shot("rival-wide", "opponent", 1, 400, { outcome: "off_target" }),
  { id: "rival-goal", kind: "goal", team: "opponent", period: 2, order: 9, time: { from: 2120, to: 2180, precision: "interval" }, facts: { goal: true, outcome: "goal", onTarget: true } },
] } };
const people = [{ id: "a", name: "Álex", number: 7 }, { id: "b", name: "Bruno", number: 10 }];
const outcomeOf = (rows: ReturnType<typeof buildShotOutcomes>["rows"]) => Object.fromEntries(rows.map(row => [row.event.id, row.outcome]));

describe("shot outcomes", () => {
  it("gives every shot one outcome with gol > madera > parado > bloqueado > fuera", () => {
    const sets = new Map([["015", new Set(["x"])], ["033", new Set(["x", "y"])], ["030", new Set(["x", "z"])], ["032", new Set(["w"])], ["031", new Set(["v"])]]);
    expect(["x", "y", "z", "w", "v", "u"].map(id => classifyShot(id, sets))).toEqual(["gol", "madera", "parado", "bloqueado", "fuera", "nd"]);
    const data = buildShotOutcomes([match]);
    expect(outcomeOf(data.rows)).toEqual({ goal: "gol", saved: "parado", post: "madera", block: "bloqueado", wide: "fuera", vague: "nd" });
    expect(data.rows.find(row => row.event.id === "wide")?.outside).toBe(true);
    expect(data.counts).toEqual({ gol: 1, madera: 1, parado: 1, bloqueado: 1, fuera: 1, nd: 1 });
    expect(goalDots(data.rows)).toHaveLength(6);
  });
  it("reads the funnel from the catalogue figures", () => {
    const f = funnelFigures(buildShotOutcomes([match]));
    expect(f).toMatchObject({ total: 6, onTarget: 2, off: 1, blocked: 1, goals: 1, saved: 1 });
    expect(f.unknown).toBe(2);
  });
  it("puts both teams on one clock, relative to each period, skipping intervals over ten minutes", () => {
    const tl = buildShotTimeline([match], { playerIds: ["a"] });
    expect(tl.us.map(row => row.event.id).sort()).toEqual(["goal", "saved", "vague", "wide"]);
    expect(tl.them.map(row => row.event.id).sort()).toEqual(["rival-goal", "rival-wide"]);
    expect(tl.skipped).toBe(1);
    const wide = tl.dots.find(d => d.row.event.id === "wide")!, rivalGoal = tl.dots.find(d => d.row.event.id === "rival-goal")!;
    expect(wide.second).toBe(300);
    expect(rivalGoal).toMatchObject({ team: "opponent", second: 630 });
    expect(wide.x).toBeGreaterThan(tl.bands[1].x);
    expect(tl.bands.map(b => b.label)).toEqual(["1.ª parte", "2.ª parte"]);
  });
  it("groups shots by shooter and the rival's in one row with its name", () => {
    const us = shotsByPlayer(buildShotOutcomes([match]).rows, people, false, "Orduña");
    expect(us.map(row => [row.name, row.total, row.counts.gol])).toEqual([["Álex", 4, 1], ["Bruno", 2, 0]]);
    const them = shotsByPlayer(buildShotOutcomes([match], { team: "opponent" }).rows, people, true, rivalLabel([match]));
    expect(them.map(row => [row.name, row.total])).toEqual([["Orduña", 2]]);
    expect(rivalLabel([match, { ...match, id: "n" }])).toBe("Los rivales");
  });
});
