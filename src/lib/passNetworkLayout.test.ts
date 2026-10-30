import { describe, expect, it } from "vitest";
import { autoThreshold, boxPercent, chordPath, curvePath, nodeRadius, pitchLayout, relax, ringLabel, ringLayout, shirtSize, strongestPair } from "./passNetworkLayout";

describe("pass network layout", () => {
  it("sizes nodes by involvement and derives the shirt from the radius", () => {
    expect(nodeRadius(0, 10)).toBeCloseTo(24 * 0.62);
    expect(nodeRadius(10, 10)).toBeCloseTo(38 * 0.62);
    expect(shirtSize(nodeRadius(10, 10))).toBe(38);
  });
  it("stretches the spots to fill the pitch, keeps the goalkeeper at the bottom and separates every pair", () => {
    const nodes = [{ id: "gk", involvement: 4 }, { id: "dc", involvement: 10 }, { id: "a", involvement: 6 }, { id: "b", involvement: 6 }];
    const spots: Record<string, { x: number; y: number }> = { gk: { x: 50, y: 93 }, dc: { x: 50, y: 12 }, a: { x: 40, y: 50 }, b: { x: 40, y: 50 } };
    const placed = pitchLayout(nodes, id => spots[id]);
    const by = new Map(placed.map(n => [n.id, n]));
    expect(by.get("gk")!.Y).toBeGreaterThan(by.get("dc")!.Y);
    for (const n of placed) { expect(n.X).toBeGreaterThanOrEqual(42); expect(n.X).toBeLessThanOrEqual(358); expect(n.Y).toBeGreaterThanOrEqual(52); expect(n.Y).toBeLessThanOrEqual(512); }
    const a = by.get("a")!, b = by.get("b")!;
    expect(Math.hypot(a.X - b.X, (a.Y - b.Y) * 0.8)).toBeGreaterThan(a.r + b.r);
  });
  it("puts a player without a spot in midfield and leaves a lone player centred", () => {
    const [only] = pitchLayout([{ id: "x", involvement: 1 }], () => undefined);
    expect(only.X).toBeCloseTo(28 + 50 * 3.44);
    expect(only.Y).toBeCloseTo(26 + 50 * 5.08);
  });
  it("does not mutate the list it relaxes", () => {
    const list = [{ id: "a", X: 200, Y: 200, r: 15 }, { id: "b", X: 200, Y: 200, r: 15 }];
    const out = relax(list);
    expect(list[0].X).toBe(200);
    expect(out[0].X).not.toBe(out[1].X);
  });
  it("places the ring clockwise from the top and labels outward", () => {
    const ring = ringLayout([{ id: "a", involvement: 1 }, { id: "b", involvement: 1 }, { id: "c", involvement: 1 }, { id: "d", involvement: 1 }]);
    expect(ring[0].X).toBeCloseTo(200); expect(ring[0].Y).toBeCloseTo(50);
    expect(ring[1].X).toBeCloseTo(350);
    expect(boxPercent("circulo", ring[0])).toEqual({ px: 50, py: 15.9 });
    expect(boxPercent("campo", { id: "z", X: 200, Y: 280, r: 1 })).toEqual({ px: 50, py: 50 });
    expect(ringLabel(ring[1]).anchor).toBe("start");
    expect(ringLabel(ring[3]).anchor).toBe("end");
    const top = ringLabel(ring[0]);
    expect(top.anchor).toBe("middle");
    expect(top.ly).toBeLessThan(0);
  });
  it("bends the two directions of a pair to opposite sides", () => {
    const a = { id: "a", X: 100, Y: 100, r: 15 }, b = { id: "b", X: 300, Y: 100, r: 15 };
    const ctrl = (d: string) => Number(d.split("Q")[1].trim().split(" ")[1]);
    expect(ctrl(curvePath(a, b))).toBeGreaterThan(100);
    expect(ctrl(curvePath(b, a))).toBeLessThan(100);
    expect(curvePath(a, b)).toMatch(/^M116\.7 103 Q200 118 /);
    expect(chordPath({ id: "t", X: 200, Y: 50, r: 15 }, { id: "u", X: 200, Y: 350, r: 15 })).toContain("Q");
  });
  it("picks the threshold that keeps at most the limit of edges", () => {
    expect(autoThreshold([5, 4, 3, 2, 1], 3)).toBe(3);
    expect(autoThreshold([1, 1], 30)).toBe(1);
    expect(autoThreshold([], 30)).toBe(1);
  });
  it("finds the pair that meets most, the stronger direction first", () => {
    expect(strongestPair([{ from: "a", to: "b", completed: 5 }, { from: "b", to: "a", completed: 9 }, { from: "a", to: "c", completed: 12 }])).toEqual({ a: "b", b: "a", ab: 9, ba: 5 });
    expect(strongestPair([{ from: "a", to: "c", completed: 3 }])).toEqual({ a: "a", b: "c", ab: 3, ba: 0 });
    expect(strongestPair([])).toBeNull();
  });
});
