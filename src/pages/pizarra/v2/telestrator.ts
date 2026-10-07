// La pizarra «Noche de partido» — the telestrator (Dibujar): the tools and colours as designed, the
// pointer on the frame turned into pitch points (TV perspective or cenital, like the drag controller),
// the strokes drawn as light in the frame's 1000×1000 box (dotted carrera, pase with its arrowhead,
// wavy conducción, translucent zona, freehand lápiz, texto), which stroke a tap lands on, and the
// telestrator's own undo stack. Pure: the board keeps the strokes in the lineup's `drawings`.
import type { BoardPoint } from "../../../lib/schemas";
import { clampPoint, type Stroke, type StrokeColor, type StrokeKind } from "../drawings";
import { f1, proj, unproj, type Cam } from "./geometry";

export const TOOLS: { k: StrokeKind; label: string }[] = [
  { k: "carrera", label: "Carrera" },
  { k: "pase", label: "Pase" },
  { k: "conduccion", label: "Conduce" },
  { k: "zona", label: "Zona" },
  { k: "lapiz", label: "Lápiz" },
  { k: "texto", label: "Texto" },
];
export const COLORS: { k: StrokeColor; label: string; hex: string }[] = [
  { k: "sky", label: "Cielo", hex: "#9fd0f2" },
  { k: "gold", label: "Oro", hex: "#FFC659" },
  { k: "white", label: "Blanco", hex: "#f4f8ff" },
];
/** What the hint says the tool draws. */
export const TOOL_HINT: Record<StrokeKind, string> = {
  carrera: "carrera (puntos de luz)",
  pase: "pase (línea)",
  conduccion: "conducción (onda)",
  zona: "zona (arrastra en diagonal)",
  lapiz: "lápiz libre",
  texto: "texto (toca donde va)",
};
export const KIND_NAME: Record<StrokeKind, string> = { carrera: "Carrera", pase: "Pase", conduccion: "Conducción", zona: "Zona", lapiz: "Lápiz", texto: "Texto" };
export const COLOR_NAME: Record<StrokeColor, string> = { sky: "cielo", gold: "oro", white: "blanco" };
/** The design's colour classes (c-s / c-g / c-w). */
export const colorCls = (c: StrokeColor): string => "c-" + (c === "sky" ? "s" : c === "gold" ? "g" : "w");
/** «Pase · oro», «Texto «¡PRESIÓN!» · cielo». */
export const strokeLabel = (s: Stroke): string => KIND_NAME[s.kind] + (s.kind === "texto" && s.text ? " «" + s.text + "»" : "") + " · " + COLOR_NAME[s.color];

/** A point of the frame (x, y in % of the drawn frame) → the pitch point under it (clamped). */
export function framePointToPitch(C: Cam, X: number, Y: number): BoardPoint {
  const p = unproj(C, X, Y);
  return clampPoint({ x: p.u, y: p.v });
}

/** The finger's path while drawing, in the 1000×1000 box (frame % in). */
export function liveD(pts: [number, number][]): string {
  return pts.map(([x, y], i) => (i ? "L" : "M") + f1(x * 10) + " " + f1(y * 10)).join("");
}

type UV = [number, number];
const SAMPLES = 24;

/** The arrow's spine on the pitch: a smooth curve through start, middle and end (a polyline through
 *  any other number of points). */
function spine(pts: BoardPoint[]): UV[] {
  if (pts.length === 3) {
    const [a, m, b] = pts;
    // the quadratic that passes through the middle point at t = ½
    const c = { x: 2 * m.x - (a.x + b.x) / 2, y: 2 * m.y - (a.y + b.y) / 2 };
    return Array.from({ length: SAMPLES + 1 }, (_, k) => {
      const t = k / SAMPLES;
      const s = 1 - t;
      return [s * s * a.x + 2 * s * t * c.x + t * t * b.x, s * s * a.y + 2 * s * t * c.y + t * t * b.y];
    });
  }
  const out: UV[] = [];
  const per = Math.max(2, Math.round(SAMPLES / Math.max(1, pts.length - 1)));
  for (let k = 0; k < pts.length - 1; k++) {
    const a = pts[k];
    const b = pts[k + 1];
    for (let j = 0; j < per; j++) out.push([a.x + ((b.x - a.x) * j) / per, a.y + ((b.y - a.y) * j) / per]);
  }
  const e = pts[pts.length - 1];
  out.push([e.x, e.y]);
  return out;
}

/** The conducción's wave: the spine pushed side to side along its normal (pitch %). */
function wave(sp: UV[]): UV[] {
  return sp.map((p, k) => {
    if (k === 0 || k === sp.length - 1) return p;
    const a = sp[k - 1];
    const b = sp[k + 1];
    const nx = -(b[1] - a[1]);
    const ny = b[0] - a[0];
    const nl = Math.hypot(nx, ny) || 1;
    const w = Math.sin(k * 1.3) * 1.3;
    return [p[0] + (nx / nl) * w, p[1] + (ny / nl) * w];
  });
}

const box = (C: Cam, p: UV): UV => {
  const q = proj(C, p[0], p[1]);
  return [q.x * 10, q.y * 10];
};
const pathOf = (P: UV[]): string => P.map((q, i) => (i ? "L" : "M") + f1(q[0]) + " " + f1(q[1])).join("");

/** The arrowhead at the end of a path in the box (the frame is Fh times taller than wide). */
function headOf(P: UV[], Fh: number): string {
  const b = P[P.length - 1];
  const a = P[Math.max(0, P.length - 2)];
  let hx = b[0] - a[0];
  let hy = (b[1] - a[1]) * Fh;
  const hl = Math.hypot(hx, hy) || 1;
  hx /= hl;
  hy /= hl;
  const hs = 22;
  const cs = Math.cos(0.5);
  const sn = Math.sin(0.5);
  const h1: UV = [b[0] - hs * (hx * cs - hy * sn), b[1] - (hs * (hy * cs + hx * sn)) / Fh];
  const h2: UV = [b[0] - hs * (hx * cs + hy * sn), b[1] - (hs * (hy * cs - hx * sn)) / Fh];
  return "M" + f1(h1[0]) + " " + f1(h1[1]) + "L" + f1(b[0]) + " " + f1(b[1]) + "L" + f1(h2[0]) + " " + f1(h2[1]);
}

/** A zona's rectangle on the pitch (from its two opposite corners). */
const rectOf = (s: Stroke) => {
  const a = s.points[0];
  const b = s.points[s.points.length - 1];
  return { u0: Math.min(a.x, b.x), u1: Math.max(a.x, b.x), v0: Math.min(a.y, b.y), v1: Math.max(a.y, b.y) };
};

/** A stroke as the frame draws it: the outline (box units) of each part, and its hit line (frame %). */
interface Shape {
  zone: string;
  dash: string;
  solid: string;
  head: string;
  /** The line a tap is measured against, in frame % (x, y). */
  hit: UV[];
}
function shapeOf(s: Stroke, C: Cam): Shape {
  const none: Shape = { zone: "", dash: "", solid: "", head: "", hit: [] };
  if (s.kind === "texto") {
    const q = proj(C, s.points[0].x, s.points[0].y);
    return { ...none, hit: [[q.x, q.y]] };
  }
  if (s.kind === "zona") {
    const r = rectOf(s);
    const P = [box(C, [r.u0, r.v0]), box(C, [r.u1, r.v0]), box(C, [r.u1, r.v1]), box(C, [r.u0, r.v1])];
    return { ...none, zone: pathOf(P) + "Z", hit: [...P, P[0]].map(([x, y]) => [x / 10, y / 10]) };
  }
  if (s.kind === "lapiz") {
    const P = s.points.map((p) => box(C, [p.x, p.y]));
    return { ...none, solid: pathOf(P), hit: P.map(([x, y]) => [x / 10, y / 10]) };
  }
  const base = spine(s.points);
  const P = (s.kind === "conduccion" ? wave(base) : base).map((p) => box(C, p));
  const d = pathOf(P);
  return {
    ...none,
    dash: s.kind === "carrera" ? d : "",
    solid: s.kind === "carrera" ? "" : d,
    head: headOf(base.map((p) => box(C, p)), C.Fh),
    hit: P.map(([x, y]) => [x / 10, y / 10]),
  };
}

export interface InkPath {
  id: string;
  cls: string;
  /** Delay before it draws itself (the strokes already there light up one after another). */
  dl: string;
  zone: string;
  dash: string;
  solid: string;
  head: string;
  sel: boolean;
}
export interface InkText {
  id: string;
  cls: string;
  x: string;
  y: string;
  text: string;
  sel: boolean;
}

/** What the ink layer draws for a board's strokes. `fresh` = drawn just now: no waiting in line. */
export function inkView(strokes: Stroke[], C: Cam, selId: string | null, fresh: ReadonlySet<string> = new Set()): { paths: InkPath[]; texts: InkText[] } {
  const paths: InkPath[] = [];
  const texts: InkText[] = [];
  strokes.forEach((s, n) => {
    const cls = colorCls(s.color);
    const sel = s.id === selId;
    if (s.kind === "texto") {
      const q = proj(C, s.points[0].x, s.points[0].y);
      texts.push({ id: s.id, cls, x: q.x.toFixed(2), y: q.y.toFixed(2), text: s.text ?? "", sel });
      return;
    }
    const sh = shapeOf(s, C);
    const dl = fresh.has(s.id) ? 0 : Math.min(2.5, n * 0.25);
    paths.push({ id: s.id, cls, dl: dl.toFixed(2) + "s", zone: sh.zone, dash: sh.dash, solid: sh.solid, head: sh.head, sel });
  });
  return { paths, texts };
}

/** Distance from p to the segment a–b, with the frame's height counted as Fh × its width. */
function segDist(p: UV, a: UV, b: UV, Fh: number): number {
  const ax = a[0];
  const ay = a[1] * Fh;
  const bx = b[0];
  const by = b[1] * Fh;
  const px = p[0];
  const py = p[1] * Fh;
  const dx = bx - ax;
  const dy = by - ay;
  const l2 = dx * dx + dy * dy;
  const t = l2 ? Math.max(0, Math.min(1, ((px - ax) * dx + (py - ay) * dy) / l2)) : 0;
  return Math.hypot(px - (ax + t * dx), py - (ay + t * dy));
}

/** How close (in % of the frame's width) a tap must land to pick a stroke; a texto's label is bigger. */
export const HIT_TOL = 4.5;
const TEXT_TOL = 7;

/** The stroke a tap at (X, Y) of the frame lands on (the nearest within reach; inside a zona counts),
 *  or null. Later strokes win ties: they are drawn on top. */
export function hitStroke(strokes: Stroke[], C: Cam, X: number, Y: number): string | null {
  let best: string | null = null;
  let bd = Infinity;
  const p: UV = [X, Y];
  const at = unproj(C, X, Y);
  strokes.forEach((s) => {
    const sh = shapeOf(s, C);
    let d = Infinity;
    let tol = HIT_TOL;
    if (s.kind === "texto") {
      d = segDist(p, sh.hit[0], sh.hit[0], C.Fh);
      tol = TEXT_TOL;
    } else {
      for (let k = 0; k < sh.hit.length - 1; k++) d = Math.min(d, segDist(p, sh.hit[k], sh.hit[k + 1], C.Fh));
      if (s.kind === "zona") {
        const r = rectOf(s);
        if (at.u >= r.u0 && at.u <= r.u1 && at.v >= r.v0 && at.v <= r.v1) d = Math.min(d, tol * 0.99);
      }
    }
    if (d <= tol && d <= bd) {
      bd = d;
      best = s.id;
    }
  });
  return best;
}

// ── the telestrator's own undo: the strokes as they were before each change ──
export const INK_UNDO_MAX = 40;
export const pushInk = (past: Stroke[][], before: Stroke[]): Stroke[][] => past.concat([before]).slice(-INK_UNDO_MAX);
