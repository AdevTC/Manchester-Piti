// Characterisation: the scoreboard bits the Partidos board, the match page's hero and the live island each
// worked out on their own before sharing this module (bloque 5, D3): the two teams and the score, the
// live minute and its bar, and the last-event line.
import { describe, expect, it } from "vitest";
import { readyClock, transitionClock } from "../../../functions/src/matchClock";
import type { MatchEvent } from "../../../functions/src/matchEngine";
import type { ClubMatch } from "../clubData";
import { boardLastLine, eventLine, goalBurstWho, livePlay, progressPct, scoreboardOf, type LastEvent } from "./scoreboard";

const MIN = 60_000;
const T0 = Date.UTC(2026, 10, 8, 11);
const base: ClubMatch = { id: "j8", version: 2, status: "scheduled", rival: "MAD SKY", date: T0, duration: 50 };
const ev = (id: string, type: MatchEvent["type"], minute: number, playerId?: string): MatchEvent => ({ id, type, minute, ...(playerId ? { playerId } : {}) }) as MatchEvent;
const names: Record<string, string> = { p1: "Erik", p2: "Rodri" };
const nameOf = (id: string) => names[id] ?? id;

describe("scoreboardOf", () => {
  it("the rival, its initials, the sides and the score (a home match)", () => {
    expect(scoreboardOf({ ...base, home: true, status: "finished", goalsFor: 3, goalsAgainst: 1 })).toEqual({ rival: "MAD SKY", initials: "MS", gf: 3, ga: 1, usSide: "Local", rivalSide: "Visitante" });
  });
  it("away: we are the visitors", () => {
    const s = scoreboardOf({ ...base, home: false });
    expect([s.usSide, s.rivalSide]).toEqual(["Visitante", "Local"]);
  });
  it("no home flag reads as home", () => {
    const s = scoreboardOf(base);
    expect([s.usSide, s.rivalSide]).toEqual(["Local", "Visitante"]);
  });
  it("«Rival» when the match names none; the match's own initials win", () => {
    expect(scoreboardOf({ ...base, rival: undefined })).toMatchObject({ rival: "Rival", initials: "RI" });
    expect(scoreboardOf({ ...base, rivalInitials: "SKY" }).initials).toBe("SKY");
  });
  it("while live the score is counted from the events", () => {
    const m = { ...base, events: [ev("a", "goal", 3, "p1"), ev("b", "opponent_goal", 9), ev("c", "opponent_own_goal", 12)] };
    expect(scoreboardOf(m)).toMatchObject({ gf: 2, ga: 1 });
  });
});

describe("progressPct", () => {
  it("the minute over the duration (50 when unknown), capped at 100", () => {
    expect(progressPct(25, 50)).toBe(50);
    expect(progressPct(10, undefined)).toBe(20);
    expect(progressPct(null, 50)).toBe(0);
    expect(progressPct(60, 50)).toBe(100);
    expect(progressPct(7, 60)).toBeCloseTo((7 / 60) * 100);
  });
});

describe("livePlay", () => {
  it("a match without a clock: the schedule's minute, its bar and the last event", () => {
    const m = { ...base, events: [ev("a", "goal", 3, "p1"), ev("b", "yellow_card", 11, "p2"), ev("x", "assist", 15, "p2")] };
    expect(livePlay(m, T0 + 19 * MIN + 30_000, nameOf)).toEqual({ minute: 20, progress: 40, last: { minute: 11, who: "Rodri", label: "Amarilla", goal: false } });
  });
  it("a match with a clock: the clock's minute of play", () => {
    const clock = transitionClock(readyClock(), "start", T0 + 5 * MIN);
    const play = livePlay({ ...base, clock }, T0 + 5 * MIN + 30_000, nameOf);
    expect(play).toMatchObject({ minute: 1, last: null });
    expect(play.progress).toBe(2);
  });
  it("a ready clock: no minute yet", () => {
    expect(livePlay({ ...base, clock: readyClock() }, T0 + MIN, nameOf)).toEqual({ minute: null, progress: 0, last: null });
  });
  it("the rival's events are the rival's", () => {
    const m = { ...base, events: [ev("b", "opponent_goal", 9)] };
    expect(livePlay(m, T0 + 10 * MIN, nameOf).last).toEqual({ minute: 9, who: "MAD SKY", label: "Gol rival", goal: false });
  });
});

describe("the last-event line", () => {
  const goal: LastEvent = { minute: 19, who: "Erik", label: "Gol", goal: true };
  const card: LastEvent = { minute: 11, who: "Rodri", label: "Amarilla", goal: false };
  it("who and what", () => {
    expect(eventLine(goal)).toBe("Erik · Gol");
  });
  it("the board's line: the event's minute and line, or the minute and «Arranca el partido»", () => {
    expect(boardLastLine({ minute: 20, last: card })).toEqual({ at: "11′", text: "Rodri · Amarilla" });
    expect(boardLastLine({ minute: 2, last: null })).toEqual({ at: "2′", text: "Arranca el partido" });
    // (as the boards always printed it: a live board has a minute, so this never shows)
    expect(boardLastLine({ minute: null, last: null })).toEqual({ at: "null′", text: "Arranca el partido" });
  });
  it("the ¡GOL! burst names our scorer and the minute, nothing else", () => {
    expect(goalBurstWho(goal)).toBe("Erik · 19′");
    expect(goalBurstWho(card)).toBeUndefined();
    expect(goalBurstWho(null)).toBeUndefined();
  });
});
