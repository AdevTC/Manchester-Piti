// La pizarra «FUT» — the phone's bottom sheet: two heights (half and full, as designed) and the handle's
// physics. The heights themselves are CSS (--shv, from the screen's height and the pitch's geometry): the
// pitch above it is fitted by the layout, never measured. Pure.
import type { Modo } from "./view";

export type Snap = "half" | "full";

/** The sheet's height for a tool: the lists (Tableros, Comparar, Compartir, Ajustes, Pachanga) open full. */
export const snapOf = (m: Modo): Snap => (m === "tableros" || m === "comparar" || m === "compartir" || m === "ajustes" || m === "pachanga" ? "full" : "half");

/** How far (ms) the release velocity is projected. */
const PROJECT_MS = 160;
/** How far (px) the projected release has to travel to change the height. */
const SNAP_PX = 50;

/** The sheet's height while its handle is dragged `dy` px (down = positive) from `h0`, kept on the rails. */
export function dragHeight(h0: number, dy: number): number {
  return Math.max(120, Math.min(h0 + 260, h0 - dy));
}

/** Where the sheet settles: the drag `dy` (down = positive) projected by the fling (px/ms, down =
 *  positive); a short one leaves it where it was. */
export function settle(dy: number, velocity: number, cur: Snap): Snap {
  const pr = -dy - velocity * PROJECT_MS;
  return pr > SNAP_PX ? "full" : pr < -SNAP_PX ? "half" : cur;
}

/** The handle as a button: each tap toggles the height. */
export const cycle = (s: Snap): Snap => (s === "full" ? "half" : "full");
/** Arrow keys on the handle: up = full, down = half. */
export const step = (_s: Snap, d: 1 | -1): Snap => (d > 0 ? "full" : "half");

export function grabLabel(s: Snap): string {
  return s === "half" ? "Ampliar el panel" : "Bajar el panel";
}
