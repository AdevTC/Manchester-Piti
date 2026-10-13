import { describe, expect, it } from "vitest";
import { centreOf, clampGroupDelta, fichasTxt, frameShift, freePoints, keepKeys, moveFreeGroup, movePiecesGroup, piecePoints, toggleKey } from "./multiSel";
import { goFree } from "./ops";
import { demoSquad, lineupOf } from "./testkit";
import { newPlay } from "../plays";

// Bloque 5 · varias fichas a la vez: the group picked, its delta held back at the edge, the free board's
// cromos and a paso's pieces moved together.

const sq = demoSquad();
const SEVEN = ["evans", "illescas", "tello", "huberoski", "eguzquiza", "almachi", "adrian"];

describe("the group", () => {
  it("a ficha goes in and out; only the ones still there are kept", () => {
    expect(toggleKey([], "a")).toEqual(["a"]);
    expect(toggleKey(["a", "b"], "a")).toEqual(["b"]);
    const keys = ["a", "b"];
    expect(keepKeys(keys, () => true)).toBe(keys);
    expect(keepKeys(keys, (k) => k === "b")).toEqual(["b"]);
    expect(fichasTxt(1)).toBe("1 ficha");
    expect(fichasTxt(3)).toBe("3 fichas");
  });
  it("its step is held back so that all of it stays on the pitch (it keeps its shape)", () => {
    const pts = [
      { x: 10, y: 50 },
      { x: 30, y: 90 },
    ];
    expect(clampGroupDelta(pts, -10, 0, 4, 96)).toEqual([-6, 0]);
    expect(clampGroupDelta(pts, 0, 10, 4, 96)).toEqual([0, 6]);
    expect(clampGroupDelta(pts, 5, -5, 4, 96)).toEqual([5, -5]);
    expect(clampGroupDelta([], 5, 5, 0, 100)).toEqual([0, 0]);
    expect(centreOf(pts)).toEqual({ x: 20, y: 70 });
  });
  it("no travel on the screen is no travel on the pitch (through the TV camera)", () => {
    const p = frameShift("tv", { x: 40, y: 60 }, 0, 0);
    expect(p.x).toBeCloseTo(40, 5);
    expect(p.y).toBeCloseTo(60, 5);
    const q = frameShift("tv", { x: 40, y: 60 }, 5, 0);
    expect(q.x).toBeGreaterThan(40);
  });
});

describe("free mode: the cromos together", () => {
  it("moves the picked ones only, kept on the pitch and on the grid when it is on", () => {
    const L = goFree(lineupOf(SEVEN, "2-3-1", sq));
    const before = freePoints(L, ["tello", "adrian"]);
    const next = moveFreeGroup(L, ["tello", "adrian"], (p) => ({ x: p.x + 3, y: p.y - 2 }), false);
    const after = freePoints(next, ["tello", "adrian"]);
    expect(after).toEqual(before.map((p) => ({ x: Math.round(p.x + 3), y: Math.round(p.y - 2) })));
    expect(freePoints(next, ["evans"])).toEqual(freePoints(L, ["evans"]));
    const grid = moveFreeGroup(L, ["tello"], (p) => ({ x: p.x + 1.2, y: p.y + 3.4 }), true);
    freePoints(grid, ["tello"]).forEach((p) => {
      expect(p.x % 5).toBe(0);
      expect(p.y % 5).toBe(0);
    });
    const edge = moveFreeGroup(L, ["tello"], () => ({ x: -40, y: 200 }), false);
    expect(freePoints(edge, ["tello"])).toEqual([{ x: 4, y: 96 }]);
  });
  it("the same lineup when nothing moves, or when the board is not in free mode", () => {
    const L = goFree(lineupOf(SEVEN, "2-3-1", sq));
    expect(moveFreeGroup(L, ["tello"], (p) => p, false)).toBe(L);
    expect(moveFreeGroup(L, [], (p) => ({ x: p.x + 9, y: p.y }), false)).toBe(L);
    const sys = lineupOf(SEVEN, "2-3-1", sq);
    expect(moveFreeGroup(sys, ["tello"], (p) => ({ x: p.x + 9, y: p.y }), false)).toBe(sys);
  });
});

describe("a paso: the pieces together", () => {
  const play = () => newPlay("J", { tello: { x: 40, y: 60 }, adrian: { x: 60, y: 40 } }, { ball: { x: 50, y: 50 } });
  it("our cromos, a rival and the ball move by the same step in one edit; the other pasos stay", () => {
    const p = play();
    const keys = ["p:tello", "r:r2", "b"];
    expect([...piecePoints(p, 1, keys).keys()]).toEqual(keys);
    const next = movePiecesGroup(p, 1, keys, (q) => ({ x: q.x + 5, y: q.y - 5 }));
    expect(next.frames[1].players.tello).toEqual({ x: 45, y: 55 });
    expect(next.frames[1].players.adrian).toEqual({ x: 60, y: 40 });
    expect(next.frames[1].ball).toEqual({ x: 55, y: 45 });
    expect(next.frames[1].rivals.find((r) => r.id === "r2")).toEqual({ id: "r2", x: 41, y: 35 });
    expect(next.frames[0]).toEqual(p.frames[0]);
  });
  it("a piece that isn't in the paso is skipped; nothing moved gives the same jugada", () => {
    const p = play();
    expect(piecePoints(p, 1, ["p:nadie", "r:r9"]).size).toBe(0);
    expect(movePiecesGroup(p, 1, ["p:tello"], (q) => q)).toBe(p);
    expect(movePiecesGroup(p, 7, ["p:tello"], (q) => ({ x: q.x + 1, y: q.y }))).toBe(p);
  });
});
