// The star map's names (Constellation): each name sits under its star unless that would put it on another name or
// another star; then above it, to its right or to its left. When every spot is taken it gives way (`crowded`: the
// star still says its name on tap, on focus and to a screen reader). The bigger stars choose first. Boxes are in
// the map's own px, as laid out (no entrance transforms).

export interface SkyBox {
  l: number;
  t: number;
  w: number;
  h: number;
}

export interface SkyItem {
  /** The name where the layout puts it (under the star). */
  label: SkyBox;
  /** The star's dot. */
  dot: SkyBox;
  /** Who chooses first (the dot's size: the more goals and assists, the bigger). */
  weight: number;
}

export interface SkyPlace {
  dx: number;
  dy: number;
  crowded: boolean;
}

const overlap = (a: SkyBox, b: SkyBox) => Math.max(0, Math.min(a.l + a.w, b.l + b.w) - Math.max(a.l, b.l)) * Math.max(0, Math.min(a.t + a.h, b.t + b.h) - Math.max(a.t, b.t));
const outside = (a: SkyBox, W: number, H: number) => a.w * a.h - overlap(a, { l: 0, t: 0, w: W, h: H });

export function placeSkyLabels(items: readonly SkyItem[], W: number, H: number, gap = 4): SkyPlace[] {
  const out: SkyPlace[] = items.map(() => ({ dx: 0, dy: 0, crowded: false }));
  const taken: SkyBox[] = items.map((i) => i.dot);
  const order = items.map((_, i) => i).sort((a, b) => items[b].weight - items[a].weight || a - b);
  for (const i of order) {
    const { label: L, dot: D } = items[i];
    const level = D.t + D.h / 2 - L.h / 2 - L.t;
    const spots = [
      { dx: 0, dy: 0 },
      { dx: 0, dy: D.t - gap - L.h - L.t },
      { dx: D.l + D.w + gap - L.l, dy: level },
      { dx: D.l - gap - L.w - L.l, dy: level },
    ];
    let best = spots[0];
    let hit = Infinity;
    for (const s of spots) {
      const box = { l: L.l + s.dx, t: L.t + s.dy, w: L.w, h: L.h };
      const h = taken.reduce((sum, b) => sum + overlap(box, b), 0) + outside(box, W, H);
      if (h < hit - 0.5) {
        best = s;
        hit = h;
      }
      if (h <= 0.5) break;
    }
    const crowded = hit > 0.5;
    out[i] = { dx: Math.round(best.dx), dy: Math.round(best.dy), crowded };
    if (!crowded) taken.push({ l: L.l + best.dx, t: L.t + best.dy, w: L.w, h: L.h });
  }
  return out;
}
