import { describe, expect, it } from "vitest";
import { readyClock, transitionClock } from "../../../functions/src/matchClock";
import type { MatchEvent } from "../../../functions/src/matchEngine";
import type { ClubMatch } from "../clubData";
import { FINAL_HOLD_MS, goalMoment, islandOf, voteMatch, whistleAt } from "./island";
// (the match of today, the announcements and the view of every state: island.vista.test.ts)

const MIN = 60_000;
const DATE = Date.UTC(2026, 10, 8, 11);
const base: ClubMatch = { id: "j8", version: 2, status: "scheduled", rival: "MAD SKY", date: DATE, duration: 50, clock: readyClock() };
const started = transitionClock(readyClock(), "start", DATE + 5 * MIN);
const ended = transitionClock(transitionClock(transitionClock(started, "halftime", DATE + 30 * MIN), "second", DATE + 40 * MIN), "finish", DATE + 65 * MIN);
// stamped by the live clock half-way through football minute `minute` (stored minute = whole minutes elapsed)
const ev = (id: string, type: MatchEvent["type"], minute: number, playerId?: string): MatchEvent => ({ id, type, minute: minute - 1, elapsedSeconds: (minute - 1) * 60 + 30, ...(playerId ? { playerId } : {}) }) as MatchEvent;

describe("islandOf", () => {
  it("«previa» just before the date (nothing earlier); pending at the date; live once the clock runs; half-time apart", () => {
    expect(islandOf([base], DATE - 1, false)?.kind).toBe("previa");
    expect(islandOf([base], DATE - 3 * 60 * MIN, false)).toBeNull();
    expect(islandOf([base], DATE, false)?.kind).toBe("pending");
    expect(islandOf([{ ...base, clock: started }], DATE + 10 * MIN, false)?.kind).toBe("live");
    expect(islandOf([{ ...base, clock: transitionClock(started, "halftime", DATE + 30 * MIN) }], DATE + 31 * MIN, false)?.kind).toBe("halftime");
  });

  it("FINAL for exactly FINAL_HOLD_MS after the whistle, then the vote only if open for this viewer", () => {
    const fin: ClubMatch = { ...base, clock: ended };
    const at = DATE + 65 * MIN;
    expect(islandOf([fin], at, false)).toEqual({ kind: "final", match: fin, published: false });
    expect(islandOf([fin], at + FINAL_HOLD_MS - 1, false)?.kind).toBe("final");
    expect(islandOf([fin], at + FINAL_HOLD_MS, false)).toBeNull();
    const voted: ClubMatch = { ...fin, status: "finished", goalsFor: 1, goalsAgainst: 0, voteClosesAt: at + 48 * 60 * MIN };
    expect(islandOf([voted], at + 5 * MIN, true)).toEqual({ kind: "final", match: voted, published: true });
    expect(islandOf([voted], at + FINAL_HOLD_MS, true)).toEqual({ kind: "vote", match: voted });
    expect(islandOf([voted], at + FINAL_HOLD_MS, false)).toBeNull();
    expect(islandOf([voted], at + 48 * 60 * MIN, true)).toBeNull();
  });

  it("just after the whistle: the finished match's FINAL, never another match's open vote — even when the end stamp is a few seconds «ahead» of the island's clock", () => {
    const other: ClubMatch = { ...base, id: "j7", rival: "RP", date: DATE - 7 * 24 * 60 * MIN, status: "finished", goalsFor: 3, goalsAgainst: 0, voteClosesAt: DATE + 24 * 60 * MIN };
    const fin: ClubMatch = { ...base, clock: ended };
    const at = DATE + 65 * MIN;
    expect(islandOf([other, fin], at - 12_000, true)).toEqual({ kind: "final", match: fin, published: false });
    expect(islandOf([other, fin], at + 29 * MIN, true)?.kind).toBe("final");
    // its half hour over and its acta not out yet: the other match's vote (no recent final any more)
    expect(islandOf([other, fin], at + FINAL_HOLD_MS, true)).toEqual({ kind: "vote", match: other });
    // its acta out with the vote open: its own vote before the older one
    const own: ClubMatch = { ...fin, status: "finished", goalsFor: 2, goalsAgainst: 0, voteClosesAt: at + 48 * 60 * MIN };
    expect(islandOf([other, own], at + FINAL_HOLD_MS, true)).toEqual({ kind: "vote", match: own });
  });

  it("a live match comes before a waiting one, a waiting one before a final, the latest final first", () => {
    const live: ClubMatch = { ...base, id: "a", clock: started };
    const waiting: ClubMatch = { ...base, id: "b", date: DATE + 5 * MIN };
    const fin1: ClubMatch = { ...base, id: "c", clock: { ...ended, endedAt: DATE + 20 * MIN } };
    const fin2: ClubMatch = { ...base, id: "d", clock: { ...ended, endedAt: DATE + 25 * MIN } };
    const now = DATE + 30 * MIN;
    expect(islandOf([waiting, fin1, live], now, false)?.match.id).toBe("a");
    expect(islandOf([fin1, waiting], now, false)?.match.id).toBe("b");
    expect(islandOf([fin1, fin2], now, false)?.match.id).toBe("d");
  });

  it("a reopened clock is live again (its old end is gone); a clock never started is no final; called-off matches never show", () => {
    const reopened: ClubMatch = { ...base, clock: transitionClock(ended, "reopen", DATE + 66 * MIN) };
    expect(islandOf([reopened], DATE + 67 * MIN, false)?.kind).toBe("live");
    expect(whistleAt({ clock: readyClock(), liveEndedAt: DATE })).toBeNull();
    expect(islandOf([{ ...base, date: DATE - 5 * 60 * MIN }], DATE, false)).toBeNull();
    expect(islandOf([{ ...base, status: "cancelled", clock: ended }], DATE + 70 * MIN, false)).toBeNull();
  });

  it("legacy matches without a clock: the final starts at liveEndedAt", () => {
    const legacy: ClubMatch = { id: "l", rival: "OLD", date: DATE, duration: 50, liveEndedAt: DATE + 40 * MIN };
    expect(whistleAt(legacy)).toBe(DATE + 40 * MIN);
    expect(islandOf([legacy], DATE + 41 * MIN, false)?.kind).toBe("final");
    expect(islandOf([legacy], DATE + 40 * MIN + FINAL_HOLD_MS, false)).toBeNull();
  });

  it("voteMatch: the latest finished match whose vote is still open", () => {
    const a: ClubMatch = { ...base, id: "a", status: "finished", date: DATE - 7 * 24 * 60 * MIN, voteClosesAt: DATE + MIN };
    const b: ClubMatch = { ...base, id: "b", status: "finished", date: DATE, voteClosesAt: DATE + 60 * MIN };
    const c: ClubMatch = { ...base, id: "c", status: "finished", date: DATE + MIN, voteClosesAt: DATE - 1 };
    expect(voteMatch([a, b, c], DATE)?.id).toBe("b");
    expect(voteMatch([a, c], DATE + 2 * MIN)).toBeUndefined();
  });
});

describe("goalMoment", () => {
  const nameOf = (id: string) => (id === "erik" ? "Erik" : "?");
  const live = (events: MatchEvent[]): ClubMatch => ({ ...base, clock: started, events });

  it("ours: «¡GOL! ERIK 19′ · 2\u2060–\u20601» and its spoken line", () => {
    const m = live([ev("g1", "goal", 3, "erik"), ev("r1", "opponent_goal", 10), ev("g2", "goal", 19, "erik")]);
    expect(goalMoment(m, "g2", nameOf)).toEqual({ ours: true, head: "¡GOL!", rest: "ERIK 19′ · 2\u2060–\u20601", text: "¡GOL! ERIK 19′ · 2\u2060–\u20601", said: "¡Gol del Piti! Erik, minuto 19. Manchester Piti 2, MAD SKY 1." });
  });

  it("theirs: «Gol de MAD SKY · 2\u2060–\u20602» (an own goal of ours too); a rival's own goal is ours", () => {
    const m = live([ev("g1", "goal", 3, "erik"), ev("g2", "goal", 5, "erik"), ev("r1", "opponent_goal", 10), ev("r2", "own_goal", 12, "erik")]);
    expect(goalMoment(m, "r2", nameOf)).toMatchObject({ ours: false, head: null, text: "Gol de MAD SKY · 2\u2060–\u20602" });
    expect(goalMoment(live([ev("o1", "opponent_own_goal", 7)]), "o1", nameOf)?.text).toBe("¡GOL! AUTOGOL DE MAD SKY 7′ · 1\u2060–\u20600");
    expect(goalMoment(live([ev("g1", "goal", 7)]), "g1", nameOf)?.text).toBe("¡GOL! EL PITI 7′ · 1\u2060–\u20600");
  });

  it("football's minute: a goal 7 s after kick-off is the 1′ (stored minute 0); a minute typed in the acta stays as typed", () => {
    const mario = (id: string) => (id === "mario" ? "Mario" : "?");
    const early = { id: "g1", type: "goal", minute: 0, elapsedSeconds: 7, playerId: "mario" } as MatchEvent;
    expect(goalMoment(live([early]), "g1", mario)?.text).toBe("¡GOL! MARIO 1′ · 1\u2060–\u20600");
    const typed = { id: "g1", type: "goal", minute: 19, playerId: "mario" } as MatchEvent;
    expect(goalMoment(live([typed]), "g1", mario)?.text).toBe("¡GOL! MARIO 19′ · 1\u2060–\u20600");
  });

  it("a goal that is gone (undone) or an event that isn't a goal: nothing", () => {
    expect(goalMoment(live([]), "g1", nameOf)).toBeNull();
    expect(goalMoment(live([ev("y1", "yellow_card", 4, "erik")]), "y1", nameOf)).toBeNull();
  });
});

