// The island's signature detail: a thin strip of the real sky over CDM Palomeras at that minute (celeste by day,
// gold at the golden hour, navy at night with the floodlights' glow), and the colours of the small still of the
// ground in the «grande» size. The sun is the site's one (lib/derived/sun.ts); the ramp is D's.
import { sunPosition } from "../../../lib/derived/sun";

/** The sun's elevation over Palomeras at `ms` (degrees, with refraction). */
export const elevationAt = (ms: number): number => sunPosition(ms).elevation;

// elevation → top, middle, horizon and sun colours (D's ramp)
const RAMP: readonly [number, string, string, string, string][] = [
  [-18, "#02061a", "#050c26", "#0a1536", "#000000"],
  [-9, "#040b24", "#0a1737", "#1a2b5c", "#1b2b5a"],
  [-5, "#0a1838", "#22386d", "#7d6276", "#e07a4a"],
  [-1.5, "#132d60", "#47669f", "#ef985c", "#ff8a3d"],
  [1.5, "#1b4380", "#7a9dcf", "#ffbd73", "#ffae48"],
  [5, "#1f4a8c", "#7f9fd0", "#ffc277", "#ffbc4f"],
  [12, "#24599a", "#86acd9", "#ffd291", "#ffd58c"],
  [25, "#2a67a7", "#6cabdd", "#d4e8f6", "#fff4dc"],
  [45, "#2a65a5", "#62a6dc", "#d8ecf8", "#fffaf0"],
];
const hex = (h: string) => [1, 3, 5].map((i) => parseInt(h.slice(i, i + 2), 16));
const toHex = (c: number[]) => `#${c.map((v) => Math.max(0, Math.min(255, Math.round(v))).toString(16).padStart(2, "0")).join("")}`;
const mix = (a: string, b: string, k: number) => {
  const A = hex(a);
  const B = hex(b);
  return toHex(A.map((v, i) => v + (B[i] - v) * k));
};
const smooth = (a: number, b: number, x: number) => {
  const t = Math.max(0, Math.min(1, (x - a) / (b - a)));
  return t * t * (3 - 2 * t);
};

export interface IslaSky {
  top: string;
  mid: string;
  hor: string;
  sun: string;
  /** 0–1: how much of night it is (the strip glows like the floodlights over 0.6). */
  night: number;
  /** 0–1: the sun's light on the still. */
  sunlight: number;
  /** 0–1: the floodlights on the still. */
  floodlights: number;
}

export function skyAt(ms: number): IslaSky {
  const el = elevationAt(ms);
  let i = 0;
  while (i < RAMP.length - 2 && el > RAMP[i + 1][0]) i++;
  const a = RAMP[i];
  const b = RAMP[i + 1];
  const k = Math.max(0, Math.min(1, (el - a[0]) / (b[0] - a[0])));
  const night = 1 - smooth(-7, 2, el);
  const golden = smooth(-2, 1.5, el) * (1 - smooth(6, 16, el));
  return { top: mix(a[1], b[1], k), mid: mix(a[2], b[2], k), hor: mix(a[3], b[3], k), sun: mix(a[4], b[4], k), night, sunlight: smooth(-0.8, 9, el), floodlights: night > 0.6 ? 1 : golden > 0.3 ? 0.55 : 0 };
}

/** The strip's inline style: the sky left to right, glowing at night. */
export function stripStyle(s: IslaSky): { background: string; boxShadow?: string } {
  const background = `linear-gradient(90deg,${s.top},${s.mid} 45%,${s.hor} 80%,${s.sun})`;
  return s.night > 0.6 ? { background, boxShadow: "0 0 8px rgba(223,236,255,.55)" } : { background };
}
