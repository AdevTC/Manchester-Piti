import { describe, expect, it } from "vitest";
import type { PitchPlace, PitchPlayer, Rect } from "../../home/vidrio/pitchLayout";
import { AIR, placeCampo } from "./campoLayout";

const SHIRT = 34;
const PLATE_H = 13;
/** A player as Campo lays him out: his block (the 34 px shirt, 2 px, the name) centred on his spot, a name about
 *  7 px a letter, and `tags` marks of 46 × 18 in a column. */
function player(cx: number, cy: number, name: string, tags = 0): PitchPlayer {
  const sh = SHIRT * 1.32;
  const top = cy - (sh + 2 + PLATE_H) / 2;
  const w = Math.round(name.length * 7);
  const words = name.split(" ");
  return {
    shirt: { x: cx - SHIRT / 2, y: top, w: SHIRT, h: sh },
    plate: { x: cx - w / 2, y: top + sh + 2, w, h: PLATE_H },
    plate2: words.length > 1 ? { w: Math.round(Math.max(...words.map((x) => x.length)) * 7), h: PLATE_H * 2 } : null,
    tags: tags ? { w: 46, h: tags * 18 + (tags - 1) * 3, n: tags } : null,
  };
}

/** «directo2» of the «Elegida» scenario: the 3-2-1 with Erik on for Illescas and Kevin for Eguzquiza, the night's
 *  marks (x across, y from their goal to ours, as the pizarra's frame). */
const NOW: readonly (readonly [number, number, string, number])[] = [
  [50, 92, "EVANS", 1],
  [18, 70, "FER", 0],
  [50, 74, "ERIK", 1],
  [82, 70, "JORDI", 1],
  [34, 46, "ADRIÁN T.C.", 2],
  [66, 46, "KEVIN", 1],
  [50, 20, "ALCIDES", 1],
];
/** The seven on a W × H pitch, as Campo clamps the spots (12–88 % across, 9–91 % down). */
const seven = (W: number, H: number) => NOW.map(([x, y, name, tags]) => player((Math.max(12, Math.min(88, x)) / 100) * W, (Math.max(9, Math.min(91, y)) / 100) * H, name, tags));

const area = (a: Rect, b: Rect) => Math.max(0, Math.min(a.x + a.w, b.x + b.w) - Math.max(a.x, b.x)) * Math.max(0, Math.min(a.y + a.h, b.y + b.h) - Math.max(a.y, b.y));
/** Every box after the pass, a name's and a column's with the air under it. */
function boxes(ps: readonly PitchPlayer[], out: readonly PitchPlace[]) {
  return ps.flatMap((p, i) => {
    const o = out[i];
    const cx = p.plate.x + p.plate.w / 2;
    const plate = o.plate === "two" && p.plate2 ? { x: cx - p.plate2.w / 2, y: p.plate.y, w: p.plate2.w, h: p.plate2.h } : p.plate;
    const named = { x: plate.x + o.nx + o.plateDx, y: plate.y + o.ny + o.plateDy, w: plate.w, h: plate.h };
    return [
      { who: i, kind: "shirt", r: { ...p.shirt, x: p.shirt.x + o.nx, y: p.shirt.y + o.ny } },
      { who: i, kind: "name", r: named, aired: { ...named, h: named.h + AIR } },
      ...(o.tagsAt ? [{ who: i, kind: "tags", r: o.tagsAt }] : []),
    ];
  });
}
/** Two players' boxes that touch (a name with the air under it, a column with its own). */
function clashes(ps: readonly PitchPlayer[], out: readonly PitchPlace[]) {
  const b = boxes(ps, out);
  const hits: string[] = [];
  for (const x of b)
    for (const y of b) {
      if (x.who >= y.who || (x.kind === "shirt" && y.kind === "shirt")) continue;
      if (area("aired" in x && x.aired ? x.aired : x.r, "aired" in y && y.aired ? y.aired : y.r) > 0) hits.push(`${NOW[x.who][2]} ${x.kind} × ${NOW[y.who][2]} ${y.kind}`);
    }
  return hits;
}

describe("placeCampo", () => {
  // the match page's upright pitch: 390, 360 and 820 (360 tall), 1440 and 1920 (330)
  for (const { at, W, H } of [
    { at: "390", W: 314, H: 360 },
    { at: "360", W: 284, H: 360 },
    { at: "820", W: 744, H: 360 },
    { at: "1440", W: 384, H: 330 },
  ])
    it(`live with two changes at ${at}: no name on another player's shirt or name, no marks on marks, every name on the pitch`, () => {
      const ps = seven(W, H);
      const out = placeCampo(ps, W, H);
      expect(out).toHaveLength(7);
      expect(clashes(ps, out)).toEqual([]);
      for (const b of boxes(ps, out)) if (b.kind === "name") expect(b.r.y + b.r.h, NOW[b.who][2]).toBeLessThanOrEqual(H + 0.5);
    });

  it("the centre-back right above the keeper makes room: the keeper keeps his name under his shirt", () => {
    const ps = seven(314, 360);
    const out = placeCampo(ps, 314, 360);
    expect(out[0]).toMatchObject({ plate: "one", plateDx: 0, plateDy: 0, nx: 0, ny: 0 });
    // ERIK's name, with its air, ends above EVANS's shirt
    const b = boxes(ps, out);
    const evansShirt = b.find((x) => x.who === 0 && x.kind === "shirt")?.r;
    const erikName = b.find((x) => x.who === 2 && x.kind === "name")?.r;
    expect(evansShirt && erikName && erikName.y + erikName.h + AIR <= evansShirt.y + 0.5).toBe(true);
  });

  it("nothing to place without a measured pitch (server, tests)", () => {
    expect(placeCampo([player(0, 0, "A", 2)], 0, 0)).toEqual([{ plate: "one", plateDx: 0, plateDy: 0, nx: 0, ny: 0, tags: "r", cols: 1, chips: "full", tagsAt: null }]);
  });
});
