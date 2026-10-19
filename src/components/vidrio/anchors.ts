// The floating things' snapping, pure: a draggable glass object (the floating score, the «Sacar el marcador»
// window) moves freely while held and springs to the nearest anchor when let go: the nine points (corners, edge
// centres, centre), only the corners, or — on a phone — along the bottom edge only. Positions are the element's
// top-left corner in its zone, in px.
export interface Pos {
  x: number;
  y: number;
}
/** The zone (W × H) and the element (w × h). */
export interface Box {
  W: number;
  H: number;
  w: number;
  h: number;
}
export type AnchorSet = "nine" | "eight" | "corners";
/** «both»: anywhere; «x»: along the bottom edge only (the phone's float above the tab bar). */
export type DragAxis = "both" | "x";

export interface AnchorOptions {
  anchors?: AnchorSet;
  axis?: DragAxis;
  /** Distance kept from the zone's sides (default 16). */
  margin?: number;
  /** Highest y allowed (default: margin) — the desktop float keeps 16 px under the top bar. */
  top?: number;
  /** Space kept at the bottom (default: margin) — the phone's tab bar. */
  bottom?: number;
}

const m = (o: AnchorOptions) => o.margin ?? 16;
const topOf = (o: AnchorOptions) => o.top ?? m(o);
const bottomY = (b: Box, o: AnchorOptions) => b.H - b.h - (o.bottom ?? m(o));
const maxX = (b: Box, o: AnchorOptions) => Math.max(m(o), b.W - b.w - m(o));

/** Keeps a position inside the zone's margins (and on the bottom edge for axis «x»). */
export function clampPos(p: Pos, b: Box, o: AnchorOptions = {}): Pos {
  const x = Math.max(m(o), Math.min(maxX(b, o), p.x));
  if (o.axis === "x") return { x, y: Math.max(topOf(o), bottomY(b, o)) };
  return { x, y: Math.max(topOf(o), Math.min(Math.max(topOf(o), bottomY(b, o)), p.y)) };
}

/** Every anchor of the zone. */
export function anchorPoints(b: Box, o: AnchorOptions = {}): Pos[] {
  const xs = [m(o), (b.W - b.w) / 2, maxX(b, o)];
  const ys = o.axis === "x" ? [bottomY(b, o)] : [topOf(o), (topOf(o) + bottomY(b, o)) / 2, bottomY(b, o)];
  const out: Pos[] = [];
  xs.forEach((x, i) =>
    ys.forEach((y, j) => {
      if (o.anchors === "corners" && o.axis !== "x" && (i === 1 || j === 1)) return;
      // (eight: every anchor but the screen's centre — the floating score never rests over the page's middle)
      if (o.anchors === "eight" && o.axis !== "x" && i === 1 && j === 1) return;
      out.push(clampPos({ x, y }, b, o));
    }),
  );
  return out;
}

const d2 = (a: Pos, c: Pos) => (a.x - c.x) ** 2 + (a.y - c.y) ** 2;

/** The anchor nearest to where it was let go. */
export function nearestAnchor(p: Pos, b: Box, o: AnchorOptions = {}): Pos {
  let best = clampPos(p, b, o);
  let dist = Infinity;
  for (const a of anchorPoints(b, o)) {
    const dd = d2(a, p);
    if (dd < dist) {
      dist = dd;
      best = a;
    }
  }
  return best;
}

export type StepKey = "ArrowLeft" | "ArrowRight" | "ArrowUp" | "ArrowDown";
const DIRS: Record<StepKey, [number, number]> = { ArrowLeft: [-1, 0], ArrowRight: [1, 0], ArrowUp: [0, -1], ArrowDown: [0, 1] };
export const isStepKey = (k: string): k is StepKey => k in DIRS;

/** The nearest anchor in an arrow's direction (keyboard moves), or null when there is none that way. */
export function stepAnchor(p: Pos, key: StepKey, b: Box, o: AnchorOptions = {}): Pos | null {
  const [dx, dy] = DIRS[key];
  let best: Pos | null = null;
  let dist = Infinity;
  for (const a of anchorPoints(b, o)) {
    if ((a.x - p.x) * dx + (a.y - p.y) * dy <= 2) continue;
    const dd = d2(a, p);
    if (dd < dist) {
      dist = dd;
      best = a;
    }
  }
  return best;
}

/** Where it goes while held: the start plus the pointer's travel, inside the zone (y fixed for axis «x»). */
export function dragTo(start: Pos, dx: number, dy: number, b: Box, o: AnchorOptions = {}): Pos {
  const x = Math.max(0, Math.min(b.W - b.w, start.x + dx));
  if (o.axis === "x") return { x, y: start.y };
  return { x, y: Math.max(0, Math.min(b.H - b.h, start.y + dy)) };
}

/** A position read back from storage (anything broken: null). */
export function parsePos(raw: string | null): Pos | null {
  if (!raw) return null;
  try {
    const v: unknown = JSON.parse(raw);
    if (!v || typeof v !== "object") return null;
    const { x, y } = v as Record<string, unknown>;
    return typeof x === "number" && typeof y === "number" && Number.isFinite(x) && Number.isFinite(y) ? { x, y } : null;
  } catch {
    return null;
  }
}

/** A pointer that moved less than this (px, |dx| + |dy|) was a tap, not a drag. */
export const DRAG_SLOP = 5;
