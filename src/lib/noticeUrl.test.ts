import { describe, expect, it } from "vitest";
import { matchUrl, noticeMatchId } from "../../functions/src/noticeUrl";

// The notices' addresses (functions/src/noticeUrl): the new ones, and the match of an old stored one, so
// push.ts' archived/deleted-match guards keep holding for notices written before /partidos.
describe("the match a notice is about", () => {
  it("the new form: /partidos/<id> and its screens", () => {
    expect(noticeMatchId("/partidos/j1")).toBe("j1");
    expect(noticeMatchId("/partidos/AbC_12-x/vestuario")).toBe("AbC_12-x");
    expect(noticeMatchId("/partidos/j1/siete")).toBe("j1");
    expect(noticeMatchId("/partidos/j1?min=21")).toBe("j1");
    expect(noticeMatchId("/partidos/j1#x")).toBe("j1");
  });
  it("the old form, in notices already stored: /matches/<id>[?tab=…]", () => {
    expect(noticeMatchId("/matches/j1")).toBe("j1");
    expect(noticeMatchId("/matches/j1?tab=vestuario")).toBe("j1");
    expect(noticeMatchId("/matches/j1?tab=campo")).toBe("j1");
    expect(noticeMatchId("/matches/j1/mesa")).toBe("j1");
  });
  it("no match: Partidos' own screens, other pages, a malformed id", () => {
    expect(noticeMatchId("/partidos")).toBeNull();
    expect(noticeMatchId("/partidos/tabla")).toBeNull();
    expect(noticeMatchId("/partidos/balance?temporada=t1")).toBeNull();
    expect(noticeMatchId("/vestuario")).toBeNull();
    expect(noticeMatchId("/pizarra?tablero=b1#charla")).toBeNull();
    expect(noticeMatchId("/perfil")).toBeNull();
    expect(noticeMatchId("/partidos/../x")).toBeNull();
    expect(noticeMatchId("https://evil.test/partidos/j1")).toBeNull();
  });
  it("the address a notice is built with names its match", () => {
    expect(matchUrl("j1")).toBe("/partidos/j1");
    expect(matchUrl("j1", "vestuario")).toBe("/partidos/j1/vestuario");
    expect(matchUrl("j1", "siete")).toBe("/partidos/j1/siete");
    for (const screen of ["", "siete", "numeros", "vestuario"] as const) expect(noticeMatchId(matchUrl("m8", screen))).toBe("m8");
  });
});
