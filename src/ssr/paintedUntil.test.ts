import { describe, expect, it } from "vitest";
import { NEAR_A_MATCH_MS, nextMadridMidnight, paintedUntil } from "./paintedUntil";

const H = 3_600_000;

describe("until when a server-rendered page can be shown as it was painted", () => {
  it("finds Madrid's next midnight, in winter and in summer", () => {
    // 2026-11-06 15:20 Madrid (UTC+1) → 2026-11-07 00:00 Madrid = 2026-11-06T23:00Z
    expect(nextMadridMidnight(Date.parse("2026-11-06T14:20:00Z"))).toBe(Date.parse("2026-11-06T23:00:00Z"));
    // 2026-07-01 23:59:30 Madrid (UTC+2) → 2026-07-01T22:00Z
    expect(nextMadridMidnight(Date.parse("2026-07-01T21:59:30Z"))).toBe(Date.parse("2026-07-01T22:00:00Z"));
    // exactly at midnight: the next one
    expect(nextMadridMidnight(Date.parse("2026-11-06T23:00:00Z"))).toBe(Date.parse("2026-11-07T23:00:00Z"));
    // the night the clocks go back (2026-10-25: 25 h long)
    expect(nextMadridMidnight(Date.parse("2026-10-24T22:30:00Z"))).toBe(Date.parse("2026-10-25T23:00:00Z"));
  });

  it("with no match around, the page is good until the end of its day", () => {
    const at = Date.parse("2026-11-04T09:00:00Z");
    const matches = [{ date: Date.parse("2026-11-01T18:00:00Z") }, { date: Date.parse("2026-11-08T20:00:00Z") }, { date: undefined }];
    expect(paintedUntil(matches, at)).toBe(Date.parse("2026-11-04T23:00:00Z"));
  });

  it("on a match day (or just after one) only six minutes, as the pages always were", () => {
    const at = Date.parse("2026-11-08T08:00:00Z");
    // the match tonight
    expect(paintedUntil([{ date: Date.parse("2026-11-08T20:00:00Z") }], at)).toBe(at + NEAR_A_MATCH_MS);
    // a match a few hours ago (pendiente del acta, tras el partido)
    expect(paintedUntil([{ date: { seconds: (at - 3 * H) / 1000 } }], at)).toBe(at + NEAR_A_MATCH_MS);
    // a match early tomorrow is still around the painted day
    expect(paintedUntil([{ date: Date.parse("2026-11-09T03:00:00Z") }], at)).toBe(at + NEAR_A_MATCH_MS);
    // one the day after tomorrow is not
    expect(paintedUntil([{ date: Date.parse("2026-11-10T20:00:00Z") }], at)).toBe(Date.parse("2026-11-08T23:00:00Z"));
  });

  it("never beyond the day's end, even near a match", () => {
    const at = Date.parse("2026-11-08T22:58:00Z");
    expect(paintedUntil([{ date: Date.parse("2026-11-08T20:00:00Z") }], at)).toBe(Date.parse("2026-11-08T23:00:00Z"));
  });
});
