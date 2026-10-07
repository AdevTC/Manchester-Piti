// La pizarra «Noche de partido» — the TV camera and the pitch geometry. Pure (no React).
// The pitch plane is (u, v) in %: u across (0 left … 100 right), v along (0 = rival goal … 100 = our goal).
// The frame is (x, y) in % of the drawn frame, with a real perspective tilt for the TV camera. The same
// formulas draw the turf, place the cromos, the química links and the plan, and invert a pointer for drag.
import type { FormationName, Lineup, Zone } from "../formations";

export interface Cam {
  c: number;
  sn: number;
  D: number;
  L: number;
  K: number;
  cy: number;
  /** Frame height / width (the frame's aspect ratio is 1 / Fh). */
  Fh: number;
  /** Perspective scale at the far (v = 0) and near (v = 100) touchlines. */
  sT: number;
  sB: number;
}

const r5 = (n: number): number => +n.toFixed(5);

function mkCam(th: number, D: number, L: number, mt: number, mb: number, fitW: number): Cam {
  const t = (th * Math.PI) / 180;
  const c = Math.cos(t);
  const sn = Math.sin(t);
  const raw = (u: number, v: number): [number, number, number] => {
    const x = u - 0.5;
    const y = (v - 0.5) * L;
    const z = y * sn;
    const s = D / (D - z);
    return [x * s, y * c * s, s];
  };
  const sB = raw(1, 1)[2];
  const K = fitW / sB;
  const yT = raw(0.5, 0)[1] * K;
  const yB = raw(0.5, 1)[1] * K;
  return { c: r5(c), sn: r5(sn), D, L, K: r5(K), cy: r5(mt - yT), Fh: r5(mt + (yB - yT) + mb), sT: r5(raw(0.5, 0)[2]), sB: r5(sB) };
}

export type CamName = "tv" | "top";
export const CAMS: Record<CamName, Cam> = {
  tv: mkCam(38, 2.4, 1.42, 0.2, 0.075, 0.97),
  top: mkCam(0, 3, 1.42, 0.2, 0.075, 0.82),
};

export interface FramePoint {
  x: number;
  y: number;
  /** Perspective scale at that point (1 at the centre line's depth). */
  s: number;
}

/** Plane (u, v) → frame (x, y) in %. */
export function proj(C: Cam, u: number, v: number): FramePoint {
  const x = u / 100 - 0.5;
  const y = (v / 100 - 0.5) * C.L;
  const z = y * C.sn;
  const s = C.D / (C.D - z);
  return { x: (0.5 + x * s * C.K) * 100, y: ((C.cy + y * C.c * s * C.K) / C.Fh) * 100, s };
}

/** Frame (x, y) in % → plane (u, v) in % (the inverse of proj, for dragging). */
export function unproj(C: Cam, X: number, Y: number): { u: number; v: number } {
  const Xr = (X / 100 - 0.5) / C.K;
  const Yr = ((Y / 100) * C.Fh - C.cy) / C.K;
  const y = (Yr * C.D) / (C.c * C.D + Yr * C.sn);
  const s = C.D / (C.D - y * C.sn);
  return { u: (Xr / s + 0.5) * 100, v: (y / C.L + 0.5) * 100 };
}

/** Cromo scale by depth: a touch smaller far away, a touch bigger near the camera. */
export function depthScale(C: Cam, s: number): number {
  if (C.sB - C.sT < 1e-6) return 1;
  return Math.max(0.9, Math.min(1.08, 0.9 + ((s - C.sT) / (C.sB - C.sT)) * 0.18));
}

// ── The systems, as designed: [label, zone, u, v] per slot (0 = POR, then back to front). ──
export type SlotSpot = readonly [label: string, zone: Zone, u: number, v: number];
export const FORM: Record<FormationName, readonly SlotSpot[]> = {
  "2-3-1": [["POR", "POR", 50, 92], ["DFC", "DEF", 30, 73], ["DFC", "DEF", 70, 73], ["MI", "MED", 17, 50], ["MC", "MED", 50, 54], ["MD", "MED", 83, 50], ["DC", "DEL", 50, 24]],
  "3-2-1": [["POR", "POR", 50, 92], ["LI", "DEF", 18, 70], ["DFC", "DEF", 50, 74], ["LD", "DEF", 82, 70], ["MC", "MED", 32, 49], ["MC", "MED", 68, 49], ["DC", "DEL", 50, 24]],
  "3-1-2": [["POR", "POR", 50, 92], ["LI", "DEF", 18, 70], ["DFC", "DEF", 50, 74], ["LD", "DEF", 82, 70], ["MC", "MED", 50, 51], ["DC", "DEL", 31, 26], ["DC", "DEL", 69, 26]],
  "2-1-3": [["POR", "POR", 50, 92], ["DFC", "DEF", 30, 74], ["DFC", "DEF", 70, 74], ["MC", "MED", 50, 54], ["EI", "DEL", 17, 32], ["DC", "DEL", 50, 23], ["ED", "DEL", 83, 32]],
  "1-3-2": [["POR", "POR", 50, 92], ["LIB", "DEF", 50, 74], ["MI", "MED", 17, 51], ["MC", "MED", 50, 53], ["MD", "MED", 83, 51], ["DC", "DEL", 31, 26], ["DC", "DEL", 69, 26]],
  "2-1-2-1": [["POR", "POR", 50, 92], ["DFC", "DEF", 29, 76], ["DFC", "DEF", 71, 76], ["MCD", "MED", 50, 59], ["MI", "MED", 20, 41], ["MD", "MED", 80, 41], ["DC", "DEL", 50, 20]],
};
export const SYSTEMS = Object.keys(FORM) as FormationName[];

// How the plan moves the seven (v offsets in % of the length; amplitude multiplier).
const DEF_LINE: Record<string, number> = { Baja: 7, Media: 0, Alta: -9 };
const MENTALITY: Record<string, number> = { Defensiva: 5, Equilibrada: 0, Ofensiva: -6 };
const WIDTH: Record<string, number> = { Estrecha: 0.78, Media: 1, Amplia: 1.13 };
export const PRESS_BAND: Record<string, [number, number]> = { Repliegue: [46, 80], Media: [26, 60], Alta: [5, 40] };
/** Seconds per pulse along the química links (the ritmo). */
export const TEMPO_PULSE: Record<string, number> = { Pausado: 3.6, Medio: 2.4, Rápido: 1.3 };
export const DEF_LINE_VALUES = ["Baja", "Media", "Alta"] as const;

const spotOf = (L: Lineup, i: number): SlotSpot => (FORM[L.formation] ?? FORM["2-3-1"])[i];

/** A plane point. */
export interface UV {
  u: number;
  v: number;
}

/** Where slot i stands: the free spot, or the system's spot moved by the plan (línea, mentalidad, amplitud). */
export function slotPos(L: Lineup, i: number): UV {
  const s = L.slots[i];
  if (L.freeMode && s) return { u: s.x, v: s.y };
  const f = spotOf(L, i);
  let u = f[2];
  let v = f[3];
  if (i === 0) return { u, v };
  const t = L.tactics ?? {};
  const dl = DEF_LINE[t.defLine] ?? 0;
  const me = MENTALITY[t.mentality] ?? 0;
  const am = WIDTH[t.width] ?? 1;
  if (f[1] === "DEF") v += dl;
  else if (f[1] === "MED") v += dl * 0.45;
  v += me;
  u = 50 + (u - 50) * am;
  return { u: Math.max(9, Math.min(91, u)), v: Math.max(8, Math.min(90, v)) };
}

/** The línea defensiva's depth for a given value (the defenders' mean + the plan + a step behind them). */
export function lineDepth(L: Lineup, value: string): number {
  const f = FORM[L.formation] ?? FORM["2-3-1"];
  let s = 0;
  let n = 0;
  f.forEach((x) => {
    if (x[1] === "DEF") {
      s += x[3];
      n++;
    }
  });
  const base = n ? s / n : 72;
  return base + (DEF_LINE[value] ?? 0) + (MENTALITY[L.tactics?.mentality] ?? 0) + 4;
}

/** The línea value closest to a depth (dragging the line snaps to Baja / Media / Alta). */
export function nearestLine(L: Lineup, v: number): (typeof DEF_LINE_VALUES)[number] {
  let best: (typeof DEF_LINE_VALUES)[number] = "Media";
  let bd = Infinity;
  DEF_LINE_VALUES.forEach((val) => {
    const d = Math.abs(lineDepth(L, val) - v);
    if (d < bd) {
      bd = d;
      best = val;
    }
  });
  return best;
}

/** The zone a slot plays in (free mode: by depth). */
export function slotZone(L: Lineup, i: number): Zone {
  if (i === 0) return "POR";
  if (L.freeMode && L.slots[i]) {
    const v = L.slots[i].y;
    return v >= 62 ? "DEF" : v >= 36 ? "MED" : "DEL";
  }
  return spotOf(L, i)[1];
}

/** The slot's short label (DFC, MI…; the zone in free mode). */
export function slotLabel(L: Lineup, i: number): string {
  if (L.freeMode) return slotZone(L, i);
  return spotOf(L, i)[0];
}

/** Squared plane distance with the length weighted like the real pitch (1.42 : 1). */
export const planeDist2 = (a: UV, b: UV): number => (a.u - b.u) ** 2 + ((a.v - b.v) * 1.42) ** 2;

// ── Static pitch art (viewBox 0 0 1000 1000 stretched to the frame). ──
export interface PitchArt {
  apron: string;
  stripes: string[];
  pools: string[];
  rim: string;
  lines: string[];
  spots: string[];
  goals: string[];
  dots: string;
}

const artCache = new Map<CamName, PitchArt>();
export function pitchArt(cam: CamName): PitchArt {
  const hit = artCache.get(cam);
  if (hit) return hit;
  const C = CAMS[cam];
  const pt = (u: number, v: number): string => {
    const p = proj(C, u, v);
    return (p.x * 10).toFixed(1) + " " + (p.y * 10).toFixed(1);
  };
  const poly = (pts: number[][]): string => "M" + pts.map((q) => pt(q[0], q[1])).join("L") + "Z";
  const line = (pts: number[][]): string => "M" + pts.map((q) => pt(q[0], q[1])).join("L");
  const arc = (cu: number, cv: number, ru: number, rv: number, a0: number, a1: number, n = 28): string =>
    line(Array.from({ length: n + 1 }, (_, i) => {
      const a = a0 + ((a1 - a0) * i) / n;
      return [cu + ru * Math.cos(a), cv + rv * Math.sin(a)];
    }));
  const RV = 1 / 1.42;
  const art: PitchArt = {
    apron: poly([[-4, -5], [104, -5], [104, 105], [-4, 105]]),
    stripes: Array.from({ length: 12 }, (_, i) => poly([[0, (i * 100) / 12], [100, (i * 100) / 12], [100, ((i + 1) * 100) / 12], [0, ((i + 1) * 100) / 12]])),
    pools: [[18, 22, 30], [82, 22, 30], [18, 78, 30], [82, 78, 30], [50, 50, 40]].map(([u, v, r]) => arc(u, v, r, r * RV, 0, Math.PI * 2, 36) + "Z"),
    rim: poly([[0, 0], [100, 0], [100, 100], [0, 100]]),
    lines: [
      poly([[0, 0], [100, 0], [100, 100], [0, 100]]),
      line([[0, 50], [100, 50]]),
      arc(50, 50, 13, 13 * RV, 0, Math.PI * 2, 40),
      line([[22, 0], [22, 15], [78, 15], [78, 0]]),
      line([[22, 100], [22, 85], [78, 85], [78, 100]]),
      line([[38, 0], [38, 5], [62, 5], [62, 0]]),
      line([[38, 100], [38, 95], [62, 95], [62, 100]]),
      arc(50, 15, 9, 9 * RV, 0.35, Math.PI - 0.35, 16),
      arc(50, 85, 9, 9 * RV, Math.PI + 0.35, Math.PI * 2 - 0.35, 16),
      arc(0, 0, 2.5, 2.5 * RV, 0, Math.PI / 2, 6),
      arc(100, 0, 2.5, 2.5 * RV, Math.PI / 2, Math.PI, 6),
      arc(0, 100, 2.5, 2.5 * RV, -Math.PI / 2, 0, 6),
      arc(100, 100, 2.5, 2.5 * RV, Math.PI, Math.PI * 1.5, 6),
    ],
    spots: [[50, 50], [50, 11], [50, 89]].map(([u, v]) => arc(u, v, 0.8, 0.8 * RV, 0, Math.PI * 2, 10) + "Z"),
    goals: [poly([[44, -2.6], [56, -2.6], [56, 0], [44, 0]]), poly([[44, 100], [56, 100], [56, 102.6], [44, 102.6]])],
    dots: (() => {
      const d: string[] = [];
      for (let u = 5; u <= 95; u += 5) for (let v = 5; v <= 95; v += 5) d.push("M" + pt(u, v) + "h.1");
      return d.join("");
    })(),
  };
  artCache.set(cam, art);
  return art;
}

/** Path data in the 1000×1000 frame box (for the plan layer and the swap arc). */
export const f1 = (n: number): string => (Math.round(n * 10) / 10).toString();
export function framePath(C: Cam, pts: [number, number][]): string {
  return pts.map(([u, v], i) => {
    const q = proj(C, u, v);
    return (i ? "L" : "M") + f1(q.x * 10) + " " + f1(q.y * 10);
  }).join("");
}

// Crowd camera flashes and the «¡Siete listo!» confetti (deterministic, as designed).
export const FLASHES = Array.from({ length: 30 }, (_, i) => ({ x: ((i * 37) % 100) + "%", y: ((i * 23) % 64) + "%", d: (-((i * 0.83) % 5)).toFixed(2) + "s" }));
export const SPARKS = Array.from({ length: 28 }, (_, i) => ({
  x: ((i * 41) % 100) + "%",
  c: ["#FFC659", "#9fd0f2", "#ffffff", "#FFE3A3"][i % 4],
  d: (1.4 + ((i * 7) % 10) / 10).toFixed(2) + "s",
  w: (((i * 13) % 10) / 20).toFixed(2) + "s",
  r: ((i * 47) % 360) + "deg",
}));
