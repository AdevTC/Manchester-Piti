// r14 «La pizarra»: the pitch's room for its caption and the rival discs kept off our shirts and plates (pure).
import { describe, expect, it } from "vitest";
import { FORMATIONS } from "../../formations";
import { captionRoom, dodgeRivals, fitGeometry, plateCrowd } from "./geometry";

describe("the caption has its own room under the pitch", () => {
  it("a caption shortens the pitch by its room: the pitch's bottom stays above the caption", () => {
    const plain = fitGeometry("pizarra", "desktop", false, 600, 800);
    const cap = fitGeometry("pizarra", "desktop", false, 600, 800, 0, captionRoom("desktop"));
    expect(cap.ph).toBeLessThan(plain.ph);
    // the pitch's bottom (centre + half + ty) sits above the caption's top (bottom 58 + its 34 px)
    const bottom = 800 / 2 + cap.ph / 2 + cap.ty;
    expect(bottom).toBeLessThanOrEqual(800 - 58 - 34 + 2);
  });
});

describe("dodgeRivals", () => {
  const ours = FORMATIONS["3-2-1"].map((d, i) => ({ x: d.x, y: d.y, label: ["EVANS", "FER", "ERIK", "JORDI", "ADRIÁN T.C.", "EGUZQUIZA", "ALCIDES"][i] }));
  const rivals = FORMATIONS["2-3-1"].map((d, i) => ({ id: "r" + i, kind: "rival", x: 100 - d.x, y: 100 - d.y, code: "RED" }));
  const box = (x: number, y: number, pw: number, ph: number) => ({ cx: (x / 100) * pw, cy: (y / 100) * ph });

  // (a 230 px pitch — a 360 px phone at its shortest — can't hold 14 people apart: there the discs only stay inside)
  for (const [pw, s] of [
    [310, 39],
    [470, 59],
  ] as const) {
    it(`no disc on a shirt or a plate, all inside the lines (pitch ${pw} px)`, () => {
      const ph = pw * 1.5;
      // (below 270 px the pitch writes short plates: the first word)
      const plates = pw < 270 ? ours.map((o) => ({ ...o, label: o.label.split(/[ .]/)[0] })) : ours;
      const out = dodgeRivals(rivals, plates, pw, ph, s);
      const D = Math.max(28, s * 0.62);
      const r = D / 2 + 3;
      const font = Math.max(12, Math.min(15, s * 0.215));
      for (const t of out) {
        const { cx, cy } = box(t.x, t.y, pw, ph);
        expect(cx - r).toBeGreaterThanOrEqual(1);
        expect(cx + r).toBeLessThanOrEqual(pw - 1);
        const H = D + (t.code ? font + 6 : 0);
        for (const o of plates) {
          const p = box(o.x, o.y, pw, ph);
          const half = Math.max(s * 0.55, (o.label.length * font * 0.62 + 16) / 2);
          const overlapX = cx - r < p.cx + half && cx + r > p.cx - half;
          const overlapY = cy - 0.7 * H < p.cy + s * 0.3 + font + 10 && cy + 0.3 * H > p.cy - s * 1.15;
          expect(overlapX && overlapY).toBe(false);
        }
      }
      // the others keep their spot (only rivals move) and nobody is lost
      expect(out).toHaveLength(rivals.length);
    });
  }

  it("a tiny pitch: every disc inside the lines", () => {
    const out = dodgeRivals(rivals, ours.map((o) => ({ ...o, label: o.label.split(/[ .]/)[0] })), 230, 345, 29);
    for (const t of out) {
      expect(t.x).toBeGreaterThan(0);
      expect(t.x).toBeLessThan(100);
      expect(t.y).toBeGreaterThan(0);
      expect(t.y).toBeLessThan(100);
    }
  });

  it("Grada (a play's tokens: their plates over the shirts): no disc or code under one of our plates, on screen", () => {
    // the J3 «Salida por Jordi» frame that let the codes peek under ADRIÁN T.C. and EGUZQUIZA (1440, Grada)
    const pw = 470;
    const ph = pw * 1.5;
    const s = 59;
    const cos = Math.cos((50 * Math.PI) / 180);
    const toks = [
      { x: 50, y: 6, label: "ALCIDES" },
      { x: 30, y: 30, label: "ADRIÁN T.C." },
      { x: 70, y: 30, label: "EGUZQUIZA" },
      { x: 85, y: 48, label: "JORDI" },
      { x: 15, y: 60, label: "FER" },
      { x: 50, y: 60, label: "ERIK" },
      { x: 50, y: 82, label: "EVANS" },
    ].map((o) => ({ ...o, above: true }));
    const riv = [
      { id: "r0", kind: "rival", x: 37, y: 18, code: "RED" },
      { id: "r1", kind: "rival", x: 63, y: 18, code: "RED" },
      { id: "r2", kind: "rival", x: 50, y: 26, code: "RED" },
    ];
    const out = dodgeRivals(riv, toks, pw, ph, s, cos);
    const font = Math.max(12, Math.min(15, s * 0.215));
    const D = Math.max(28, s * 0.62);
    for (const t of out) {
      const cx = (t.x / 100) * pw;
      const cy = (t.y / 100) * ph * cos;
      const H = D + (t.code ? font + 6 : 0);
      for (const o of toks) {
        const px = (o.x / 100) * pw;
        const py = (o.y / 100) * ph * cos;
        const half = Math.max(s * 0.55, (o.label.length * font * 0.62 + 16) / 2);
        const man = s * 1.327 + 2 + font + 10;
        const overlapX = cx - D / 2 < px + half && cx + D / 2 > px - half;
        const overlapY = cy - 0.7 * H < py + 0.38 * man && cy + 0.3 * H > py - 0.62 * man;
        expect(overlapX && overlapY, `${t.id} on ${o.label}`).toBe(false);
      }
    }
  });

  it("a disc already free keeps its spot", () => {
    const out = dodgeRivals([{ id: "r", kind: "rival", x: 50, y: 30, code: "" }], [{ x: 50, y: 90, label: "EVANS" }], 400, 600, 50);
    expect(out[0]).toMatchObject({ x: 50, y: 30 });
  });
});

describe("plateCrowd: plates of a row never touch", () => {
  const row = [
    { i: 0, x: 18, y: 46, label: "ADRIÁN T.C.", marks: 0 },
    { i: 1, x: 50, y: 48, label: "HUBEROSKI", marks: 2 },
    { i: 2, x: 82, y: 46, label: "EGUZQUIZA", marks: 1 },
    { i: 3, x: 50, y: 95, label: "EVANS", marks: 0 },
  ];
  it("roomy (1440 flat, no marks): nothing changes", () => {
    const c = plateCrowd(row.map((o) => ({ ...o, marks: 0 })), 470, 705, 59, "pizarra");
    expect(c.short.size + c.tight.size).toBe(0);
  });
  it("tight (a phone in Grada): the row's plates go short, then the marks drop their minute; the keeper's stays", () => {
    const c = plateCrowd(row, 250, 375, 31, "grada");
    expect(c.short.has(0) && c.short.has(1)).toBe(true);
    expect(c.short.has(3)).toBe(false);
  });
});
