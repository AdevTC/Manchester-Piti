// Broadcast-crane camera: the camera orbits a target (azimuth, elevation, distance, fov). Presets
// adapt to the aspect (portrait: behind our goal, pitch running up the screen; landscape: from the
// main stand, our goal on the left) and are auto-fitted so the whole pitch shows. Flights
// interpolate the orbit parameters (crane arcs, no straight dollies) with a slight pull-back.
import { PerspectiveCamera, Vector3 } from "three";
import { PITCH_L, PITCH_W, SHIRT_FLOAT, SHIRT_H, clamp, easeInOutCubic, easeOutCubic, lerp } from "./constants";
import type { CameraPreset } from "./types";

export interface Orbit {
  target: Vector3;
  az: number;
  el: number;
  dist: number;
  fov: number;
}

const HW = PITCH_W / 2, HL = PITCH_L / 2;
const D2R = Math.PI / 180;

export function orbitPosition(o: Orbit, out = new Vector3()) {
  const c = Math.cos(o.el);
  return out.set(o.target.x + Math.sin(o.az) * c * o.dist, o.target.y + Math.sin(o.el) * o.dist, o.target.z + Math.cos(o.az) * c * o.dist);
}

const probe = new PerspectiveCamera();
const tmp = new Vector3();
/**
 * Smallest distance at which every point projects inside the box (NDC): |x| ≤ mx, y ∈ [-my, myTop].
 * Points behind the camera fail.
 */
function fit(o: Omit<Orbit, "dist">, aspect: number, points: Vector3[], mx: number, my: number, myTop = my): number {
  let lo = 2, hi = 800;
  probe.fov = o.fov;
  probe.aspect = aspect;
  probe.near = 0.1;
  probe.far = 3000;
  probe.updateProjectionMatrix();
  for (let i = 0; i < 28; i++) {
    const mid = (lo + hi) / 2;
    orbitPosition({ ...o, dist: mid }, probe.position);
    probe.lookAt(o.target);
    probe.updateMatrixWorld(true);
    let ok = true;
    for (const p of points) {
      tmp.copy(p).project(probe);
      if (tmp.z > 1 || Math.abs(tmp.x) > mx || tmp.y < -my || tmp.y > myTop) {
        ok = false;
        break;
      }
    }
    if (ok) hi = mid;
    else lo = mid;
  }
  return hi;
}

const corners = (y: number, pad = 0) => [
  new Vector3(-HW - pad, y, -HL - pad),
  new Vector3(HW + pad, y, -HL - pad),
  new Vector3(-HW - pad, y, HL + pad),
  new Vector3(HW + pad, y, HL + pad),
];

/**
 * The orbit of a preset for the element's aspect. The subject is the pitch and the players; the
 * stadium only frames them.
 *  - tv: broadcast main camera. Portrait: behind our goal, the pitch running up the screen, its
 *    width filling the frame (the near corners may crop). Landscape: the main stand, our goal on
 *    the left, the far touchline spanning ~85% of the width (the near touchline crops at the bottom).
 *  - top: cenital, the pitch filling the frame (length along the long side of the screen).
 *  - low: pitch-level hero shot from behind our back line, the seven towering over the grass.
 *  - stands: high corner of the stands (the intro starts here).
 */
export function preset(name: CameraPreset, aspect: number): Orbit {
  const portrait = aspect < 0.9;
  const side = portrait ? 0 : Math.PI / 2;
  const head = SHIRT_FLOAT + SHIRT_H;
  switch (name) {
    case "top": {
      const o = { target: new Vector3(0, 0, 0), az: side, el: 89 * D2R, fov: 30 };
      return { ...o, dist: fit(o, aspect, corners(0, 0.6), 0.985, 0.975) };
    }
    case "stands": {
      const o = { target: new Vector3(0, 2, portrait ? -4 : 0), az: side + (portrait ? 0.7 : 0.62), el: (portrait ? 24 : 18) * D2R, fov: portrait ? 50 : 40 };
      return { ...o, dist: fit(o, aspect, corners(0, 2), portrait ? 1.0 : 0.95, 0.9) };
    }
    case "low": {
      // pitch level, just inside the bowl (in front of the stands, over the boards), slightly off-axis
      // so the nearest shirt does not block the lens
      return portrait
        ? { target: new Vector3(0, head * 0.5, -4), az: 0.32, el: 6 * D2R, dist: 34, fov: 56 }
        : { target: new Vector3(-2, head * 0.5, 0), az: side + 0.2, el: 5 * D2R, dist: 26, fov: 46 };
    }
    case "tv":
    default: {
      if (portrait) {
        const o = { target: new Vector3(0, 0, -3), az: 0, el: 41 * D2R, fov: 45 };
        // far corners + far players fully in, the near goal area in (the near corners may crop)
        const pts = [new Vector3(-HW, 0, -HL), new Vector3(HW, 0, -HL), new Vector3(-HW, head, -HL + 4), new Vector3(HW, head, -HL + 4), new Vector3(-12, 0, HL + 1), new Vector3(12, 0, HL + 1)];
        return { ...o, dist: fit(o, aspect, pts, 1.0, 0.96, 0.9) };
      }
      const o = { target: new Vector3(-1.5, 0, 0), az: side, el: 27 * D2R, fov: 28 };
      // the far touchline (with the players' heads) spans ~85% of the width; the near touchline may crop
      const pts = [new Vector3(-HW, 0, -HL), new Vector3(-HW, 0, HL), new Vector3(-HW, head, -HL + 3), new Vector3(-HW, head, HL - 3), new Vector3(HW - 2, 0, 0)];
      return { ...o, dist: fit(o, aspect, pts, 0.86, 1.0, 0.92) };
    }
  }
}

/** Close follow orbit for jugadas (target = the action). */
export function followOrbit(aspect: number, at: Vector3): Orbit {
  const portrait = aspect < 0.9;
  const tv = preset("tv", aspect);
  return { target: at.clone(), az: tv.az, el: (portrait ? 48 : 30) * D2R, dist: tv.dist * (portrait ? 0.5 : 0.65), fov: tv.fov };
}

/** Hero orbit around a shirt: the shirt fills `frac` of the frame height. */
export function heroDistance(fov: number, frac: number) {
  return (SHIRT_H / frac) / (2 * Math.tan((fov * D2R) / 2));
}

const angleDelta = (a: number, b: number) => {
  let d = (b - a) % (Math.PI * 2);
  if (d > Math.PI) d -= Math.PI * 2;
  if (d < -Math.PI) d += Math.PI * 2;
  return d;
};

/** "inOut": crane move (slow start and end); "out": get there fast, settle softly (approaches). */
export type FlightEase = "inOut" | "out";
/** A flight never outlives its duration by more than this (wall-clock guard), ms. */
export const FLIGHT_GRACE = 500;
const wallNow = () => (typeof performance !== "undefined" ? performance.now() : Date.now());

interface Flight {
  from: Orbit;
  to: Orbit;
  start: number;
  /** performance.now() at take-off: the wall-clock guard. */
  wall: number;
  dur: number;
  arc: number;
  ease: FlightEase;
  done: () => void;
}

export class CameraRig {
  orbit: Orbit;
  /** Point the orbit target tracks (jugadas), damped; null = free. */
  private track: Vector3 | null = null;
  private trackPos = new Vector3();
  private flight: Flight | null = null;
  /** The preset the rig rests on (refitted on resize), or null for a custom orbit. */
  resting: CameraPreset | null;
  camera: PerspectiveCamera;

  constructor(camera: PerspectiveCamera, name: CameraPreset, aspect: number) {
    this.camera = camera;
    this.orbit = preset(name, aspect);
    this.resting = name;
  }

  get flying() {
    return this.flight !== null;
  }

  /**
   * Fly to an orbit; resolves on arrival, when interrupted by another flight, or at the latest
   * FLIGHT_GRACE ms after its duration in wall-clock time (see update()).
   */
  fly(to: Orbit, dur: number, now: number, arc = 0.12, ease: FlightEase = "inOut"): Promise<void> {
    this.flight?.done();
    if (dur <= 0) {
      this.orbit = cloneOrbit(to);
      this.flight = null;
      return Promise.resolve();
    }
    return new Promise((done) => {
      this.flight = { from: cloneOrbit(this.orbit), to: cloneOrbit(to), start: now, wall: wallNow(), dur, arc, ease, done };
    });
  }

  /** Land the current flight now (snap to its destination) and resolve it. */
  finish() {
    const f = this.flight;
    if (!f) return;
    this.flight = null;
    this.orbit = cloneOrbit(f.to);
    f.done();
  }

  /** The host was paused for `ms`: move the wall-clock guard along so a resumed flight is not cut short. */
  shiftWall(ms: number) {
    if (this.flight) this.flight.wall += ms;
  }

  /** Make the orbit target follow a moving point (smoothly), or release it. */
  setTrack(v: Vector3 | null) {
    if (v && !this.track) this.trackPos.copy(this.flight ? this.flight.to.target : this.orbit.target);
    this.track = v ? (this.track ?? new Vector3()).copy(v) : null;
  }

  update(now: number, dt: number) {
    if (this.track) {
      this.trackPos.lerp(this.track, 1 - Math.exp(-dt * 2.6));
      if (this.flight) this.flight.to.target.copy(this.trackPos);
      else this.orbit.target.copy(this.trackPos);
    }
    const f = this.flight;
    if (f) {
      let p = clamp((now - f.start) / f.dur, 0, 1);
      if (wallNow() - f.wall >= f.dur + FLIGHT_GRACE) p = 1; // guard: never hang on a stalled clock
      const e = f.ease === "out" ? easeOutCubic(p) : easeInOutCubic(p), bump = f.ease === "out" ? 0 : Math.sin(Math.PI * e);
      const o = this.orbit;
      o.target.lerpVectors(f.from.target, f.to.target, e);
      o.az = f.from.az + angleDelta(f.from.az, f.to.az) * e;
      o.el = lerp(f.from.el, f.to.el, e) + bump * f.arc * 0.35;
      // distances interpolate in log space (feels like a zoom) with a crane pull-back mid-flight
      o.dist = Math.exp(lerp(Math.log(f.from.dist), Math.log(f.to.dist), e)) * (1 + bump * f.arc);
      o.fov = lerp(f.from.fov, f.to.fov, e);
      if (p >= 1) {
        this.flight = null;
        f.done();
      }
    }
    orbitPosition(this.orbit, this.camera.position);
    this.camera.lookAt(this.orbit.target);
    if (this.camera.fov !== this.orbit.fov) {
      this.camera.fov = this.orbit.fov;
      this.camera.updateProjectionMatrix();
    }
  }
}

export function cloneOrbit(o: Orbit): Orbit {
  return { target: o.target.clone(), az: o.az, el: o.el, dist: o.dist, fov: o.fov };
}
