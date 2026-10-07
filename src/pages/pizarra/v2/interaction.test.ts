import { describe, expect, it } from "vitest";
import { CAMS, proj } from "./geometry";
import { MAGNET_LIFT, pickMagnet, slotInDirection, swapArc, tilt } from "./drag";
import { cycle, dragHeight, grabLabel, settle, SNAP_H, step } from "./sheet";
import { EMPTY_HISTORY, HISTORY_MAX, pushHistory, redo, undo } from "./history";
import { lineupOf } from "./testkit";

describe("magnetic ghost slots", () => {
  const magnets = [
    { i: 0, x: 100, y: 300 },
    { i: 1, x: 160, y: 300 },
  ];
  it("snaps to the nearest slot within the radius (the finger sits above the feet)", () => {
    expect(pickMagnet(102, 300 - MAGNET_LIFT, magnets)).toBe(0);
    expect(pickMagnet(150, 300 - MAGNET_LIFT, magnets)).toBe(1);
  });
  it("lets go outside the radius", () => {
    expect(pickMagnet(300, 100, magnets)).toBeNull();
    expect(pickMagnet(100, 300 - MAGNET_LIFT, [])).toBeNull();
  });
});

describe("swap arc", () => {
  it("flies from the target slot up and over to the origin", () => {
    const to = { u: 30, v: 73 };
    const from = { u: 50, v: 24 };
    const d = swapArc(CAMS.tv, to, from);
    const m = d.match(/^M([\d.]+) ([\d.]+)Q([\d.]+) (-?[\d.]+) ([\d.]+) ([\d.]+)$/);
    expect(m).not.toBeNull();
    const [ax, ay, , cy, bx, by] = (m as RegExpMatchArray).slice(1).map(Number);
    const A = proj(CAMS.tv, to.u, to.v);
    const B = proj(CAMS.tv, from.u, from.v);
    expect(ax).toBeCloseTo(A.x * 10, 0);
    expect(ay).toBeCloseTo(A.y * 10 - 20, 0);
    expect(bx).toBeCloseTo(B.x * 10, 0);
    expect(by).toBeCloseTo(B.y * 10 - 20, 0);
    // the control point is above both ends (an arc, not a line)
    expect(cy).toBeLessThan(Math.min(ay, by));
  });
  it("leans the cromo into the move, within ±14°", () => {
    expect(tilt(5)).toBe(6);
    expect(tilt(100)).toBe(14);
    expect(tilt(-100)).toBe(-14);
  });
});

describe("keyboard moves between slots", () => {
  const pts = [
    { i: 0, x: 50, y: 90 },
    { i: 1, x: 30, y: 70 },
    { i: 2, x: 70, y: 70 },
    { i: 6, x: 50, y: 20 },
  ];
  it("goes to the nearest slot that way, preferring the straight line", () => {
    expect(slotInDirection(pts, 0, "up")).toBe(1);
    expect(slotInDirection(pts, 1, "right")).toBe(2);
    expect(slotInDirection(pts, 2, "left")).toBe(1);
    expect(slotInDirection(pts, 1, "up")).toBe(6);
  });
  it("stays when there is nothing that way", () => {
    expect(slotInDirection(pts, 0, "down")).toBeNull();
    expect(slotInDirection(pts, 6, "up")).toBeNull();
  });
});

describe("bottom sheet physics", () => {
  it("settles by the released height projected by the fling", () => {
    expect(settle(SNAP_H.peek, 0)).toBe("peek");
    expect(settle(SNAP_H.half, 0)).toBe("half");
    expect(settle(650, 0)).toBe("full");
    // a fast flick up from peek lands on full; a fast flick down from full lands on peek
    expect(settle(260, -2.5)).toBe("full");
    expect(settle(600, 2.6)).toBe("peek");
    // a slow drag past the midpoint
    expect(settle(310, 0)).toBe("half");
  });
  it("uses the tallest sheet the screen allows for full", () => {
    expect(settle(470, 0, 520)).toBe("full");
    expect(settle(440, 0, 520)).toBe("half");
  });
  it("keeps the dragged height on the rails", () => {
    expect(dragHeight(200, 500)).toBe(120);
    expect(dragHeight(200, -900)).toBe(SNAP_H.full + 20);
    expect(dragHeight(404, 4)).toBe(400);
  });
  it("cycles and steps like a button and arrow keys", () => {
    expect(cycle("peek")).toBe("half");
    expect(cycle("half")).toBe("full");
    expect(cycle("full")).toBe("peek");
    expect(step("peek", -1)).toBe("peek");
    expect(step("half", 1)).toBe("full");
    expect(step("full", 1)).toBe("full");
    expect(grabLabel("full")).toBe("Bajar el panel");
  });
});

describe("undo / redo", () => {
  const A = lineupOf(["a"]);
  const B = lineupOf(["b"]);
  const Cc = lineupOf(["c"]);
  it("rewinds and fast-forwards", () => {
    let h = pushHistory(EMPTY_HISTORY, A); // A → B
    h = pushHistory(h, B); // B → C
    const u1 = undo(h, Cc);
    expect(u1?.lineup).toBe(B);
    const u2 = undo(u1!.history, B);
    expect(u2?.lineup).toBe(A);
    expect(undo(u2!.history, A)).toBeNull();
    const r1 = redo(u2!.history, A);
    expect(r1?.lineup).toBe(B);
    const r2 = redo(r1!.history, B);
    expect(r2?.lineup).toBe(Cc);
    expect(redo(r2!.history, Cc)).toBeNull();
  });
  it("a new change drops the future, and the past is bounded", () => {
    const u1 = undo(pushHistory(EMPTY_HISTORY, A), B)!;
    expect(pushHistory(u1.history, A).future).toEqual([]);
    let h = EMPTY_HISTORY;
    for (let i = 0; i < HISTORY_MAX + 10; i++) h = pushHistory(h, A);
    expect(h.past).toHaveLength(HISTORY_MAX);
  });
});
