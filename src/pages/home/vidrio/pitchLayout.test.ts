import { describe, expect, it } from "vitest";
import { placePitch, tagsBox, tagsSize, type PitchPlace, type PitchPlayer, type Rect } from "./pitchLayout";

const SHIRT = 34;
const PLATE_H = 13;
/** A player whose shirt is centred at (cx, cy), a plate `name.length * 7` wide and `tags` tags of 46 × 18. */
function player(cx: number, cy: number, name: string, tags = 0): PitchPlayer {
  const shirt = { x: cx - SHIRT / 2, y: cy - SHIRT / 2, w: SHIRT, h: SHIRT * 1.18 };
  const w = name.length * 7;
  return { shirt, plate: { x: cx - w / 2, y: shirt.y + shirt.h + 2, w, h: PLATE_H }, tags: tags ? { w: 46, h: tags * 18 + (tags - 1) * 3, n: tags } : null };
}

const area = (a: Rect, b: Rect) => Math.max(0, Math.min(a.x + a.w, b.x + b.w) - Math.max(a.x, b.x)) * Math.max(0, Math.min(a.y + a.h, b.y + b.h) - Math.max(a.y, b.y));

/** Every box on the pitch after the pass (shirts, the plates still shown, the tags). */
function boxes(ps: readonly PitchPlayer[], out: readonly PitchPlace[]): { r: Rect; who: number; kind: string }[] {
  const all: { r: Rect; who: number; kind: string }[] = [];
  ps.forEach((p, i) => {
    all.push({ r: p.shirt, who: i, kind: "shirt" });
    if (out[i].plate === "full") all.push({ r: { ...p.plate, y: p.plate.y + out[i].plateDy }, who: i, kind: "plate" });
    if (p.tags) all.push({ r: tagsBox(p.shirt, tagsSize(p.tags, out[i].cols, out[i].chips), out[i].tags, out[i].tagsDy), who: i, kind: "tags" });
  });
  return all;
}
const clashes = (ps: readonly PitchPlayer[], out: readonly PitchPlace[]) => {
  const b = boxes(ps, out);
  const hits: string[] = [];
  for (let i = 0; i < b.length; i++) for (let j = i + 1; j < b.length; j++) if (area(b[i].r, b[j].r) >= 1) hits.push(`${b[i].who}.${b[i].kind} × ${b[j].who}.${b[j].kind}`);
  return hits;
};

describe("placePitch", () => {
  it("a plate that would sit on the shirt below moves above its own shirt", () => {
    const ps = [player(100, 60, "ILLESCAS"), player(104, 112, "JORDI")];
    const out = placePitch(ps, 300, 200);
    expect(out[0].plate).toBe("full");
    expect(out[0].plateDy).toBeLessThan(0);
    expect(clashes(ps, out)).toEqual([]);
  });

  it("with no room above or below, the plate shrinks to the dorsal", () => {
    const ps = [player(100, 30, "EGUZQUIZA"), player(100, 82, "ALCIDES"), player(100, 134, "EVANS")];
    const out = placePitch(ps, 300, 175);
    expect(out[1].plate).toBe("num");
    expect(clashes(ps, out)).toEqual([]);
  });

  it("tags facing each other: one column turns to the other side", () => {
    const ps = [player(100, 100, "A", 3), player(180, 100, "B", 3)];
    const out = placePitch(ps, 300, 200);
    expect(clashes(ps, out)).toEqual([]);
  });

  it("the viewer's plate is kept first", () => {
    const ps = [player(100, 30, "OTRO"), { ...player(100, 86, "YO"), first: true }, player(100, 138, "MAS")];
    const out = placePitch(ps, 300, 185);
    expect(out[1].plate).toBe("full");
    expect(clashes(ps, out)).toEqual([]);
  });

  it("any 3-2-1 (or a crowded 2-3-1) with four tags each stays clear on the phone's pitch", () => {
    const W = 330;
    const H = 232;
    const lineups = [
      // 3-2-1, our goal on the left
      [[0.08, 0.5], [0.3, 0.18], [0.26, 0.5], [0.3, 0.82], [0.54, 0.34], [0.54, 0.66], [0.8, 0.5]],
      // a crowded midfield
      [[0.08, 0.5], [0.28, 0.3], [0.28, 0.7], [0.5, 0.2], [0.5, 0.5], [0.5, 0.8], [0.78, 0.5]],
    ];
    for (const spots of lineups) {
      const ps = spots.map(([x, y], i) => player(x * W, y * H, ["EVANS", "ILLESCAS", "FER", "ADRIÁN T.C.", "EGUZQUIZA", "JORDI", "ALCIDES"][i], 4));
      expect(clashes(ps, placePitch(ps, W, H))).toEqual([]);
    }
  });

  it("the 1920 compact centre's short pitch (390 × 150, smaller shirts) with the acta's marks stays clear", () => {
    const W = 390;
    const H = 150;
    const spots = [[0.08, 0.5], [0.3, 0.2], [0.26, 0.5], [0.3, 0.8], [0.54, 0.34], [0.54, 0.66], [0.8, 0.5]];
    const tags = [1, 1, 2, 2, 3, 4, 1];
    const ps = spots.map(([x, y], i) => {
      const p = player(x * W, y * H, ["EVANS", "FER", "ERIK", "JORDI", "ADRIÁN T.C.", "KEVIN", "ALCIDES"][i], tags[i]);
      const s = 30 / SHIRT;
      return { ...p, shirt: { ...p.shirt, x: p.shirt.x + (p.shirt.w * (1 - s)) / 2, w: p.shirt.w * s, h: p.shirt.h * s } };
    });
    const out = placePitch(ps, W, H);
    expect(clashes(ps, out)).toEqual([]);
  });

  it("nothing to place without a measured pitch (server, tests)", () => {
    expect(placePitch([player(0, 0, "A", 2)], 0, 0)).toEqual([{ plate: "full", plateDy: 0, tags: "r", cols: 1, chips: "full", tagsDy: 0 }]);
  });
});
