// Jugadas: a deterministic timeline over the frames. Each segment first paints that frame's AR
// arrows on the grass (animated draw), then the players run along smooth Catmull-Rom paths
// through all frames (with light trails), the ball arcs on passes / rolls on carries, and the
// camera follows the ball. Everything is a pure function of the playhead, so seek() is exact.
import { Vector2, Vector3, type Group } from "three";
import { C, clamp, easeInOutCubic, toWorld } from "./constants";
import { Arrow, Trail, type Ball } from "./fx";
import type { Player, Rivals } from "./players";
import type { PlayController, PlayFrame, PlayOptions } from "./types";

const DRAW = 0.6, HOLD0 = 0.35, HOLD_END = 1.1, REWIND = 1.3, TRAIL_N = 26, TRAIL_DT = 0.032;

interface Mover {
  id: string;
  pts: Vector2[];
  set(p: Vector2 | null): void;
  trail: Trail;
}
interface Segment {
  start: number;
  moveStart: number;
  end: number;
  arrows: Arrow[];
  ballMode: "pase" | "conduccion" | "roll";
  carrier: string | null;
}

export interface PlayHost {
  players: Map<string, Player>;
  rivals: Rivals;
  ball: Ball;
  layer: Group;
  /** Camera: follow this point closely (null = release). */
  track(v: Vector3 | null): void;
  reduceMotion: boolean;
}

function catmull(p0: Vector2, p1: Vector2, p2: Vector2, p3: Vector2, t: number, out: Vector2) {
  const t2 = t * t, t3 = t2 * t;
  out.x = 0.5 * (2 * p1.x + (-p0.x + p2.x) * t + (2 * p0.x - 5 * p1.x + 4 * p2.x - p3.x) * t2 + (-p0.x + 3 * p1.x - 3 * p2.x + p3.x) * t3);
  out.y = 0.5 * (2 * p1.y + (-p0.y + p2.y) * t + (2 * p0.y - 5 * p1.y + 4 * p2.y - p3.y) * t2 + (-p0.y + 3 * p1.y - 3 * p2.y + p3.y) * t3);
  return out;
}

export class Jugada implements PlayController {
  private movers: Mover[] = [];
  private segs: Segment[] = [];
  private ballPts: Vector2[] = [];
  private total = 0;
  private cycle = 0;
  private time = 0;
  private paused = false;
  private ended = false;
  private finished = false;
  private lastFrame = -1;
  private speed: number;
  private resolve!: () => void;
  readonly done: Promise<void>;
  private tmp = new Vector2();
  private follow = new Vector3();
  private host: PlayHost;
  private frames: PlayFrame[];
  private opts: PlayOptions;

  constructor(host: PlayHost, frames: PlayFrame[], opts: PlayOptions) {
    this.host = host;
    this.frames = frames;
    this.opts = opts;
    this.done = new Promise((ok) => (this.resolve = ok));
    this.speed = Math.max(0.1, opts.speed ?? 1);
    const n = frames.length;
    // every entity mentioned in any frame, positions carried forward
    const ids = new Set<string>();
    for (const f of frames) for (const p of f.players) ids.add(p.id);
    for (const id of ids) {
      const pl = host.players.get(id);
      const rv = host.rivals.items.find((r) => r.id === id);
      if (!pl && !rv) continue;
      let last = pl ? pl.pos.clone() : rv!.pos.clone();
      const pts = frames.map((f) => {
        const p = f.players.find((q) => q.id === id);
        if (p) {
          const [wx, wz] = toWorld(p.x, p.y);
          last = new Vector2(wx, wz);
        }
        return last.clone();
      });
      // frame 0 entries missing → back-fill from the first known spot
      const set = pl
        ? (p: Vector2 | null) => (pl.driven = p ? (pl.driven ?? new Vector2()).copy(p) : null)
        : (p: Vector2 | null) => (rv!.driven = p ? (rv!.driven ?? new Vector2()).copy(p) : null);
      const trail = new Trail(pl ? C.skyHi : C.rival, TRAIL_N);
      host.layer.add(trail.mesh);
      this.movers.push({ id, pts, set, trail });
    }
    let lastBall = host.ball.pos.clone();
    this.ballPts = frames.map((f) => {
      if (f.ball) {
        const [wx, wz] = toWorld(f.ball.x, f.ball.y);
        lastBall = new Vector2(wx, wz);
      }
      return lastBall.clone();
    });
    // timeline
    let t = HOLD0;
    for (let i = 0; i < n - 1; i++) {
      let maxD = 0;
      for (const m of this.movers) maxD = Math.max(maxD, m.pts[i].distanceTo(m.pts[i + 1]));
      const bd = this.ballPts[i].distanceTo(this.ballPts[i + 1]);
      const move = clamp(Math.max(maxD / 7.5, bd / 16), 1.0, 2.8);
      const arrows = (frames[i].arrows ?? []).map((a) => {
        const ar = new Arrow(a);
        host.layer.add(ar.group);
        return ar;
      });
      const kinds = new Set((frames[i].arrows ?? []).map((a) => a.kind));
      const ballMode: Segment["ballMode"] = bd < 0.8 ? "roll" : kinds.has("pase") ? "pase" : kinds.has("conduccion") ? "conduccion" : "roll";
      // carrier: the mover closest to the ball at both ends of a carry
      let carrier: string | null = null;
      if (ballMode === "conduccion") {
        let best = 4;
        for (const m of this.movers) {
          const d = m.pts[i].distanceTo(this.ballPts[i]) + m.pts[i + 1].distanceTo(this.ballPts[i + 1]);
          if (d < best) {
            best = d;
            carrier = m.id;
          }
        }
      }
      this.segs.push({ start: t, moveStart: t + DRAW, end: t + DRAW + move, arrows, ballMode, carrier });
      t += DRAW + move;
    }
    // arrows of the last frame (if any) are drawn during the end hold
    const lastArrows = (frames[n - 1]?.arrows ?? []).map((a) => {
      const ar = new Arrow(a);
      host.layer.add(ar.group);
      return ar;
    });
    if (lastArrows.length) this.segs.push({ start: t, moveStart: t + DRAW, end: t + DRAW, arrows: lastArrows, ballMode: "roll", carrier: null });
    this.total = t + HOLD_END;
    this.cycle = this.total + (opts.loop ? REWIND : 0);
    this.apply();
  }

  private pathAt(pts: Vector2[], i: number, u: number, out: Vector2) {
    const n = pts.length;
    return catmull(pts[Math.max(0, i - 1)], pts[i], pts[Math.min(n - 1, i + 1)], pts[Math.min(n - 1, i + 2)], u, out);
  }

  /** Position of a mover at playhead τ (seconds). */
  private moverAt(m: Mover, tau: number, out: Vector2): Vector2 {
    const n = m.pts.length;
    if (tau >= this.total) {
      if (this.opts.loop && tau > this.total) {
        const u = easeInOutCubic(clamp((tau - this.total) / REWIND, 0, 1));
        return out.copy(m.pts[n - 1]).lerp(m.pts[0], u);
      }
      return out.copy(m.pts[n - 1]);
    }
    for (let i = 0; i < this.segs.length; i++) {
      const s = this.segs[i];
      if (i >= n - 1) break;
      if (tau < s.moveStart) return out.copy(m.pts[i]);
      if (tau < s.end) return this.pathAt(m.pts, i, easeInOutCubic((tau - s.moveStart) / (s.end - s.moveStart)), out);
    }
    return out.copy(m.pts[n - 1]);
  }

  private apply() {
    const tau = this.time, n = this.frames.length;
    const reduce = this.host.reduceMotion;
    for (const m of this.movers) {
      const p = this.moverAt(m, tau, this.tmp);
      m.set(p);
      // trail: sample the recent past within the current move
      const pts: Vector2[] = [];
      let moving = false;
      const seg = this.segs.find((s) => tau >= s.moveStart && tau < s.end + 0.5);
      if (seg && !reduce) {
        for (let k = 0; k < TRAIL_N; k++) {
          const tk = Math.max(seg.moveStart, tau - k * TRAIL_DT);
          pts.push(this.moverAt(m, Math.min(tk, seg.end), new Vector2()));
          if (tk <= seg.moveStart) break;
        }
        moving = pts.length > 1 && pts[0].distanceTo(pts[pts.length - 1]) > 0.4;
      }
      const fade = seg ? clamp(1 - (tau - seg.end) / 0.5, 0, 1) : 0;
      m.trail.set(moving ? pts : [], fade);
    }
    // ball
    const b = this.host.ball;
    b.driven = true;
    let h = 0;
    if (tau >= this.total) {
      if (this.opts.loop && tau > this.total) {
        const u = easeInOutCubic(clamp((tau - this.total) / REWIND, 0, 1));
        b.pos.copy(this.ballPts[n - 1]).lerp(this.ballPts[0], u);
      } else b.pos.copy(this.ballPts[n - 1]);
    } else {
      let placed = false;
      for (let i = 0; i < this.segs.length && i < n - 1; i++) {
        const s = this.segs[i];
        if (tau < s.moveStart) {
          b.pos.copy(this.ballPts[i]);
          placed = true;
          break;
        }
        if (tau < s.end) {
          const lin = (tau - s.moveStart) / (s.end - s.moveStart);
          const A = this.ballPts[i], B = this.ballPts[i + 1], d = A.distanceTo(B);
          if (s.ballMode === "pase") {
            // the pass leaves a touch after the run starts and lands as the receiver arrives
            const u = clamp((lin - 0.12) / 0.78, 0, 1);
            const e = u < 1 ? 1 - Math.pow(1 - u, 1.6) : 1;
            b.pos.copy(A).lerp(B, e);
            h = Math.min(4.5, d * 0.1) * Math.sin(Math.PI * u);
          } else if (s.ballMode === "conduccion" && s.carrier) {
            const m = this.movers.find((q) => q.id === s.carrier)!;
            const p = this.moverAt(m, tau, new Vector2());
            // the ball runs a metre ahead of the carrier, towards the next spot
            const k = easeInOutCubic(lin);
            b.pos.copy(A).lerp(B, k).lerp(p, 0.5);
          } else b.pos.copy(A).lerp(B, easeInOutCubic(lin));
          placed = true;
          break;
        }
      }
      if (!placed) b.pos.copy(this.ballPts[n - 1]);
    }
    b.height = h;
    // arrows: draw during the segment's draw phase, stay through the run, fade during the next draw
    this.segs.forEach((s, i) => {
      const next = this.segs[i + 1];
      const fadeStart = next ? next.start : this.total - 0.3;
      for (const a of s.arrows) {
        a.progress = clamp((tau - s.start) / (DRAW * 0.9), 0, 1);
        a.opacity = tau < s.start ? 0 : clamp(1 - (tau - fadeStart) / 0.4, 0, 1);
        a.group.visible = a.opacity > 0.001;
      }
    });
    // frame callbacks
    let frame = 0;
    for (let i = 0; i < this.segs.length && i < n - 1; i++) if (tau >= this.segs[i].start) frame = i;
    if (tau >= this.total - HOLD_END) frame = n - 1;
    if (frame !== this.lastFrame) {
      this.lastFrame = frame;
      this.opts.onFrame?.(frame);
    }
    // the camera follows the action: the ball, pulled a little towards the pitch centre
    this.follow.set(b.pos.x * 0.8, 0, b.pos.y * 0.85);
    this.host.track(this.follow);
  }

  /** Called by the engine with the elapsed engine time (s) — every frame, or from a timeout when frames stall. */
  tick(dt: number, t: number) {
    for (const s of this.segs) for (const a of s.arrows) a.tick(t);
    if (this.ended || this.paused) return;
    this.time += dt * this.speed;
    if (this.time >= this.cycle) {
      if (this.opts.loop) {
        this.time -= this.cycle;
        this.lastFrame = -1;
      } else {
        // hold the final picture until stop(); `done` resolves now
        this.time = this.total;
        this.apply();
        this.finished = true;
        this.paused = true;
        this.opts.onEnd?.();
        this.resolve();
        return;
      }
    }
    this.apply();
  }

  pause() {
    this.paused = true;
  }
  resume() {
    if (this.finished) {
      // replay from the start
      this.finished = false;
      this.time = 0;
      this.lastFrame = -1;
    }
    this.paused = false;
  }
  seek(t: number) {
    this.time = clamp(t, 0, 1) * this.total;
    this.lastFrame = -1;
    this.apply();
  }
  stop() {
    if (this.ended) return;
    this.ended = true;
    for (const m of this.movers) {
      m.set(null);
      m.trail.dispose();
    }
    for (const s of this.segs) for (const a of s.arrows) a.dispose();
    this.host.ball.driven = false;
    this.host.ball.height = 0;
    this.host.track(null);
    this.resolve();
  }
  /** Where the playhead is, 0..1. */
  get progress() {
    return clamp(this.time / this.total, 0, 1);
  }
  get isEnded() {
    return this.ended;
  }
}
