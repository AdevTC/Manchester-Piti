import { describe, expect, it } from "vitest";
import { CAMS, camGeo, FORM, proj, SYSTEMS } from "./geometry";

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
