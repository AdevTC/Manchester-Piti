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
      const r = Math.max(14, s * 0.31) + 3;
      const font = Math.max(12, Math.min(15, s * 0.215));
      for (const t of out) {
        const { cx, cy } = box(t.x, t.y, pw, ph);
        expect(cx - r).toBeGreaterThanOrEqual(1);
        expect(cx + r).toBeLessThanOrEqual(pw - 1);
        for (const o of plates) {
          const p = box(o.x, o.y, pw, ph);
          const half = Math.max(s * 0.55, (o.label.length * font * 0.62 + 16) / 2);
          const overlapX = cx - r < p.cx + half && cx + r > p.cx - half;
          const overlapY = cy - r * 1.5 < p.cy + s * 0.3 + font + 10 && cy + r * 0.5 + (t.code ? font + 6 : 0) > p.cy - s * 1.15;
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
