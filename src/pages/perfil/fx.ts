// /profile «La carta»: the walkout's particles, exactly as designed (stats-gen/pf-e-data.mjs, pf-g-data.mjs):
// sparks (the burst), embers (rising loop), the lightning bolts by the light pillar, the 24 rising ticks
// around the rating (timed inside the 1.80–2.40 s beat) and the heat press's steam puffs. Pure data.
import type { CSSProperties } from "react";
import { shirtSize } from "./rules";

/** CSS custom properties on an element (the design binds --i/--y/--r, --p… inline). */
export const vars = (o: Record<string, string | number>): CSSProperties => o as unknown as CSSProperties;

/** n1 grande ≤5 · n2 normal ≤8 · n3 estrecha ≤10 · n4 muy estrecha (also past 12: it is flagged «No cabe»). */
export function printClass(len: number): "n1" | "n2" | "n3" | "n4" {
  const s = shirtSize(len);
  return s === "nocabe" ? "n4" : s;
}

export const SPARKS = Array.from({ length: 26 }, (_, i) => ({
  a: Math.round((i / 26) * 360 + ((i * 37) % 11)) + "deg",
  d: 120 + ((i * 53) % 110) + "px",
  w: (((i * 7) % 5) * 0.03).toFixed(2) + "s",
  s: i % 3 === 0 ? 1.6 : 1,
}));

export const EMBERS = Array.from({ length: 16 }, (_, i) => ({
  x: 34 + ((i * 41) % 32) + "%",
  y: 40 + ((i * 29) % 40) + "%",
  d: (4 + ((i * 3) % 5)).toFixed(1) + "s",
  w: (-((i * 1.3) % 6)).toFixed(1) + "s",
}));

export const BOLTS = ["M50 0 L44 18 L53 22 L41 46 L50 50 L38 78", "M50 0 L57 16 L48 24 L60 44 L52 48 L63 74", "M48 6 L30 20 L38 26 L18 42", "M52 6 L70 22 L62 28 L84 44"];

export const TICKS = Array.from({ length: 24 }, (_, i) => ({
  r: Math.round((i / 24) * 360) + "deg",
  h: (6 + i * 0.7).toFixed(1) + "px",
  w: (1.8 + i * 0.025).toFixed(3) + "s",
}));

export const STEAM = Array.from({ length: 8 }, (_, i) => ({
  x: 10 + ((i * 37) % 80) + "%",
  s: (0.7 + ((i * 7) % 6) / 10).toFixed(2),
  w: ((i * 0.05) % 0.35).toFixed(2) + "s",
  dx: (i % 2 ? 1 : -1) * (6 + ((i * 11) % 16)) + "px",
}));

/** The intro's length (ms): `introDone` at 3.4 s. */
export const INTRO_MS = 3400;
/** The heat press: the toast once it is done (ms after the press starts). */
export const PRESS_TOAST_MS = 1900;
/** «Deshacer» stays 6 s. */
export const UNDO_MS = 6000;

/**
 * The share studio («Compartir mi carta», «Mi póster») arrives in phase 4: until then its buttons stay
 * out of the page. Phase 4 flips this.
 */
export const SHARE_READY = false;
