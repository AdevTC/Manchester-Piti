import { describe, expect, it } from "vitest";
import { calculateLedger, matchPhase, nextFixture, type MatchEvent } from "../../functions/src/matchEngine";
import { liveProblem, liveSequenceProblem } from "../../functions/src/liveLogic";
import { matchSnapshot, chapters, playerLine } from "./ficha";
import { scoreOf } from "./partidos";
import { seasonPulse, narrative } from "./home";

const MIN = 60_000;
const date = Date.UTC(2026, 9, 13, 12, 0, 17);
const roster = { starters: ["a", "b", "c", "d", "e", "f", "g"], bench: ["h", "i"], notCalled: ["j"] };
const match = { id: "live", seasonId: "s", date, duration: 60, status: "scheduled" as const, ...roster, events: [] as MatchEvent[] };
const ev = (type: MatchEvent["type"], minute: number, playerId?: string, extra: Partial<MatchEvent> = {}): MatchEvent => ({ id: `${type}-${minute}-${playerId}`, type, minute, ...(playerId ? { playerId } : {}), ...extra });

describe("one live match across home, pitch and backend", () => {
  it("counts event goals on home, including undo and a stale saved score", () => {
    const m = { ...match, goalsFor: 9, goalsAgainst: 9, events: [ev("goal", 5, "a"), ev("opponent_goal", 7)] };
    const p = seasonPulse([m], "s", date + 10 * MIN);
    expect(scoreOf(m)).toEqual({ gf: 1, ga: 1 });
    expect(narrative(p, { seasonName: "Liga", squadSize: 10, now: date + 10 * MIN, nameOf: (id) => id }).head).toContain("1\u2060–\u20601");
    expect(scoreOf({ ...m, events: m.events.slice(0, 1) })).toEqual({ gf: 1, ga: 0 });
    expect(scoreOf({ ...m, status: "finished" })).toEqual({ gf: 9, ga: 9 });
  });
  it("transitions at exact kickoff/end and after a shared whistle, then selects the next match", () => {
    const next = { ...match, id: "next", date: date + 7 * 86400_000 };
    expect(matchPhase(match, date - 1)).toBe("scheduled");
    expect(matchPhase(match, date)).toBe("playing");
    expect(nextFixture([next, match], date + 60 * MIN)).toEqual(next);
    expect(nextFixture([next, { ...match, liveEndedAt: date + 48 * MIN }], date + 49 * MIN)).toEqual(next);
    expect(matchPhase({ ...match, duration: 90 }, date + 70 * MIN)).toBe("playing");
    expect(matchPhase({ ...match, duration: 50 }, date + 59 * MIN)).toBe("playing");
  });
  it("handles reentries, same-minute actions, a dismissal, and the exact team minute total", () => {
    const events = [ev("substitution", 20, "a", { inPlayerId: "h" }), ev("goal", 20, "h", { assistPlayerId: "b" }), ev("substitution", 40, "h", { inPlayerId: "a" }), ev("red_card", 45, "c")];
    const ledger = calculateLedger({ ...match, events });
    expect(ledger.errors).toEqual([]);
    expect(ledger.players.a.minutes).toBe(40);
    expect(ledger.players.h.minutes).toBe(20);
    expect(ledger.players.c.minutes).toBe(45);
    expect(Object.values(ledger.players).reduce((n, p) => n + p.minutes, 0)).toBe(405);
    expect(ledger.field).toEqual(["a", "b", null, "d", "e", "f", "g"]);
    const at25 = matchSnapshot({ ...match, events: events.slice(0, 2) }, date + 25 * MIN);
    expect(at25.field[0]).toBe("h");
    expect(at25.players.a.minutes).toBe(20);
    expect(at25.players.h.minutes).toBe(5);
    expect(playerLine("h", at25.players, events)).toMatchObject({ goals: 1, minutes: 5 });
  });
  it("supports zero-minute substitutions, a bench red, and a substitute entering at the end", () => {
    const events = [ev("substitution", 0, "a", { inPlayerId: "h" }), ev("red_card", 10, "a"), ev("substitution", 60, "h", { inPlayerId: "i" })];
    const r = calculateLedger({ ...match, events });
    expect(r.errors).toEqual([]);
    expect([r.players.a.minutes, r.players.h.minutes, r.players.i.minutes]).toEqual([0, 60, 0]);
    expect(Object.values(r.players).reduce((n, p) => n + p.minutes, 0)).toBe(420);
  });
  it("accepts both teams' chances/corners without changing goals or minutes", () => {
    const events = [ev("chance", 5, "a"), ev("chance", 6), ev("corner", 8, "b"), ev("opponent_chance", 9), ev("opponent_corner", 11)];
    for (const e of events) expect(liveProblem(match, e as MatchEvent & { minute: number }, date + 20 * MIN)).toBeNull();
    expect(liveSequenceProblem(match, events)).toBeNull();
    const r = calculateLedger({ ...match, events });
    expect(r.errors).toEqual([]);
    expect(r.players.a.chances).toBe(1);
    expect(r.players.b.corners).toBe(1);
    expect(r.goalsFor + r.goalsAgainst).toBe(0);
    expect(chapters(events, (id) => id, "Rival")).toHaveLength(5);
    expect(chapters(events, (id) => id, "Rival").at(-1)).toMatchObject({ side: "them", title: "Córner para Rival" });
  });
  it("rejects impossible live actions before they can corrupt participation", () => {
    expect(liveSequenceProblem(match, [ev("goal", 2, "h")])).toMatch(/campo/);
    expect(liveSequenceProblem(match, [ev("substitution", 4, "a", { inPlayerId: "b" })])).toMatch(/cambio/);
    expect(liveSequenceProblem(match, [ev("red_card", 2, "h"), ev("substitution", 4, "a", { inPlayerId: "h" })])).toMatch(/cambio/);
    expect(liveSequenceProblem(match, [ev("yellow_card", 2, "a"), ev("yellow_card", 4, "a")])).toMatch(/segunda amarilla/);
    expect(liveSequenceProblem(match, [ev("chance", 4, "j")])).toMatch(/convocado/);
    expect(liveSequenceProblem(match, [ev("goal", 4)])).toBeNull();
    expect(calculateLedger({ ...match, events: [ev("goal", 4)] }).errors).not.toEqual([]);
  });
});
