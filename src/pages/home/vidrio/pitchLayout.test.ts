import { describe, expect, it } from "vitest";
import { NUDGE, placePitch, tagsSize, type PitchPlace, type PitchPlayer, type Rect } from "./pitchLayout";
import { spotOf } from "../hoyModel";

const PLATE_H = 13;
/** A player whose shirt (`size` wide, the still's 1.32 tall) is centred at (cx, cy), a plate about 6.6 px a
 *  letter, and `tags` tags of 46 × 18. */
function player(cx: number, cy: number, name: string, tags = 0, size = 34): PitchPlayer {
  const shirt = { x: cx - size / 2, y: cy - (size * 1.32) / 2, w: size, h: size * 1.32 };
  const w = Math.round(name.length * 6.6);
  const words = name.split(" ");
  const plate2 = words.length > 1 ? { w: Math.round(Math.max(...words.map((x) => x.length)) * 6.6), h: PLATE_H * 2 } : null;
  return { shirt, plate: { x: cx - w / 2, y: shirt.y + shirt.h + 2, w, h: PLATE_H }, plate2, tags: tags ? { w: 46, h: tags * 18 + (tags - 1) * 3, n: tags } : null };
}

const area = (a: Rect, b: Rect) => Math.max(0, Math.min(a.x + a.w, b.x + b.w) - Math.max(a.x, b.x)) * Math.max(0, Math.min(a.y + a.h, b.y + b.h) - Math.max(a.y, b.y));

/** Every box on the pitch after the pass (shirts, plates, tags), where the pass put them. */
function boxes(ps: readonly PitchPlayer[], out: readonly PitchPlace[]): { r: Rect; who: number; kind: string }[] {
  const all: { r: Rect; who: number; kind: string }[] = [];
  ps.forEach((p, i) => {
    const o = out[i];
    const shirt = { ...p.shirt, x: p.shirt.x + o.nx, y: p.shirt.y + o.ny };
    all.push({ r: shirt, who: i, kind: "shirt" });
    const cx = p.plate.x + p.plate.w / 2;
    const plate = o.plate === "two" && p.plate2 ? { x: cx - p.plate2.w / 2, y: p.plate.y, w: p.plate2.w, h: p.plate2.h } : p.plate;
    all.push({ r: { ...plate, x: plate.x + o.nx + o.plateDx, y: plate.y + o.ny + o.plateDy }, who: i, kind: "plate" });
    if (o.tagsAt) all.push({ r: o.tagsAt, who: i, kind: "tags" });
  });
  return all;
}
const clashes = (ps: readonly PitchPlayer[], out: readonly PitchPlace[]) => {
  const b = boxes(ps, out);
  const hits: string[] = [];
  for (let i = 0; i < b.length; i++) for (let j = i + 1; j < b.length; j++) if (area(b[i].r, b[j].r) >= 1) hits.push(`${b[i].who}.${b[i].kind} × ${b[j].who}.${b[j].kind}`);
  return hits;
};
/** A name's plate on another player's shirt, plate or tags (what makes a name unreadable). */
const namesCovered = (ps: readonly PitchPlayer[], out: readonly PitchPlace[]) => clashes(ps, out).filter((h) => h.includes("plate") && !/^(\d+)\.\w+ × \1\./.test(h));
const outsideOf = (ps: readonly PitchPlayer[], out: readonly PitchPlace[], W: number, H: number) => boxes(ps, out).filter(({ r }) => r.x < -0.5 || r.y < -0.5 || r.x + r.w > W + 0.5 || r.y + r.h > H + 0.5);

const NAMES = ["EVANS", "FER", "ILLESCAS", "JORDI", "ADRIÁN T.C.", "EGUZQUIZA", "ALCIDES"];
/** The «Elegida» 3-2-1 in the pizarra's frame (x across, y their goal 0 → ours 100). */
const ELEGIDA: readonly (readonly [number, number])[] = [
  [50, 92],
  [18, 70],
  [50, 74],
  [82, 70],
  [34, 46],
  [66, 46],
  [50, 20],
];
/** The long season's J17 seven (a 2-3-1, the midfield in a line). */
const LARGA: readonly (readonly [number, number])[] = [
  [50, 92],
  [30, 72],
  [70, 72],
  [18, 46],
  [50, 50],
  [82, 46],
  [50, 18],
];

/** The seven on a pitch of W × H, horizontal (our goal on the left) or vertical (ours at the bottom). */
function seven(spots: readonly (readonly [number, number])[], W: number, H: number, vertical: boolean, tags: readonly number[], size: number) {
  return spots.map(([x, y], i) => {
    const s = spotOf(x, y);
    const at = vertical ? s.v : s.h;
    return player((at.left / 100) * W, (at.top / 100) * H, NAMES[i], tags[i], size);
  });
}

describe("placePitch", () => {
  it("a plate that would sit on the shirt below moves out of its way, and every name stays", () => {
    const ps = [player(100, 60, "ILLESCAS"), player(104, 116, "JORDI")];
    const out = placePitch(ps, 300, 200);
    expect(out.every((o) => o.plate === "one" || o.plate === "two")).toBe(true);
    expect(clashes(ps, out)).toEqual([]);
  });

  it("with no room above or below, the player moves a little (never more than 6 % of the pitch) and keeps his name", () => {
    const ps = [player(100, 34, "EGUZQUIZA"), player(100, 92, "ALCIDES"), player(100, 150, "EVANS")];
    const out = placePitch(ps, 300, 200);
    expect(namesCovered(ps, out)).toEqual([]);
    for (const o of out) {
      expect(Math.abs(o.nx)).toBeLessThanOrEqual(NUDGE * 300 + 0.5);
      expect(Math.abs(o.ny)).toBeLessThanOrEqual(NUDGE * 200 + 0.5);
    }
  });

  it("tags facing each other: one column turns to the other side", () => {
    const ps = [player(100, 100, "A", 3), player(180, 100, "B", 3)];
    const out = placePitch(ps, 300, 200);
    expect(clashes(ps, out)).toEqual([]);
  });

  it("tags never sit on a name: with both sides full they go in a row under it", () => {
    const ps = [player(60, 60, "IZQUIERDO"), player(110, 60, "CENTRO", 2), player(160, 60, "DERECHO")];
    const out = placePitch(ps, 220, 160);
    expect(namesCovered(ps, out)).toEqual([]);
  });

  it("a defender whose shirt touches the keeper's below (1440's upright pitch) keeps his name beside his shirt, never above it", () => {
    const ps = seven(ELEGIDA, 286, 272, true, [0, 0, 0, 0, 0, 0, 0], 36);
    const out = placePitch(ps, 286, 272);
    expect(namesCovered(ps, out)).toEqual([]);
    // ILLESCAS: his plate is not lifted over his shirt (where it read as ADRIÁN's second line)
    expect(out[2].plateDy).toBeGreaterThan(-ps[2].shirt.h);
  });

  it("the viewer's name (placed first) stays clear in a tight column", () => {
    const ps = [player(100, 30, "OTRO"), { ...player(100, 86, "YO"), first: true }, player(100, 138, "MAS")];
    const out = placePitch(ps, 300, 185);
    expect(namesCovered(ps, out).filter((h) => h.startsWith("1.") || h.includes("× 1."))).toEqual([]);
  });

  // the pitch sizes of every breakpoint: 1440's narrow ornament (vertical), 390 and 820 (horizontal), the 1920
  // centre (horizontal, 300 or 250 tall)
  const SIZES = [
    { at: "1440", W: 280, H: 262, vertical: true, size: 36 },
    { at: "390", W: 326, H: 232, vertical: false, size: 34 },
    { at: "820", W: 335, H: 252, vertical: false, size: 38 },
    { at: "1920", W: 377, H: 184, vertical: false, size: 32 },
    { at: "1920 (≤ 1199 tall)", W: 377, H: 140, vertical: false, size: 30 },
  ];
  const NIGHTS = [
    { night: "before", tags: [0, 0, 0, 0, 0, 0, 0] },
    { night: "live (2–1)", tags: [0, 0, 0, 1, 2, 1, 1] },
    { night: "the acta", tags: [1, 0, 0, 1, 3, 2, 1] },
  ];
  for (const lineup of [
    { name: "Elegida 3-2-1", spots: ELEGIDA },
    { name: "larga 2-3-1", spots: LARGA },
  ])
    for (const s of SIZES)
      for (const n of NIGHTS)
        it(`${lineup.name} at ${s.at}, ${n.night}: all seven names on the pitch and none covered`, () => {
          const ps = seven(lineup.spots, s.W, s.H, s.vertical, n.tags, s.size);
          const out = placePitch(ps, s.W, s.H);
          expect(out).toHaveLength(7);
          expect(namesCovered(ps, out)).toEqual([]);
          expect(outsideOf(ps, out, s.W, s.H).filter((b) => b.kind === "plate")).toEqual([]);
        });

  it("any 3-2-1 with four tags each keeps every name clear on the phone's pitch", () => {
    const W = 330;
    const H = 232;
    const spots = [[0.08, 0.5], [0.3, 0.18], [0.26, 0.5], [0.3, 0.82], [0.54, 0.34], [0.54, 0.66], [0.8, 0.5]];
    const ps = spots.map(([x, y], i) => player(x * W, y * H, NAMES[i], 4));
    expect(namesCovered(ps, placePitch(ps, W, H))).toEqual([]);
  });

  it("tagsSize folds a tall column in two", () => {
    expect(tagsSize({ w: 46, h: 60, n: 3 }, 2)).toEqual({ w: 95, h: 39 });
    expect(tagsSize({ w: 46, h: 60, n: 3 }, 1, "icon")).toEqual({ w: 21, h: 60 });
  });

  it("nothing to place without a measured pitch (server, tests)", () => {
    expect(placePitch([player(0, 0, "A", 2)], 0, 0)).toEqual([{ plate: "one", plateDx: 0, plateDy: 0, nx: 0, ny: 0, tags: "r", cols: 1, chips: "full", tagsAt: null }]);
  });
});
