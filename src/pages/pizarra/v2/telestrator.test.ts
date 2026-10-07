import { describe, expect, it } from "vitest";
import type { Stroke } from "../drawings";
import { CAMS, proj } from "./geometry";
import { colorCls, framePointToPitch, hitStroke, inkView, INK_UNDO_MAX, liveD, pushInk, strokeLabel } from "./telestrator";

// The telestrator's pure side: the pointer on the frame → the pitch (TV perspective and cenital), the
// strokes as the frame draws them, which one a tap lands on, and its own undo stack.

const st = (id: string, kind: Stroke["kind"], points: [number, number][], extra: Partial<Stroke> = {}): Stroke => ({
  id,
  kind,
  color: "gold",
  points: points.map(([x, y]) => ({ x, y })),
  ...extra,
});
const at = (cam: "tv" | "top", u: number, v: number) => {
  const q = proj(CAMS[cam], u, v);
  return [q.x, q.y] as const;
};

describe("the pointer on the pitch", () => {
  it.each(["tv", "top"] as const)("a frame point maps back to the pitch point drawn there (%s)", (cam) => {
    for (const [u, v] of [
      [50, 50],
      [12, 80],
      [88, 14],
      [30, 95],
    ]) {
      const [X, Y] = at(cam, u, v);
      const p = framePointToPitch(CAMS[cam], X, Y);
      expect(p.x).toBeCloseTo(u, 0);
      expect(p.y).toBeCloseTo(v, 0);
    }
  });

  it("the TV camera's perspective: the same frame step covers more pitch far away than near", () => {
    const C = CAMS.tv;
    const far = framePointToPitch(C, 50, 20).y - framePointToPitch(C, 50, 25).y;
    const near = framePointToPitch(C, 50, 80).y - framePointToPitch(C, 50, 85).y;
    expect(Math.abs(far)).toBeGreaterThan(Math.abs(near));
  });

  it("outside the pitch it stays on the pitch (clamped, one decimal)", () => {
    const p = framePointToPitch(CAMS.top, -40, 140);
    expect(p).toEqual({ x: 0, y: 100 });
    const q = framePointToPitch(CAMS.tv, 33.333, 47.777);
    expect(q.x * 10).toBe(Math.round(q.x * 10));
  });

  it("the live path follows the finger in the 1000×1000 box", () => {
    expect(liveD([
      [10, 20],
      [10.55, 21],
    ])).toBe("M100 200L105.5 210");
  });
});

describe("the strokes as light", () => {
  const C = CAMS.tv;
  const all = [
    st("a", "carrera", [[20, 80], [30, 60], [50, 40]]),
    st("b", "pase", [[50, 80], [50, 30]], { color: "sky" }),
    st("c", "conduccion", [[70, 80], [70, 60], [70, 40]], { color: "white" }),
    st("d", "zona", [[20, 20], [40, 35]]),
    st("e", "lapiz", [[60, 20], [62, 22], [65, 21], [70, 25]]),
    st("f", "texto", [[50, 50]], { text: "¡PRESIÓN!" }),
  ];
  const ink = inkView(all, C, "b", new Set(["e"]));

  it("draws each tool as designed: dotted carrera, pase and conducción with a head, a closed zona, a bare lápiz", () => {
    const by = Object.fromEntries(ink.paths.map((p) => [p.id, p]));
    expect(by.a).toMatchObject({ cls: "c-g", solid: "", zone: "" });
    expect(by.a.dash).toMatch(/^M/);
    expect(by.a.head).toMatch(/^M.+L.+L/);
    expect(by.b).toMatchObject({ cls: "c-s", dash: "", sel: true });
    expect(by.b.solid).toMatch(/^M/);
    expect(by.b.head).not.toBe("");
    expect(by.c.cls).toBe("c-w");
    expect(by.d.zone).toMatch(/Z$/);
    expect(by.d).toMatchObject({ dash: "", solid: "", head: "" });
    expect(by.e).toMatchObject({ head: "", dash: "" });
    expect(by.e.solid.split("L")).toHaveLength(4);
  });

  it("the conducción waves where the pase goes straight (seen from above)", () => {
    const straight = inkView([st("p", "pase", [[70, 80], [70, 60], [70, 40]])], CAMS.top, null).paths[0].solid;
    const wavy = inkView([all[2]], CAMS.top, null).paths[0].solid;
    const xs = (d: string) => new Set(d.slice(1).split("L").map((pt) => pt.split(" ")[0]));
    expect(xs(straight).size).toBe(1);
    expect(xs(wavy).size).toBeGreaterThan(3);
  });

  it("a texto is a label at its point; the strokes already there light up one after another, a new one at once", () => {
    expect(ink.texts).toEqual([{ id: "f", cls: "c-g", x: proj(C, 50, 50).x.toFixed(2), y: proj(C, 50, 50).y.toFixed(2), text: "¡PRESIÓN!", sel: false }]);
    const dl = Object.fromEntries(ink.paths.map((p) => [p.id, p.dl]));
    expect(dl).toMatchObject({ a: "0.00s", b: "0.25s", c: "0.50s", d: "0.75s", e: "0.00s" });
    const many = inkView(Array.from({ length: 30 }, (_, i) => st("k" + i, "pase", [[10, 10], [20, 20]])), C, null);
    expect(many.paths[29].dl).toBe("2.50s");
  });

  it("names a stroke for the list and the screen reader", () => {
    expect(strokeLabel(all[1])).toBe("Pase · cielo");
    expect(strokeLabel(all[5])).toBe("Texto «¡PRESIÓN!» · oro");
    expect(colorCls("white")).toBe("c-w");
  });
});

describe("a tap on a stroke", () => {
  it.each(["tv", "top"] as const)("picks the stroke under the finger, inside a zona too, and nothing far away (%s)", (cam) => {
    const C = CAMS[cam];
    const list = [st("pase", "pase", [[20, 80], [20, 20]]), st("zona", "zona", [[60, 30], [90, 60]]), st("txt", "texto", [[50, 90]], { text: "OJO" })];
    expect(hitStroke(list, C, ...at(cam, 20.5, 50))).toBe("pase");
    expect(hitStroke(list, C, ...at(cam, 75, 45))).toBe("zona");
    expect(hitStroke(list, C, ...at(cam, 50, 90))).toBe("txt");
    expect(hitStroke(list, C, ...at(cam, 45, 10))).toBeNull();
    expect(hitStroke([], C, 50, 50)).toBeNull();
  });

  it("the later stroke wins where two cross (it is drawn on top)", () => {
    const C = CAMS.top;
    const list = [st("one", "pase", [[10, 50], [90, 50]]), st("two", "carrera", [[50, 10], [50, 90]])];
    expect(hitStroke(list, C, ...at("top", 50, 50))).toBe("two");
  });
});

describe("the telestrator's own undo", () => {
  it("keeps the strokes as they were before each change, bounded", () => {
    let h: Stroke[][] = [];
    for (let i = 0; i < INK_UNDO_MAX + 5; i++) h = pushInk(h, [st("s" + i, "pase", [[0, 0], [10, 10]])]);
    expect(h).toHaveLength(INK_UNDO_MAX);
    expect(h[h.length - 1][0].id).toBe("s" + (INK_UNDO_MAX + 4));
  });
});
