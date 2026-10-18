import { describe, expect, it } from "vitest";
import { readyClock, transitionClock, type MatchClock } from "../../../functions/src/matchClock";
import type { ClubMatch, MatchEvent } from "../clubData";
import { AFTER_WINDOW_MS, matchdayOf, viewerRoleOf } from "./matchday";

const MIN = 60_000;
const HOUR = 60 * MIN;
const DAY = 24 * HOUR;
// Sunday 18 Oct 2026, 19:00 Madrid (CEST, UTC+2) = 17:00 UTC: the J1 kick-off
const KO = Date.UTC(2026, 9, 18, 17);
const J2 = Date.UTC(2026, 9, 25, 13); // Sunday 25 Oct, 14:00 CET
/** Firestore's Timestamp as the mapper hands it over (seconds + nanoseconds). */
const ts = (ms: number) => ({ seconds: Math.floor(ms / 1000), nanoseconds: 0 });

const started = transitionClock(readyClock(), "start", KO);
const half = transitionClock(started, "halftime", KO + 25 * MIN);
const second = transitionClock(half, "second", KO + 32 * MIN);
const withAdded = transitionClock(second, "added", KO + 55 * MIN, [], 2);
const ended = transitionClock(withAdded, "finish", KO + 59 * MIN);
const WHISTLE = KO + 59 * MIN;

const goal = (id: string, type: MatchEvent["type"], playerId: string | undefined, seconds: number, period: 1 | 2): MatchEvent => ({ id, type, playerId, elapsedSeconds: seconds, period });
const EVENTS: MatchEvent[] = [goal("e1", "goal", "alcides", 5 * 60 + 10, 1), goal("e2", "opponent_goal", undefined, 10 * 60 + 5, 1), goal("e3", "goal", "adrian", 20 * 60 + 30, 1)];

const j1Base: ClubMatch = {
  id: "j1",
  seasonId: "t1",
  version: 2,
  status: "scheduled",
  rival: "Orduña fc",
  date: ts(KO),
  duration: 50,
  home: true,
  venue: "Palomeras",
  clock: readyClock(),
  starters: ["evans", "fer", "illescas", "jordi", "adrian", "eguzquiza", "alcides"],
  bench: ["erik", "kevin", "jorge", "brawan"],
  notCalled: ["josito", "huberoski"],
  events: [],
};
const j2: ClubMatch = { ...j1Base, id: "j2", rival: "Pitutis", date: ts(J2), home: false, venue: "Moratalaz", starters: [], bench: [], notCalled: [] };
const j1 = (clock: MatchClock, extra: Partial<ClubMatch> = {}): ClubMatch => ({ ...j1Base, clock, events: EVENTS, ...extra });
const published = j1(ended, { status: "finished", goalsFor: 3, goalsAgainst: 1, voteClosesAt: WHISTLE + 48 * HOUR, liveEndedAt: WHISTLE });
const other: ClubMatch = { ...j1Base, id: "old", seasonId: "t0", status: "finished", date: ts(KO - 200 * DAY), goalsFor: 1, goalsAgainst: 0 };

describe("matchdayOf, phase by phase", () => {
  it("pretemporada: the season has no fixtures (another season's don't count)", () => {
    expect(matchdayOf([other], "t1", KO)).toEqual({ phase: "pretemporada", match: null, next: null, last: null, kickoff: null, minute: null, added: null, score: null, jornada: null });
  });

  it("semana: days before, counting down to the next one", () => {
    const m = matchdayOf([other, j1Base, j2], "t1", KO - 4 * DAY);
    expect(m).toMatchObject({ phase: "semana", kickoff: KO, jornada: 1, score: null, minute: null, last: null });
    expect(m.match?.id).toBe("j1");
    expect(m.next).toBeNull(); // (next is only another match than `match`)
  });

  it("semana the evening before; antes from 00:00 Madrid on the match's day", () => {
    const midnight = Date.UTC(2026, 9, 17, 22); // 00:00 CEST on the 18th
    expect(matchdayOf([j1Base, j2], "t1", midnight - 1).phase).toBe("semana");
    const m = matchdayOf([j1Base, j2], "t1", midnight);
    expect(m.phase).toBe("antes");
    expect(m.match?.id).toBe("j1");
    expect(matchdayOf([j1Base, j2], "t1", KO - 1).phase).toBe("antes");
  });

  it("pitido: the date has come and the clock is still ready", () => {
    const m = matchdayOf([j1Base, j2], "t1", KO + 3 * MIN);
    expect(m).toMatchObject({ phase: "pitido", score: null, minute: null });
    expect(m.match?.id).toBe("j1");
  });

  it("directo1: first half, the minute shown and the score from the events", () => {
    const m = matchdayOf([j1(started), j2], "t1", KO + 21 * MIN + 10_000);
    expect(m).toMatchObject({ phase: "directo1", minute: 22, added: null, score: { gf: 2, ga: 1 }, jornada: 1 });
    expect(m.next?.id).toBe("j2");
  });

  it("descanso: half-time, the minute reached", () => {
    expect(matchdayOf([j1(half), j2], "t1", KO + 28 * MIN)).toMatchObject({ phase: "descanso", minute: 25, score: { gf: 2, ga: 1 } });
  });

  it("directo2: second half; the added time once la mesa sets it", () => {
    expect(matchdayOf([j1(second), j2], "t1", KO + 40 * MIN)).toMatchObject({ phase: "directo2", minute: 34, added: null });
    expect(matchdayOf([j1(withAdded), j2], "t1", KO + 57 * MIN)).toMatchObject({ phase: "directo2", minute: 51, added: 2 });
  });

  it("a legacy match without a clock: the schedule's half", () => {
    const legacy: ClubMatch = { ...j1Base, version: undefined, clock: undefined, events: EVENTS };
    expect(matchdayOf([legacy], "t1", KO + 10 * MIN).phase).toBe("directo1");
    expect(matchdayOf([legacy], "t1", KO + 40 * MIN).phase).toBe("directo2");
  });

  it("final: whistle gone, acta still to come", () => {
    const m = matchdayOf([j1(ended), j2], "t1", WHISTLE + 3 * MIN);
    expect(m).toMatchObject({ phase: "final", score: { gf: 2, ga: 1 }, minute: null, added: null });
    expect(m.match?.id).toBe("j1");
    expect(m.next?.id).toBe("j2");
  });

  it("final also for a clock nobody started, once its window is over", () => {
    expect(matchdayOf([j1Base, j2], "t1", KO + 50 * MIN + 2 * HOUR + MIN).phase).toBe("final");
  });

  it("an acta forgotten for more than 4 days stops holding the page", () => {
    expect(matchdayOf([j1(ended), j2], "t1", WHISTLE + AFTER_WINDOW_MS + MIN).phase).toBe("semana");
  });

  it("acta: published, MVP vote open — the stored score", () => {
    const m = matchdayOf([published, j2], "t1", WHISTLE + 30 * MIN);
    expect(m).toMatchObject({ phase: "acta", score: { gf: 3, ga: 1 } });
    expect(m.match?.id).toBe("j1");
    expect(m.last?.id).toBe("j1");
    expect(m.next?.id).toBe("j2");
  });

  it("después: the vote closed, up to 4 days after the match; then the week", () => {
    const tuesday = WHISTLE + 48 * HOUR;
    const m = matchdayOf([published, j2], "t1", tuesday);
    expect(m.phase).toBe("despues");
    expect(m.match?.id).toBe("j1");
    expect(m.next?.id).toBe("j2");
    expect(matchdayOf([published, j2], "t1", KO + 4 * DAY).phase).toBe("despues");
    const thursday = matchdayOf([published, j2], "t1", KO + 4 * DAY + MIN);
    expect(thursday.phase).toBe("semana");
    expect(thursday.match?.id).toBe("j2");
    expect(thursday.last?.id).toBe("j1");
    expect(thursday.score).toBeNull();
  });

  it("después also for an acta published without a vote", () => {
    const noVote: ClubMatch = { ...published, voteClosesAt: undefined };
    expect(matchdayOf([noVote, j2], "t1", WHISTLE + HOUR).phase).toBe("despues");
  });

  it("the next match's day wins over an open vote", () => {
    const sameWeek: ClubMatch = { ...j2, date: ts(KO + DAY) };
    expect(matchdayOf([published, sameWeek], "t1", KO + DAY - HOUR).phase).toBe("antes");
  });

  it("aplazado: the nearest fixture is postponed (after the después window)", () => {
    const off: ClubMatch = { ...j2, status: "postponed" };
    const j3: ClubMatch = { ...j2, id: "j3", date: ts(J2 + 7 * DAY), status: "scheduled" };
    const m = matchdayOf([published, off, j3], "t1", KO + 5 * DAY);
    expect(m.phase).toBe("aplazado");
    expect(m.match?.id).toBe("j2");
    expect(m.next?.id).toBe("j3");
    expect(m.score).toBeNull();
  });

  it("aplazado on its own day wins over después; a cancelled one too", () => {
    const off: ClubMatch = { ...j2, date: ts(KO + 2 * DAY + 3 * HOUR), status: "cancelled" };
    // (Tuesday 20:30, the vote closed at 19:59; the cancelled one was at 22:00)
    expect(matchdayOf([published, off], "t1", KO + 2 * DAY + 90 * MIN).phase).toBe("aplazado");
    expect(matchdayOf([published, off], "t1", KO + DAY).phase).toBe("acta");
  });

  it("a postponed match further away than the next scheduled one is not the news", () => {
    const off: ClubMatch = { ...j2, id: "j3", date: ts(J2 + 7 * DAY), status: "postponed" };
    expect(matchdayOf([published, j2, off], "t1", KO + 5 * DAY).phase).toBe("semana");
  });

  it("nothing ahead at the end of the season: semana without a match", () => {
    const m = matchdayOf([published], "t1", KO + 10 * DAY);
    expect(m).toMatchObject({ phase: "semana", match: null, next: null, kickoff: null });
    expect(m.last?.id).toBe("j1");
  });

  it("archived matches are not the club's match day", () => {
    expect(matchdayOf([{ ...j1(started), archived: true }], "t1", KO + 10 * MIN).phase).toBe("pretemporada");
  });
});

describe("viewerRoleOf", () => {
  const seven = j1Base.starters ?? [];
  const ctx = { scorer: false, absentToday: false, seven };
  const member = (playerId: string | null) => ({ member: true, playerId });

  it("a fan is aficionado, whatever else", () => {
    expect(viewerRoleOf(j1Base, { member: false, playerId: null }, { ...ctx, scorer: true })).toBe("aficionado");
  });
  it("anotador first, then ausente", () => {
    expect(viewerRoleOf(j1Base, member("huberoski"), { ...ctx, scorer: true, absentToday: true })).toBe("anotador");
    expect(viewerRoleOf(j1Base, member("jordi"), { ...ctx, absentToday: true })).toBe("ausente");
  });
  it("titular in the seven, suplente in the convocatoria, noconvocado otherwise", () => {
    expect(viewerRoleOf(j1Base, member("jordi"), ctx)).toBe("titular");
    expect(viewerRoleOf(j1Base, member("erik"), ctx)).toBe("suplente");
    expect(viewerRoleOf(j1Base, member("josito"), ctx)).toBe("noconvocado");
  });
  it("the seven decides titular: a convocatoria titular left out of the pizarra's seven is suplente", () => {
    expect(viewerRoleOf(j1Base, member("jordi"), { ...ctx, seven: seven.filter((id) => id !== "jordi").concat("erik") })).toBe("suplente");
    expect(viewerRoleOf(j1Base, member("erik"), { ...ctx, seven: seven.filter((id) => id !== "jordi").concat("erik") })).toBe("titular");
  });
  it("a member without a player file, or without a match, is noconvocado", () => {
    expect(viewerRoleOf(j1Base, member(null), ctx)).toBe("noconvocado");
    expect(viewerRoleOf(null, member("jordi"), ctx)).toBe("noconvocado");
  });
});
