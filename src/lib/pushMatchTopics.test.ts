// «Avisos de este partido» (functions/src/pushMatchTopics.ts): which device gets a notice about a match it
// chose its own avisos for, and how the overrides stay small.
import { describe, expect, it } from "vitest";
import { deviceGets, effectiveMatchTopics, MATCH_OVERRIDE_DAYS_MS, MAX_MATCH_OVERRIDES, matchOverride, nextMatchTopics, type MatchInfo } from "../../functions/src/pushMatchTopics";
import { noticesFor } from "../../functions/src/pushLogic";

const NOW = Date.UTC(2026, 9, 22, 12);
const DAY = 24 * 3600_000;

describe("deviceGets", () => {
  const goal = { topic: "goals" };
  const card = { topic: "cards" };
  it("without an override: today's rule (presets)", () => {
    expect(deviceGets({ preset: "todo" }, card, "j8")).toBe(true);
    expect(deviceGets({ preset: "goles" }, card, "j8")).toBe(false);
    expect(deviceGets({ preset: "goles" }, goal, "j8")).toBe(true);
    expect(deviceGets({ preset: "custom", matchTopics: { j9: [] } }, card, "j8")).toBe(true);
  });
  it("an override for the notice's match decides alone, even against the preset", () => {
    expect(deviceGets({ preset: "todo", matchTopics: { j8: ["goals"] } }, card, "j8")).toBe(false);
    expect(deviceGets({ preset: "todo", matchTopics: { j8: [] } }, goal, "j8")).toBe(false);
    expect(deviceGets({ preset: "goles", matchTopics: { j8: ["cards"] } }, card, "j8")).toBe(true);
    // a device with no global topics, just this match
    expect(deviceGets({ preset: "nada", matchTopics: { j8: ["final"] } }, { topic: "final" }, "j8")).toBe(true);
    expect(deviceGets({ preset: "nada", matchTopics: { j8: ["final"] } }, { topic: "final" }, "j9")).toBe(false);
  });
  it("the descanso answers to «Descanso y final» in the match's avisos", () => {
    const base = { rival: "MAD SKY", status: "scheduled", version: 2, date: NOW - 30 * 60_000 };
    const [half] = noticesFor("j8", { ...base, clock: { phase: "first" } }, { ...base, clock: { phase: "halftime" } }, () => "", NOW);
    expect(half).toMatchObject({ topic: "start", matchTopic: "final" });
    expect(deviceGets({ preset: "todo", matchTopics: { j8: ["final"] } }, half, "j8")).toBe(true);
    expect(deviceGets({ preset: "todo", matchTopics: { j8: ["start"] } }, half, "j8")).toBe(false);
    // the global switches keep it on «start»
    expect(deviceGets({ preset: "custom" }, half, "j8")).toBe(true);
  });
  it("so does the 2ª parte: a sheet with everything off lets nothing of the match through", () => {
    const base = { rival: "MAD SKY", status: "scheduled", version: 2, date: NOW - 60 * 60_000 };
    const [second] = noticesFor("j8", { ...base, clock: { phase: "halftime" } }, { ...base, clock: { phase: "second" } }, () => "", NOW);
    expect(second).toMatchObject({ title: "Arranca la 2ª parte", topic: "start", matchTopic: "final" });
    expect(deviceGets({ preset: "todo", matchTopics: { j8: ["final"] } }, second, "j8")).toBe(true);
    // (what was left of a choice made before the kick-off: «start» no longer brings the 2ª parte)
    expect(deviceGets({ preset: "todo", matchTopics: { j8: ["start", "mvp", "dates", "lineup"] } }, second, "j8")).toBe(false);
    expect(deviceGets({ preset: "custom" }, second, "j8")).toBe(true);
  });
  it("personal, door and convocatoria notices never look at the overrides", () => {
    expect(deviceGets({ preset: "custom", matchTopics: { j8: [] } }, { topic: "personal" }, "j8")).toBe(true);
    expect(deviceGets({ preset: "goles", matchTopics: { j8: ["goals"] } }, { topic: "personal" }, "j8")).toBe(false);
    expect(deviceGets({ preset: "nada", matchTopics: { j8: [] } }, { topic: "door" }, "j8")).toBe(true);
    expect(deviceGets({ preset: "custom", matchTopics: { j8: [] } }, { topic: "convocatoria" }, "j8")).toBe(true);
  });
  it("a notice about no match goes as before", () => {
    expect(deviceGets({ preset: "custom", matchTopics: { j8: [] } }, { topic: "lineup" }, null)).toBe(true);
  });
});

describe("matchOverride / effectiveMatchTopics", () => {
  it("reads only arrays of match topics", () => {
    expect(matchOverride({ j8: ["goals", "door", 3] }, "j8")).toEqual(["goals"]);
    expect(matchOverride({ j8: "goals" }, "j8")).toBeNull();
    expect(matchOverride(undefined, "j8")).toBeNull();
    expect(matchOverride({ j8: [] }, null)).toBeNull();
  });
  it("the sheet starts from the override, else the match topics among the global ones", () => {
    expect(effectiveMatchTopics(null, ["goals", "convocatoria", "door", "final"])).toEqual(["goals", "final"]);
    expect(effectiveMatchTopics([], ["goals"])).toEqual([]);
    expect(effectiveMatchTopics(["cards"], ["goals"])).toEqual(["cards"]);
  });
});

describe("nextMatchTopics", () => {
  const live: MatchInfo = { exists: true, status: "scheduled", date: NOW + DAY };
  it("sets, replaces and drops the match's override", () => {
    const m = new Map([["a", live]]);
    const one = nextMatchTopics({}, "j8", ["goals", "goals", "cards"], m, NOW);
    expect(one).toEqual({ matchTopics: { j8: ["goals", "cards"] }, matchTopicsAt: { j8: NOW } });
    const empty = nextMatchTopics(one, "j8", [], m, NOW + 1);
    expect(empty.matchTopics).toEqual({ j8: [] });
    expect(nextMatchTopics({ matchTopics: { j8: ["goals"], a: ["final"] }, matchTopicsAt: { j8: 1, a: 2 } }, "j8", null, m, NOW)).toEqual({ matchTopics: { a: ["final"] }, matchTopicsAt: { a: 2 } });
  });
  it("drops gone, archived and long-finished matches; keeps recent ones and aplazados", () => {
    const m = new Map<string, MatchInfo>([
      ["gone", { exists: false }],
      ["arch", { exists: true, archived: true, status: "scheduled", date: NOW + DAY }],
      ["old", { exists: true, status: "finished", date: NOW - MATCH_OVERRIDE_DAYS_MS - 1 }],
      ["recent", { exists: true, status: "finished", date: NOW - DAY }],
      ["aplazado", { exists: true, status: "postponed", date: NOW - 30 * DAY }],
    ]);
    const cur = { matchTopics: { gone: ["goals"], arch: ["goals"], old: ["mvp"], recent: ["mvp"], aplazado: ["dates"], unknown: ["goals"] } };
    expect(Object.keys(nextMatchTopics(cur, "j8", ["goals"], m, NOW).matchTopics).sort()).toEqual(["aplazado", "j8", "recent"]);
  });
  it("keeps at most a dozen, the newest choices first, and always the one just made", () => {
    const ids = Array.from({ length: 20 }, (_, i) => `m${i}`);
    const m = new Map(ids.map((id) => [id, live] as const));
    const cur = { matchTopics: Object.fromEntries(ids.map((id) => [id, ["goals"]])), matchTopicsAt: Object.fromEntries(ids.map((id, i) => [id, i])) };
    const out = nextMatchTopics(cur, "new", ["final"], m, NOW);
    expect(Object.keys(out.matchTopics)).toHaveLength(MAX_MATCH_OVERRIDES);
    expect(out.matchTopics.new).toEqual(["final"]);
    expect(out.matchTopics.m19).toBeDefined();
    expect(out.matchTopics.m0).toBeUndefined();
    expect(out.matchTopics[`m${20 - MAX_MATCH_OVERRIDES + 1}`]).toBeDefined();
    expect(out.matchTopics[`m${20 - MAX_MATCH_OVERRIDES}`]).toBeUndefined();
  });
});
