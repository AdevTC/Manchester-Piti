import { describe, expect, it } from "vitest";
import { CARD_SHAPE, cardInner, cartaLayout, posterLayout, teeBox } from "./shareLayout";
import { SHARE_SIZE } from "./share";

const inside = (b: { x: number; y: number; w: number; h: number }, W: number, H: number) => b.x >= 0 && b.y >= 0 && b.x + b.w <= W && b.y + b.h <= H;

describe("Mi carta: el túnel y la carta, como la vista previa a escala", () => {
  it("Historia 1080×1920 y Post 1080×1350", () => {
    expect(SHARE_SIZE).toEqual({ historia: { w: 1080, h: 1920 }, post: { w: 1080, h: 1350 } });
    expect(cartaLayout("historia", "frente")).toMatchObject({ w: 1080, h: 1920 });
    expect(cartaLayout("post", "frente")).toMatchObject({ w: 1080, h: 1350 });
  });

  it("la carta (136 px de 224 / 130 de 268) centrada, 25 em de ancho, 1,4 de alto, dentro de la imagen", () => {
    for (const f of ["historia", "post"] as const) {
      const L = cartaLayout(f, "frente");
      expect(L.card.w / L.w).toBeCloseTo(f === "historia" ? 136 / 224 : 130 / 268, 5);
      expect(L.card.h).toBeCloseTo(L.card.w * 1.4, 5);
      expect(L.card.u).toBeCloseTo(L.card.w / 25, 5);
      expect(L.card.x + L.card.w / 2).toBeCloseTo(L.w / 2, 5);
      // translate(-50%, -44%): a bit lower than the middle
      expect(L.card.y + 0.44 * L.card.h).toBeCloseTo(L.h / 2, 5);
      expect(inside(L.card, L.w, L.h)).toBe(true);
      // the kicker above the card, the light pool under its tip, the foot under everything
      expect(L.kicker.y + L.kicker.size).toBeLessThan(L.card.y);
      expect(L.ped.cy).toBeGreaterThan(L.card.y + 0.9 * L.card.h);
      expect(L.ped.cy + L.ped.ry).toBeLessThan(L.foot.y - L.foot.size);
    }
  });

  it("las paredes del túnel se alejan hacia el centro (más bajas por el fondo)", () => {
    const L = cartaLayout("historia", "frente");
    expect(L.walls.l.near).toBe(0);
    expect(L.walls.l.far).toBeGreaterThan(0);
    expect(L.walls.l.far).toBeLessThan(0.34 * L.w);
    expect(L.walls.r.far).toBeCloseTo(L.w - L.walls.l.far, 5);
    expect(L.walls.l.farTop).toBeGreaterThan(0);
    expect(L.walls.l.farBottom).toBeLessThan(L.h);
    expect(L.walls.l.farTop + L.walls.l.farBottom).toBeCloseTo(L.h, 5);
  });

  it("el título es más pequeño en el dorso y en el post", () => {
    expect(cartaLayout("historia", "dorso").kicker.size).toBeLessThan(cartaLayout("historia", "frente").kicker.size);
    expect(cartaLayout("post", "frente").kicker.size / cartaLayout("post", "frente").s).toBe(15);
  });

  it("el escudo de la carta: el polígono del diseño y el marco interior (.55 em, «Fijo» .8 em)", () => {
    expect(CARD_SHAPE).toHaveLength(13);
    expect(CARD_SHAPE[8]).toEqual([0.5, 1]);
    const c = { x: 0, y: 0, w: 250, h: 350, u: 10 };
    expect(cardInner(c, false)).toEqual({ x: 5.5, y: 5.5, w: 239, h: 339 });
    expect(cardInner(c, true)).toEqual({ x: 8, y: 8, w: 234, h: 334 });
  });
});

describe("¡Ya es oficial!: de arriba abajo sin solaparse", () => {
  const cases = [
    ["historia", false, ""],
    ["historia", true, "m"],
    ["post", false, "s"],
    ["post", true, ""],
  ] as const;
  it.each(cases)("%s (largo %s, nombre «%s»)", (format, long, nmCls) => {
    const L = posterLayout(format, { long, nmCls });
    expect(L.E).toBeCloseTo(L.w / (format === "post" ? 25.6 : 22.4), 5);
    // crest bar → LED board → figure → name → line → foot rule → dorsal at the bottom padding
    expect(L.top.y).toBeCloseTo(L.pad, 5);
    expect(L.vb.y).toBeGreaterThan(L.top.y + L.top.crest);
    const vbBottom = L.vb.y + L.vb.h;
    expect(L.vb.lines[1] + L.vb.lineH).toBeLessThanOrEqual(vbBottom);
    expect(L.fig.tee.y).toBeGreaterThan(vbBottom);
    expect(L.fig.tee.y + L.fig.tee.h).toBeLessThan(L.name.top);
    expect(L.name.top + L.name.lineH).toBeLessThan(L.line.top);
    expect(L.line.top + L.line.lineH).toBeLessThan(L.ft.border);
    expect(L.ft.numBottom).toBeCloseTo(L.h - L.pad, 5);
    expect(L.ft.textLines[1]).toBeGreaterThan(L.ft.textLines[0]);
    expect(L.fig.cx).toBe(L.w / 2);
    expect(L.vb.x + L.vb.w).toBeCloseTo(L.w - L.pad, 5);
  });

  it("el letrero largo («EN TRÁMITE») usa letra más pequeña; el nombre largo, también", () => {
    expect(posterLayout("historia", { long: true, nmCls: "" }).vb.led).toBeLessThan(posterLayout("historia", { long: false, nmCls: "" }).vb.led);
    const n = (c: "" | "m" | "s") => posterLayout("historia", { long: false, nmCls: c }).name.size;
    expect(n("s")).toBeLessThan(n("m"));
    expect(n("m")).toBeLessThan(n(""));
  });
});

describe("la espalda de la camiseta (.tee)", () => {
  it("10 em × 10,5 em; el nombre encima del dorsal, dentro de la zona de impresión", () => {
    const t = teeBox(100, 200, 10);
    expect(t).toMatchObject({ x: 100, y: 200, w: 100, h: 105, f: 10 });
    expect(t.pr).toEqual({ x: 115, y: 211, w: 70, h: 78 });
    expect(t.nameBottom).toBe(211 + 17.5);
    expect(t.numSize).toBeCloseTo(41, 5);
    expect(t.numTop).toBeCloseTo(211 + 0.45 * 41, 5);
    expect(t.numTop + t.numSize).toBeLessThan(t.pr.y + t.pr.h);
  });
});
