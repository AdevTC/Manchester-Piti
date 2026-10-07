import { describe, expect, it } from "vitest";
import { PIZARRA_LIMITS, type Stroke } from "../../lib/schemas";
import {
  addStroke,
  canAddStroke,
  clampPoint,
  clearStrokes,
  makeStroke,
  parseDrawings,
  removeStroke,
  simplifyPoints,
  strokeToData,
  undoStroke,
} from "./drawings";

const line = (n: number, from = { x: 10, y: 10 }, to = { x: 60, y: 40 }) =>
  Array.from({ length: n }, (_, i) => ({ x: from.x + ((to.x - from.x) * i) / (n - 1), y: from.y + ((to.y - from.y) * i) / (n - 1) }));
const wiggle = (n: number) => Array.from({ length: n }, (_, i) => ({ x: 5 + (90 * i) / (n - 1), y: 50 + 20 * Math.sin(i / 6) }));

describe("makeStroke", () => {
  it("keeps start, middle and end of an arrow", () => {
    const s = makeStroke("pase", "gold", line(21));
    expect(s?.points).toHaveLength(3);
    expect(s?.points[0]).toEqual({ x: 10, y: 10 });
    expect(s?.points[2]).toEqual({ x: 60, y: 40 });
  });

  it("ignores a tap (less than 2% of travel)", () => {
    expect(makeStroke("carrera", "sky", [{ x: 50, y: 50 }, { x: 50.5, y: 51 }])).toBeNull();
    expect(makeStroke("lapiz", "white", [])).toBeNull();
  });

  it("stores a zona as two opposite corners, and needs a real area", () => {
    const s = makeStroke("zona", "sky", [{ x: 20, y: 20 }, { x: 30, y: 25 }, { x: 40, y: 50 }]);
    expect(s?.points).toEqual([{ x: 20, y: 20 }, { x: 40, y: 50 }]);
    expect(makeStroke("zona", "sky", [{ x: 20, y: 20 }, { x: 40, y: 20.5 }])).toBeNull();
  });

  it("places a texto where the finger lifts, trimmed to 40 characters", () => {
    const s = makeStroke("texto", "white", [{ x: 5, y: 5 }, { x: 30, y: 70 }], "  ¡PRESIÓN ARRIBA, TODOS JUNTOS, SIN MIEDO Y A MUERTE!  ");
    expect(s?.points).toEqual([{ x: 30, y: 70 }]);
    expect(s?.text).toHaveLength(PIZARRA_LIMITS.strokeText);
    expect(makeStroke("texto", "white", [{ x: 5, y: 5 }], "   ")).toBeNull();
  });

  it("clamps everything to the pitch", () => {
    const s = makeStroke("carrera", "gold", [{ x: -20, y: 50 }, { x: 140, y: 120 }]);
    expect(s?.points).toEqual([{ x: 0, y: 50 }, { x: 100, y: 100 }]);
    expect(clampPoint({ x: 12.345, y: 99.99 })).toEqual({ x: 12.3, y: 100 });
  });

  it("simplifies a long pencil stroke to at most 64 points, ends kept", () => {
    const raw = wiggle(500);
    const s = makeStroke("lapiz", "gold", raw);
    expect(s).not.toBeNull();
    expect(s!.points.length).toBeLessThanOrEqual(PIZARRA_LIMITS.strokePoints);
    expect(s!.points.length).toBeGreaterThan(5);
    expect(s!.points[0]).toEqual(clampPoint(raw[0]));
    expect(s!.points.at(-1)).toEqual(clampPoint(raw.at(-1)!));
  });
});

describe("simplifyPoints", () => {
  it("collapses a straight line to its ends", () => {
    expect(simplifyPoints(line(200), 10)).toEqual([{ x: 10, y: 10 }, { x: 60, y: 40 }]);
  });
  it("leaves short paths alone and drops jitter", () => {
    expect(simplifyPoints([{ x: 1, y: 1 }, { x: 1.1, y: 1.1 }, { x: 9, y: 9 }])).toEqual([{ x: 1, y: 1 }, { x: 9, y: 9 }]);
  });
  it("respects any cap", () => {
    expect(simplifyPoints(wiggle(300), 8).length).toBeLessThanOrEqual(8);
  });
});

describe("stroke list", () => {
  const s = (): Stroke => makeStroke("carrera", "sky", line(5))!;

  it("adds, undoes, removes and clears", () => {
    const a = s(), b = s();
    let list = addStroke(addStroke([], a), b);
    expect(list.map((x) => x.id)).toEqual([a.id, b.id]);
    expect(a.id).not.toBe(b.id);
    list = undoStroke(list);
    expect(list).toEqual([a]);
    expect(removeStroke(list, a.id)).toEqual([]);
    expect(undoStroke([])).toEqual([]);
    expect(clearStrokes()).toEqual([]);
  });

  it("stops at 60 strokes and ignores invalid ones", () => {
    const full = Array.from({ length: PIZARRA_LIMITS.strokes }, s);
    expect(canAddStroke(full)).toBe(false);
    expect(addStroke(full, s())).toBe(full);
    expect(addStroke([], null)).toEqual([]);
    expect(addStroke([], { ...s(), points: [{ x: 1, y: 1 }] })).toEqual([]);
  });
});

describe("(de)serialization", () => {
  it("writes no undefined fields", () => {
    const data = strokeToData(makeStroke("pase", "gold", line(3))!);
    expect(Object.values(data)).not.toContain(undefined);
    expect("text" in data).toBe(false);
  });

  it("reads old boards (no drawings) as none, drops invalid strokes and keeps 60", () => {
    expect(parseDrawings(undefined)).toEqual([]);
    expect(parseDrawings("nada")).toEqual([]);
    const ok = strokeToData(makeStroke("pase", "gold", line(3))!);
    const bad = [{ ...ok, kind: "garabato" }, { ...ok, points: [{ x: 500, y: 1 }, { x: 1, y: 1 }] }, { ...ok, kind: "texto" }, null];
    expect(parseDrawings([ok, ...bad])).toHaveLength(1);
    expect(parseDrawings(Array.from({ length: 70 }, () => ok))).toHaveLength(PIZARRA_LIMITS.strokes);
  });
});
