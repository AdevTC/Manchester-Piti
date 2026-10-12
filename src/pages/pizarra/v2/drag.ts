// La pizarra «Noche de partido» — the geometry of dragging a cromo: the magnetic ghost slot it snaps
// to, the swap arc that shows where the displaced cromo will fly, the tilt while it travels, and the
// keyboard's way around the slots. Pure.
import type { Cam } from "./geometry";
import { proj } from "./geometry";

/** A ghost slot's magnet point on screen (px): its card bottom, where a dragged cromo's feet go. */
export interface Magnet {
  i: number;
  x: number;
  y: number;
}

/** Magnetic pull radius (px). */
export const MAGNET_PX = 52;
/** The finger sits above the cromo's feet: the pointer is lifted this much (px) before measuring. */
export const MAGNET_LIFT = 18;

/** The slot a dragged cromo snaps to: the nearest magnet within the radius, or null. */
export function pickMagnet(px: number, py: number, magnets: Magnet[], radius = MAGNET_PX): number | null {
  let best: number | null = null;
  let bd = radius;
  magnets.forEach((m) => {
    const d = Math.hypot(px - m.x, py + MAGNET_LIFT - m.y);
    if (d < bd) {
      bd = d;
      best = m.i;
    }
  });
  return best;
}

/** The swap arc in the 1000×1000 frame box: from the target slot (whose cromo will move) up and over
 *  to where the dragged cromo came from. */
export function swapArc(C: Cam, to: { u: number; v: number }, from: { u: number; v: number }): string {
  const A = proj(C, to.u, to.v);
  const B = proj(C, from.u, from.v);
  const mx = ((A.x + B.x) / 2) * 10;
  const my = Math.min(A.y, B.y) * 10 - 90;
  return `M${(A.x * 10).toFixed(1)} ${(A.y * 10 - 20).toFixed(1)}Q${mx.toFixed(1)} ${my.toFixed(1)} ${(B.x * 10).toFixed(1)} ${(B.y * 10 - 20).toFixed(1)}`;
}

/** The cromo leans into the move (deg), from the horizontal speed of the last pointer step. */
export const tilt = (dx: number): number => Math.max(-14, Math.min(14, dx * 1.2));

/** A press becomes a drag after this many px. */
export const DRAG_SLOP = 7;
/** Holding still this long opens the quick menu (pitch) or the ficha (bench). */
export const LONG_PRESS_MS = 480;
/** After a drag or a long press, the click that follows is ignored for this long. */
export const CLICK_GUARD_MS = 450;

// The phone's bench is a strip that scrolls sideways under the finger: there a finger only lifts a cromo
// after holding it still (it lifts, with a buzz) or by moving it mostly upwards, toward the pitch; a
// sideways swipe scrolls the strip. The mouse drags at once.
/** Holding a strip cromo this long lifts it: from then on it follows the finger anywhere. */
export const BENCH_HOLD_MS = 300;
/** On the strip the ficha (the long press) waits a little longer, so a lifted cromo can still be moved. */
export const BENCH_FICHA_MS = 800;

/** What a finger moving (dx, dy px from where it pressed) on a strip cromo does: still `wait`ing, `drag`
 *  (lifted already, or mostly upwards), or `scroll` (sideways or downwards: the strip's, not ours). */
export function stripGesture(dx: number, dy: number, lifted: boolean): "wait" | "drag" | "scroll" {
  if (Math.hypot(dx, dy) < DRAG_SLOP) return "wait";
  if (lifted) return "drag";
  return -dy > Math.abs(dx) ? "drag" : "scroll";
}

export type Dir = "up" | "down" | "left" | "right";
export const DIR_KEYS: Record<string, Dir> = { ArrowUp: "up", ArrowDown: "down", ArrowLeft: "left", ArrowRight: "right" };

/** Keyboard move: from slot `from`, the nearest slot in that direction on screen (frame %, y down),
 *  preferring the straight line; null if there is none that way. */
export function slotInDirection(points: { i: number; x: number; y: number }[], from: number, dir: Dir): number | null {
  const a = points.find((p) => p.i === from);
  if (!a) return points[0]?.i ?? null;
  let best: number | null = null;
  let bs = Infinity;
  points.forEach((p) => {
    if (p.i === from) return;
    const dx = p.x - a.x;
    const dy = p.y - a.y;
    const along = dir === "up" ? -dy : dir === "down" ? dy : dir === "left" ? -dx : dx;
    const across = dir === "up" || dir === "down" ? Math.abs(dx) : Math.abs(dy);
    if (along <= 0.5) return;
    const score = along + across * 2;
    if (score < bs) {
      bs = score;
      best = p.i;
    }
  });
  return best;
}
