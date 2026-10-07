// World layout (metres, Y up). The pitch lies on y = 0, its length along Z: our goal line at
// z = +L/2 (near the default camera), the rival goal line at z = -L/2; x grows to the right.

/** Fútbol-7 pitch, between the lines. */
export const PITCH_W = 40;
export const PITCH_L = 60;
/** Grass run-off around the lines. */
export const RUNOFF = 4;
/** Goals (fútbol-7): 6 × 2 m. */
export const GOAL_W = 6;
export const GOAL_H = 2;
export const GOAL_D = 1.4;

/** Players are stylised "holograms": the real shirt mesh at a heroic scale so the board reads. */
export const SHIRT_H = 4.6;
/** Gap between the grass and the hem of the floating shirt. */
export const SHIRT_FLOAT = 0.7;
export const BALL_R = 0.62;
/** AR ring plane size under a shirt (the ring is ~0.87 of the plane, a bit wider than the shirt). */
export const RING_SCALE = SHIRT_H * 1.02;

/** Stands start this far beyond the lines; LED boards sit in the gap. */
export const BOARD_GAP = 2.4;
export const STAND_GAP = 6.5;
export const STAND_DEPTH = 13;
export const STAND_TIERS = 9;
export const STAND_RISE = 0.85;
export const MAST_H = 30;
/** Inside of the bowl (cameras must stay within): up to just before the stands. */
export const HW_BOWL = PITCH_W / 2 + STAND_GAP - 1.2;
export const HL_BOWL = PITCH_L / 2 + STAND_GAP - 1.2;

export const C = {
  navy: 0x030817,
  navy2: 0x0a1532,
  sky: 0x6cabdd,
  skyHi: 0x9fd0f2,
  gold: 0xffc659,
  goldDeep: 0xcfa862,
  white: 0xeef4ff,
  rival: 0xd6283a,
} as const;

export const CSS = {
  navy: "#030817",
  sky: "#6CABDD",
  skyHi: "#9FD0F2",
  gold: "#FFC659",
  white: "#EEF4FF",
  rival: "#E0485A",
} as const;

/** Pitch % → world (x, z). */
export function toWorld(x: number, y: number): [number, number] {
  return [(x / 100 - 0.5) * PITCH_W, (0.5 - y / 100) * PITCH_L];
}
/** World (x, z) → pitch %. */
export function toPitch(wx: number, wz: number): { x: number; y: number } {
  return { x: (wx / PITCH_W + 0.5) * 100, y: (0.5 - wz / PITCH_L) * 100 };
}

export const clamp = (v: number, a: number, b: number) => (v < a ? a : v > b ? b : v);
export const lerp = (a: number, b: number, t: number) => a + (b - a) * t;
export const smooth = (t: number) => t * t * (3 - 2 * t);
export const easeInOutCubic = (p: number) => (p < 0.5 ? 4 * p * p * p : 1 - Math.pow(-2 * p + 2, 3) / 2);
export const easeOutCubic = (p: number) => 1 - Math.pow(1 - p, 3);
export const easeOutBack = (p: number) => {
  const c1 = 1.5, c3 = c1 + 1;
  return 1 + c3 * Math.pow(p - 1, 3) + c1 * Math.pow(p - 1, 2);
};
/** Deterministic pseudo-random (mulberry32). */
export function rng(seed: number) {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}
