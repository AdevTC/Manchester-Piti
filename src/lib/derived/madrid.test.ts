import { describe, expect, it } from "vitest";
import { isEveningKickoff, madridDate, madridDayAfter, madridDayNumber, tonightWord, TonightWord } from "./madrid";

// 25 Oct 2026 is winter time (UTC+1); 14 Jun 2026 is summer time (UTC+2).
const morning = Date.UTC(2026, 9, 25, 10, 0); // 11:00 Madrid
const evening = Date.UTC(2026, 9, 25, 20, 30); // 21:30 Madrid
const edge = Date.UTC(2026, 5, 14, 14, 0); // 16:00 Madrid

describe("isEveningKickoff / tonightWord", () => {
  it("says «hoy» for a morning kick-off", () => {
    expect(isEveningKickoff(morning)).toBe(false);
    expect(tonightWord(morning)).toBe("hoy");
    expect(TonightWord(morning)).toBe("Hoy");
  });
  it("says «esta noche» for an evening kick-off", () => {
    expect(isEveningKickoff(evening)).toBe(true);
    expect(tonightWord(evening)).toBe("esta noche");
    expect(TonightWord(evening)).toBe("Esta noche");
  });
  it("starts the evening at 16:00 Madrid, in summer time too", () => {
    expect(isEveningKickoff(edge)).toBe(true);
    expect(isEveningKickoff(edge - 60_000)).toBe(false);
  });
  it("reads a Madrid clock", () => {
    expect(tonightWord("11:00")).toBe("hoy");
    expect(tonightWord("21:30")).toBe("esta noche");
  });
  it("falls back to «hoy» without a kick-off", () => {
    expect(tonightWord(null)).toBe("hoy");
    expect(tonightWord(Number.NaN)).toBe("hoy");
    expect(tonightWord("--:--")).toBe("hoy");
  });
});

describe("madridDayNumber / madridDayAfter: calendar days across a change of clocks", () => {
  // 28 Mar 2026, 23:30 Madrid (winter time); the clocks go forward that night, so +24 h is Monday 00:30
  const satNight = Date.UTC(2026, 2, 28, 22, 30);
  // 25 Oct 2026, 00:10 Madrid (summer time); the clocks go back that night, so +24 h is still Sunday 23:10
  const sunEarly = Date.UTC(2026, 9, 24, 22, 10);
  it("counts days by the calendar, not by 24 hours", () => {
    expect(madridDayNumber(Date.UTC(2026, 2, 29, 9)) - madridDayNumber(satNight)).toBe(1);
    expect(madridDayNumber(Date.UTC(2026, 9, 26, 9)) - madridDayNumber(sunEarly)).toBe(1);
  });
  it("lands on the right day n days later", () => {
    expect(madridDate(madridDayAfter(satNight, 1))).toBe("2026-03-29");
    expect(madridDate(madridDayAfter(sunEarly, 1))).toBe("2026-10-26");
    expect(madridDate(madridDayAfter(sunEarly, 0))).toBe("2026-10-25");
  });
});
