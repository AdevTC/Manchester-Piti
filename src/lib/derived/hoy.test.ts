import { describe, expect, it } from "vitest";
import { readyClock, transitionClock } from "../../../functions/src/matchClock";
import type { ClubMatch } from "../clubData";
import { hoyMatch, hoyModel, inHoyWindow, madridDay } from "./hoy";

const MIN = 60_000;
const HOUR = 60 * MIN;
// Sunday 8 Nov 2026, 12:00 Madrid (UTC+1): 11:00 UTC
const DATE = Date.UTC(2026, 10, 8, 11);
const MIDNIGHT = Date.UTC(2026, 10, 7, 23); // 00:00 Madrid on the 8th
const member = { member: true, playerId: "adri" };
const fan = { member: false, playerId: null };

const base: ClubMatch = { id: "j8", seasonId: "t1", version: 2, status: "scheduled", rival: "MAD SKY", date: DATE, duration: 50, clock: readyClock(), starters: [], bench: [] };
const started = transitionClock(readyClock(), "start", DATE + 5 * MIN);
const half = transitionClock(started, "halftime", DATE + 30 * MIN);
const second = transitionClock(half, "second", DATE + 40 * MIN);
const ended = transitionClock(second, "finish", DATE + 65 * MIN);
const WHISTLE = DATE + 65 * MIN;
const published: ClubMatch = { ...base, clock: ended, status: "finished", goalsFor: 2, goalsAgainst: 1, voteClosesAt: WHISTLE + 48 * HOUR };

describe("madridDay", () => {
  it("the Madrid calendar date, not the UTC one", () => {
    expect(madridDay(MIDNIGHT)).toBe("2026-11-08");
    expect(madridDay(MIDNIGHT - 1)).toBe("2026-11-07");
  });
});

describe("hoyModel across the match day", () => {
  it("nothing the day before; from 00:00 Madrid on the match's date, before kick-off with the convocatoria open", () => {
    expect(hoyModel([base], member, MIDNIGHT - 1)).toBeNull();
    const m = hoyModel([base], member, MIDNIGHT);
    expect(m).toMatchObject({ match: base, phase: "scheduled", stage: "before", rsvpOpen: true, published: false, voteOpen: false });
  });

  it("before kick-off, the morning of the match", () => {
    expect(hoyModel([base], member, DATE - 2 * HOUR)).toMatchObject({ phase: "scheduled", stage: "before", rsvpOpen: true });
  });

  it("the date has come and nobody started the clock: pending whistle, still «before», the convocatoria closed", () => {
    expect(hoyModel([base], member, DATE + 3 * MIN)).toMatchObject({ phase: "pending_whistle", stage: "before", rsvpOpen: false });
  });

  it("live, then half-time", () => {
    expect(hoyModel([{ ...base, clock: started }], member, DATE + 10 * MIN)).toMatchObject({ phase: "live", stage: "live" });
    expect(hoyModel([{ ...base, clock: half }], member, DATE + 32 * MIN)).toMatchObject({ phase: "halftime", stage: "live" });
  });

  it("ended, acta pending: after the whistle until the end of the day (no vote yet)", () => {
    const fin: ClubMatch = { ...base, clock: ended };
    expect(hoyModel([fin], member, WHISTLE + MIN)).toMatchObject({ phase: "ended", stage: "after", published: false, voteOpen: false });
    expect(hoyModel([fin], member, MIDNIGHT + 24 * HOUR - 1)?.stage).toBe("after");
    expect(hoyModel([fin], member, MIDNIGHT + 24 * HOUR)).toBeNull();
  });

  it("a clock nobody started, past its window: «Pendiente del acta» (after), until the end of the day", () => {
    const at = DATE + 50 * MIN + 2 * HOUR + MIN;
    expect(hoyModel([base], member, at)).toMatchObject({ phase: "awaiting_result", stage: "after" });
    expect(hoyModel([base], member, MIDNIGHT + 24 * HOUR)).toBeNull();
  });

  it("the acta published with the vote open: after, with the vote — the next day too, until it closes", () => {
    expect(hoyModel([published], member, WHISTLE + 2 * HOUR)).toMatchObject({ phase: "ended", stage: "after", published: true, voteOpen: true });
    expect(hoyModel([published], member, MIDNIGHT + 30 * HOUR)?.voteOpen).toBe(true);
  });

  it("the vote closed: null", () => {
    expect(hoyModel([published], member, published.voteClosesAt!)).toBeNull();
    expect(hoyModel([{ ...published, voteClosesAt: WHISTLE + HOUR }], member, WHISTLE + HOUR)).toBeNull();
  });

  it("a fan gets null, whatever the moment", () => {
    for (const now of [MIDNIGHT, DATE + 3 * MIN, WHISTLE + 2 * HOUR]) expect(hoyModel([published, base], fan, now)).toBeNull();
    expect(hoyModel([{ ...base, clock: started }], fan, DATE + 10 * MIN)).toBeNull();
  });

  it("a member without a linked ficha still gets the card (no «Sales de titular»)", () => {
    expect(hoyModel([{ ...base, starters: ["adri"] }], { member: true, playerId: null }, DATE - HOUR)).toMatchObject({ stage: "before", starter: null });
  });

  it("called off or postponed: no card", () => {
    expect(hoyModel([{ ...base, status: "cancelled" }], member, DATE - HOUR)).toBeNull();
    expect(hoyModel([{ ...base, status: "postponed" }], member, DATE - HOUR)).toBeNull();
  });
});

describe("two matches the same day", () => {
  const morning: ClubMatch = { ...base, id: "a", date: Date.UTC(2026, 10, 8, 9) };
  const evening: ClubMatch = { ...base, id: "b", date: Date.UTC(2026, 10, 8, 17) };
  const aStart = transitionClock(readyClock(), "start", Date.UTC(2026, 10, 8, 9, 2));
  const aEnd = transitionClock(transitionClock(transitionClock(aStart, "halftime", Date.UTC(2026, 10, 8, 9, 27)), "second", Date.UTC(2026, 10, 8, 9, 35)), "finish", Date.UTC(2026, 10, 8, 10, 0));

  it("the next one not yet ended, whatever the list's order; once both ended, the latest", () => {
    expect(hoyMatch([evening, morning], MIDNIGHT)?.id).toBe("a");
    expect(hoyMatch([evening, { ...morning, clock: aStart }], Date.UTC(2026, 10, 8, 9, 10))?.id).toBe("a");
    expect(hoyMatch([evening, { ...morning, clock: aEnd }], Date.UTC(2026, 10, 8, 10, 5))?.id).toBe("b");
    const bEnd = transitionClock(transitionClock(transitionClock(transitionClock(readyClock(), "start", Date.UTC(2026, 10, 8, 17, 1)), "halftime", Date.UTC(2026, 10, 8, 17, 26)), "second", Date.UTC(2026, 10, 8, 17, 30)), "finish", Date.UTC(2026, 10, 8, 17, 55));
    expect(hoyMatch([{ ...evening, clock: bEnd }, { ...morning, clock: aEnd }], Date.UTC(2026, 10, 8, 18))?.id).toBe("b");
  });

  it("today's match before last week's open vote", () => {
    const lastWeek: ClubMatch = { ...published, id: "j7", date: DATE - 7 * 24 * HOUR, voteClosesAt: DATE + 24 * HOUR };
    expect(hoyMatch([lastWeek, base], DATE - HOUR)?.id).toBe("j8");
    // (the day before, the old vote still open: that is the card)
    expect(hoyMatch([lastWeek, base], MIDNIGHT - HOUR)?.id).toBe("j7");
  });
});

describe("a kick-off at 23:30 Madrid", () => {
  // Sunday 8 Nov, 23:30 Madrid = 22:30 UTC: the UTC date is the same, the next morning's isn't
  const LATE = Date.UTC(2026, 10, 8, 22, 30);
  const late: ClubMatch = { ...base, id: "late", date: LATE };
  const lStart = transitionClock(readyClock(), "start", LATE + 2 * MIN);
  const lEnd = transitionClock(transitionClock(transitionClock(lStart, "halftime", LATE + 27 * MIN), "second", LATE + 32 * MIN), "finish", LATE + 58 * MIN);

  it("its own Madrid day from 00:00 (22:59 UTC the day before is still the 7th)", () => {
    expect(inHoyWindow(late, MIDNIGHT - MIN)).toBe(false);
    expect(inHoyWindow(late, MIDNIGHT)).toBe(true);
  });

  it("live past midnight, and after the whistle until the end of the day it ended", () => {
    expect(hoyModel([{ ...late, clock: lStart }], member, LATE + 40 * MIN)).toMatchObject({ stage: "live" });
    const fin = { ...late, clock: lEnd };
    expect(madridDay(LATE + 58 * MIN)).toBe("2026-11-09");
    expect(hoyModel([fin], member, Date.UTC(2026, 10, 9, 12))?.stage).toBe("after");
    expect(hoyModel([fin], member, Date.UTC(2026, 10, 9, 23))).toBeNull(); // 00:00 Madrid on the 10th
  });
});

describe("the October DST change", () => {
  // Sunday 25 Oct 2026: clocks go back at 03:00. 00:00 Madrid is still UTC+2 (22:00 UTC on the 24th);
  // the 10:00 kick-off is UTC+1 (09:00 UTC).
  const dst: ClubMatch = { ...base, id: "dst", date: Date.UTC(2026, 9, 25, 9) };
  it("the window opens at 00:00 Madrid", () => {
    expect(inHoyWindow(dst, Date.UTC(2026, 9, 24, 21, 59))).toBe(false);
    expect(inHoyWindow(dst, Date.UTC(2026, 9, 24, 22))).toBe(true);
  });
  it("and closes at the end of that day (UTC+1 by then: 23:00 UTC)", () => {
    expect(inHoyWindow(dst, Date.UTC(2026, 9, 25, 22, 59))).toBe(true); // awaiting its acta
    expect(inHoyWindow(dst, Date.UTC(2026, 9, 25, 23))).toBe(false);
  });
});

describe("«Sales de titular»", () => {
  const conv: ClubMatch = { ...base, starters: ["adri", "b", "c"], bench: ["d"] };

  it("the official seven's slot code for this match", () => {
    const m = hoyModel([conv], member, DATE - HOUR, { board: { seven: ["x", "adri"], codes: { adri: "DFC" } }, player: { positions: { main: "MC", also: [] } } });
    expect(m?.seven).toEqual({ field: ["x", "adri"], official: true });
    expect(m?.starter).toBe("Sales de titular · DFC");
  });

  it("no official board: the convocatoria's titulares and his preferred position", () => {
    const m = hoyModel([conv], member, DATE - HOUR, { player: { positions: { main: "MC", also: [] } } });
    expect(m?.seven).toEqual({ field: ["adri", "b", "c"], official: false });
    expect(m?.starter).toBe("Sales de titular · MC");
  });

  it("an official board without his code falls back to the preferred one; nothing known: no code", () => {
    expect(hoyModel([conv], member, DATE - HOUR, { board: { seven: ["adri"], codes: {} }, player: { naturalPosition: "Pivote" } })?.starter).toBe("Sales de titular · MCD");
    expect(hoyModel([conv], member, DATE - HOUR)?.starter).toBe("Sales de titular");
  });

  it("on the bench, or out of the official seven: no line", () => {
    expect(hoyModel([conv], { member: true, playerId: "d" }, DATE - HOUR)?.starter).toBeNull();
    expect(hoyModel([conv], member, DATE - HOUR, { board: { seven: ["b", "c"] } })?.starter).toBeNull();
  });

  it("still said while waiting for the whistle; gone once the ball rolls", () => {
    expect(hoyModel([conv], member, DATE + 3 * MIN)?.starter).toBe("Sales de titular");
    expect(hoyModel([{ ...conv, clock: started }], member, DATE + 10 * MIN)?.starter).toBeNull();
  });
});
