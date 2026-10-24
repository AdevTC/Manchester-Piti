import { describe, expect, it } from "vitest";
import { emptyParticipation } from "../../functions/src/matchEngine";
import { DEFAULT_ANALYSIS_PROFILE, type Observation } from "../../functions/src/narrated/types";
import type { ClubMatch } from "./clubData";
import { GLOBAL_METHOD, ratingMatches, seasonRating, SEASON_RATING_VERSION, type SeasonRating } from "./seasonRating";

const player = { id: "p", naturalPosition: "MED" };
function obs(id: string, kind: Observation["kind"], facts: Observation["facts"] = {}, extra: Partial<Observation> = {}): Observation {
  return { id, kind, team: "us", actorId: "p", order: Number(id.replace(/\D/g, "")) || 1, validity: "valid", facts, ...extra };
}
let day = 0;
function game(id = "m", observations: Observation[] = [], extra: Partial<ClubMatch> = {}): ClubMatch {
  return { id, seasonId: "s", status: "finished", date: ++day * 86_400_000, duration: 50, goalsFor: 0, goalsAgainst: 0, events: [], ledger: { p: { ...emptyParticipation(), played: true, minutes: 50, stints: [{ from: 0, to: 50 }] } }, analysis: { version: 2, revision: 1, profile: DEFAULT_ANALYSIS_PROFILE, observations, coverage: [{ family: "*", team: "us", state: "complete" }, { family: "*", team: "opponent", state: "complete" }] }, ...extra };
}
const passes = (complete: number, failed = 0) => Array.from({ length: complete + failed }, (_, i) => obs(`p${i}`, "pass", { outcome: i < complete ? "complete" : "failed", subtype: "standard", continuity: false }, { receiverId: "other" }));
const item = (r: SeasonRating, label: string) => r.groups.flatMap((g) => g.items).find((it) => it.label === label);

describe("GLOBAL de temporada: datos honestos", () => {
  it("keeps goals-only legacy unrated instead of inventing minutes or a rating", () => {
    const rating = seasonRating(player, [game("old", [], { ledger: undefined, analysis: undefined, events: [{ id: "g", type: "goal", playerId: "p" }] })]);
    expect(rating.value).toBeNull();
    expect(rating.form).toBeNull();
    expect(rating.minutes).toBeNull();
    expect(rating.status).toBe("insufficient");
    expect(rating.summary).toBe("GLOBAL pendiente: el acta no tiene sus minutos");
    expect(seasonRating({ id: "nadie" }, [game()]).summary).toBe("Sin partidos esta temporada");
  });
  it("a narration that names him proves presence, not minutes: no nota without the acta's", () => {
    const m = game("rich", passes(8, 2), { ledger: undefined, events: [] });
    expect(seasonRating(player, [m]).value).toBeNull();
    expect(seasonRating(player, [m]).matches).toBe(0);
    expect(seasonRating({ ...player, id: "other" }, [m]).value).toBeNull();
  });
  it("a cameo under 10′ gives no nota (and says so)", () => {
    const m = game("m", [], { ledger: { p: { ...emptyParticipation(), played: true, minutes: 6, stints: [{ from: 44, to: 50 }] } } });
    const rating = seasonRating(player, [m]);
    expect(rating.value).toBeNull();
    expect(rating.summary).toBe("GLOBAL pendiente: aún sin 10 minutos en un partido");
  });
  it("a normal match is a 6,5: GLOBAL starts at 65, provisional until 150 minutes with a nota", () => {
    const one = seasonRating(player, [game()]);
    expect(one.notes.map((n) => n.nota)).toEqual([6.5]);
    expect(one.value).toBe(65);
    expect(one.status).toBe("provisional");
    expect(one.summary).toBe("GLOBAL provisional 65/99 · 1 partido · 50 min");
    const three = seasonRating(player, [game("a"), game("b"), game("c")]);
    expect(three.status).toBe("rated");
    expect(three.summary).toBe("GLOBAL 65/99 · 3 partidos");
  });
  it("does not depend on the order the matches come in, and a match he missed changes nothing", () => {
    const a = game("a", passes(20, 10)), b = game("b", passes(10, 20));
    expect(seasonRating(player, [a, b]).value).toBe(seasonRating(player, [b, a]).value);
    expect(seasonRating(player, [a, b, game("absent", [], { ledger: {} })]).value).toBe(seasonRating(player, [a, b]).value);
  });
  it("duplicates, archives, cancellations and scheduled matches do not change the grade", () => {
    const a = game("a", passes(20, 10));
    const expected = seasonRating(player, [a]);
    expect(seasonRating(player, [a, a, game("archived", passes(100), { archived: true }), game("cancelled", [], { status: "cancelled" }), game("next", [], { status: "scheduled" })])).toEqual(expected);
    expect(ratingMatches([a, { ...a, revision: 2, archived: true }])).toEqual([]);
  });
  it("never presents several seasons as a season GLOBAL", () => {
    const rating = seasonRating(player, [game("a", passes(20)), game("b", passes(20), { seasonId: "another" })]);
    expect(rating.value).toBeNull();
    expect(rating.form).toBeNull();
    expect(rating.summary).toBe("Elige una temporada para consultar GLOBAL");
  });
  it("canonical enrichments replace their source and never count as two actions", () => {
    const canonical = { id: "p0", type: "pass" as const, playerId: "p", receiverId: "other", outcome: "complete" as const, minute: 1 };
    const original = game("m", passes(10), { events: [canonical] });
    original.analysis!.observations[0].canonicalEventId = "p0";
    expect(item(seasonRating(player, [original]), "Pase raso bueno")?.n).toBe(10);
  });
  it("unclassified results do not become failures", () => {
    const m = game("m", [...passes(10), obs("p90", "pass", {}), obs("p91", "pass", { outcome: "unknown" })]);
    const rating = seasonRating(player, [m]);
    expect(item(rating, "Pase raso bueno")?.n).toBe(10);
    expect(item(rating, "Pase raso fallado")).toBeUndefined();
  });
  it("a duel+tackle is one contest; extra correlated stats do not raise it", () => {
    const d = obs("duel", "duel", { outcome: "complete" }, { links: { action: "same" } });
    const t = obs("tackle", "tackle", { outcome: "complete" }, { links: { action: "same" }, controlAfter: "us" });
    const a = seasonRating({ ...player, naturalPosition: "DEF" }, [game("m", [...passes(10), d])]);
    const b = seasonRating({ ...player, naturalPosition: "DEF" }, [game("m", [...passes(10), d, t])]);
    expect(b.groups).toEqual(a.groups);
    expect(b.value).toBe(a.value);
  });
  // (a match is read once per object, as the app's data is never changed in place: each case is a new match)
  const keeper = { ...player, naturalPosition: "POR" };
  const faced = (more: Observation[] = [], row: Partial<NonNullable<ClubMatch["ledger"]>[string]> = {}) => {
    const m = game("m", [...passes(10), obs("save", "save", { outcome: "complete" }), ...more], { goalsAgainst: 1, events: [{ id: "goal", type: "opponent_goal", minute: 10 }] });
    m.ledger!.p = { ...m.ledger!.p, ...row };
    return seasonRating(keeper, [m]);
  };
  it("credits a conceded goal to no keeper without proof of who was in goal", () => {
    expect(item(faced(), "Goles evitados")).toBeUndefined();
    // one save and one goal faced, each a 42 % chance: 0,84 expected − 1 conceded
    expect(item(faced([obs("gk", "lineup", { role: "GK", intervalStart: 0, intervalEnd: 3000 })]), "Goles evitados")).toMatchObject({ n: 2, value: expect.closeTo(-0.16, 5) });
  });
  it("recognises a certified full-match keeper but never a merely preferred or estimated position", () => {
    expect(item(faced([], { positionsPlayed: { POR: 50 } }), "Goles evitados")).toBeDefined();
    expect(item(faced([], { positionsPlayed: { POR: 50 }, positionsEstimated: true }), "Goles evitados")).toBeUndefined();
    expect(item(faced([], { positionsPlayed: { POR: 25 } }), "Goles evitados")).toBeUndefined();
  });
  it("names the season's certified dominant line, otherwise the preferred one", () => {
    const m = game("m", passes(10));
    m.ledger!.p.positionsPlayed = { DFC: 50 };
    expect(seasonRating(player, [m])).toMatchObject({ role: "DEF", roleSource: "played" });
    m.ledger!.p.positionsEstimated = true;
    expect(seasonRating(player, [m])).toMatchObject({ role: "MED", roleSource: "preferred" });
    // without any line he is compared with the whole team: still rated
    const unknown = seasonRating({ id: "p" }, [game("m", passes(10))]);
    expect(unknown).toMatchObject({ role: null, roleSource: "unknown" });
    expect(unknown.value).not.toBeNull();
  });
  it("explains itself: the method, the version and what his actions were worth", () => {
    const rating = seasonRating(player, [game("m", passes(10, 2))]);
    expect(rating.version).toBe(SEASON_RATING_VERSION);
    expect(rating.explanation).toBe(GLOBAL_METHOD);
    expect(GLOBAL_METHOD).toContain("Los votos MVP no cuentan");
    expect(rating.groups.map((g) => g.label)).toEqual(["Pase"]);
    expect(item(rating, "Pase raso fallado")).toMatchObject({ n: 2 });
    expect(item(rating, "Pase raso fallado")!.value).toBeLessThan(0);
  });
});
