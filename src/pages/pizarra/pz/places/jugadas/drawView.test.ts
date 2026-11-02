import { describe, expect, it } from "vitest";
import type { Stroke } from "../../../../../lib/schemas";
import { strokeSchema } from "../../../../../lib/schemas";
import { hitStroke, strokeFrom, strokeName, strokePath } from "./drawView";

const S = (o: Partial<Stroke>): Stroke => ({ id: "k1", kind: "carrera", color: "white", points: [{ x: 10, y: 10 }, { x: 40, y: 40 }], ...o }) as Stroke;

describe("drawView · how a stored stroke is drawn", () => {
  it("a 2-point carrera is a straight Flecha; a 3-point one bends through its middle", () => {
    expect(strokePath(S({}), null)?.kind).toBe("flecha");
    const c = strokePath(S({ points: [{ x: 10, y: 10 }, { x: 30, y: 15 }, { x: 40, y: 40 }] }), null)!;
    expect(c.kind).toBe("carrera");
    expect(c.pts!.length).toBe(13);
    // the curve passes through its middle point
    expect(c.pts![6][0]).toBeCloseTo(30, 0);
    expect(c.pts![6][1]).toBeCloseTo(15, 0);
  });
  it("keeps its colour (white · sky · gold → blanco · celeste · amarillo)", () => {
    expect(strokePath(S({ color: "sky" }), null)?.color).toBe("celeste");
    expect(strokePath(S({ color: "gold", kind: "pase" }), null)?.color).toBe("amarillo");
  });
  it("a zone is a box with its label; a text is a label", () => {
    const z = strokePath(S({ kind: "zona", text: "Mordemos" }), null)!;
    expect(z.kind).toBe("zona");
    expect(z.pts!.length).toBe(4);
    expect(z.label).toBe("Mordemos");
    expect(strokePath(S({ kind: "texto", points: [{ x: 50, y: 50 }], text: "¡PRESIÓN!" }), null)?.label).toBe("¡PRESIÓN!");
  });
  it("pinned strokes follow the players when the board is known", () => {
    const ctx = { places: { a: { x: 20, y: 60 }, b: { x: 80, y: 60 } }, lineup: { slots: [] } as never, name: (id: string) => id.toUpperCase() };
    const m = S({ kind: "medir", anchors: ["a", "b"], points: [{ x: 0, y: 0 }, { x: 1, y: 1 }] });
    const p = strokePath(m, ctx)!;
    expect(p.pts).toEqual([
      [20, 60],
      [80, 60],
    ]);
    expect(p.label).toBe("A – B: 24 m");
    expect(strokeName(m, ctx)).toBe("Medida · A – B: 24 m");
  });
  it("names strokes in words", () => {
    expect(strokeName(S({}), null)).toBe("Flecha");
    expect(strokeName(S({ kind: "pase" }), null, "x")).toBe("Pase de x");
    expect(strokeName(S({ kind: "texto", points: [{ x: 1, y: 1 }], text: "Hola" }), null)).toBe("Texto «Hola»");
  });
});

describe("drawView · tools and hits", () => {
  it("each tool makes a stroke the app stores (strokeSchema)", () => {
    const pts: [number, number][] = [
      [10, 10],
      [20, 15],
      [30, 30],
    ];
    for (const t of ["lapiz", "flecha", "carrera", "pase", "zona"] as const) {
      const s = strokeFrom(t, pts, "sky", "k" + t);
      expect(typeof s).not.toBe("string");
      expect(strokeSchema.safeParse(s).success).toBe(true);
    }
    expect(strokeFrom("flecha", [[10, 10], [11, 11]], "white", "x")).toMatch(/corto/);
    expect(strokeFrom("zona", [[10, 10], [11, 40]], "white", "x")).toMatch(/diagonal/);
  });
  it("a tap hits the stroke under it", () => {
    const a = S({ id: "a" });
    const z = S({ id: "z", kind: "zona", points: [{ x: 60, y: 60 }, { x: 80, y: 80 }] });
    expect(hitStroke([a, z], [25, 25], null)?.id).toBe("a");
    expect(hitStroke([a, z], [70, 70], null)?.id).toBe("z");
    expect(hitStroke([a, z], [90, 10], null)).toBeNull();
  });
});
