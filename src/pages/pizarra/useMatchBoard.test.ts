import { describe, expect, it } from "vitest";
import { boardViewOfDoc } from "./useMatchBoard";

// What the match page reads of the official board (one projection of lineups/{id}): its seven, its system
// and each player's slot code (the Campo draws the seven there before the acta).
describe("boardViewOfDoc", () => {
  it("the seven, the system and the codes of a stored board", () => {
    const slots = [{ playerId: "g" }, { playerId: "a" }, { playerId: "b" }, { playerId: "c" }, { playerId: null }, { playerId: "e" }, { playerId: "f" }];
    const v = boardViewOfDoc({ formation: "3-2-1", freeMode: false, slots });
    expect(v?.system).toBe("3-2-1");
    expect(v?.seven).toEqual(["g", "a", "b", "c", "e", "f"]);
    expect(v?.codes).toEqual({ g: "POR", a: "LI", b: "DFC", c: "LD", e: "MC", f: "DC" });
    expect(boardViewOfDoc({ formation: "3-2-1", freeMode: true, slots })?.system).toBe("libre");
  });
  it("no doc → null; a doc with odd slots still reads (empty seven, no codes)", () => {
    expect(boardViewOfDoc(undefined)).toBeNull();
    expect(boardViewOfDoc({ formation: "nope", slots: "x" })).toEqual({ seven: [], system: "2-3-1", codes: {} });
  });
});
