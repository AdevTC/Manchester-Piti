// Camera rigs. yaw 0 looks north (-z) across the pitch at the main stand; yaw 90 looks east (+x) from behind
// our goal. pitch is the tilt in degrees (negative looks down). The horizon and the sun's screen point follow
// analytically, so the still, the CSS sky and the WebGL scene agree.
import type { PalomerasRig } from "./types";

export interface RigDef {
  pos: readonly [number, number, number];
  yaw: number;
  pitch: number;
  fov: number;
}

export const RIGS = {
  wide: { pos: [-2, 12.6, 41], yaw: 0, pitch: -4.6, fov: 50 },
  tab: { pos: [-4, 12.2, 39], yaw: 0, pitch: -3.9, fov: 56 },
  phone: { pos: [-48, 13, 0.5], yaw: 90, pitch: -8, fov: 70 },
  mini: { pos: [-2, 14, 44], yaw: 0, pitch: -7, fov: 48 },
  /** The phone's featured jornada, closer so the seven read bigger. */
  gf: { pos: [-11, 11, 29], yaw: 0, pitch: -15, fov: 46 },
  /** The six light-calendar slices, each from its own spot (portrait s1..s6, phone bands b1..b6). */
  s1: { pos: [-47, 13.5, 4], yaw: 90, pitch: -6, fov: 64 },
  s2: { pos: [-42, 30, 42], yaw: 45, pitch: -18, fov: 64 },
  s3: { pos: [12, 4.2, 31], yaw: -22, pitch: 3, fov: 64 },
  s4: { pos: [47, 12, -4], yaw: -90, pitch: -6, fov: 64 },
  s5: { pos: [0, 19, 54], yaw: 0, pitch: -9, fov: 64 },
  s6: { pos: [40, 15, -38], yaw: -135, pitch: -8, fov: 64 },
  b1: { pos: [-2, 13, 46], yaw: 0, pitch: -7, fov: 40 },
  b2: { pos: [-42, 28, 44], yaw: 45, pitch: -16, fov: 40 },
  b3: { pos: [8, 4.5, 34], yaw: -16, pitch: 1, fov: 40 },
  b4: { pos: [50, 12, -2], yaw: -90, pitch: -7, fov: 40 },
  b5: { pos: [0, 18, 56], yaw: 0, pitch: -8, fov: 40 },
  b6: { pos: [42, 15, -38], yaw: -135, pitch: -8, fov: 40 },
} as const satisfies Record<string, RigDef>;

export type RigKey = keyof typeof RIGS;

/**
 * The camera of a rig. Slices pick one of six vantage points (`spot` 1–6): portrait slices use s1..s6;
 * wide phone bands use the close featured camera for spot 1 and b2..b6 for the rest.
 */
export function rigKey(rig: PalomerasRig, spot = 1): RigKey {
  const n = Math.max(1, Math.min(6, Math.round(spot)));
  switch (rig) {
    case "hero390":
      return "phone";
    case "hero820":
      return "tab";
    case "hero1440":
      return "wide";
    case "window":
      return "mini";
    case "slice":
      return `s${n}` as RigKey;
    case "sliceWide":
      return n === 1 ? "gf" : (`b${n}` as RigKey);
  }
}

export function rigDef(rig: PalomerasRig, spot = 1): RigDef {
  return RIGS[rigKey(rig, spot)];
}

const RAD = Math.PI / 180;

/** Where the horizon crosses the view, as a fraction of its height from the top. */
export function horizonFraction(r: RigDef): number {
  return 0.5 + (0.5 * Math.tan(r.pitch * RAD)) / Math.tan((r.fov * RAD) / 2);
}

/** The afternoon the hero spans, in Madrid minutes: 14:00 at the left edge, 21:00 at the right. */
export const SCRUB0 = 840;
export const SCRUB1 = 1260;

/** Sun over the view (fractions of the box): x by time of day, y by compressed elevation. */
export function sunScreen(minutes: number, el: number, r: RigDef): { x: number; y: number } {
  const tf = Math.tan((r.fov * RAD) / 2);
  const emax = ((Math.atan(tf) / RAD) + r.pitch) * 0.84;
  const ev = el <= 5 ? Math.max(el, -3.5) : 5 + (el - 5) * Math.max(0.05, (emax - 5) / 37);
  const u = Math.max(0, Math.min(1, (minutes - SCRUB0) / (SCRUB1 - SCRUB0)));
  return { x: 0.07 + 0.86 * u, y: 0.5 - (0.5 * Math.tan((ev - r.pitch) * RAD)) / tf };
}

export type Projector = (X: number, Y: number, Z: number) => { x: number; y: number; z: number } | null;

/** Pinhole projection of world metres into a w×h view for a rig (the still and the plates use it). */
export function projector(r: RigDef, w: number, h: number): Projector {
  const y = r.yaw * RAD;
  const p = r.pitch * RAD;
  const f = [Math.sin(y) * Math.cos(p), Math.sin(p), -Math.cos(y) * Math.cos(p)];
  const rt = [Math.cos(y), 0, Math.sin(y)];
  const up = [rt[1] * f[2] - rt[2] * f[1], rt[2] * f[0] - rt[0] * f[2], rt[0] * f[1] - rt[1] * f[0]];
  const tv = Math.tan((r.fov * RAD) / 2);
  const th = (tv * w) / h;
  return (X, Y, Z) => {
    const d = [X - r.pos[0], Y - r.pos[1], Z - r.pos[2]];
    const z = d[0] * f[0] + d[1] * f[1] + d[2] * f[2];
    if (z < 0.3) return null;
    const x = d[0] * rt[0] + d[1] * rt[1] + d[2] * rt[2];
    const yy = d[0] * up[0] + d[1] * up[1] + d[2] * up[2];
    return { x: w / 2 + ((x / z / th) * w) / 2, y: h / 2 - ((yy / z / tv) * h) / 2, z };
  };
}
