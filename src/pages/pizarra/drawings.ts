// Pure ops for the telestrator: what gets drawn over the pitch of a board. No React. Points are
// pitch % in the board's frame (y 0 = rival goal line, 100 = ours). Unit-tested in drawings.test.ts.
import { PIZARRA_LIMITS, strokeSchema, type BoardPoint, type Stroke, type StrokeColor, type StrokeKind } from "../../lib/schemas";
import { reportDroppedDoc } from "../../lib/docTelemetry";

export type { Stroke, StrokeColor, StrokeKind };

const clamp = (v: number, a: number, b: number) => (v < a ? a : v > b ? b : v);
const round = (v: number) => Math.round(v * 10) / 10;
/** A point on the pitch (clamped, one decimal: enough for a finger, light to store). */
export const clampPoint = (p: BoardPoint): BoardPoint => ({ x: round(clamp(p.x, 0, 100)), y: round(clamp(p.y, 0, 100)) });

const dist = (a: BoardPoint, b: BoardPoint) => Math.hypot(a.x - b.x, a.y - b.y);
/** Distance from p to the segment a–b. */
function segDist(p: BoardPoint, a: BoardPoint, b: BoardPoint) {
  const dx = b.x - a.x, dy = b.y - a.y, len2 = dx * dx + dy * dy;
  if (len2 === 0) return dist(p, a);
  const t = clamp(((p.x - a.x) * dx + (p.y - a.y) * dy) / len2, 0, 1);
  return Math.hypot(p.x - (a.x + t * dx), p.y - (a.y + t * dy));
}
/** Ramer–Douglas–Peucker: the points that matter for the shape, within `eps` (pitch %). */
function rdp(pts: BoardPoint[], eps: number): BoardPoint[] {
  if (pts.length < 3) return pts.slice();
  const keep = new Uint8Array(pts.length);
  keep[0] = keep[pts.length - 1] = 1;
  const stack: [number, number][] = [[0, pts.length - 1]];
  while (stack.length) {
    const [a, b] = stack.pop()!;
    let worst = -1, at = -1;
    for (let i = a + 1; i < b; i++) {
      const d = segDist(pts[i], pts[a], pts[b]);
      if (d > worst) {
        worst = d;
        at = i;
      }
    }
    if (at >= 0 && worst > eps) {
      keep[at] = 1;
      stack.push([a, at], [at, b]);
    }
  }
  return pts.filter((_, i) => keep[i]);
}

/**
 * Simplifies a freehand path to at most `max` points: drops jitter (points closer than 0.4% to the
 * previous one), then RDP with a growing tolerance until it fits. Ends are always kept.
 */
export function simplifyPoints(points: BoardPoint[], max: number = PIZARRA_LIMITS.strokePoints): BoardPoint[] {
  const pts: BoardPoint[] = [];
  points.map(clampPoint).forEach((p, i, all) => {
    if (i === 0 || i === all.length - 1 || dist(p, pts[pts.length - 1]) >= 0.4) pts.push(p);
  });
  if (pts.length <= max) return pts;
  let eps = 0.25;
  let out = rdp(pts, eps);
  while (out.length > Math.max(2, max)) {
    eps *= 1.6;
    out = rdp(pts, eps);
  }
  return out;
}

/** Minimum travel (pitch %) for a drag to count as a stroke instead of a tap. */
export const MIN_STROKE_LENGTH = 2;

let seq = 0;
/** Short unique id for a stroke/jugada/rival (stored, so kept small). */
export function newId(prefix: string): string {
  seq = (seq + 1) % 1296;
  return `${prefix}${Date.now().toString(36)}${seq.toString(36).padStart(2, "0")}`;
}

/**
 * Builds a stroke from the raw pointer path of one gesture, or null if it is not one (a tap, or a
 * text without text). Arrows keep start, middle and end (drawn as a curve through them); a zona
 * keeps the two opposite corners of the drag; the pencil keeps its simplified path; a texto is
 * placed where the finger lifted.
 */
export function makeStroke(kind: StrokeKind, color: StrokeColor, path: BoardPoint[], text?: string): Stroke | null {
  if (!path.length) return null;
  const pts = path.map(clampPoint);
  if (kind === "texto") {
    const t = (text ?? "").trim().slice(0, PIZARRA_LIMITS.strokeText);
    return t ? { id: newId("k"), kind, color, points: [pts[pts.length - 1]], text: t } : null;
  }
  const first = pts[0], last = pts[pts.length - 1];
  let travel = 0;
  for (let i = 1; i < pts.length; i++) travel = Math.max(travel, dist(first, pts[i]));
  if (travel < MIN_STROKE_LENGTH) return null;
  const points =
    kind === "lapiz" ? simplifyPoints(pts) : kind === "zona" ? [first, last] : pts.length < 3 ? [first, last] : [first, pts[Math.floor(pts.length / 2)], last];
  if (kind === "zona" && (Math.abs(first.x - last.x) < 1 || Math.abs(first.y - last.y) < 1)) return null;
  return { id: newId("k"), kind, color, points };
}

export const canAddStroke = (list: Stroke[]) => list.length < PIZARRA_LIMITS.strokes;

/** Adds a stroke; the same list back when it is full (≤ 60) or the stroke is invalid. */
export function addStroke(list: Stroke[], stroke: Stroke | null): Stroke[] {
  if (!stroke || !canAddStroke(list) || !strokeSchema.safeParse(stroke).success) return list;
  return [...list, stroke];
}
/** Undo: drops the last stroke. */
export const undoStroke = (list: Stroke[]): Stroke[] => (list.length ? list.slice(0, -1) : list);
export const removeStroke = (list: Stroke[], id: string): Stroke[] => list.filter((s) => s.id !== id);
export const clearStrokes = (): Stroke[] => [];

/** Firestore payload (no `undefined`). */
export function strokeToData(s: Stroke): Record<string, unknown> {
  const out: Record<string, unknown> = { id: s.id, kind: s.kind, color: s.color, points: s.points.map((p) => ({ x: p.x, y: p.y })) };
  if (s.text !== undefined) out.text = s.text;
  return out;
}

/**
 * Reads the `drawings` of a stored board: anything that is not a list is no drawings; each invalid
 * stroke is dropped (and reported) without losing the rest; at most 60 are kept.
 */
export function parseDrawings(raw: unknown, docId = "-"): Stroke[] {
  if (!Array.isArray(raw)) return [];
  const out: Stroke[] = [];
  raw.forEach((item, i) => {
    const r = strokeSchema.safeParse(item);
    if (r.success) out.push(r.data);
    else reportDroppedDoc("lineups.drawings", `${docId}#${i}`, r.error.issues);
  });
  return out.slice(0, PIZARRA_LIMITS.strokes);
}
