import { describe, expect, it } from "vitest";
import type { ClubMatch } from "../clubData";
import { resultOf as partidosResult } from "../partidos";
import { resultOf as homeResult } from "../home";
import { resultLetter as adminLetter, resultWord as adminWord } from "../../pages/admin/kit/result";
import { matchBand, type CalMatch } from "../../pages/pizarra/v2/boards";
import { RESULT_LEGEND, RESULT_WORD, resultLetter, resultTitle } from "./result";

describe("the result alphabet: G · E · P", () => {
  it("G victoria, E empate, P derrota", () => {
    expect(resultLetter(3, 1)).toBe("G");
    expect(resultLetter(2, 2)).toBe("E");
    expect(resultLetter(0, 1)).toBe("P");
    expect(RESULT_WORD).toEqual({ G: "victoria", E: "empate", P: "derrota" });
    expect(resultTitle("P")).toBe("Derrota");
    expect(RESULT_LEGEND).toBe("G victoria · E empate · P derrota");
  });

  it("parity: home, /partidos, the admin and the pizarra give the same letter and word", () => {
    const cal = (gf: number, ga: number): CalMatch => ({ id: "m", j: 1, rival: "R", dateMs: 0, played: true, gf, ga, home: null, venue: "" });
    for (const [gf, ga] of [
      [3, 1],
      [1, 1],
      [0, 2],
    ]) {
      const m: ClubMatch = { id: "m", status: "finished", goalsFor: gf, goalsAgainst: ga };
      const l = resultLetter(gf, ga);
      expect(partidosResult(m)).toBe(l);
      expect(homeResult(m)).toBe(l);
      expect(adminLetter(gf, ga)).toBe(l);
      expect(matchBand(cal(gf, ga)).letter).toBe(l);
      expect(adminWord(l)).toBe(resultTitle(l));
      expect(matchBand(cal(gf, ga)).title.startsWith(resultTitle(l))).toBe(true);
    }
  });
});
