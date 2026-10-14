import { describe, expect, it } from "vitest";
import { playedSummary } from "../playedSummary";
import { fmtMinutes, wholeMinutes } from "./minutes";

describe("minutes on screen: whole, with «′»", () => {
  it("rounds and never prints decimals", () => {
    expect(fmtMinutes(342.67)).toBe("343′");
    expect(fmtMinutes(342.4)).toBe("342′");
    expect(fmtMinutes(0)).toBe("0′");
    expect(wholeMinutes(49.5)).toBe(50);
    expect(wholeMinutes(Number.NaN)).toBe(0);
  });
  it("no number: «—» (or the given text)", () => {
    expect(fmtMinutes(null)).toBe("—");
    expect(fmtMinutes(undefined)).toBe("—");
    expect(fmtMinutes(Number.NaN, "?")).toBe("?");
  });
  it("parity: a consumer prints the same", () => {
    expect(playedSummary({ lines: [{ code: "MC", minutes: 120.67 }] })).toContain(fmtMinutes(120.67));
  });
});
