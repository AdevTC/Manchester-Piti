import { describe, expect, it } from "vitest";
import { emptyParticipation } from "../../functions/src/matchEngine";
import { DEFAULT_ANALYSIS_PROFILE, type Observation } from "../../functions/src/narrated/types";
import type { ClubMatch } from "./clubData";
import { GLOBAL_WEIGHTS, ratingMatches, seasonRating } from "./seasonRating";

const player = { id: "p", naturalPosition: "MED" };
function obs(id: string, kind: Observation["kind"], facts: Observation["facts"] = {}, extra: Partial<Observation> = {}): Observation {
  return { id, kind, team: "us", actorId: "p", order: Number(id.replace(/\D/g, "")) || 1, validity: "valid", facts, ...extra };
}
function game(id = "m", observations: Observation[] = [], extra: Partial<ClubMatch> = {}): ClubMatch {
  return { id, seasonId: "s", status: "finished", duration: 50, goalsFor: 0, goalsAgainst: 0, events: [], ledger: { p: { ...emptyParticipation(), played: true, minutes: 50, stints: [{ from: 0, to: 50 }] } }, analysis: { version: 2, revision: 1, profile: DEFAULT_ANALYSIS_PROFILE, observations, coverage: [{ family: "*", team: "us", state: "complete" }, { family: "*", team: "opponent", state: "complete" }] }, ...extra };
}
const passes = (complete: number, failed = 0) => Array.from({ length: complete + failed }, (_, i) => obs(`p${i}`, "pass", { outcome: i < complete ? "complete" : "failed", subtype: "standard", continuity: false }, { receiverId: "other" }));
const block = (rating: ReturnType<typeof seasonRating>, id: string) => rating.blocks.find(b => b.id === id)!;

describe("GLOBAL de temporada: evidencia y cobertura", () => {
  it("keeps goals-only legacy unrated instead of inventing minutes or a rating", () => {
    const rating = seasonRating(player, [game("old", [], { ledger: undefined, analysis: undefined, events: [{ id: "g", type: "goal", playerId: "p" }] })]);
    expect(rating.value).toBeNull();
    expect(rating.minutes).toBeNull();
    expect(rating.status).toBe("insufficient");
    expect(block(rating, "passing").score).toBeNull();
  });
  it("a known zero differs from unknown or an empty opportunity sample", () => {
    const failed = seasonRating(player, [game("m", passes(0, 10))]);
    expect(block(failed, "passing").score).toBe(0);
    const unknown = seasonRating(player, [game("m", [obs("p1", "pass", { outcome: "unknown" })])]);
    expect(block(unknown, "passing").score).toBeNull();
    expect(block(unknown, "dribbling").score).toBeNull();
  });
  it("keeps rich-only participants and ratios without inventing their missing minutes", () => {
    const m = game("rich", passes(8, 2), { ledger: undefined, events: [] });
    const rating = seasonRating(player, [m]);
    expect(rating.matches).toBe(1);
    expect(rating.minutes).toBeNull();
    expect(rating.sample).toBe(10);
    expect(block(rating, "passing").score).toBe(80);
    expect(rating.value).toBeNull();
    const receiver = seasonRating({ ...player, id: "other" }, [m]);
    expect(receiver.matches).toBe(1);
    expect(receiver.minutes).toBeNull();
    expect(block(receiver, "passing").score).toBeNull();
    m.analysis!.observations = m.analysis!.observations.map((o, i) => ({ ...o, validity: i % 2 ? "pending" : "void" }));
    expect(seasonRating(player, [m]).matches).toBe(0);
    expect(seasonRating({ ...player, id: "other" }, [m]).matches).toBe(0);
  });
  it("recalculates ratios over season opportunities, not means of match percentages", () => {
    const rating = seasonRating(player, [game("a", passes(1)), game("b", passes(0, 9))]);
    expect(block(rating, "passing").score).toBe(10);
    expect(block(rating, "passing").detail).toContain("1/10");
  });
  it("does not give recent games extra weight and does not punish missed games", () => {
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
    expect(rating.summary).toBe("Elige una temporada para consultar GLOBAL");
  });
  it("canonical enrichments replace their source and never count as two actions", () => {
    const canonical = { id: "p0", type: "pass" as const, playerId: "p", receiverId: "other", outcome: "complete" as const, minute: 1 };
    const original = game("m", passes(10), { events: [canonical] });
    original.analysis!.observations[0].canonicalEventId = "p0";
    const rating = seasonRating(player, [original]);
    expect(block(rating, "passing").detail).toContain("10/10");
    expect(rating.sample).toBe(10);
  });
  it("unclassified results do not become failures or fabricated percentages", () => {
    const m = game("m", [...passes(10), obs("unknown", "pass", {})]);
    expect(block(seasonRating(player, [m]), "passing").score).toBeNull();
    expect(seasonRating(player, [m]).sample).toBe(10);
  });
  it("a partial goal/creation count is not divided by all minutes as if exhaustive", () => {
    const m = game("m", passes(10));
    m.analysis!.coverage = [{ family: "pass", team: "us", state: "partial" }];
    const rating = seasonRating(player, [m]);
    expect(block(rating, "creation").score).toBeNull();
    expect(block(rating, "passing").score).toBe(100);
    expect(block(rating, "passing").partial).toBe(true);
    expect(rating.status).not.toBe("rated");
  });
  it("limits a tiny perfect sample and leaves no-actions records unrated", () => {
    const rating = seasonRating(player, [game("m", passes(6))]);
    expect(rating.value).not.toBeNull();
    expect(rating.value).toBeLessThanOrEqual(60);
    expect(rating.status).toBe("provisional");
    expect(seasonRating(player, [game()]).value).toBeNull();
  });
  it("uses the season's certified dominant line, otherwise the preferred one", () => {
    const m = game("m", passes(10));
    m.ledger!.p.positionsPlayed = { DFC: 50 };
    expect(seasonRating(player, [m]).role).toBe("DEF");
    m.ledger!.p.positionsEstimated = true;
    expect(seasonRating(player, [m]).role).toBe("MED");
    expect(seasonRating({ id: "p" }, [game("m", passes(10))]).value).toBeNull();
    Object.values(GLOBAL_WEIGHTS).forEach(weights => expect(Object.values(weights).reduce((a, b) => a + b, 0)).toBe(100));
  });
  it("a duel+tackle is one contest; extra correlated stats do not raise its block", () => {
    const d = obs("duel", "duel", { outcome: "complete" }, { links: { action: "same" } });
    const t = obs("tackle", "tackle", { outcome: "complete" }, { links: { action: "same" }, controlAfter: "us" });
    const a = seasonRating({ ...player, naturalPosition: "DEF" }, [game("m", [...passes(10), d])]);
    const b = seasonRating({ ...player, naturalPosition: "DEF" }, [game("m", [...passes(10), d, t])]);
    expect(block(a, "defence").score).toBe(block(b, "defence").score);
    expect(a.sample).toBe(b.sample);
  });
  it("does not assign an unattributed conceded goal away from the goalkeeper", () => {
    const m = game("m", [...passes(10), obs("save", "save", { outcome: "complete" })], { goalsAgainst: 1, events: [{ id: "goal", type: "opponent_goal", minute: 10 }] });
    expect(block(seasonRating({ ...player, naturalPosition: "POR" }, [m]), "keeping").score).toBeNull();
    m.analysis!.observations.push(obs("gk", "lineup", { role: "GK", intervalStart: 0, intervalEnd: 3000 }));
    const rating = seasonRating({ ...player, naturalPosition: "POR" }, [m]);
    expect(block(rating, "keeping").score).toBe(50);
    expect(block(rating, "keeping").detail).toContain("1/2");
  });
  it("recognises a certified full-match keeper but never a merely preferred or estimated position", () => {
    const m = game("m", [...passes(10), obs("save", "save")], { goalsAgainst: 1, events: [{ id: "goal", type: "opponent_goal", minute: 10 }] });
    const keeper = { ...player, naturalPosition: "POR" };
    m.ledger!.p.positionsPlayed = { POR: 50 };
    expect(block(seasonRating(keeper, [m]), "keeping").score).toBe(50);
    m.ledger!.p.positionsEstimated = true;
    expect(block(seasonRating(keeper, [m]), "keeping").score).toBeNull();
    delete m.ledger!.p.positionsEstimated;
    m.ledger!.p.positionsPlayed.POR = 25;
    expect(block(seasonRating(keeper, [m]), "keeping").score).toBeNull();
  });
});
