// Dibujar, Bloque 4: the strokes that follow the players. «Unir» (a line or a polygon pinned to 2–4 of
// the seven: the línea defensiva, a rombo), «Foco» (a spotlight on one), «Medir» (metres on a 7-a-side
// pitch, 60 × 40 m by default, between two points or two players) and «Fuera de juego» (the line at the
// last defender, ours or theirs, that moves by itself). They are ordinary strokes of the board's
// `drawings` (so the telestrator's undo / redo, the list and the delete work on them as on any other);
// this file builds them, says where they are now, draws and hits them on the frame, and lays them out
// for the cartel. Pure.
import type { BoardPoint } from "../../../lib/schemas";
import type { Lineup } from "../formations";
import { clampPoint, newId, type Stroke, type StrokeColor } from "../drawings";
import { f1, proj, slotPos, type Cam } from "./geometry";
import { COLOR_NAME, COLORS, colorCls } from "./telestrator";
import { isExtraKind } from "./drawKinds";
import { rivalAria, rivalSpots, type RivalSeven } from "./rival";

/** The pitch in metres (fútbol 7): across (x) and along (y). */
export const PITCH_M = { w: 40, l: 60 } as const;
/** Two points closer than this (pitch %) are not a measurement. */
const MIN_MEDIR = 1.5;

/** Metres between two pitch points (x across the width, y along the length). */
export function metres(a: BoardPoint, b: BoardPoint, dims: { w: number; l: number } = PITCH_M): number {
  return Math.hypot(((a.x - b.x) / 100) * dims.w, ((a.y - b.y) / 100) * dims.l);
}
/** «12,5 m», «8 m». */
export const metresTxt = (m: number): string => String(Math.round(m * 10) / 10).replace(".", ",") + " m";

/** Where each of the seven stands on the board now (pitch %), by player. */
export function boardPlaces(L: Lineup): Record<string, BoardPoint> {
  const out: Record<string, BoardPoint> = {};
  L.slots.forEach((s, i) => {
    if (!s.playerId) return;
    const p = slotPos(L, i);
    out[s.playerId] = { x: p.u, y: p.v };
  });
  return out;
}

export type Side = "nos" | "rival";

/**
 * Where the fuera de juego line is (pitch y): at our last defender (the second deepest of the seven,
 * the keeper being the deepest) or at theirs (their second closest to their goal line, y 0). Never past
 * halfway (no fuera de juego in your own half). Null when that side has fewer than two on the pitch.
 */
export function offsideY(L: Lineup, side: Side, rival: RivalSeven | null | undefined): number | null {
  if (side === "nos") {
    const ys = L.slots.map((s, i) => (s.playerId ? slotPos(L, i).v : null)).filter((v): v is number => v !== null).sort((a, b) => b - a);
    return ys.length < 2 ? null : Math.max(50, ys[1]);
  }
  if (!rival) return null;
  const ys = rivalSpots(rival)
    .map((p) => p.y)
    .sort((a, b) => a - b);
  return ys.length < 2 ? null : Math.min(50, ys[1]);
}

/** Where a stroke is now: pinned ones follow their players (their stored points are the fallback for
 *  one who left the pitch), the fuera de juego its line; the rest are as drawn. */
export function livePoints(s: Stroke, places: Record<string, BoardPoint>, L: Lineup, rival: RivalSeven | null | undefined): BoardPoint[] {
  if (s.kind === "fuera") {
    const y = offsideY(L, s.side ?? "nos", rival) ?? s.points[0].y;
    return [
      { x: 0, y },
      { x: 100, y },
    ];
  }
  if (s.anchors && (s.kind === "unir" || s.kind === "foco" || s.kind === "medir")) return s.anchors.map((id, k) => places[id] ?? s.points[k] ?? s.points[0]);
  return s.points;
}

// ── building them ──

/** «Unir» 2 to 4 different players of the seven (null otherwise). */
export function makeUnir(ids: string[], places: Record<string, BoardPoint>, color: StrokeColor): Stroke | null {
  const uniq = [...new Set(ids)].filter((id) => places[id]);
  if (uniq.length < 2 || uniq.length > 4 || uniq.length !== ids.length) return null;
  return { id: newId("k"), kind: "unir", color, anchors: uniq, points: uniq.map((id) => clampPoint(places[id])) };
}
/** «Foco» on one of the seven. */
export function makeFoco(id: string, places: Record<string, BoardPoint>, color: StrokeColor): Stroke | null {
  const at = places[id];
  return at ? { id: newId("k"), kind: "foco", color, anchors: [id], points: [clampPoint(at)] } : null;
}
/** «Medir» from a to b (pinned to two players when `anchors` says which). Null when too short. */
export function makeMedir(a: BoardPoint, b: BoardPoint, color: StrokeColor, anchors?: [string, string] | null): Stroke | null {
  const p = clampPoint(a);
  const q = clampPoint(b);
  if (Math.hypot(p.x - q.x, p.y - q.y) < MIN_MEDIR) return null;
  const pin = anchors && anchors[0] !== anchors[1] ? { anchors: [anchors[0], anchors[1]] } : {};
  return { id: newId("k"), kind: "medir", color, points: [p, q], ...pin };
}
/** The fuera de juego line of one side (it moves by itself; `y` is only where it is now). */
export function makeFuera(side: Side, y: number, color: StrokeColor): Stroke {
  const v = Math.round(Math.max(0, Math.min(100, y)) * 10) / 10;
  return {
    id: newId("k"),
    kind: "fuera",
    color,
    side,
    points: [
      { x: 0, y: v },
      { x: 100, y: v },
    ],
  };
}
/** The fuera de juego stroke of a side, if drawn. */
export const fueraOf = (strokes: Stroke[], side: Side): Stroke | undefined => strokes.find((s) => s.kind === "fuera" && s.side === side);

/** The one of the seven nearest to a tap (frame %), within `tol` % of the frame's width. */
export function nearestPlayer(cards: { id: string; x: number; y: number }[], X: number, Y: number, Fh = 1, tol = 6): string | null {
  let best: string | null = null;
  let bd = tol;
  cards.forEach((c) => {
    const d = Math.hypot(c.x - X, (c.y - Y) * Fh);
    if (d <= bd) {
      bd = d;
      best = c.id;
    }
  });
  return best;
}

/** «Unir»'s pending pick after a tap on `id`: on (up to four) or off again. */
export const togglePick = (picked: string[], id: string, max = 4): string[] => (picked.includes(id) ? picked.filter((x) => x !== id) : picked.length >= max ? picked : [...picked, id]);

// ── words ──

/** What a pinned stroke is, in the list and for screen readers. `nm`: a player's name. */
export function extraLabel(s: Stroke, nm: (id: string) => string, live: BoardPoint[]): string {
  const c = " · " + COLOR_NAME[s.color];
  if (s.kind === "unir") return "Unir " + (s.anchors ?? []).map(nm).join(", ") + c;
  if (s.kind === "foco") return "Foco en " + nm(s.anchors?.[0] ?? "") + c;
  if (s.kind === "medir") return "Medir " + metresTxt(metres(live[0], live[1])) + (s.anchors ? " (" + s.anchors.map(nm).join("–") + ")" : "") + c;
  if (s.kind === "fuera") return "Fuera de juego · " + (s.side === "rival" ? "su última línea" : "nuestra última línea") + c;
  return s.kind + c;
}

// ── on the frame ──

export interface ExtraLine {
  id: string;
  cls: string;
  /** In the frame's 1000 × 1000 box. */
  d: string;
  kind: "unir" | "medir" | "fuera";
  sel: boolean;
}
export interface ExtraLabel {
  id: string;
  cls: string;
  /** Frame %. */
  x: string;
  y: string;
  text: string;
  sel: boolean;
}
export interface ExtraFoco {
  id: string;
  cls: string;
  x: string;
  y: string;
  sel: boolean;
}
export interface RivalToken {
  i: number;
  x: string;
  y: string;
  sc: string;
  num: string;
  noted: boolean;
  aria: string;
}
export interface ExtraView {
  lines: ExtraLine[];
  labels: ExtraLabel[];
  focos: ExtraFoco[];
}

const boxOf = (C: Cam, p: BoardPoint): [number, number] => {
  const q = proj(C, p.x, p.y);
  return [q.x * 10, q.y * 10];
};

/** What the extras layer draws for the board's pinned strokes, where they are now. */
export function extraView(strokes: Stroke[], L: Lineup, rival: RivalSeven | null | undefined, C: Cam, selId: string | null): ExtraView {
  const places = boardPlaces(L);
  const out: ExtraView = { lines: [], labels: [], focos: [] };
  strokes.forEach((s) => {
    if (!isExtraKind(s.kind)) return;
    const pts = livePoints(s, places, L, rival);
    const cls = colorCls(s.color);
    const sel = s.id === selId;
    if (s.kind === "foco") {
      const q = proj(C, pts[0].x, pts[0].y);
      out.focos.push({ id: s.id, cls, x: q.x.toFixed(2), y: q.y.toFixed(2), sel });
      return;
    }
    const P = pts.map((p) => boxOf(C, p));
    const closed = s.kind === "unir" && P.length >= 3;
    const d = P.map(([x, y], i) => (i ? "L" : "M") + f1(x) + " " + f1(y)).join("") + (closed ? "Z" : "");
    out.lines.push({ id: s.id, cls, d, kind: s.kind, sel });
    if (s.kind === "medir") {
      const m = { x: (pts[0].x + pts[1].x) / 2, y: (pts[0].y + pts[1].y) / 2 };
      const q = proj(C, m.x, m.y);
      out.labels.push({ id: s.id, cls, x: q.x.toFixed(2), y: q.y.toFixed(2), text: metresTxt(metres(pts[0], pts[1])), sel });
    } else if (s.kind === "fuera") {
      const q = proj(C, 9, pts[0].y);
      out.labels.push({ id: s.id, cls, x: q.x.toFixed(2), y: q.y.toFixed(2), text: s.side === "rival" ? "FUERA · ELLOS" : "FUERA · NOSOTROS", sel });
    }
  });
  return out;
}

/** The rival seven's red tokens on the frame. */
export function rivalTokens(rival: RivalSeven, C: Cam): RivalToken[] {
  return rivalSpots(rival).map((p, i) => {
    const q = proj(C, p.x, p.y);
    const pl = rival.players[i];
    return {
      i,
      x: q.x.toFixed(2),
      y: q.y.toFixed(2),
      sc: Math.max(0.85, Math.min(1.1, q.s)).toFixed(3),
      num: pl?.num !== undefined ? String(pl.num) : "",
      noted: !!pl?.note,
      aria: rivalAria(rival, i),
    };
  });
}

/** Distance from p to the segment a–b, the frame's height counted as Fh × its width (frame %). */
function segDist(p: [number, number], a: [number, number], b: [number, number], Fh: number): number {
  const dx = b[0] - a[0];
  const dy = (b[1] - a[1]) * Fh;
  const l2 = dx * dx + dy * dy;
  const px = p[0] - a[0];
  const py = (p[1] - a[1]) * Fh;
  const t = l2 ? Math.max(0, Math.min(1, (px * dx + py * dy) / l2)) : 0;
  return Math.hypot(px - t * dx, py - t * dy);
}

/** The pinned stroke a tap at (X, Y) of the frame lands on (the nearest within reach), or null. */
export function hitExtra(strokes: Stroke[], L: Lineup, rival: RivalSeven | null | undefined, C: Cam, X: number, Y: number, tol = 4.5): string | null {
  const places = boardPlaces(L);
  let best: string | null = null;
  let bd = Infinity;
  strokes.forEach((s) => {
    if (!isExtraKind(s.kind)) return;
    const pts = livePoints(s, places, L, rival).map((p): [number, number] => {
      const q = proj(C, p.x, p.y);
      return [q.x, q.y];
    });
    let d = Infinity;
    if (s.kind === "foco") d = segDist([X, Y], pts[0], pts[0], C.Fh);
    else {
      const ring = s.kind === "unir" && pts.length >= 3 ? [...pts, pts[0]] : pts;
      for (let k = 0; k < ring.length - 1; k++) d = Math.min(d, segDist([X, Y], ring[k], ring[k + 1], C.Fh));
    }
    if (d <= tol && d <= bd) {
      bd = d;
      best = s.id;
    }
  });
  return best;
}

// ── in the cartel ──

export type CartelExtra =
  | { k: "line"; pts: [number, number][]; closed: boolean; color: string; dash: boolean; label?: string }
  | { k: "foco"; at: [number, number]; color: string }
  | { k: "rival"; at: [number, number]; num: string };

const hexOf = (c: StrokeColor): string => COLORS.find((x) => x.k === c)?.hex ?? "#FFC659";
/** A pitch point in % of the cartel's pitch box (as cartel.ts lays the cromos out). */
const cartelPt = (p: BoardPoint): [number, number] => [+Math.max(7, Math.min(93, p.x)).toFixed(1), +Math.max(8, Math.min(86, 6 + p.y * 0.86)).toFixed(1)];

/**
 * The pinned strokes and (when shown) the rival tokens, in % of the cartel's pitch box. A pinned point
 * sits on its player's cromo in the cartel (`cromos`: where the cartel put each one).
 */
export function cartelExtras(strokes: Stroke[], L: Lineup, rival: RivalSeven | null | undefined, cromos: { id: string; x: number; y: number }[], showRival: boolean): CartelExtra[] {
  const places = boardPlaces(L);
  const at = new Map(cromos.map((c) => [c.id, [c.x, c.y] as [number, number]]));
  const out: CartelExtra[] = [];
  strokes.forEach((s) => {
    if (!isExtraKind(s.kind)) return;
    const pts = livePoints(s, places, L, rival);
    const P = pts.map((p, k) => (s.anchors?.[k] && at.has(s.anchors[k]) ? (at.get(s.anchors[k]) as [number, number]) : cartelPt(p)));
    const color = hexOf(s.color);
    if (s.kind === "foco") out.push({ k: "foco", at: P[0], color });
    else if (s.kind === "fuera") {
      const y = cartelPt(pts[0])[1];
      out.push({ k: "line", pts: [[0, y], [100, y]], closed: false, color, dash: true, label: "FUERA DE JUEGO" });
    } else out.push({ k: "line", pts: P, closed: s.kind === "unir" && P.length >= 3, color, dash: s.kind === "medir", ...(s.kind === "medir" ? { label: metresTxt(metres(pts[0], pts[1])) } : {}) });
  });
  if (showRival && rival)
    rivalSpots(rival).forEach((p, i) => {
      const n = rival.players[i]?.num;
      out.push({ k: "rival", at: cartelPt(p), num: n !== undefined ? String(n) : "" });
    });
  return out;
}

/** The canvas calls the cartel needs (a CanvasRenderingContext2D has them all; tests pass a recorder). */
export interface CartelCtx {
  save(): void;
  restore(): void;
  beginPath(): void;
  closePath(): void;
  moveTo(x: number, y: number): void;
  lineTo(x: number, y: number): void;
  arc(x: number, y: number, r: number, a0: number, a1: number): void;
  fill(): void;
  stroke(): void;
  fillText(t: string, x: number, y: number): void;
  setLineDash(d: number[]): void;
  fillStyle: string | CanvasGradient | CanvasPattern;
  strokeStyle: string | CanvasGradient | CanvasPattern;
  lineWidth: number;
  font: string;
  textAlign: CanvasTextAlign;
  textBaseline: CanvasTextBaseline;
  globalAlpha: number;
}

/** Draws the extras on the cartel's pitch box (px). */
export function drawCartelExtras(ctx: CartelCtx, extras: CartelExtra[], box: { x: number; y: number; w: number; h: number }): void {
  const px = ([x, y]: [number, number]): [number, number] => [box.x + (box.w * x) / 100, box.y + (box.h * y) / 100];
  extras.forEach((e) => {
    ctx.save();
    if (e.k === "line") {
      const P = e.pts.map(px);
      ctx.beginPath();
      P.forEach(([x, y], i) => (i ? ctx.lineTo(x, y) : ctx.moveTo(x, y)));
      if (e.closed) ctx.closePath();
      ctx.setLineDash(e.dash ? [16, 12] : []);
      ctx.strokeStyle = e.color;
      ctx.lineWidth = 6;
      ctx.stroke();
      if (e.closed) {
        ctx.globalAlpha = 0.14;
        ctx.fillStyle = e.color;
        ctx.fill();
        ctx.globalAlpha = 1;
      }
      if (e.label) {
        const [x, y] = e.pts.length === 2 && e.label !== "FUERA DE JUEGO" ? px([(e.pts[0][0] + e.pts[1][0]) / 2, (e.pts[0][1] + e.pts[1][1]) / 2]) : px([4, e.pts[0][1]]);
        ctx.font = "800 26px 'Anybody', sans-serif";
        ctx.textAlign = e.label === "FUERA DE JUEGO" ? "left" : "center";
        ctx.textBaseline = "bottom";
        ctx.fillStyle = e.color;
        ctx.fillText(e.label, x, y - 8);
      }
    } else if (e.k === "foco") {
      const [x, y] = px(e.at);
      ctx.beginPath();
      ctx.arc(x, y + 40, 86, 0, Math.PI * 2);
      ctx.globalAlpha = 0.22;
      ctx.fillStyle = e.color;
      ctx.fill();
      ctx.globalAlpha = 1;
      ctx.lineWidth = 4;
      ctx.strokeStyle = e.color;
      ctx.stroke();
    } else {
      const [x, y] = px(e.at);
      ctx.beginPath();
      ctx.arc(x, y, 26, 0, Math.PI * 2);
      ctx.fillStyle = "#d8344a";
      ctx.fill();
      ctx.lineWidth = 4;
      ctx.strokeStyle = "#ffffff";
      ctx.stroke();
      if (e.num) {
        ctx.font = "900 26px 'Anybody', sans-serif";
        ctx.textAlign = "center";
        ctx.textBaseline = "middle";
        ctx.fillStyle = "#ffffff";
        ctx.fillText(e.num, x, y + 1);
      }
    }
    ctx.restore();
  });
}
