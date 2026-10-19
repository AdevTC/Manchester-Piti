import { describe, expect, it } from "vitest";
import { anchorPoints, clampPos, dragTo, nearestAnchor, parsePos, stepAnchor, type Box } from "./anchors";

// a 1440 × 900 viewport, a 240 × 50 floating score
const B: Box = { W: 1440, H: 900, w: 240, h: 50 };

describe("anchors", () => {
  it("nine anchors: corners, edge centres and the centre, inside the margins and under the bar", () => {
    const a = anchorPoints(B, { top: 104, margin: 24 });
    expect(a).toHaveLength(9);
    expect(a).toContainEqual({ x: 24, y: 104 });
    expect(a).toContainEqual({ x: 600, y: 104 });
    expect(a).toContainEqual({ x: 1176, y: 826 });
    expect(Math.min(...a.map((p) => p.y))).toBe(104);
  });

  it("corners only for the «Sacar el marcador» window", () => {
    expect(anchorPoints(B, { anchors: "corners" })).toEqual([
      { x: 16, y: 16 },
      { x: 16, y: 834 },
      { x: 1184, y: 16 },
      { x: 1184, y: 834 },
    ]);
  });

  it("a phone float only rides the bottom edge, above the tab bar", () => {
    const phone: Box = { W: 390, H: 844, w: 200, h: 50 };
    const a = anchorPoints(phone, { axis: "x", margin: 12, bottom: 96 });
    expect(a.map((p) => p.y)).toEqual([698, 698, 698]);
    expect(a.map((p) => p.x)).toEqual([12, 95, 178]);
    expect(dragTo({ x: 95, y: 698 }, 40, -300, phone, { axis: "x" })).toEqual({ x: 135, y: 698 });
  });

  it("let go: it springs to the nearest anchor", () => {
    expect(nearestAnchor({ x: 1300, y: 140 }, B, { top: 104, margin: 24 })).toEqual({ x: 1176, y: 104 });
    expect(nearestAnchor({ x: 640, y: 480 }, B, { top: 104, margin: 24 })).toEqual({ x: 600, y: 465 });
  });

  it("arrow keys hop to the nearest anchor that way, none past the edge", () => {
    const o = { top: 104, margin: 24 };
    expect(stepAnchor({ x: 600, y: 104 }, "ArrowRight", B, o)).toEqual({ x: 1176, y: 104 });
    expect(stepAnchor({ x: 600, y: 104 }, "ArrowDown", B, o)).toEqual({ x: 600, y: 465 });
    expect(stepAnchor({ x: 1176, y: 104 }, "ArrowRight", B, o)).toBeNull();
  });

  it("clamps into the zone (a saved spot from a bigger screen) and while dragging", () => {
    expect(clampPos({ x: 1800, y: 1200 }, B, { top: 104 })).toEqual({ x: 1184, y: 834 });
    expect(clampPos({ x: -50, y: 0 }, B, { top: 104 })).toEqual({ x: 16, y: 104 });
    expect(dragTo({ x: 600, y: 104 }, 2000, 2000, B)).toEqual({ x: 1200, y: 850 });
  });

  it("reads a saved spot back, anything broken is nothing", () => {
    expect(parsePos('{"x":12,"y":40}')).toEqual({ x: 12, y: 40 });
    expect(parsePos("{")).toBeNull();
    expect(parsePos('{"x":"a","y":1}')).toBeNull();
    expect(parsePos(null)).toBeNull();
  });
});
