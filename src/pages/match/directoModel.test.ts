import { describe, expect, it } from "vitest";
import { rivalTag } from "./directoModel";

describe("rivalTag", () => {
  it("uses the match's own code (rivalShort) and derives one when there is none", () => {
    expect(rivalTag({ rival: "Atlético Demo", rivalShort: "atd" })).toBe("ATD");
    expect(rivalTag({ rival: "Atlético Demo", rivalShort: "" })).toBe("ATL");
    expect(rivalTag({ rival: "Rayo Pruebas" })).toBe("RAY");
  });
});
