// La pizarra «Noche de partido» — the bottom sheet's three snap points and its physics, and how big the
// pitch may be drawn above it. Pure.
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

// ── the pitch above the sheet ──
/** The app screen's layouts by width (the CSS container queries): the phone; the tablet (the phone's
 *  composition, centred, with a 560 px pitch); the desktop (the stadium, with the panels at the sides). */
export type Composition = "phone" | "tablet" | "desktop";
export const composition = (w: number): Composition => (w < 700 ? "phone" : w < 1100 ? "tablet" : "desktop");

/** The pitch's width before scaling (px): the whole screen on a phone, 560 on a tablet, 600 on desktop. */
export const pitchWidth = (w: number): number => (w < 700 ? w : w < 1100 ? 560 : 600);

/** The app screen's height for a viewport (as the CSS has it): the viewport, between 560 and the
 *  designed 844 (phone) or 900 (tablet); 940 on desktop (the page scrolls past it). */
export function appHeight(w: number, vh: number): number {
  const c = composition(w);
  return c === "desktop" ? DESKTOP_H : Math.max(560, Math.min(c === "phone" ? 844 : 900, vh));
}

/** The pitch starts under the app bar (px). */
export const PITCH_TOP = 60;
/** The mode bar under the sheet (px). */
export const MODE_BAR = 72;
/** Room for the hint line between the pitch and the sheet at peek (px). */
export const HINT_H = 44;
/** A little air above the half sheet (px). */
export const HALF_GAP = 6;

/** The largest the half sheet lets the pitch be, as designed (phone .64, tablet .5). */
const HALF_MAX: Record<Exclude<Composition, "desktop">, number> = { phone: 0.64, tablet: 0.5 };

/** Desktop: the pitch starts here (px), and the app screen is DESKTOP_H tall. */
export const DESK_TOP = 160;
export const DESKTOP_H = 940;
/** Desktop: the hint line sits 6 px under the pitch; room for it and a margin to the screen's edge. */
const DESK_HINT = 6 + HINT_H;

export interface StageFit {
  /** Phone / tablet, sheet at peek. */
  kp: number;
  /** Phone / tablet, sheet at half (the dolly back). */
  kh: number;
  /** Desktop (the panels at the sides): only what the screen's height asks for. */
  kd: number;
}

/**
 * How much the pitch (frame aspect `fh` = height / width) is scaled so it fits. On a phone or a tablet,
 * between the app bar and the sheet: `kp` with the sheet at peek (the hint line under it too), `kh` with
 * it at half (the dolly back). On desktop, between its top and the screen's bottom, with the hint line:
 * `kd` (the TV camera fits as drawn; the taller top-down one shrinks). Always the smaller of fitting the
 * width (never larger than drawn) and fitting the height (never below a fifth, for absurdly short
 * screens).
 */
export function stageFit(w: number, h: number, fh: number): StageFit {
  const c = composition(w);
  const fit = (room: number, max: number) => Math.max(0.2, Math.min(max, room));
  if (!w || !h || !fh) return { kp: 1, kh: c === "tablet" ? HALF_MAX.tablet : HALF_MAX.phone, kd: 1 };
  const ph = pitchWidth(w) * fh;
  if (c === "desktop") return { kp: 1, kh: HALF_MAX.phone, kd: fit((h - DESK_TOP - DESK_HINT) / ph, 1) };
  const peek = (h - MODE_BAR - SNAP_H.peek - PITCH_TOP - HINT_H) / ph;
  const half = (h - MODE_BAR - SNAP_H.half - PITCH_TOP - HALF_GAP) / ph;
  return { kp: fit(peek, 1), kh: fit(half, HALF_MAX[c]), kd: 1 };
}
