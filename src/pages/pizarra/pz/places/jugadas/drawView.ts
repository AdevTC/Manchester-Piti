// r14 «La pizarra» · Dibujar, the pure side (PiDibujar.dc.html's render / strokeName / hitStroke on the app's strokes,
// lib/schemas strokeSchema): how a stored stroke is drawn on the pitch (its colour, a carrera through its middle, a
// zone as a box, a text as a label; the pinned ones — Unir, Foco, Medir between two players, the fuera de juego —
// follow the seven when the board is known), its name in words, which stroke a tap hits, and the new strokes of
// each tool. The app's stroke kinds: a «Flecha» is a straight carrera (two points), a «Carrera» bends through its
// middle (three). Colours: white · sky · gold = Blanco · Celeste · Amarillo. Tested in drawView.test.ts.
import type { BoardPoint, Stroke, StrokeColor } from "../../../../../lib/schemas";
import type { Lineup } from "../../../formations";
import { metres, metresTxt, offsideY } from "../../../v2/drawTools";
import type { OverlayPath, PathColor } from "../../store/types";
import { clamp, r1, type XY } from "./jugadasView";

export type ToolId = "lapiz" | "flecha" | "carrera" | "pase" | "zona" | "texto" | "borrar" | "mover" | "unir" | "foco" | "medir" | "fuera";
export const ICONS: Record<ToolId, { d: string; dash?: string }> = {
  lapiz: { d: "M4 17c3-1 4-7 7-7s3 6 6 5 3-6 3-6" },
  flecha: { d: "M5 19L19 5M10.5 5H19v8.5" },
  carrera: { d: "M4 19c2-9 8-13 15-13M14.5 3.5L19 6l-2.5 4.5" },
  pase: { d: "M4 12h12M13 7.5l5 4.5-5 4.5", dash: "3 2.6" },
  zona: { d: "M4.5 6.5h15v11h-15z", dash: "3 2.4" },
  texto: { d: "M5 6V4.5h14V6M12 4.5v15M9 19.5h6" },
  borrar: { d: "M16 4.5l4 4-9.5 9.5H6.5l-3-3zM9 10l5 5M11 19.5h9" },
  mover: { d: "M12 3.5v17M3.5 12h17M12 3.5L9.5 6M12 3.5L14.5 6M12 20.5L9.5 18M12 20.5L14.5 18M3.5 12L6 9.5M3.5 12L6 14.5M20.5 12L18 9.5M20.5 12L18 14.5" },
  unir: { d: "M6 17L12 6l6 11M6 17h12M6 17a2 2 0 1 0 0 .1M12 6a2 2 0 1 0 0 .1M18 17a2 2 0 1 0 0 .1" },
  foco: { d: "M12 4.5a7.5 7.5 0 1 0 0 15a7.5 7.5 0 1 0 0-15zM12 9.5a2.5 2.5 0 1 0 0 5a2.5 2.5 0 1 0 0-5z" },
  medir: { d: "M3.5 15.5l12-12 5 5-12 12zM7 12l2 2M10 9l1.5 1.5M13 6l2 2" },
  fuera: { d: "M3.5 12h17M6 8v8M18 8v8" },
};
/** One family of tools (A-JUG-10): draw · stick to players · erase, each with its word. */
export const TOOLS: [ToolId, string, string][] = [
  ["lapiz", "Lápiz", "Dibuja libre con el dedo"],
  ["flecha", "Flecha", "Arrastra de dónde a dónde"],
  ["carrera", "Carrera", "Un desmarque: sale curvo"],
  ["pase", "Pase", "El balón de uno a otro"],
  ["zona", "Zona", "Arrastra en diagonal"],
  ["texto", "Texto", "Toca donde va"],
  ["borrar", "Borrar", "Toca un trazo para quitarlo"],
];
export const STICK: [ToolId, string, string][] = [
  ["unir", "Unir", "Toca de 2 a 4 jugadores en orden y pulsa Unir otra vez"],
  ["foco", "Foco", "Toca un jugador"],
  ["medir", "Medir", "Arrastra de un punto a otro (campo de 40 × 60 m)"],
  ["fuera", "Fuera", "La línea del fuera de juego se mueve sola: nuestra, luego la suya, luego ninguna"],
];
export const COLORS: [StrokeColor, string, string][] = [
  ["white", "Blanco", "#ffffff"],
  ["sky", "Celeste", "#9fd0f2"],
  ["gold", "Amarillo", "#ffd77a"],
];
export const COLOR_PATH: Record<StrokeColor, PathColor> = { white: "blanco", sky: "celeste", gold: "amarillo" };
export const COLOR_WORD: Record<StrokeColor, string> = { white: "blanco", sky: "celeste", gold: "amarillo" };
export const MAX_STROKES = 60;

/** What the pinned strokes need to follow the seven: where each one stands, the board (fuera de juego). */
export interface DrawCtx {
  places: Record<string, BoardPoint>;
  lineup: Lineup;
  name: (pid: string) => string;
}
const P2 = (p: BoardPoint): XY => [p.x, p.y];

function isStroke(s: unknown): s is Stroke {
  const x = s as Partial<Stroke> | null;
  return !!x && typeof x === "object" && typeof x.kind === "string" && Array.isArray(x.points) && x.points.length > 0;
}
/** The control point that makes a quadratic pass through `mid` at its middle. */
const ctrl = (a: XY, mid: XY, b: XY): XY => [2 * mid[0] - (a[0] + b[0]) / 2, 2 * mid[1] - (a[1] + b[1]) / 2];
export function curveThrough(a: XY, mid: XY, b: XY): XY[] {
  const c = ctrl(a, mid, b);
  const out: XY[] = [];
  for (let j = 0; j <= 12; j++) {
    const t = j / 12;
    const u = 1 - t;
    out.push([u * u * a[0] + 2 * u * t * c[0] + t * t * b[0], u * u * a[1] + 2 * u * t * c[1] + t * t * b[1]]);
  }
  return out;
}
/** Where a stroke is now (pinned ones follow their players; the fuera de juego its line). */
export function livePts(s: Stroke, ctx: DrawCtx | null): XY[] {
  if (s.kind === "fuera") {
    const y = ctx ? (offsideY(ctx.lineup, s.side === "rival" ? "rival" : "nos", ctx.lineup.rival ?? null) ?? s.points[0].y) : s.points[0].y;
    return [
      [4, y],
      [96, y],
    ];
  }
  if (s.anchors && ctx && (s.kind === "unir" || s.kind === "foco" || s.kind === "medir")) return s.anchors.map((id, k) => P2(ctx.places[id] ?? s.points[k] ?? s.points[0]));
  return s.points.map(P2);
}
export const pinned = (s: Stroke) => s.kind === "unir" || s.kind === "foco" || s.kind === "fuera" || (s.kind === "medir" && !!s.anchors);

/** A stored stroke → the pitch's overlay path (null: nothing to draw). */
export function strokePath(raw: unknown, ctx: DrawCtx | null): OverlayPath | null {
  if (!isStroke(raw)) return null;
  const s = raw;
  const color = COLOR_PATH[s.color] ?? "blanco";
  const pts = livePts(s, ctx);
  if (s.kind === "texto") {
    const p = pts[0];
    return { kind: "lapiz", pts: [p, [p[0] + 0.01, p[1]]], label: s.text ?? "", color };
  }
  if (s.kind === "carrera") {
    if (pts.length >= 3) return { kind: "carrera", pts: curveThrough(pts[0], pts[1], pts[pts.length - 1]), color };
    return pts.length === 2 ? { kind: "flecha", pts, color } : null;
  }
  if (s.kind === "zona" && pts.length >= 2) {
    const a = pts[0];
    const b = pts[1];
    return { kind: "zona", pts: [a, [b[0], a[1]], b, [a[0], b[1]]], color, ...(s.text ? { label: s.text } : {}) };
  }
  if (s.kind === "medir" && pts.length >= 2) {
    const m = metresTxt(metres({ x: pts[0][0], y: pts[0][1] }, { x: pts[1][0], y: pts[1][1] }));
    const who = s.anchors && ctx ? `${ctx.name(s.anchors[0])} – ${ctx.name(s.anchors[1])}: ` : "";
    return { kind: "lapiz", pts: [pts[0], pts[1]], color, label: who + m };
  }
  if (s.kind === "unir") {
    if (pts.length < 2) return null;
    return pts.length > 2 ? { kind: "zona", pts, color } : { kind: "lapiz", pts, color };
  }
  if (s.kind === "foco") {
    const c = pts[0];
    const ring: XY[] = [];
    for (let j = 0; j < 14; j++) {
      const t = (j / 14) * Math.PI * 2;
      ring.push([c[0] + Math.cos(t) * 6, c[1] - 2.5 + Math.sin(t) * 4]);
    }
    return { kind: "zona", pts: ring, color };
  }
  if (s.kind === "fuera") return { kind: "lapiz", pts, color: "celeste", label: "Fuera de juego · " + (s.side === "rival" ? "la suya" : "nuestra línea") };
  if (pts.length < 2) return null;
  const kind = s.kind === "pase" || s.kind === "conduccion" || s.kind === "lapiz" ? s.kind : "lapiz";
  return { kind, pts, color, ...(s.text ? { label: s.text } : {}) };
}

/** The stroke's name, in words («Carrera de ALCIDES», «Texto «¡PRESIÓN!»», «Medida · 12,5 m»). */
export function strokeName(s: Stroke, ctx: DrawCtx | null, from?: string | null): string {
  const nm = (id: string) => (ctx ? ctx.name(id) : id);
  const who = from ? " de " + nm(from) : "";
  if (s.kind === "texto") return `Texto «${s.text ?? ""}»`;
  if (s.kind === "medir") return "Medida · " + (strokePath(s, ctx)?.label ?? "");
  if (s.kind === "unir") return "Unidos · " + (s.anchors ?? []).map(nm).join(", ");
  if (s.kind === "foco") return "Foco en " + nm(s.anchors?.[0] ?? "");
  if (s.kind === "fuera") return "Fuera de juego · " + (s.side === "rival" ? "la suya" : "nuestra línea");
  if (s.kind === "carrera") return (s.points.length === 2 ? "Flecha" : "Carrera") + who;
  const K: Record<string, string> = { lapiz: "Lápiz", pase: "Pase", zona: "Zona", conduccion: "Conducción" };
  return (K[s.kind] ?? "Trazo") + who;
}

function segDist(p: XY, a: XY, b: XY): number {
  const ax = a[0], ay = a[1] * 1.5, bx = b[0], by = b[1] * 1.5, px = p[0], py = p[1] * 1.5;
  const vx = bx - ax, vy = by - ay;
  const Lq = vx * vx + vy * vy || 1;
  const t = clamp(((px - ax) * vx + (py - ay) * vy) / Lq, 0, 1);
  return Math.hypot(px - ax - t * vx, py - ay - t * vy);
}
export const dd = (a: XY, b: XY) => Math.hypot(a[0] - b[0], (a[1] - b[1]) * 1.5);
/** The stroke under the finger, whatever the tool (A-JUG-11: one way to mark, one way to erase). */
export function hitStroke(strokes: Stroke[], pt: XY, ctx: DrawCtx | null): Stroke | null {
  let best: Stroke | null = null;
  let bv = 4.5;
  strokes.forEach((s) => {
    const r = strokePath(s, ctx);
    if (!r || !r.pts) return;
    if (r.kind === "zona") {
      const xs = r.pts.map((q) => q[0]);
      const ys = r.pts.map((q) => q[1]);
      if (pt[0] >= Math.min(...xs) && pt[0] <= Math.max(...xs) && pt[1] >= Math.min(...ys) && pt[1] <= Math.max(...ys)) {
        if (bv > 3) {
          bv = 3;
          best = s;
        }
        return;
      }
    }
    const tol = s.kind === "texto" ? 7 : 4.5;
    for (let k = 0; k < r.pts.length - 1; k++) {
      const d = segDist(pt, r.pts[k], r.pts[k + 1]);
      if (d < tol && d < bv) {
        bv = d;
        best = s;
      }
    }
    if (s.kind === "texto") {
      const d = dd(pt, r.pts[0]);
      if (d < tol && d < bv) {
        bv = d;
        best = s;
      }
    }
  });
  return best;
}
/** The one of the seven nearest to a point (within `max`, on the 2:3 pitch). */
export function nearPlayer(places: Record<string, BoardPoint>, pt: XY, max = 9): { pid: string; at: XY } | null {
  let best: { pid: string; at: XY } | null = null;
  let bv = max;
  Object.entries(places).forEach(([pid, p]) => {
    const d = dd(pt, P2(p));
    if (d < bv) {
      bv = d;
      best = { pid, at: P2(p) };
    }
  });
  return best;
}
const bp = (q: XY): BoardPoint => ({ x: r1(clamp(q[0], 0, 100)), y: r1(clamp(q[1], 0, 100)) });
/** Keeps at most `max` points of a freehand path, evenly. */
export function thin(pts: XY[], max: number): XY[] {
  if (pts.length <= max) return pts;
  const out: XY[] = [];
  const step = (pts.length - 1) / (max - 1);
  for (let k = 0; k < max; k++) out.push(pts[Math.round(k * step)]);
  return out;
}
/** The stroke a drag with a drawing tool makes (Spanish reason when there is none). */
export function strokeFrom(tool: ToolId, pts: XY[], color: StrokeColor, id: string): Stroke | string {
  const a = pts[0];
  const b = pts[pts.length - 1];
  if (tool === "zona") {
    if (Math.abs(a[0] - b[0]) < 4 || Math.abs(a[1] - b[1]) < 3) return "Arrastra en diagonal para marcar la zona";
    return { id, kind: "zona", color, points: [bp([Math.min(a[0], b[0]), Math.min(a[1], b[1])]), bp([Math.max(a[0], b[0]), Math.max(a[1], b[1])])] };
  }
  if (tool === "lapiz") {
    if (pts.length < 3) return "Trazo muy corto: arrastra un poco más";
    return { id, kind: "lapiz", color, points: thin(pts, 64).map(bp) };
  }
  if (dd(a, b) < 4) return "Trazo muy corto: arrastra un poco más";
  if (tool === "carrera") {
    const mid: XY = [(a[0] + b[0]) / 2 + (b[1] - a[1]) * 0.16, (a[1] + b[1]) / 2 - (b[0] - a[0]) * 0.16];
    return { id, kind: "carrera", color, points: [bp(a), bp(mid), bp(b)] };
  }
  if (tool === "flecha") return { id, kind: "carrera", color, points: [bp(a), bp(b)] };
  if (tool === "pase") return { id, kind: "pase", color, points: [bp(a), bp(b)] };
  return "Toca, no arrastres";
}
export { bp };
