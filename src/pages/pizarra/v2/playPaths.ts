// Jugadas, Bloque 4: curved paths (one control point per player and move, bent by dragging the handle at
// the middle of the path), the replay's speed (0,5× · 1× · 1,5×) and «Convertir el dibujo en jugada» (the
// carreras, pases and conducciones on the grass become a two-paso jugada). Pure.
import type { BoardPoint } from "../../../lib/schemas";
import { PIZARRA_LIMITS } from "../../../lib/schemas";
import type { Lineup } from "../formations";
import { clampPoint, type Stroke } from "../drawings";
import { newPlay, setFrameText, type Play } from "../plays";
import { proj, type Cam } from "./geometry";
import { boardSpots, rederive } from "./jugadas";

// ── speed ──
export const RATES = [0.5, 1, 1.5] as const;
export type Rate = (typeof RATES)[number];
/** How much longer than 1× everything lasts (0,5× keeps the design's 1.9). */
export const rateFactor = (r: number): number => (r === 0.5 ? 1.9 : r === 1.5 ? 1 / 1.5 : 1);
/** «0,5×», «1×», «1,5×». */
export const rateLabel = (r: number): string => String(r).replace(".", ",") + "×";
/** The estelas' draw time at that speed (the design's 1.7 s at 1×, 3.2 s at 0,5×). */
export const trailsDurOf = (r: number): string => (r === 0.5 ? "3.2s" : r === 1.5 ? "1.1s" : "1.7s");

// ── curves ──

/** A path closer than this (pitch %) to straight at its middle is straight (its curve goes). */
export const STRAIGHT_TOL = 1.5;
/** A player has to travel at least this far (pitch %) in a move for its path to be bent. */
export const MIN_BEND_MOVE = 4;

/** The middle (t = ½) of the path a → b, bent through control point `c` when there is one. */
export function midOf(a: BoardPoint, c: BoardPoint | undefined, b: BoardPoint): BoardPoint {
  if (!c) return { x: (a.x + b.x) / 2, y: (a.y + b.y) / 2 };
  return { x: (a.x + 2 * c.x + b.x) / 4, y: (a.y + 2 * c.y + b.y) / 4 };
}
/** The control point that makes the path a → b pass through `mid` (null: near enough to straight). */
export function controlFromMid(a: BoardPoint, mid: BoardPoint, b: BoardPoint): BoardPoint | null {
  const straight = { x: (a.x + b.x) / 2, y: (a.y + b.y) / 2 };
  if (Math.hypot(mid.x - straight.x, mid.y - straight.y) < STRAIGHT_TOL) return null;
  return clampPoint({ x: 2 * mid.x - straight.x, y: 2 * mid.y - straight.y });
}
/** The quadratic a → c → b at t. */
export function bend(a: BoardPoint, c: BoardPoint, b: BoardPoint, t: number): BoardPoint {
  const s = 1 - t;
  return { x: s * s * a.x + 2 * s * t * c.x + t * t * b.x, y: s * s * a.y + 2 * s * t * c.y + t * t * b.y };
}

/** The curve of player `id`'s path into paso `i`, if bent. */
export const curveOf = (play: Play, i: number, id: string): BoardPoint | undefined => play.frames[i]?.curves?.[id];

/** Bends (or, with null, straightens) player `id`'s path into paso `i`. The same play back when nothing changes. */
export function setCurve(play: Play, i: number, id: string, c: BoardPoint | null): Play {
  const f = play.frames[i];
  if (!f || i < 1 || !(id in f.players)) return play;
  const had = f.curves?.[id];
  if (!c && !had) return play;
  if (c && had && had.x === c.x && had.y === c.y) return play;
  const curves = { ...(f.curves ?? {}) };
  if (c) {
    if (!had && Object.keys(curves).length >= PIZARRA_LIMITS.curves) return play;
    curves[id] = clampPoint(c);
  } else delete curves[id];
  const frames = play.frames.slice();
  const g = { ...f };
  if (Object.keys(curves).length) g.curves = curves;
  else delete g.curves;
  frames[i] = g;
  return { ...play, frames };
}

/** Where a player stands in paso i (carried from an earlier paso when this one leaves him out). */
function at(play: Play, i: number, id: string): BoardPoint | undefined {
  for (let k = i; k >= 0; k--) {
    const p = play.frames[k]?.players[id];
    if (p) return p;
  }
  return undefined;
}

export interface CurveHandle {
  id: string;
  /** Pitch % of the path's middle. */
  mid: BoardPoint;
  /** Frame %. */
  x: string;
  y: string;
  bent: boolean;
}

/** The handles of paso i: one at the middle of each of ours who runs into it (far enough to bend). */
export function curveHandles(play: Play, i: number, C: Cam, known: (id: string) => boolean): CurveHandle[] {
  if (i < 1 || !play.frames[i]) return [];
  const out: CurveHandle[] = [];
  Object.entries(play.frames[i].players).forEach(([id, b]) => {
    const a = at(play, i - 1, id);
    if (!a || !known(id) || Math.hypot(a.x - b.x, a.y - b.y) < MIN_BEND_MOVE) return;
    const c = curveOf(play, i, id);
    const mid = midOf(a, c, b);
    const q = proj(C, mid.x, mid.y);
    out.push({ id, mid, x: q.x.toFixed(2), y: q.y.toFixed(2), bent: !!c });
  });
  return out;
}

/** The new curve when the handle of player `id` (paso i) is put at `mid` (pitch %). */
export function bendTo(play: Play, i: number, id: string, mid: BoardPoint): Play {
  const a = at(play, i - 1, id);
  const b = play.frames[i]?.players[id];
  if (!a || !b) return play;
  return setCurve(play, i, id, controlFromMid(a, mid, b));
}

// ── «Convertir el dibujo en jugada» ──

const KINDS = new Set(["carrera", "pase", "conduccion"]);
/** How close (pitch %) a stroke must start to one of ours for it to be his. */
export const OWNER_TOL = 9;

/** The strokes that can become a jugada (carreras, pases, conducciones). */
export const convertible = (strokes: Stroke[]): Stroke[] => strokes.filter((s) => KINDS.has(s.kind) && s.points.length >= 2);

function nearest(spots: Record<string, BoardPoint>, p: BoardPoint, tol: number, skip: Set<string> = new Set()): string | null {
  let best: string | null = null;
  let bd = tol;
  Object.entries(spots).forEach(([id, q]) => {
    if (skip.has(id)) return;
    const d = Math.hypot(q.x - p.x, q.y - p.y);
    if (d <= bd) {
      bd = d;
      best = id;
    }
  });
  return best;
}

/** The control point of a drawn arrow (start, middle, end: the curve passes through the middle). */
const arrowControl = (s: Stroke): BoardPoint | null => (s.points.length === 3 ? controlFromMid(s.points[0], s.points[1], s.points[2]) : null);

/**
 * The drawing as a two-paso jugada: paso 1 is the board as it is, paso 2 where the strokes take them.
 * A carrera moves the one of ours it starts on (bent as drawn); a conducción moves him with the ball;
 * a pase sends the ball (from whoever has it) to where it ends. Null when no stroke starts on anyone
 * of the seven (or nobody is on the pitch).
 */
export function drawingToPlay(strokes: Stroke[], L: Lineup, name: string): Play | null {
  const spots = boardSpots(L);
  if (!Object.keys(spots).length) return null;
  const list = convertible(strokes);
  const moves: { id: string; to: BoardPoint; c: BoardPoint | null }[] = [];
  let ball0: BoardPoint | null = null;
  let ball1: BoardPoint | null = null;
  const used = new Set<string>();
  for (const s of list) {
    const a = s.points[0];
    const b = s.points[s.points.length - 1];
    if (s.kind === "pase") {
      if (ball0) continue;
      const who = nearest(spots, a, OWNER_TOL);
      ball0 = clampPoint(who ? spots[who] : a);
      ball1 = clampPoint(b);
      continue;
    }
    const id = nearest(spots, a, OWNER_TOL, used);
    if (!id) continue;
    used.add(id);
    moves.push({ id, to: clampPoint(b), c: arrowControl(s) });
    if (s.kind === "conduccion" && !ball0) {
      ball0 = clampPoint(spots[id]);
      ball1 = clampPoint(b);
    }
  }
  if (!moves.length && !ball0) return null;
  const base = newPlay(name, spots, ball0 ? { ball: ball0 } : {});
  const f1 = base.frames[1];
  const players = { ...f1.players };
  const curves: Record<string, BoardPoint> = {};
  moves.forEach((m) => {
    players[m.id] = m.to;
    if (m.c) curves[m.id] = m.c;
  });
  const second = { ...f1, players, ball: ball1 ?? f1.ball, title: "Lo dibujado", ...(Object.keys(curves).length ? { curves } : {}) };
  const play = rederive({ ...base, frames: [base.frames[0], second] });
  return setFrameText(play, 0, { title: "Salida" });
}
