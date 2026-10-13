import { describe, expect, it } from "vitest";
import { boardCodeByPlayer, boardSlotCodes, boardSystem, type BoardLike } from "../../functions/src/boardCodes";
import { systemDef } from "../../functions/src/formations";

const slotsOf = (ids: (string | null)[], spots: readonly (readonly [unknown, number, number])[]) =>
  ids.map((playerId, i) => ({ playerId, x: spots[i]?.[1] ?? 50, y: spots[i]?.[2] ?? 50 }));

const seven = ["a", "b", "c", "d", "e", "f", "g"];

describe("boardSlotCodes (el código exacto de cada casilla de una pizarra guardada)", () => {
  it("2-3-1: the catalogue's codes, keeper first", () => {
    const b: BoardLike = { formation: "2-3-1", freeMode: false, slots: slotsOf(seven, systemDef("2-3-1").spots) };
    expect(boardSlotCodes(b)).toEqual(["POR", "DFC", "DFC", "MI", "MC", "MD", "DC"]);
  });

  it("1-3-1-1: líbero, three mids, mediapunta, punta", () => {
    const b: BoardLike = { formation: "1-3-1-1", freeMode: false, slots: slotsOf(seven, systemDef("1-3-1-1").spots) };
    expect(boardSlotCodes(b)).toEqual(["POR", "LIB", "MI", "MC", "MD", "MCO", "DC"]);
  });

  it("an unknown or missing formation reads as 2-3-1", () => {
    expect(boardSlotCodes({ formation: "9-9-9" })).toEqual(["POR", "DFC", "DFC", "MI", "MC", "MD", "DC"]);
    expect(boardSlotCodes({})).toEqual(["POR", "DFC", "DFC", "MI", "MC", "MD", "DC"]);
  });

  it("free mode: a slot near the right back is LD, one up front in the centre is DC, slot 0 stays POR", () => {
    const slots = slotsOf(seven, systemDef("2-3-1").spots);
    slots[0] = { ...slots[0], x: 50, y: 48 };
    slots[2] = { ...slots[2], x: 88, y: 68 };
    slots[6] = { ...slots[6], x: 52, y: 12 };
    const codes = boardSlotCodes({ formation: "2-3-1", freeMode: true, slots });
    expect(codes[0]).toBe("POR");
    expect(codes[2]).toBe("LD");
    expect(codes[6]).toBe("DC");
    expect(codes).toHaveLength(7);
  });

  it("free mode: the depth band picks the line first (x 14 · y 60 is a medio: MI, not LI; y 36 is MED, y 35.9 DEL)", () => {
    const slots = slotsOf(seven, systemDef("2-3-1").spots);
    slots[3] = { ...slots[3], x: 14, y: 60 };
    slots[4] = { ...slots[4], x: 50, y: 36 };
    slots[5] = { ...slots[5], x: 50, y: 35.9 };
    slots[1] = { ...slots[1], x: 50, y: 62 };
    const codes = boardSlotCodes({ formation: "2-3-1", freeMode: true, slots });
    expect(codes[3]).toBe("MI");
    expect(codes[4]).toBe("MCO");
    expect(codes[5]).toBe("DC");
    expect(codes[1]).toBe("DFC");
  });

  it("free mode with a slot missing its spot falls back to the formation's code", () => {
    const codes = boardSlotCodes({ formation: "2-3-1", freeMode: true, slots: [{ playerId: "a", x: 50, y: 95 }] });
    expect(codes).toEqual(["POR", "DFC", "DFC", "MI", "MC", "MD", "DC"]);
  });
});

describe("boardCodeByPlayer", () => {
  it("maps each player on the board to his slot's code, skipping empty slots", () => {
    const b: BoardLike = { formation: "2-3-1", slots: slotsOf(["a", "b", null, "d", "e", "f", "g"], systemDef("2-3-1").spots) };
    expect(boardCodeByPlayer(b)).toEqual({ a: "POR", b: "DFC", d: "MI", e: "MC", f: "MD", g: "DC" });
  });

  it("no slots, no players", () => {
    expect(boardCodeByPlayer({ formation: "2-3-1" })).toEqual({});
  });
});

describe("boardSystem", () => {
  it("is «libre» in free mode, else the formation id (unknown → 2-3-1)", () => {
    expect(boardSystem({ formation: "3-2-1", freeMode: true })).toBe("libre");
    expect(boardSystem({ formation: "3-2-1", freeMode: false })).toBe("3-2-1");
    expect(boardSystem({ formation: "nope" })).toBe("2-3-1");
  });
});
