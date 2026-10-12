import { describe, expect, it } from "vitest";
import { CAMS, camGeo, cardRect, cardsOverlap, FORM, proj, slotLabel, slotPos, SYSTEMS } from "./geometry";
import { lineupOf } from "./testkit";

// The pitch is fitted by the layout (CSS), from the camera's geometry: --cut (the frame above the far LED
// ribbon, the pitch's top edge on screen), --vr (the visible frame) and --kb (just under the keeper's
// cromo). The generated pizarra.css carries the design's numbers (its root: the TV camera; each frame:
// its own); the board sets the camera's on its root. They must be the same geometry, or the keeper
// would leave the screen.

describe("the camera's geometry for the layout", () => {
  it("is the design's (pizarra.css: .pzv{--vr:1.0961;--cut:0.0971;--kb:1.0933}, .pfr.top{--vr:1.3816;--cut:0.0578})", () => {
    expect(camGeo("tv")).toEqual({ cut: 0.0971, vr: 1.0961, kb: 1.0933 });
    expect(camGeo("top")).toMatchObject({ cut: 0.0578, vr: 1.3816 });
    // the frames' aspect ratios in pizarra.css (1 / 1.19318 and 1 / 1.4394)
    expect(CAMS.tv.Fh).toBeCloseTo(1.19318, 5);
    expect(CAMS.top.Fh).toBeCloseTo(1.4394, 4);
  });

  for (const cam of ["tv", "top"] as const)
    it(`the ${cam} camera keeps the keeper in view: between the cut and --kb`, () => {
      const C = CAMS[cam];
      const g = camGeo(cam);
      expect(g.vr + g.cut).toBeCloseTo(C.Fh, 3);
      for (const s of SYSTEMS) {
        const [, z, u, v] = FORM[s][0];
        expect(z).toBe("POR");
        const y = (proj(C, u, v).y / 100) * C.Fh;
        expect(y).toBeGreaterThan(g.cut);
        expect(y).toBeLessThan(g.kb);
        expect(g.kb).toBeLessThanOrEqual(C.Fh + 0.04);
      }
    });

  it("the keeper stands at 95 in every system (as designed)", () => {
    expect(SYSTEMS.map((s) => FORM[s][0][3])).toEqual(SYSTEMS.map(() => 95));
  });
});

// The cromo's size in pizarra.css: .app{--cw:16} on phones, 15.2 on tablets, 15 on desktop (in cqw of the
// frame), 5:7, held at translate(-50%,-84%) scale(--sc) where --sc is depthScale. Same frame units for
// every viewport, so the largest (the phone's) is the one that must fit.
const CW = [16, 15.2, 15];

describe("no two cromos cover each other", () => {
  for (const cam of ["tv", "top"] as const)
    for (const width of ["Estrecha", "Media", "Amplia"])
      it(`${cam} camera, amplitud ${width}: every system with the default plan`, () => {
        const C = CAMS[cam];
        const hits: string[] = [];
        for (const f of SYSTEMS) {
          const base = lineupOf([], f);
          const L = { ...base, tactics: { ...base.tactics, width } };
          for (const cw of CW) {
            const rects = L.slots.map((_, i) => {
              const p = slotPos(L, i);
              return cardRect(C, p.u, p.v, cw);
            });
            for (let a = 0; a < rects.length; a++)
              for (let b = a + 1; b < rects.length; b++) if (cardsOverlap(rects[a], rects[b])) hits.push(f + " " + slotLabel(L, a) + "/" + slotLabel(L, b) + " @" + cw);
          }
        }
        expect(hits).toEqual([]);
      });

  it("the reported overlaps are gone: 1-3-2's líbero and MC, 2-3-1's DFCs and MC on the phone", () => {
    const C = CAMS.tv;
    const at = (f: "1-3-2" | "2-3-1", i: number) => {
      const p = slotPos(lineupOf([], f), i);
      return cardRect(C, p.u, p.v, 16);
    };
    expect(cardsOverlap(at("1-3-2", 1), at("1-3-2", 3))).toBe(false);
    expect(cardsOverlap(at("2-3-1", 1), at("2-3-1", 4))).toBe(false);
    expect(cardsOverlap(at("2-3-1", 2), at("2-3-1", 4))).toBe(false);
    // (the boxes are real: the same spot overlaps itself)
    expect(cardsOverlap(at("2-3-1", 4), at("2-3-1", 4))).toBe(true);
  });
});
