// «Pausar» (functions/src/pushPauseLogic.ts): what sendTo skips, what pushSetPause keeps, and when «mañana» and
// «después del partido» are.
import { describe, expect, it } from "vitest";
import { clampPause, isPaused, matchEndAt, MAX_PAUSE_MS, tomorrowAtNine } from "../../functions/src/pushPauseLogic";

const NOW = Date.UTC(2026, 9, 22, 12); // Thursday 22 Oct 2026, 14:00 in Madrid (CEST)

describe("isPaused (sendTo's filter)", () => {
  it("only a time still ahead silences the device", () => {
    expect(isPaused(NOW + 1, NOW)).toBe(true);
    expect(isPaused(NOW, NOW)).toBe(false);
    expect(isPaused(NOW - 60_000, NOW)).toBe(false);
    expect(isPaused(undefined, NOW)).toBe(false);
    expect(isPaused(null, NOW)).toBe(false);
    expect(isPaused(String(NOW + 60_000), NOW)).toBe(false);
    expect(isPaused(Number.NaN, NOW)).toBe(false);
  });
});

describe("clampPause (pushSetPause)", () => {
  it("null resumes; a time in (now, now + a week] stays", () => {
    expect(clampPause(null, NOW)).toEqual({ ok: true, until: null });
    expect(clampPause(NOW + 3600_000, NOW)).toEqual({ ok: true, until: NOW + 3600_000 });
    expect(clampPause(NOW + MAX_PAUSE_MS, NOW)).toEqual({ ok: true, until: NOW + MAX_PAUSE_MS });
  });
  it("a clock a little ahead is clamped to the week; the past or further is refused", () => {
    expect(clampPause(NOW + MAX_PAUSE_MS + 5 * 60_000, NOW)).toEqual({ ok: true, until: NOW + MAX_PAUSE_MS });
    expect(clampPause(NOW, NOW).ok).toBe(false);
    expect(clampPause(NOW - 1, NOW).ok).toBe(false);
    expect(clampPause(NOW + 2 * MAX_PAUSE_MS, NOW).ok).toBe(false);
    expect(clampPause(Number.NaN, NOW).ok).toBe(false);
  });
});

describe("tomorrowAtNine («Hasta mañana»)", () => {
  it("9:00 in Madrid the next day", () => {
    expect(tomorrowAtNine(NOW)).toBe(Date.UTC(2026, 9, 23, 7));
  });
  it("in the small hours, the coming 9:00", () => {
    expect(tomorrowAtNine(Date.UTC(2026, 9, 22, 1))).toBe(Date.UTC(2026, 9, 22, 7)); // 3:00 in Madrid
  });
  it("across the change of hour (25 Oct 2026: CEST → CET)", () => {
    expect(tomorrowAtNine(Date.UTC(2026, 9, 24, 20))).toBe(Date.UTC(2026, 9, 25, 8));
  });
});

describe("matchEndAt («Hasta después del partido»)", () => {
  it("kick-off, the acta's minutes, the descanso and the time added", () => {
    expect(matchEndAt(NOW)).toBe(NOW + 65 * 60_000);
    expect(matchEndAt(NOW, 60)).toBe(NOW + 75 * 60_000);
    expect(matchEndAt(NOW, 0)).toBe(NOW + 65 * 60_000);
  });
});
