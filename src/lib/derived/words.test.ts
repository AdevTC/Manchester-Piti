import { describe, expect, it } from "vitest";
import { capital, plural, pluralWord } from "./words";
import { madridDay, madridDayParts, madridTime } from "./madrid";

describe("words", () => {
  it("counts with the right word", () => {
    expect(plural(1, "partido")).toBe("1 partido");
    expect(plural(0, "partido")).toBe("0 partidos");
    expect(plural(3, "gol", "goles")).toBe("3 goles");
    expect(pluralWord(1, "vez", "veces")).toBe("vez");
    expect(pluralWord(2, "vez", "veces")).toBe("veces");
  });
  it("capitalises the first letter only", () => {
    expect(capital("domingo, 8 nov")).toBe("Domingo, 8 nov");
    expect(capital("ñu")).toBe("Ñu");
    expect(capital("")).toBe("");
  });
});

describe("madrid day and time", () => {
  // 2026-09-30 22:30 UTC is already 1 October in Madrid (CEST, +2)
  const lateSept = Date.UTC(2026, 8, 30, 22, 30);
  it("prints the Madrid calendar day", () => {
    expect(madridDayParts(lateSept)).toEqual({ day: "1", month: "oct" });
    expect(madridDay(lateSept)).toBe("1 oct");
    expect(madridDay(Date.UTC(2026, 8, 12, 10))).toBe("12 sept");
  });
  it("prints the clock in 24 h", () => {
    expect(madridTime(lateSept)).toBe("00:30");
    expect(madridTime(Date.UTC(2026, 10, 8, 11))).toBe("12:00");
  });
});
