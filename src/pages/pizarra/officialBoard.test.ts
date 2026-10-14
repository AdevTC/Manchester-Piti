import { describe, expect, it } from "vitest";
import { toBePlayed } from "../../lib/derived/kickoff";
import { boardBench, boardForMatch, boardFromLocks, boardSeven, convocatoriaWithSeven, lockedBoard, mapOfficialLock, officialScopeId, sameSeven, sevenAgreement, sevenDiffs } from "./officialBoard";

// A link to «the pizarra of this match» opens the match's own official; the season's official only while
// the match is still to be played. Read from the official's scope docs (lineupOfficials), never the boards.

describe("officialBoard", () => {
  it("the scope doc ids: one per match, one for the season (as publishOfficial writes them)", () => {
    expect(officialScopeId("t1", "m8")).toBe("t1__m8");
    expect(officialScopeId("t1", null)).toBe("t1__temporada");
  });

  it("a scope doc names a board, or none", () => {
    expect(lockedBoard({ lineupId: "b8" })).toBe("b8");
    expect(lockedBoard({ lineupId: "" })).toBeNull();
    expect(lockedBoard({ lineupId: 7 })).toBeNull();
    expect(lockedBoard(undefined)).toBeNull();
    expect(mapOfficialLock("t1__m8", { lineupId: "b8", seasonId: "t1", matchId: "m8" })).toEqual({ id: "t1__m8", lineupId: "b8" });
    expect(mapOfficialLock("t1__m8", null)).toBeNull();
  });

  it("the match's own official always; the season's only for a match still to be played", () => {
    expect(boardForMatch("b8", "s1", false)).toBe("b8");
    expect(boardForMatch("b8", "s1", true)).toBe("b8");
    expect(boardForMatch(null, "s1", true)).toBe("s1");
    expect(boardForMatch(null, "s1", false)).toBeNull();
    expect(boardForMatch(null, null, true)).toBeNull();
  });

  it("over a season's scope docs: another season's match gets nothing", () => {
    const locks = new Map([
      ["t1__m8", "b8"],
      ["t1__temporada", "s1"],
    ]);
    expect(boardFromLocks(locks, "t1", { id: "m8", seasonId: "t1" }, false)).toBe("b8");
    expect(boardFromLocks(locks, "t1", { id: "m9", seasonId: "t1" }, true)).toBe("s1");
    expect(boardFromLocks(locks, "t1", { id: "m9", seasonId: "t1" }, false)).toBeNull();
    expect(boardFromLocks(locks, "t1", { id: "m8", seasonId: "t0" }, true)).toBeNull();
    expect(boardFromLocks(locks, "", { id: "m8" }, true)).toBeNull();
  });
});

describe("toBePlayed", () => {
  const now = Date.UTC(2026, 10, 2, 10);
  const at = (h: number) => now + h * 3_600_000;
  it("a scheduled match ahead is; played, live, cancelled or postponed is not", () => {
    expect(toBePlayed({ status: "scheduled", date: at(48) }, now)).toBe(true);
    expect(toBePlayed({ status: "finished", date: at(-48), goalsFor: 1 }, now)).toBe(false);
    expect(toBePlayed({ status: "scheduled", date: at(-0.25), duration: 50 }, now)).toBe(false);
    expect(toBePlayed({ status: "cancelled", date: at(48) }, now)).toBe(false);
    expect(toBePlayed({ status: "postponed", date: at(48) }, now)).toBe(false);
  });
});

// One «siete» (M6): the official board's seven against the match's convocatoria.
describe("the official's seven and the convocatoria", () => {
  const S = ["a", "b", "c", "d", "e", "f", "g"];
  it("a board doc's seven: slot order, nobody twice, empty or malformed slots skipped", () => {
    expect(boardSeven([{ playerId: "a" }, { playerId: null }, { playerId: "b" }, { playerId: "a" }, null, "x"])).toEqual(["a", "b"]);
    expect(boardSeven(undefined)).toEqual([]);
  });
  it("same seven = same players, order aside; agreement with the titulares", () => {
    expect(sameSeven(S, [...S].reverse())).toBe(true);
    expect(sameSeven(S, S.slice(0, 6))).toBe(false);
    expect(sevenAgreement(S, [...S].reverse())).toBe("coincide");
    expect(sevenAgreement(S, [...S.slice(0, 6), "h"])).toBe("otro");
    expect(sevenAgreement(S, [])).toBe("otro");
    // no seven on the board (or not read): nothing to say
    expect(sevenAgreement([], S)).toBeNull();
    expect(sevenAgreement(null, S)).toBeNull();
  });
  it("who differs, each side", () => {
    expect(sevenDiffs([...S.slice(0, 6), "h"], S)).toEqual({ conv: ["h"], board: ["g"] });
  });
  it("the convocatoria with the board's seven: the banquillo keeps its order, who leaves the siete stays called", () => {
    expect(convocatoriaWithSeven({ starters: ["a", "b", "x"], bench: ["c", "d"] }, ["a", "c", null, "b"])).toEqual({ starters: ["a", "c", "b"], bench: ["d", "x"] });
    // already this seven (any order): nothing to write
    expect(convocatoriaWithSeven({ starters: ["b", "a"], bench: [] }, ["a", "b"])).toBeNull();
    expect(convocatoriaWithSeven(undefined, ["a"])).toBeNull();
  });
  it("nobody «no convocado» is called unless the board puts him in the seven", () => {
    // n1 is out of the convocatoria (neither siete nor banquillo): stays out; n2 enters the siete
    const next = convocatoriaWithSeven({ starters: ["a", "b"], bench: ["c"] }, ["a", "n2"], ["n1", "c", "b"]);
    expect(next).toEqual({ starters: ["a", "n2"], bench: ["c", "b"] });
  });
  it("with no convocatoria yet: the board's bench (off the pitch, no bajas), without the seven", () => {
    expect(convocatoriaWithSeven({ starters: [], bench: [] }, ["a", "b"], ["c", "a", "d", "c"])).toEqual({ starters: ["a", "b"], bench: ["c", "d"] });
  });
  it("a convocatoria with only «no convocados» set keeps them out (unless the board puts one in the seven)", () => {
    expect(convocatoriaWithSeven({ starters: [], bench: [], notCalled: ["d", "b"] }, ["a", "b"], ["c", "d", "e"])).toEqual({ starters: ["a", "b"], bench: ["c", "e"] });
  });
  it("the board's bench: off the seven, no baja of any kind", () => {
    const squad = [{ id: "a" }, { id: "b", baja: "Lesionado" }, { id: "c", baja: "Sancionado" }, { id: "d", baja: "Inactivo" }, { id: "e" }, { id: "f", baja: undefined }];
    expect(boardBench(squad, ["a", null])).toEqual(["e", "f"]);
  });
});
