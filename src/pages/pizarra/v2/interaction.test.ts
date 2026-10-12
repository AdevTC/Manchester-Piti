import { describe, expect, it } from "vitest";
import { CAMS, proj } from "./geometry";
import { MAGNET_LIFT, pickMagnet, slotInDirection, swapArc, tilt } from "./drag";
import { cycle, dragHeight, grabLabel, settle, snapOf, step } from "./sheet";
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

describe("bottom sheet (two heights, as designed)", () => {
  it("settles by the drag projected by the fling; a short one stays", () => {
    // dragged up 80 px: full; down 80 px: half
    expect(settle(-80, 0, "half")).toBe("full");
    expect(settle(80, 0, "full")).toBe("half");
    // a short drag leaves it where it was
    expect(settle(-30, 0, "half")).toBe("half");
    expect(settle(30, 0, "full")).toBe("full");
    // a short drag with a fast flick still goes (160 ms of projection)
    expect(settle(-10, -0.5, "half")).toBe("full");
    expect(settle(10, 0.5, "full")).toBe("half");
  });
  it("keeps the dragged height on the rails", () => {
    expect(dragHeight(280, 500)).toBe(120);
    expect(dragHeight(280, -900)).toBe(280 + 260);
    expect(dragHeight(404, 4)).toBe(400);
  });
  it("toggles and steps like a button and arrow keys", () => {
    expect(cycle("half")).toBe("full");
    expect(cycle("full")).toBe("half");
    expect(step("half", 1)).toBe("full");
    expect(step("full", 1)).toBe("full");
    expect(step("full", -1)).toBe("half");
    expect(grabLabel("half")).toBe("Ampliar el panel");
    expect(grabLabel("full")).toBe("Bajar el panel");
  });
  it("opens the lists full and every other tool at half", () => {
    expect((["tableros", "comparar", "compartir", "ajustes"] as const).map(snapOf)).toEqual(["full", "full", "full", "full"]);
    expect((["editar", "quimica", "jugadas", "dibujar", "mas", "charla"] as const).map(snapOf)).toEqual(["half", "half", "half", "half", "half", "half"]);
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
