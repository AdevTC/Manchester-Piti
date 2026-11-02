// r14 «La pizarra» · Jugadas: the pure side of the place (the prototype's window.PJ engine, PiJugadas.dc.html).
// A play is read by slot (token k = the board's slot k, so the pitch's `jugada` source names each shirt): the team's
// plays (the app's library, playLibrary.ts) are cast onto the board's seven by least travel with the galón holder on
// the dead ball; the board's own plays (the app's `Play`, keyed by player id) are played by the seven as it stands —
// one of the seven who is in the play runs his own track, a slot whose player is not in it takes the track of one
// who left the seven (nearest start), else stands still. Edits happen on the slot steps and are written back to the
// app's `Play` (fromSteps), with the arrows of each move derived again (plays.ts deriveArrows, the ball's way kept).
// Also: what the pitch draws for a step (ghost rings, curved runs, the ball's line), the flat zoom on a set piece, the
// Foco point, the key step, the signature a recorded video checks (B-PZ-10). No React, no store. Tested in
// jugadasView.test.ts.
import { PIZARRA_LIMITS, type BoardPoint, type Stroke } from "../../../../../lib/schemas";
import { PLAY_LIBRARY } from "../../../playLibrary";
import { deriveArrows, type Play, type PlayFrame, type PlayKind } from "../../../plays";
import type { RoleKey } from "../../../formations";
import type { OverlayPath, PathColor, PzPlay, PzSlot, StageSpec } from "../../store/types";

export type XY = [number, number];
export type BallWay = "pase" | "conduccion";
/** One step of a play, by slot (the prototype's rsteps item). `c['m'+k]`: the control point of slot k's run. */
export interface PjStep {
  title: string;
  note: string;
  p: XY[];
  r: XY[];
  b: XY | null;
  dur: number;
  c: Record<string, XY>;
  bk: BallWay | null;
  /** «Paso clave» (marked by hand; none marked = the step with most movement). */
  key?: boolean;
  /** What is drawn inside the step (the app's strokes, ≤ 8). */
  d?: Stroke[];
}
/** A play as the place reads it: its slot steps, who plays each slot's track (the app's player id key), its rivals. */
export interface PjPlay {
  id: string;
  name: string;
  kind: PlayKind;
  own: boolean;
  /** A season play this board uses (seasonPlays/{id}): edits change it on every board. */
  season?: { id: string; scope: "mine" | "team"; ownerUid: string; ownerNick: string };
  /** The app's play (the board's own; for a team play, the library's built for this seven). */
  play: Play;
  /** Slot k → the player id whose track it runs (null: an empty slot, or one of the seven not in the play). */
  ids: (string | null)[];
  rivalIds: string[];
  steps: PjStep[];
  taker?: { role: RoleKey; slot: number };
}

export const L = PIZARRA_LIMITS;
export const MAX_OWN = L.plays;
export const MAX_STEPS = L.framesMax;
export const MIN_STEPS = L.framesMin;
export const MAX_RIV = L.rivals;
export const KIND_T: Record<PlayKind, string> = { corner: "Córner", falta: "Falta", banda: "Banda", salida: "Salida", propia: "Tuya" };
export const TYPES: [string, string][] = [
  ["todas", "Todas"],
  ["corner", "Córner"],
  ["falta", "Falta"],
  ["banda", "Banda"],
  ["salida", "Salida"],
  ["otras", "Otras"],
];
export const RATES: [number, string][] = [
  [0.5, "0,5×"],
  [1, "1×"],
  [2, "2×"],
];
export const TAKER_K: Partial<Record<RoleKey, "corners" | "freekicks" | "penalties">> = { cornersId: "corners", freekicksId: "freekicks", penaltiesId: "penalties" };
export const TAKER_T: Record<"corners" | "freekicks" | "penalties", string> = { corners: "córners", freekicks: "faltas", penalties: "penaltis" };

export const r1 = (v: number) => Math.round(v * 10) / 10;
export const clamp = (v: number, a: number, b: number) => Math.max(a, Math.min(b, v));
/** Distance on the 2:3 pitch (y counts 1.5×, as the prototype). */
export const dist = (a: XY | null | undefined, b: XY | null | undefined) => (a && b ? Math.hypot(a[0] - b[0], (a[1] - b[1]) * 1.5) : 0);
export const norm = (s: string) =>
  String(s || "")
    .toLowerCase()
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "");
/** «2,3 s». */
export const secs = (v: number) => String(r1(v)).replace(".", ",") + " s";
/** «0:09». */
export const clock = (v: number) => {
  const s = Math.max(0, Math.round(v));
  return Math.floor(s / 60) + ":" + String(s % 60).padStart(2, "0");
};
const xy = (p: BoardPoint): XY => [p.x, p.y];
const pt = (q: XY): BoardPoint => ({ x: r1(clamp(q[0], 0, 100)), y: r1(clamp(q[1], 0, 100)) });
/** A step's default length (the app stores none: the prototype's 2,3 s, the last one 2,6 s). */
export const stepDur = (i: number, n: number) => (i === n - 1 ? 2.6 : 2.3);

// ── the team's plays, cast onto the seven ─────────────────────────────────────────────────────────────────
const PERM6: number[][] = (() => {
  const out: number[][] = [];
  const go = (pre: number[], rest: number[]) => {
    if (!rest.length) out.push(pre);
    rest.forEach((v, k) => go([...pre, v], [...rest.slice(0, k), ...rest.slice(k + 1)]));
  };
  go([], [0, 1, 2, 3, 4, 5]);
  return out;
})();
/** Role (part) → slot: the keeper keeps goal, the rest by the least travel from the play's start; the galón holder
 *  takes the dead ball (his slot swaps into the taker's part). */
export function castOf(base: XY[], slots: PzSlot[], taker?: { slot: number } | null, takerPid?: string | null): number[] {
  if (slots.length !== 7) return [0, 1, 2, 3, 4, 5, 6];
  let gk = slots.findIndex((s) => s.code === "POR");
  if (gk < 0) gk = 0;
  const free = [0, 1, 2, 3, 4, 5, 6].filter((i) => i !== gk);
  let best = PERM6[0];
  let bv = Infinity;
  for (const pm of PERM6) {
    let v = 0;
    for (let r = 1; r < 7 && v < bv; r++) {
      const s = slots[free[pm[r - 1]]];
      const q = base[r];
      v += (s.x - q[0]) ** 2 + (s.y - q[1]) ** 2 * 0.6;
    }
    if (v < bv) {
      bv = v;
      best = pm;
    }
  }
  const cast = [gk, ...best.map((k) => free[k])];
  if (taker && takerPid) {
    const j = slots.findIndex((s) => s.playerId === takerPid);
    const r = cast.indexOf(j);
    const t = taker.slot;
    if (j >= 0 && j !== gk && r >= 0 && r !== t) {
      const x = cast[t];
      cast[t] = j;
      cast[r] = x;
    }
  }
  return cast;
}

/** The app's library, built for this seven (slot order; empty slots included as unnamed shirts). */
export function teamPlays(slots: PzSlot[], takerOf: (role: RoleKey) => string | null): PjPlay[] {
  return PLAY_LIBRARY.map((lib) => {
    const cast = castOf(lib.steps[0].p as XY[], slots, lib.taker ?? null, lib.taker ? takerOf(lib.taker.role) : null);
    const n = lib.steps.length;
    const steps: PjStep[] = lib.steps.map((st, i) => {
      const p: XY[] = Array.from({ length: 7 }, () => [50, 50] as XY);
      st.p.forEach((q, role) => {
        p[cast[role] ?? role] = [q[0], q[1]];
      });
      return { title: st.title, note: st.note, p, r: st.r.map((q) => [q[0], q[1]] as XY), b: [st.b[0], st.b[1]], dur: stepDur(i, n), c: {}, bk: null };
    });
    const ids = slots.map((s) => s.playerId);
    const rivalIds = lib.steps[0].r.map((_, j) => `r${j + 1}`);
    const pj: PjPlay = { id: lib.id, name: lib.name, kind: lib.kind, own: false, play: { id: lib.id, name: lib.name, kind: lib.kind, frames: [] }, ids, rivalIds, steps, ...(lib.taker ? { taker: lib.taker } : {}) };
    pj.play = fromSteps(pj, steps);
    return pj;
  });
}

// ── the board's own plays (the app's Play, keyed by player id) ────────────────────────────────────────────
/** Each id's spot in every frame: carried forward when a frame leaves it out, back-filled from its first one. */
function tracks(frames: PlayFrame[], at: (f: PlayFrame) => Record<string, BoardPoint>): Map<string, XY[]> {
  const order: string[] = [];
  for (const f of frames) for (const id of Object.keys(at(f))) if (!order.includes(id)) order.push(id);
  const out = new Map<string, XY[]>();
  for (const id of order) {
    let last: XY | null = null;
    const pts = frames.map((f) => {
      const p = at(f)[id];
      if (p) last = xy(p);
      return last;
    });
    const first = pts.find((q): q is XY => q !== null) ?? [50, 50];
    out.set(id, pts.map((q) => q ?? first));
  }
  return out;
}

/** The board's own play read by slot (the seven as it stands plays it). */
export function ownPlay(play: Play, slots: PzSlot[]): PjPlay {
  const frames = play.frames;
  const T = tracks(frames, (f) => f.players);
  const R = tracks(frames, (f) => Object.fromEntries(f.rivals.map((r) => [r.id, { x: r.x, y: r.y }])));
  const ids: (string | null)[] = slots.map((s) => (s.playerId && T.has(s.playerId) ? s.playerId : null));
  // those of the play who left the seven run in the free slots (nearest start first)
  const left = [...T.keys()].filter((id) => !ids.includes(id));
  const freeSlots = slots.map((_, k) => k).filter((k) => !ids[k]);
  const pairs: { id: string; k: number; d: number }[] = [];
  left.forEach((id) => freeSlots.forEach((k) => pairs.push({ id, k, d: dist(T.get(id)![0], [slots[k].x, slots[k].y]) })));
  pairs.sort((a, b) => a.d - b.d);
  const usedId = new Set<string>();
  pairs.forEach(({ id, k }) => {
    if (ids[k] || usedId.has(id) || slots[k].code === "POR") return;
    ids[k] = id;
    usedId.add(id);
  });
  const rivalIds = [...R.keys()];
  const n = frames.length;
  const steps: PjStep[] = frames.map((f, i) => {
    const p: XY[] = slots.map((s, k) => {
      const id = ids[k];
      return id ? T.get(id)![i] : [s.x, s.y];
    });
    const c: Record<string, XY> = {};
    Object.entries(f.curves ?? {}).forEach(([id, q]) => {
      const k = ids.indexOf(id);
      if (k >= 0) c["m" + k] = xy(q);
    });
    const prev = i > 0 ? frames[i - 1] : null;
    const bk: BallWay | null = prev && prev.arrows.some((a) => a.kind === "conduccion") ? "conduccion" : prev && prev.arrows.some((a) => a.kind === "pase") ? "pase" : null;
    return { title: f.title || "Paso " + (i + 1), note: f.note || "", p, r: rivalIds.map((id) => R.get(id)![i]), b: xy(f.ball), dur: f.dur ? f.dur / 1000 : stepDur(i, n), c, bk, ...(f.key ? { key: true } : {}), ...(f.d?.length ? { d: f.d.map((x) => structuredClone(x)) } : {}) };
  });
  return { id: play.id, name: play.name, kind: play.kind, own: true, play, ids, rivalIds, steps };
}

/** The slot steps written back as the app's Play: ours by their id key, the rivals, the ball, curves, texts and the
 *  arrows of each move derived again (the ball's way, pase or conducción, kept as chosen). */
export function fromSteps(pj: PjPlay, steps: PjStep[], o: { ids?: (string | null)[]; rivalIds?: string[]; name?: string } = {}): Play {
  const ids = o.ids ?? pj.ids;
  const rivalIds = o.rivalIds ?? pj.rivalIds;
  const frames: PlayFrame[] = steps.map((st) => {
    const players: Record<string, BoardPoint> = {};
    st.p.forEach((q, k) => {
      const id = ids[k];
      if (id && Object.keys(players).length < L.framePlayers) players[id] = pt(q);
    });
    const curves: Record<string, BoardPoint> = {};
    Object.entries(st.c).forEach(([key, q]) => {
      const id = ids[Number(key.slice(1))];
      if (key[0] === "m" && id && id in players) curves[id] = pt(q);
    });
    const f: PlayFrame = { players, ball: pt(st.b ?? [50, 50]), rivals: st.r.slice(0, L.rivals).map((q, j) => ({ id: rivalIds[j] ?? `r${j + 1}`, ...pt(q) })), arrows: [] };
    const t = st.title.trim().slice(0, L.frameTitle);
    if (t) f.title = t;
    const nt = st.note.trim().slice(0, L.frameNote);
    if (nt) f.note = nt;
    if (Object.keys(curves).length) f.curves = curves;
    f.dur = Math.round(clamp(st.dur, L.frameDurMin / 1000, L.frameDurMax / 1000) * 1000);
    if (st.key) f.key = true;
    if (st.d?.length) f.d = st.d.slice(0, L.frameStrokes).map((x) => structuredClone(x));
    return f;
  });
  frames.forEach((f, i) => {
    const nx = frames[i + 1];
    if (!nx) return;
    const way = steps[i + 1].bk;
    f.arrows = deriveArrows(f, nx).map((a) => (way && (a.kind === "pase" || a.kind === "conduccion") && a.from.x === f.ball.x && a.from.y === f.ball.y ? { ...a, kind: way } : a));
  });
  const out: Play = { id: pj.play.id || pj.id, name: (o.name ?? pj.name).trim().slice(0, L.playName) || pj.name, kind: pj.kind, frames };
  if (pj.play.video) out.video = pj.play.video;
  if (pj.play.moment) out.moment = pj.play.moment;
  return out;
}

// ── reading a play ───────────────────────────────────────────────────────────────────────────────────────
/** The key step: none is stored, so the step with the most movement (the ball counts double). */
export function keyStep(steps: PjStep[]): number {
  const marked = steps.findIndex((s) => s.key);
  if (marked >= 0) return marked;
  if (steps.length < 2) return 0;
  let best = 1;
  let bv = -1;
  for (let i = 1; i < steps.length; i++) {
    let v = 0;
    steps[i].p.forEach((q, j) => {
      v += dist(steps[i - 1].p[j], q);
    });
    v += dist(steps[i - 1].b, steps[i].b) * 2;
    if (v > bv) {
      bv = v;
      best = i;
    }
  }
  return best;
}
export const totalDur = (steps: PjStep[]) => steps.reduce((s, x) => s + x.dur, 0);
/** How the ball reaches step i: as chosen, else a conducción when one of ours carries it, else a pase. */
export function ballKind(prev: PjStep, st: PjStep): BallWay {
  if (st.bk) return st.bk;
  if (!prev.b || !st.b) return "pase";
  for (let k = 0; k < 7; k++) if (dist(prev.p[k], prev.b) < 7 && dist(st.p[k], st.b) < 7) return "conduccion";
  return "pase";
}
export function bez(a: XY, c: XY, b: XY, t: number): XY {
  const u = 1 - t;
  return [u * u * a[0] + 2 * u * t * c[0] + t * t * b[0], u * u * a[1] + 2 * u * t * c[1] + t * t * b[1]];
}
export function curvePts(a: XY, c: XY | undefined, b: XY): XY[] {
  if (!c) return [a, [(a[0] + b[0]) / 2, (a[1] + b[1]) / 2], b];
  const out: XY[] = [];
  for (let j = 0; j <= 12; j++) out.push(bez(a, c, b, j / 12));
  return out;
}
function ring(c: XY, rx: number): XY[] {
  const pts: XY[] = [];
  for (let j = 0; j < 12; j++) {
    const t = (j / 12) * Math.PI * 2;
    pts.push([c[0] + Math.cos(t) * rx, c[1] + (Math.sin(t) * rx) / 1.5]);
  }
  return pts;
}
export interface PathOpts {
  ghost: boolean;
  trails: boolean;
  ball: boolean;
}
/** What the pitch draws for step i: where each one was (a chalk ring), the runs (curved when bent), the ball's way. */
export function stepPaths(steps: PjStep[], i: number, o: PathOpts, draw?: (s: Stroke) => OverlayPath | null): OverlayPath[] {
  const st = steps[i];
  const prev = i > 0 ? steps[i - 1] : null;
  const out: OverlayPath[] = [];
  if (prev && o.ghost)
    st.p.forEach((q, k) => {
      const a = prev.p[k];
      if (dist(a, q) > 4) out.push({ kind: "zona", color: "blanco", pts: ring(a, 2.6) });
    });
  if (prev && o.trails) {
    st.p.forEach((q, k) => {
      const a = prev.p[k];
      if (dist(a, q) > 4) out.push({ kind: "carrera", pts: curvePts(a, st.c["m" + k], q) });
    });
    if (o.ball && prev.b && st.b && dist(prev.b, st.b) > 3) out.push({ kind: ballKind(prev, st), pts: [prev.b, st.b] });
  }
  if (draw) (st.d ?? []).forEach((s) => {
    const p = draw(s);
    if (p) out.push(p);
  });
  return out;
}
/** The y the window of a cropped mini shows (where the action of step i is). */
export function actionY(steps: PjStep[], i: number): number {
  const st = steps[i];
  const ys = st.p.map((q) => q[1]).concat(st.b ? [st.b[1]] : []);
  const mv = st.p.filter((q, k) => i > 0 && dist(steps[i - 1].p[k], q) > 4).map((q) => q[1]);
  const Ls = mv.length ? mv.concat(st.b ? [st.b[1]] : []) : ys;
  return Math.round(Ls.reduce((s, v) => s + v, 0) / Ls.length);
}
/** Where Foco looks on step i (the movers and the ball; a little lower so the far goal stays on screen). */
export function focusOf(steps: PjStep[], i: number): { x: number; y: number } {
  const st = steps[i];
  const mv = st.p.filter((q, k) => i > 0 && dist(steps[i - 1].p[k], q) > 4);
  const pts = (mv.length ? mv : st.p).concat(st.b ? [st.b] : []);
  const fx = pts.reduce((s, q) => s + q[0], 0) / pts.length;
  const fy = pts.reduce((s, q) => s + q[1], 0) / pts.length;
  return { x: r1(clamp(fx, 28, 72)), y: r1(clamp(fy - 6, 2, 88)) };
}
/** A flat zoom on where the whole play happens (set pieces), or null (the whole pitch). */
export function zoomOf(steps: PjStep[], o: { phone: boolean; editing: boolean }): { x: number; y: number; s: number } | null {
  const core: XY[] = [];
  steps.forEach((st) => (st.r || []).concat(st.b ? [st.b] : []).forEach((q) => core.push(q)));
  if (!core.length) return null;
  const cy0 = Math.min(...core.map((q) => q[1])) - 14;
  const cy1 = Math.max(...core.map((q) => q[1])) + 14;
  const xs: number[] = [];
  const ys: number[] = [];
  steps.forEach((st) =>
    core.concat(st.p.filter((q) => q[1] >= cy0 && q[1] <= cy1)).forEach((q) => {
      xs.push(q[0]);
      ys.push(q[1]);
    }),
  );
  if (!ys.length) return null;
  const y0 = Math.min(...ys);
  const y1 = Math.max(...ys);
  const x0 = Math.min(...xs);
  const x1 = Math.max(...xs);
  const hr = y1 - y0 + 16;
  if (hr > 62) return null;
  const xr = x1 - x0;
  const docks = !o.phone && o.editing;
  const s = r1(Math.min(1.8, 100 / hr, (o.phone ? 104 : docks ? 106 : 150) / (xr + 8)));
  if (s < 1.15) return null;
  const half = 50 / s;
  return { x: r1(clamp((x0 + x1) / 2, half, 100 - half)), y: r1(clamp((y0 + y1) / 2, half - 4, 100 - half + 4)), s };
}
/** The positions of a step at t of the move into it (the runs follow their curves; the rest glide straight). */
export function poseAt(a: PjStep, b: PjStep, t: number): { p: XY[]; r: XY[]; b: XY | null } {
  return {
    p: b.p.map((q, k) => {
      const c = b.c["m" + k];
      const s = a.p[k];
      return c ? bez(s, c, q, t) : [s[0] + (q[0] - s[0]) * t, s[1] + (q[1] - s[1]) * t];
    }),
    r: b.r.map((q, k) => {
      const s = a.r[k] ?? q;
      return [s[0] + (q[0] - s[0]) * t, s[1] + (q[1] - s[1]) * t];
    }),
    b: b.b ? (a.b ? [a.b[0] + (b.b[0] - a.b[0]) * t, a.b[1] + (b.b[1] - a.b[1]) * t] : b.b) : null,
  };
}
export interface FrameArgs {
  pos?: { p: XY[]; r: XY[]; b: XY | null };
  /** The glide (s) of this frame. */
  dur?: number;
  o: PathOpts;
  rivals: boolean;
  ball: boolean;
  short?: boolean;
  /** How a step's own strokes are drawn (Dibujar's renderer). */
  draw?: (s: Stroke) => OverlayPath | null;
  rivalName: string;
  rivalCode: string;
}
/** A step as the pitch's `jugada` source draws it: a one-step play (positions glide linearly from the last frame),
 *  the step's lines as the overlay, no caption (the step lives in the lead / the peek). */
export function frameSpec(steps: PjStep[], i: number, x: FrameArgs): StageSpec {
  const st = steps[i];
  const pos = x.pos ?? st;
  const play: PzPlay = {
    id: "f",
    name: "",
    steps: [
      {
        title: st.title,
        p: pos.p.map((q) => [r1(q[0]), r1(q[1])] as XY),
        r: x.rivals ? pos.r.map((q) => [r1(q[0]), r1(q[1])] as XY) : [],
        ...(x.ball && pos.b ? { b: [r1(pos.b[0]), r1(pos.b[1])] as XY } : {}),
        dur: x.dur != null ? x.dur : 0.6,
      },
    ],
  };
  return { source: "jugada", plates: x.short ? "short" : "", play, step: 0, rate: 1, ghost: false, overlay: { paths: stepPaths(steps, i, x.o, x.draw) }, rivalCode: x.rivalCode, caption: "", editable: false, rivalName: x.rivalName };
}
/** The whole play as the `jugada` source reads it (PLAN and CHARLA replay with it): slot order, one step per paso. */
export function toPzPlay(pj: PjPlay): PzPlay {
  return { id: pj.id, name: pj.name, steps: pj.steps.map((s) => ({ title: s.title, note: s.note, p: s.p.map((q) => [q[0], q[1]] as XY), r: s.r.map((q) => [q[0], q[1]] as XY), ...(s.b ? { b: [s.b[0], s.b[1]] as XY } : {}), dur: s.dur })) };
}
/** A recorded video's check: changes when anything it shows changes (B-PZ-10: a stale video says «caducado»). */
export function playSig(pj: PjPlay | null, rate: number): string {
  if (!pj) return "";
  const s = JSON.stringify([pj.name, pj.steps.map((x) => [x.p, x.r, x.b, x.dur, x.c, x.bk, x.title, !!x.key, x.d ?? []]), rate]);
  let h = 0;
  for (let k = 0; k < s.length; k++) h = (h * 31 + s.charCodeAt(k)) | 0;
  return String(h >>> 0);
}

// ── editing (slot steps; B-PZ-08 / B-PZ-16 in the step ops) ──────────────────────────────────────────────
const cloneStep = (s: PjStep): PjStep => ({ ...s, p: s.p.map((q) => [q[0], q[1]] as XY), r: s.r.map((q) => [q[0], q[1]] as XY), b: s.b ? [s.b[0], s.b[1]] : null, c: Object.fromEntries(Object.entries(s.c).map(([k, q]) => [k, [q[0], q[1]] as XY])), ...(s.d ? { d: s.d.map((x) => structuredClone(x)) } : {}) });
export const cloneSteps = (steps: PjStep[]) => steps.map(cloneStep);
/** A blank copy of a step: positions only — never its curves (B-PZ-08). */
const blankFrom = (s: PjStep, title: string): PjStep => {
  const c: PjStep = { ...cloneStep(s), title, note: "", c: {}, bk: null };
  delete c.key;
  delete c.d;
  return c;
};
/** «Paso al final»: a copy of the LAST step (B-PZ-16). */
export function addStepEnd(steps: PjStep[]): PjStep[] | null {
  if (steps.length >= MAX_STEPS) return null;
  return [...cloneSteps(steps), blankFrom(steps[steps.length - 1], "Paso nuevo")];
}
/** «Duplicar este»: a copy of step i right behind it (its note kept, no curves). */
export function dupStepAt(steps: PjStep[], i: number): PjStep[] | null {
  if (steps.length >= MAX_STEPS || !steps[i]) return null;
  const out = cloneSteps(steps);
  const c = blankFrom(steps[i], ((steps[i].title || "Paso") + " (otra vez)").slice(0, L.frameTitle));
  c.note = steps[i].note;
  out.splice(i + 1, 0, c);
  return out;
}
/** Quita el paso i (2 at least); the next one's runs straighten (they started somewhere else). */
export function delStepAt(steps: PjStep[], i: number): PjStep[] | null {
  if (steps.length <= MIN_STEPS || !steps[i]) return null;
  const out = cloneSteps(steps);
  out.splice(i, 1);
  if (out[i]) out[i] = { ...out[i], c: {}, bk: null };
  return out;
}
/** Moves step i to j; every step whose previous step changed loses its curves. */
export function moveStepTo(steps: PjStep[], i: number, j: number): PjStep[] | null {
  if (i === j || j < 0 || j >= steps.length || !steps[i]) return null;
  const tagged = steps.map((s, k) => ({ s: cloneStep(s), prev: k > 0 ? k - 1 : -1, k }));
  const [m] = tagged.splice(i, 1);
  tagged.splice(j, 0, m);
  return tagged.map((t, k) => {
    const prevNow = k > 0 ? tagged[k - 1].k : -1;
    return prevNow !== t.prev ? { ...t.s, c: {}, bk: null } : t.s;
  });
}
/** Moves pieces of step i ('m3', 'r1', 'b') by dx, dy (pitch %), kept inside the lines. */
export function nudgeIn(steps: PjStep[], i: number, ids: string[], dx: number, dy: number, from?: Record<string, XY>): PjStep[] {
  const out = cloneSteps(steps);
  const st = out[i];
  ids.forEach((id) => {
    const s0 = from?.[id] ?? pieceAt(steps[i], id);
    if (!s0) return;
    const q: XY = [clamp(r1(s0[0] + dx), 1, 99), clamp(r1(s0[1] + dy), 1, 99)];
    if (id === "b") st.b = q;
    else if (id[0] === "r") st.r[Number(id.slice(1))] = q;
    else st.p[Number(id.slice(1))] = q;
  });
  return out;
}
export function pieceAt(st: PjStep, id: string): XY | null {
  if (id === "b") return st.b;
  if (id[0] === "r") return st.r[Number(id.slice(1))] ?? null;
  return st.p[Number(id.slice(1))] ?? null;
}
/** The curve of slot k's run into step i, set so its middle passes through `mid` (straight when near the line). */
export function bendTo(steps: PjStep[], i: number, k: number, mid: XY): PjStep[] {
  const out = cloneSteps(steps);
  const a = steps[i - 1]?.p[k];
  const b = steps[i]?.p[k];
  if (!a || !b) return out;
  const c = out[i].c;
  if (dist(mid, [(a[0] + b[0]) / 2, (a[1] + b[1]) / 2]) < 1.6) delete c["m" + k];
  else c["m" + k] = [r1(clamp(2 * mid[0] - (a[0] + b[0]) / 2, 0, 100)), r1(clamp(2 * mid[1] - (a[1] + b[1]) / 2, 0, 100))];
  return out;
}
export function straighten(steps: PjStep[], i: number, k: number): PjStep[] {
  const out = cloneSteps(steps);
  delete out[i].c["m" + k];
  return out;
}
/** A rival added to every step on a free spot (≤ 7). */
export function addRivalAll(steps: PjStep[]): PjStep[] | null {
  if ((steps[0]?.r.length ?? 0) >= MAX_RIV) return null;
  const spots: XY[] = [
    [50, 20],
    [30, 30],
    [70, 30],
    [50, 36],
    [20, 40],
    [80, 40],
    [50, 12],
  ];
  const used = steps[0]?.r ?? [];
  const sp = spots.find((s) => !used.some((u) => dist(u, s) < 6)) ?? [50, 30];
  return cloneSteps(steps).map((s) => ({ ...s, r: [...s.r, [sp[0], sp[1]] as XY] }));
}
export function removeRivalAll(steps: PjStep[], k: number): PjStep[] {
  return cloneSteps(steps).map((s) => ({ ...s, r: s.r.filter((_, j) => j !== k) }));
}
/** A new rival id for the app's play (r1, r2… not used yet). */
export function nextRivalId(ids: string[]): string {
  let n = 1;
  while (ids.includes(`r${n}`)) n++;
  return `r${n}`;
}

// ── the video link (JUG-49): «12:34» ↔ seconds ───────────────────────────────────────────────────────────
export function parseAt(s: string): number | null {
  const t = s.trim();
  if (!t) return 0;
  if (/^\d+$/.test(t)) return Number(t);
  const m = /^(?:(\d{1,2}):)?(\d{1,2}):(\d{2})$/.exec(t);
  if (!m) return null;
  return Number(m[1] ?? 0) * 3600 + Number(m[2]) * 60 + Number(m[3]);
}
export function atText(sec: number): string {
  if (!sec) return "";
  const h = Math.floor(sec / 3600);
  const m = Math.floor((sec % 3600) / 60);
  const s = sec % 60;
  return (h ? h + ":" + String(m).padStart(2, "0") : String(m)) + ":" + String(s).padStart(2, "0");
}
/** What is wrong with a video link (Spanish), or "". */
export function videoError(url: string, at: string): string {
  const u = url.trim();
  if (!u) return "Pega el enlace del vídeo.";
  if (!u.startsWith("https://")) return "Solo enlaces seguros: tiene que empezar por https://";
  if (u.length > 300) return "El enlace es demasiado largo (300 caracteres como mucho).";
  try {
    const x = new URL(u);
    if (!x.hostname || x.username || x.password) return "Ese enlace no es válido.";
  } catch {
    return "Ese enlace no es válido.";
  }
  if (u.length < 12) return "Ese enlace no es válido.";
  if (parseAt(at) == null) return "El minuto va como 12:34 (minutos y segundos).";
  return "";
}

// ── the library's filters ────────────────────────────────────────────────────────────────────────────────
export const typeOf = (pj: PjPlay): string => (pj.own ? (pj.kind !== "propia" ? pj.kind : "otras") : pj.kind);
export function matches(pj: PjPlay, q: string, type: string): boolean {
  if (type !== "todas" && typeOf(pj) !== type) return false;
  const nq = norm(q).trim();
  if (!nq) return true;
  return norm(pj.name + " " + KIND_T[pj.kind] + " " + pj.steps.map((s) => s.title + " " + s.note).join(" ")).includes(nq);
}
/** «Del dibujo»-like names not used yet: «base», «base 2»… */
export function freeName(base: string, taken: string[]): string {
  const used = new Set(taken.map((t) => t.trim().toLowerCase()));
  const b = base.trim().slice(0, L.playName);
  if (!used.has(b.toLowerCase())) return b;
  for (let n = 2; ; n++) {
    const tail = " " + n;
    const c = b.slice(0, L.playName - tail.length) + tail;
    if (!used.has(c.toLowerCase())) return c;
  }
}
export const COLOR_OF: Record<string, PathColor> = { white: "blanco", sky: "celeste", gold: "amarillo" };

// ── the step's length, «Paso clave», its strokes ──────────────────────────────────────────────────────────
export const DUR_MIN = 0.5;
export const DUR_MAX = 5;
export const MAX_STEP_STROKES = L.frameStrokes;
/** Step i lasts d seconds (0,5–5 in half seconds; the server keeps 0,3–10). */
export function setDurAt(steps: PjStep[], i: number, d: number): PjStep[] {
  const out = cloneSteps(steps);
  if (out[i]) out[i].dur = r1(clamp(d, DUR_MIN, DUR_MAX));
  return out;
}
/** Marks step i as the key one (only one), or unmarks it (the most-movement step is the key again). */
export function setKeyAt(steps: PjStep[], i: number, on: boolean): PjStep[] {
  return cloneSteps(steps).map((s, k) => {
    const c = { ...s };
    delete c.key;
    if (on && k === i) c.key = true;
    return c;
  });
}
/** Step i's own strokes (≤ 8). */
export function setStrokesAt(steps: PjStep[], i: number, d: Stroke[]): PjStep[] {
  const out = cloneSteps(steps);
  if (!out[i]) return out;
  if (d.length) out[i].d = d.slice(0, MAX_STEP_STROKES);
  else delete out[i].d;
  return out;
}

// ── the board's size (Firestore keeps ≤ 1 MiB per document: plays × steps × strokes can get close) ───────────
/** Bytes the board takes, roughly (its JSON: field names and UTF-8 text, as Firestore counts them). */
export function boardBytes(data: unknown): number {
  try {
    const s = JSON.stringify(data) ?? "";
    let n = 0;
    for (let k = 0; k < s.length; k++) {
      const c = s.charCodeAt(k);
      n += c < 0x80 ? 1 : c < 0x800 ? 2 : 3;
    }
    return n;
  } catch {
    return 0;
  }
}
/** A calm warning from 700 KB; from 900 KB nothing grows (new plays, steps, strokes). */
export const SIZE_WARN = 700_000;
export const SIZE_FULL = 900_000;
export type SizeState = "ok" | "warn" | "full";
export const sizeState = (bytes: number): SizeState => (bytes >= SIZE_FULL ? "full" : bytes >= SIZE_WARN ? "warn" : "ok");
