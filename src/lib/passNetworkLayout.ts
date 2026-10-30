// «Gráficas del juego» › Red de pases: the drawing maths, kept pure so it can be tested without a DOM.
// Two boxes: the vertical pitch (400×560, the rival's goal at the top) and the ring (viewBox −60 −20 520 440 around
// a circle of radius 150 at 200,200). Every placed node carries its radius in those units (r), from which the
// shirt's size follows.

export interface NetNodeInput { id: string; involvement: number }
export interface PlacedNode { id: string; X: number; Y: number; r: number; ang?: number }
export interface Spot { x: number; y: number }
export type NetworkView = "campo" | "circulo";

export const PITCH_BOX = { x: 0, y: 0, w: 400, h: 560 } as const;
export const RING_BOX = { x: -60, y: -20, w: 520, h: 440, cx: 200, cy: 200, R: 150 } as const;

const r1 = (v: number) => Math.round(v * 10) / 10;

/** Node radius (box units) by passes given + received; the shirt's --s is r / 0.62. */
export const nodeRadius = (involvement: number, maxInvolvement: number) => (24 + 14 * Math.sqrt(Math.max(0, involvement) / Math.max(1, maxInvolvement))) * 0.62;
export const shirtSize = (r: number) => r1(r / 0.62);

/** Pushes overlapping nodes apart (a little more sideways than up and down) and keeps them on the pitch. */
export function relax(list: PlacedNode[], iterations = 160): PlacedNode[] {
  const out = list.map(n => ({ ...n }));
  for (let it = 0; it < iterations; it++) {
    for (let i = 0; i < out.length; i++) for (let j = i + 1; j < out.length; j++) {
      const a = out[i], b = out[j];
      let dx = b.X - a.X, dy = (b.Y - a.Y) * 0.8, d = Math.hypot(dx, dy);
      const need = a.r + b.r + 30;
      if (d >= need) continue;
      if (d < 0.01) { dx = i % 2 ? 1 : -1; dy = 0.2; d = Math.hypot(dx, dy); }
      const push = (need - d) / 2, ux = dx / d, uy = dy / d;
      a.X -= ux * push; a.Y -= uy * push * 0.7; b.X += ux * push; b.Y += uy * push * 0.7;
    }
    for (const n of out) { n.X = Math.max(42, Math.min(358, n.X)); n.Y = Math.max(52, Math.min(512, n.Y)); }
  }
  return out;
}

/** Each player at his minute-weighted spot (x 0 left → 100 right, y 0 the rival's goal), stretched min–max per axis
 *  to fill the pitch, then de-overlapped. A player without a spot stands in midfield. */
export function pitchLayout(nodes: readonly NetNodeInput[], spot: (id: string) => Spot | undefined): PlacedNode[] {
  const maxInv = Math.max(1, ...nodes.map(n => n.involvement));
  const ps = nodes.map(n => spot(n.id) ?? { x: 50, y: 60 });
  const xs = ps.map(p => p.x), ys = ps.map(p => p.y);
  const stretch = (lo: number, hi: number, from: number, span: number) => (v: number) => hi - lo < 1 ? 50 : from + (v - lo) / (hi - lo) * span;
  const sx = stretch(Math.min(...xs), Math.max(...xs), 12, 76), sy = stretch(Math.min(...ys), Math.max(...ys), 10, 80);
  return relax(nodes.map((n, i) => ({ id: n.id, X: 28 + sx(ps[i].x) * 3.44, Y: 26 + sy(ps[i].y) * 5.08, r: nodeRadius(n.involvement, maxInv) })));
}

/** Everyone on the circle in the given order (a team sheet: portero first), clockwise from the top. */
export function ringLayout(ordered: readonly NetNodeInput[]): PlacedNode[] {
  const maxInv = Math.max(1, ...ordered.map(n => n.involvement));
  return ordered.map((n, i) => {
    const ang = -Math.PI / 2 + i * 2 * Math.PI / ordered.length;
    return { id: n.id, X: RING_BOX.cx + RING_BOX.R * Math.cos(ang), Y: RING_BOX.cy + RING_BOX.R * Math.sin(ang), ang, r: nodeRadius(n.involvement, maxInv) };
  });
}

const ends = (a: PlacedNode, b: PlacedNode, cx: number, cy: number) => {
  const s = Math.hypot(cx - a.X, cy - a.Y) || 1, e = Math.hypot(cx - b.X, cy - b.Y) || 1;
  return `M${r1(a.X + (cx - a.X) / s * (a.r + 2))} ${r1(a.Y + (cy - a.Y) / s * (a.r + 2))} Q${r1(cx)} ${r1(cy)} ${r1(b.X + (cx - b.X) / e * (b.r + 5))} ${r1(b.Y + (cy - b.Y) / e * (b.r + 5))}`;
};

/** A pass on the pitch: a quadratic curve bent to the passer's left (so A→B and B→A never overlap), longer passes
 *  bend more; it starts and ends just outside both shirts. */
export function curvePath(a: PlacedNode, b: PlacedNode): string {
  const dx = b.X - a.X, dy = b.Y - a.Y, L = Math.hypot(dx, dy) || 1, bend = 6 + L * 0.06;
  return ends(a, b, (a.X + b.X) / 2 - dy / L * bend, (a.Y + b.Y) / 2 + dx / L * bend);
}

/** A pass on the ring: a chord bent toward the centre (and a little to the side, for the return pass). */
export function chordPath(a: PlacedNode, b: PlacedNode, centre: readonly [number, number] = [RING_BOX.cx, RING_BOX.cy]): string {
  const mx = (a.X + b.X) / 2, my = (a.Y + b.Y) / 2, dx = b.X - a.X, dy = b.Y - a.Y, L = Math.hypot(dx, dy) || 1;
  return ends(a, b, mx + (centre[0] - mx) * 0.45 - dy / L * 10, my + (centre[1] - my) * 0.45 + dx / L * 10);
}

/** Where a node's button sits in its box, in percent of the box. */
export function boxPercent(view: NetworkView, n: PlacedNode) {
  const box = view === "campo" ? PITCH_BOX : RING_BOX;
  return { px: r1((n.X - box.x) / box.w * 100), py: r1((n.Y - box.y) / box.h * 100) };
}

/** The ring's labels go outward: start/end anchored at the sides, centred above and below. */
export function ringLabel(n: PlacedNode): { lx: number; ly: number; anchor: "start" | "end" | "middle" } {
  const c = Math.cos(n.ang ?? 0), s = Math.sin(n.ang ?? 0), s2 = shirtSize(n.r);
  const anchor = c > 0.3 ? "start" : c < -0.3 ? "end" : "middle";
  const out = anchor === "middle" ? s2 * 0.68 + 10 : s2 * 0.5 + 6;
  return { lx: anchor === "middle" ? 0 : r1(c * out), ly: r1(s * out), anchor };
}

/** The lowest «at least N passes» that keeps the drawing readable (≤ limit edges). */
export function autoThreshold(counts: readonly number[], limit = 30): number {
  let t = 1;
  while (counts.filter(c => c >= t).length > limit) t++;
  return t;
}

export interface DirectedCount { from: string; to: string; completed: number }
/** The two players who meet most (both directions added), the stronger direction first. */
export function strongestPair(edges: readonly DirectedCount[]): { a: string; b: string; ab: number; ba: number } | null {
  const total = new Map<string, number>();
  for (const e of edges) { if (e.completed <= 0) continue; const k = JSON.stringify([e.from, e.to].sort()); total.set(k, (total.get(k) ?? 0) + e.completed); }
  const best = [...total].sort((x, y) => y[1] - x[1] || x[0].localeCompare(y[0]))[0];
  if (!best) return null;
  const [p, q] = JSON.parse(best[0]) as [string, string];
  const count = (f: string, t: string) => edges.find(e => e.from === f && e.to === t)?.completed ?? 0;
  const pq = count(p, q), qp = count(q, p);
  return pq >= qp ? { a: p, b: q, ab: pq, ba: qp } : { a: q, b: p, ab: qp, ba: pq };
}
