import { describe, expect, it } from "vitest";
import { capital, endSentence, homeFirst, plural, pluralWord, SCORE_DASH, scoreText } from "./words";
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
  it("ends a sentence with one full stop, even after «T.C.» or «F.C.»", () => {
    expect(endSentence("Marcaron Alcides y Adrián T.C.")).toBe("Marcaron Alcides y Adrián T.C.");
    expect(endSentence("Contra Entrepibas F.C.")).toBe("Contra Entrepibas F.C.");
    expect(endSentence("Contra Pitutis")).toBe("Contra Pitutis.");
    expect(endSentence("¿Vas hoy?")).toBe("¿Vas hoy?");
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

describe("homeFirst", () => {
  it("the home side on the left: away we go right; no flag counts as at home", () => {
    expect(homeFirst(true, "us", "them")).toEqual(["us", "them"]);
    expect(homeFirst(undefined, "us", "them")).toEqual(["us", "them"]);
    expect(homeFirst(null, "us", "them")).toEqual(["us", "them"]);
    expect(homeFirst(false, "us", "them")).toEqual(["them", "us"]);
  });
});

describe("scoreText", () => {
  it("glues a score into one word: an en dash between word joiners, so «1–8» never breaks across lines", () => {
    expect(SCORE_DASH).toBe("\u2060–\u2060");
    expect(scoreText(1, 8)).toBe("1\u2060–\u20608");
    expect(scoreText("10", 0)).toBe("10\u2060–\u20600");
    // (what a reader sees and copies: the plain «1–8»)
    expect(scoreText(1, 8).replace(/\u2060/g, "")).toBe("1–8");
    // (no break opportunity around the dash: every character next to it is a word joiner)
    expect(/\d\u2060–\u2060\d/.test(`Perdemos ${scoreText(1, 8)} el estreno`)).toBe(true);
  });
});
