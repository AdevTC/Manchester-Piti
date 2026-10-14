import { describe, expect, it } from "vitest";
import { matchPhase, nextFixture } from "../../../functions/src/matchEngine";
import { transitionClock, readyClock } from "../../../functions/src/matchClock";
import { AWAITING_ACTA, kickoffState, kickoffText, PENDING_WHISTLE, whistleDeadline } from "./kickoff";

const MIN = 60_000;
const DATE = Date.UTC(2026, 10, 8, 11);
// A v2 match as saveMatchSheet stores it: the clock is ready until a scorer presses «Iniciar».
const v2 = { id: "j8", version: 2 as const, status: "scheduled", date: DATE, duration: 50, clock: readyClock() };
const first = transitionClock(v2.clock, "start", DATE + 20 * MIN);
const half = transitionClock(first, "halftime", DATE + 45 * MIN);
const second = transitionClock(half, "second", DATE + 50 * MIN);
const ended = transitionClock(second, "finish", DATE + 75 * MIN);

describe("kickoffState: the clock decides, the date only says when to wait for it", () => {
  it("over a match day: before, at the date, running, halftime, ended", () => {
    expect(kickoffState(v2, DATE - 1)).toBe("scheduled");
    expect(kickoffState(v2, DATE)).toBe("pending_whistle");
    expect(kickoffState(v2, DATE + 19 * MIN)).toBe("pending_whistle");
    expect(kickoffState({ ...v2, clock: first }, DATE + 21 * MIN)).toBe("live");
    expect(kickoffState({ ...v2, clock: half }, DATE + 46 * MIN)).toBe("halftime");
    expect(kickoffState({ ...v2, clock: second }, DATE + 51 * MIN)).toBe("live");
    expect(kickoffState({ ...v2, clock: ended }, DATE + 76 * MIN)).toBe("ended");
  });
  it("a clock nobody starts: pending until date + duration + 2 h, then awaiting the acta", () => {
    const deadline = DATE + 50 * MIN + 120 * MIN;
    expect(whistleDeadline(v2)).toBe(deadline);
    expect(kickoffState(v2, deadline - 1)).toBe("pending_whistle");
    expect(kickoffState(v2, deadline)).toBe("awaiting_result");
    // a running or ended clock is never «awaiting» by the date
    expect(kickoffState({ ...v2, clock: first }, deadline + 1)).toBe("live");
    expect(kickoffState({ ...v2, clock: ended }, deadline + 1)).toBe("ended");
  });
  it("a v2 match stored without a clock waits for the whistle the same way", () => {
    const bare = { version: 2 as const, status: "scheduled", date: DATE, duration: 50 };
    expect(kickoffState(bare, DATE + MIN)).toBe("pending_whistle");
    expect(kickoffState(bare, whistleDeadline(bare))).toBe("awaiting_result");
  });
  it("legacy matches (no clock) still follow the schedule; finished ones are ended", () => {
    const legacy = { status: "scheduled", date: DATE, duration: 50 };
    expect(kickoffState(legacy, DATE - 1)).toBe("scheduled");
    expect(kickoffState(legacy, DATE)).toBe("live");
    expect(kickoffState(legacy, DATE + 60 * MIN)).toBe("ended");
    expect(kickoffState({ ...legacy, liveEndedAt: DATE + 30 * MIN }, DATE + 31 * MIN)).toBe("ended");
    expect(kickoffState({ ...v2, status: "finished" }, DATE + 10 * MIN)).toBe("ended");
    expect(kickoffState({ date: DATE, goalsFor: 2 }, DATE + MIN)).toBe("ended");
  });
  it("cancelled, postponed or undated matches never wait for a whistle", () => {
    expect(kickoffState({ ...v2, status: "cancelled" }, DATE + MIN)).toBe("scheduled");
    expect(kickoffState({ ...v2, status: "postponed" }, DATE + MIN)).toBe("scheduled");
    expect(kickoffState({ ...v2, date: undefined }, DATE + MIN)).toBe("scheduled");
  });
});

describe("matchPhase and nextFixture follow it", () => {
  it("pending is still «scheduled» (and next); awaiting the acta is not next any more", () => {
    const later = { ...v2, id: "j9", date: DATE + 7 * 24 * 60 * MIN };
    expect(matchPhase(v2, DATE + MIN)).toBe("scheduled");
    expect(nextFixture([later, v2], DATE + MIN)?.id).toBe("j8");
    expect(matchPhase(v2, whistleDeadline(v2))).toBe("awaiting_result");
    expect(nextFixture([later, v2], whistleDeadline(v2))?.id).toBe("j9");
  });
  it("running and ended clocks keep their phases", () => {
    expect(matchPhase({ ...v2, clock: first }, DATE + 21 * MIN)).toBe("playing");
    expect(matchPhase({ ...v2, clock: half }, DATE + 46 * MIN)).toBe("playing");
    expect(matchPhase({ ...v2, clock: ended }, DATE + 76 * MIN)).toBe("awaiting_result");
  });
});

describe("the words", () => {
  it("pending and awaiting have one text each; the rest have none", () => {
    expect(PENDING_WHISTLE).toBe("Pendiente del pitido inicial");
    expect(AWAITING_ACTA).toBe("Pendiente del acta");
    expect(kickoffText(v2, DATE + MIN)).toBe(PENDING_WHISTLE);
    expect(kickoffText(v2, whistleDeadline(v2))).toBe(AWAITING_ACTA);
    expect(kickoffText(v2, DATE - 1)).toBeNull();
    expect(kickoffText({ ...v2, clock: first }, DATE + 21 * MIN)).toBeNull();
  });
});
