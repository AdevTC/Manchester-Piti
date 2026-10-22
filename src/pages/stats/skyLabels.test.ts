import { describe, expect, it } from "vitest";
import { placeSkyLabels, type SkyBox, type SkyItem } from "./skyLabels";

/** A star at (cx, cy) with a dot of `d` px and its name (`w` × 14) under it, as the map lays them out. */
function star(cx: number, cy: number, w: number, d = 12): SkyItem {
  const dot = { l: cx - d / 2, t: cy - d / 2, w: d, h: d };
  return { dot, label: { l: cx - w / 2, t: cy + d / 2 + 3, w, h: 14 }, weight: d };
}
const moved = (it: SkyItem, p: { dx: number; dy: number }): SkyBox => ({ ...it.label, l: it.label.l + p.dx, t: it.label.t + p.dy });
const hits = (a: SkyBox, b: SkyBox) => Math.min(a.l + a.w, b.l + b.w) - Math.max(a.l, b.l) > 0.5 && Math.min(a.t + a.h, b.t + b.h) - Math.max(a.t, b.t) > 0.5;

describe("placeSkyLabels", () => {
  it("stars apart: every name stays under its star", () => {
    const items = [star(60, 60, 50), star(200, 200, 50)];
    expect(placeSkyLabels(items, 400, 440)).toEqual([
      { dx: 0, dy: 0, crowded: false },
      { dx: 0, dy: 0, crowded: false },
    ]);
  });

  it("two stars side by side: one name moves, none sits on the other or on a star", () => {
    const items = [star(100, 100, 60), star(130, 106, 50)];
    const out = placeSkyLabels(items, 400, 440);
    expect(out.every((p) => !p.crowded)).toBe(true);
    const a = moved(items[0], out[0]);
    const b = moved(items[1], out[1]);
    expect(hits(a, b)).toBe(false);
    for (const it of items) {
      expect(hits(a, it.dot)).toBe(false);
      expect(hits(b, it.dot)).toBe(false);
    }
  });

  it("a cluster of seven (the long season's forwards): the names shown never touch, the rest give way", () => {
    const items = [star(150, 120, 70, 16), star(170, 128, 64), star(160, 140, 58), star(140, 150, 40), star(180, 150, 44), star(150, 165, 52), star(175, 172, 46)];
    const out = placeSkyLabels(items, 400, 440);
    const shown = items.map((it, i) => ({ box: moved(it, out[i]), crowded: out[i].crowded })).filter((x) => !x.crowded);
    for (let i = 0; i < shown.length; i++) for (let j = i + 1; j < shown.length; j++) expect(hits(shown[i].box, shown[j].box)).toBe(false);
    // the biggest star chooses first: it always shows its name (moved off the stars under it if need be)
    expect(out[0].crowded).toBe(false);
    expect(shown.length).toBeGreaterThanOrEqual(4);
  });

  it("a star at the map's edge never puts its name outside", () => {
    const items = [star(390, 60, 60), star(380, 70, 60)];
    const out = placeSkyLabels(items, 400, 440);
    items.forEach((it, i) => {
      if (out[i].crowded) return;
      const b = moved(it, out[i]);
      expect(b.l).toBeGreaterThanOrEqual(-0.5);
      expect(b.l + b.w).toBeLessThanOrEqual(400.5);
    });
  });
});
