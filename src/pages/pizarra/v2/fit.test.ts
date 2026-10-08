import { describe, expect, it } from "vitest";
import { CAMS } from "./geometry";
import { appHeight, composition, DESK_TOP, DESKTOP_H, HALF_GAP, HINT_H, MODE_BAR, PITCH_TOP, pitchWidth, SNAP_H, stageFit } from "./sheet";

// The pitch on phones and tablets is scaled to fit between the app bar and the sheet — by the smaller of
// the width (never larger than drawn) and the room above the sheet — so the goalkeeper's cromo is never
// under the sheet's peek (with the hint line) nor under the half sheet; on desktop it fits above the
// screen's bottom with its hint line. Both cameras, the sizes the layout audit checks.

const SIZES: [number, number][] = [
  [360, 640],
  [390, 844],
  [768, 1024],
  [768, 900],
  [1024, 768],
  [1024, 900],
  [600, 960],
  [699, 560],
  [1099, 600],
  [844, 390],
];
const DESKTOPS: [number, number][] = [
  [1280, 720],
  [1440, 900],
  [1920, 1080],
  [1100, 800],
];

describe("the pitch fits above the sheet", () => {
  for (const cam of ["tv", "top"] as const)
    for (const [w, vh] of SIZES)
      it(`${w}×${vh} · ${cam}`, () => {
        const h = appHeight(w, vh);
        const fh = CAMS[cam].Fh;
        const { kp, kh } = stageFit(w, h, fh);
        const ph = pitchWidth(w) * fh;
        // at peek: the pitch and the hint line end where the sheet begins (a pitch is never drawn smaller
        // than a fifth: only absurdly short screens hit that floor)
        if (kp > 0.2) expect(PITCH_TOP + ph * kp + HINT_H).toBeLessThanOrEqual(h - MODE_BAR - SNAP_H.peek + 0.5);
        // at half: the pitch ends above the half sheet
        if (kh > 0.2) expect(PITCH_TOP + ph * kh + HALF_GAP).toBeLessThanOrEqual(h - MODE_BAR - SNAP_H.half + 0.5);
        // never bigger than drawn, nor than the design's dolly at half
        expect(kp).toBeLessThanOrEqual(1);
        expect(kh).toBeLessThanOrEqual(composition(w) === "phone" ? 0.64 : 0.5);
        expect(kh).toBeLessThanOrEqual(kp);
      });

  it("phones and tablets are not touched by the desktop's scale", () => {
    for (const [w, vh] of SIZES) expect(stageFit(w, appHeight(w, vh), CAMS.top.Fh).kd).toBe(1);
  });

  it("the realistic sizes all fit (no floor reached)", () => {
    for (const [w, vh] of SIZES.slice(0, 6)) {
      const { kp } = stageFit(w, appHeight(w, vh), CAMS.top.Fh);
      expect(kp).toBeGreaterThan(0.2);
    }
  });

  it("the designed phone (390×844, TV camera) keeps its designed sizes", () => {
    expect(stageFit(390, 844, CAMS.tv.Fh)).toEqual({ kp: 1, kh: 0.64, kd: 1 });
  });

  it("tablets were drawn by their width and ran under the sheet: now they shrink to the height", () => {
    // 768 wide, the app 900 tall: the 560 px pitch (668 px tall) would end at 728, under the peek at 628
    const { kp, kh } = stageFit(768, 900, CAMS.tv.Fh);
    expect(kp).toBeCloseTo((900 - 72 - 200 - 60 - 44) / (560 * CAMS.tv.Fh), 3);
    expect(kp).toBeLessThan(0.8);
    expect(kh).toBe(0.5);
    // a landscape tablet (1024×768): the app is the viewport, the pitch smaller still
    expect(appHeight(1024, 768)).toBe(768);
    expect(stageFit(1024, 768, CAMS.tv.Fh).kp).toBeLessThan(0.6);
  });

  it("the compositions and the app's height follow the CSS", () => {
    expect([360, 699, 700, 1099, 1100].map(composition)).toEqual(["phone", "phone", "tablet", "tablet", "desktop"]);
    expect([appHeight(390, 500), appHeight(390, 1000), appHeight(768, 1200), appHeight(1440, 700)]).toEqual([560, 844, 900, 940]);
    expect(pitchWidth(390)).toBe(390);
    expect(pitchWidth(800)).toBe(560);
    expect(stageFit(0, 0, CAMS.tv.Fh)).toEqual({ kp: 1, kh: 0.64, kd: 1 });
  });
});

describe("the pitch fits on desktop (the panels at the sides)", () => {
  for (const cam of ["tv", "top"] as const)
    for (const [w, vh] of DESKTOPS)
      it(`${w}×${vh} · ${cam}`, () => {
        const h = appHeight(w, vh);
        expect(h).toBe(DESKTOP_H);
        const fh = CAMS[cam].Fh;
        const { kd } = stageFit(w, h, fh);
        // the pitch and its hint line end inside the app screen
        expect(DESK_TOP + pitchWidth(w) * fh * kd + 6 + HINT_H).toBeLessThanOrEqual(DESKTOP_H + 0.5);
        expect(kd).toBeLessThanOrEqual(1);
        expect(kd).toBeGreaterThan(0.2);
      });

  it("the TV camera fits as drawn (unchanged); the top-down one shrinks to fit", () => {
    for (const [w, vh] of DESKTOPS) {
      expect(stageFit(w, appHeight(w, vh), CAMS.tv.Fh)).toEqual({ kp: 1, kh: 0.64, kd: 1 });
      const top = stageFit(w, appHeight(w, vh), CAMS.top.Fh).kd;
      // 600 px wide, 864 px tall as drawn: it ran past the 940 px screen
      expect(600 * CAMS.top.Fh + DESK_TOP).toBeGreaterThan(DESKTOP_H);
      expect(top).toBeCloseTo((DESKTOP_H - DESK_TOP - 6 - HINT_H) / (600 * CAMS.top.Fh), 3);
      expect(top).toBeLessThan(0.86);
    }
  });
});
