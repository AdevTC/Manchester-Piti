// The island's signature detail: a thin strip of the real sky over CDM Palomeras at that minute (celeste by day,
// gold at the golden hour, navy at night with the floodlights' glow), and the colours of the small still of the
// ground in the «grande» size. A private copy of D's sun (NOAA) and sky ramp until lib/derived/sun.ts (W1) lands:
// then `elevationAt` becomes `sunPosition(ms).elevation` and nothing else changes.
const LAT = 40.39;
const LON = -3.66;
const RAD = Math.PI / 180;

/** The sun's elevation over Palomeras at `ms` (degrees, with refraction). */
export function elevationAt(ms: number): number {
  const jd = ms / 86_400_000 + 2440587.5;
  const T = (jd - 2451545) / 36525;
  const L0 = (280.46646 + T * (36000.76983 + T * 0.0003032)) % 360;
  const M = 357.52911 + T * (35999.05029 - 0.0001537 * T);
  const e = 0.016708634 - T * (0.000042037 + 0.0000001267 * T);
  const C = Math.sin(M * RAD) * (1.914602 - T * (0.004817 + 0.000014 * T)) + Math.sin(2 * M * RAD) * (0.019993 - 0.000101 * T) + Math.sin(3 * M * RAD) * 0.000289;
  const om = 125.04 - 1934.136 * T;
  const lam = L0 + C - 0.00569 - 0.00478 * Math.sin(om * RAD);
  const eps = 23 + (26 + (21.448 - T * (46.815 + T * (0.00059 - T * 0.001813))) / 60) / 60 + 0.00256 * Math.cos(om * RAD);
  const decl = Math.asin(Math.sin(eps * RAD) * Math.sin(lam * RAD));
  const yy = Math.tan((eps * RAD) / 2) ** 2;
  const eot = (4 / RAD) * (yy * Math.sin(2 * L0 * RAD) - 2 * e * Math.sin(M * RAD) + 4 * e * yy * Math.sin(M * RAD) * Math.cos(2 * L0 * RAD) - 0.5 * yy * yy * Math.sin(4 * L0 * RAD) - 1.25 * e * e * Math.sin(2 * M * RAD));
  const utcMin = (((ms / 60_000) % 1440) + 1440) % 1440;
  const ha = (utcMin + eot + 4 * LON) / 4 - 180;
  const lat = LAT * RAD;
  const cz = Math.sin(lat) * Math.sin(decl) + Math.cos(lat) * Math.cos(decl) * Math.cos(ha * RAD);
  let el = 90 - Math.acos(Math.max(-1, Math.min(1, cz))) / RAD;
  if (el > -1.5) el += 1.02 / Math.tan((el + 10.3 / (el + 5.11)) * RAD) / 60;
  return el;
}

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
