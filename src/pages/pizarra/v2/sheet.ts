// La pizarra «Noche de partido» — the bottom sheet's three snap points and its physics. Pure.
export type Snap = "peek" | "half" | "full";
export const SNAPS: Snap[] = ["peek", "half", "full"];
/** Visible height of each snap (px), as designed for the 844 app screen. */
export const SNAP_H: Record<Snap, number> = { peek: 200, half: 404, full: 700 };
/** How far (ms) the release velocity is projected. */
const PROJECT_MS = 160;

/** The sheet height while dragging the handle `dy` px (down = positive), kept on the rails. */
export function dragHeight(start: number, dy: number, max = SNAP_H.full): number {
  return Math.max(120, Math.min(max + 20, start - dy));
}

/** Where the sheet settles: the released height projected by the fling (px/ms, down = positive),
 *  against the midpoints between snaps. `full` is the tallest the screen allows. */
export function settle(height: number, velocity: number, full = SNAP_H.full): Snap {
  const pr = height - velocity * PROJECT_MS;
  const h = Math.min(SNAP_H.half, full);
  if (pr > (h + full) / 2) return "full";
  if (pr > (SNAP_H.peek + h) / 2) return "half";
  return "peek";
}

/** The handle as a button: each tap goes one snap up, and from the top back down. */
export const cycle = (s: Snap): Snap => (s === "peek" ? "half" : s === "half" ? "full" : "peek");
/** Arrow keys on the handle. */
export const step = (s: Snap, d: 1 | -1): Snap => SNAPS[Math.max(0, Math.min(2, SNAPS.indexOf(s) + d))];

export function grabLabel(s: Snap): string {
  return s === "peek" ? "Ampliar el panel" : s === "half" ? "Panel a pantalla completa" : "Bajar el panel";
}
