import { describe, expect, it } from "vitest";
import { convocatoriaNoticeKind, convocatoriaProblem, notCalledOf, sameLineup } from "../../functions/src/convocatoriaLogic";

const ROSTER = ["a", "b", "c", "d", "e", "f", "g", "h", "i"];
const seven = ROSTER.slice(0, 7);

describe("setConvocatoria · the one convocatoria's rules", () => {
  it("accepts up to seven titulares and any banquillo of the season", () => {
    expect(convocatoriaProblem({ starters: seven, bench: ["h"] }, { roster: ROSTER, status: "scheduled" })).toBeNull();
    expect(convocatoriaProblem({ starters: ["a"], bench: [] }, { roster: ROSTER })).toBeNull();
    expect(convocatoriaProblem({ starters: [], bench: [] }, { roster: ROSTER })).toBeNull();
  });
  it("refuses an eighth titular, a player twice, players of another season", () => {
    expect(convocatoriaProblem({ starters: [...seven, "h"], bench: [] }, { roster: ROSTER })).toMatch(/siete/);
    expect(convocatoriaProblem({ starters: ["a", "a"], bench: [] }, { roster: ROSTER })).toMatch(/una sola vez/);
    expect(convocatoriaProblem({ starters: ["a"], bench: ["a"] }, { roster: ROSTER })).toMatch(/una sola vez/);
    expect(convocatoriaProblem({ starters: ["z"], bench: [] }, { roster: ROSTER })).toMatch(/temporada/);
  });
  it("a played or cancelled match keeps its convocatoria closed", () => {
    expect(convocatoriaProblem({ starters: ["a"], bench: [] }, { roster: ROSTER, status: "finished" })).toMatch(/ya se jugó/);
    expect(convocatoriaProblem({ starters: ["a"], bench: [] }, { roster: ROSTER, status: "cancelled" })).toMatch(/cancelado/);
  });
  it("the rest of the season is «no convocado»; same lineup ignores the order", () => {
    expect(notCalledOf(ROSTER, { starters: seven, bench: ["h"] })).toEqual(["i"]);
    expect(sameLineup({ starters: ["a", "b"], bench: ["c"] }, { starters: ["b", "a"], bench: ["c"] })).toBe(true);
    expect(sameLineup({ starters: ["a", "b"], bench: ["c"] }, { starters: ["a", "c"], bench: ["b"] })).toBe(false);
  });
  it("«Convocar y avisar»: the first notice, then «Cambios» only when it changed, never once started", () => {
    expect(convocatoriaNoticeKind({ notify: false, upcoming: true, notifiedBefore: false, changed: true })).toBeNull();
    expect(convocatoriaNoticeKind({ notify: true, upcoming: true, notifiedBefore: false, changed: false })).toBe("first");
    expect(convocatoriaNoticeKind({ notify: true, upcoming: true, notifiedBefore: true, changed: true })).toBe("changes");
    expect(convocatoriaNoticeKind({ notify: true, upcoming: true, notifiedBefore: true, changed: false })).toBeNull();
    expect(convocatoriaNoticeKind({ notify: true, upcoming: false, notifiedBefore: false, changed: true })).toBeNull();
  });
});
