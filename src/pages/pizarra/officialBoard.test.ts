import { describe, expect, it } from "vitest";
import { toBePlayed } from "../../lib/derived/kickoff";
import { boardForMatch, boardFromLocks, lockedBoard, mapOfficialLock, officialScopeId } from "./officialBoard";

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
