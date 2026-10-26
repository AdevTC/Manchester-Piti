import { describe, expect, it } from "vitest";
import { isEveningKickoff, tonightWord, TonightWord } from "./madrid";

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
