// Pure ops for the jugadas of a board: steps (pasos) with our seven, the ball, the rivals and the
// arrows; the replay pose at any point of the timeline; limits; (de)serialization; and the
// conversion to the 3D engine. No React. Board frame: x 0→100 left→right, y 0 = rival goal line →
// 100 = ours (the engine counts y from our goal line). Unit-tested in plays.test.ts.
import type { ArrowSpec, PlayFrame as EngineFrame, RivalSpec } from "../../components/pitch3d/types";
import { reportDroppedDoc } from "../../lib/docTelemetry";
import {
  PIZARRA_LIMITS,
  playSchema,
  type BoardPoint,
  type Play,
  type PlayArrow,
  type PlayFrame,
  type PlayKind,
  type PlayRival,
} from "../../lib/schemas";
import { clampPoint, newId } from "./drawings";

export type { Play, PlayArrow, PlayFrame, PlayKind, PlayRival };

const L = PIZARRA_LIMITS;
const clamp = (v: number, a: number, b: number) => (v < a ? a : v > b ? b : v);
const dist = (a: BoardPoint, b: BoardPoint) => Math.hypot(a.x - b.x, a.y - b.y);
export const easeInOutCubic = (p: number) => (p < 0.5 ? 4 * p * p * p : 1 - Math.pow(-2 * p + 2, 3) / 2);

/** The five rivals a new jugada starts with (a keeper and two lines), as in the design. */
export const DEFAULT_RIVALS: PlayRival[] = [
  [50, 5],
  [36, 40],
  [64, 40],
  [26, 27],
  [74, 27],
].map(([x, y], i) => ({ id: `r${i + 1}`, x, y }));

const cloneFrame = (f: PlayFrame): PlayFrame => {
  const out: PlayFrame = {
    players: Object.fromEntries(Object.entries(f.players).map(([id, p]) => [id, { x: p.x, y: p.y }])),
    ball: { ...f.ball },
    rivals: f.rivals.map((r) => ({ ...r })),
    arrows: f.arrows.map((a) => ({ from: { ...a.from }, to: { ...a.to }, kind: a.kind })),
  };
  if (f.title !== undefined) out.title = f.title;
  if (f.note !== undefined) out.note = f.note;
  return out;
};
const withFrames = (play: Play, frames: PlayFrame[]): Play => ({ ...play, frames });
const validIndex = (play: Play, i: number) => Number.isInteger(i) && i >= 0 && i < play.frames.length;
/** Applies `fn` to a copy of frame `i` (the same play back if `i` is out of range). */
function editFrame(play: Play, i: number, fn: (f: PlayFrame) => void): Play {
  if (!validIndex(play, i)) return play;
  const frames = play.frames.slice();
  const f = cloneFrame(frames[i]);
  fn(f);
  frames[i] = f;
  return withFrames(play, frames);
}
const cleanName = (name: string, fallback: string) => name.trim().slice(0, L.playName) || fallback;

// ───────────────────────────── jugadas ─────────────────────────────

/**
 * A new jugada from where the seven stand now: two pasos (the start and a copy to move), the ball
 * at our keeper's feet unless given, and the default rivals.
 */
export function newPlay(
  name: string,
  players: Record<string, BoardPoint>,
  opts: { kind?: PlayKind; ball?: BoardPoint; rivals?: PlayRival[] } = {},
): Play {
  const start: PlayFrame = {
    players: Object.fromEntries(Object.entries(players).slice(0, L.framePlayers).map(([id, p]) => [id, clampPoint(p)])),
    ball: clampPoint(opts.ball ?? { x: 50, y: 88 }),
    rivals: (opts.rivals ?? DEFAULT_RIVALS).slice(0, L.rivals).map((r) => ({ id: r.id, ...clampPoint(r) })),
    arrows: [],
  };
  return { id: newId("j"), name: cleanName(name, "Jugada"), kind: opts.kind ?? "propia", frames: [start, { ...cloneFrame(start), arrows: [] }] };
}

export const renamePlay = (play: Play, name: string): Play => ({ ...play, name: cleanName(name, play.name) });

/** Appends a paso that starts where the last one ends (its arrows are for the new move). */
export function addFrame(play: Play): Play {
  if (play.frames.length >= L.framesMax) return play;
  const last = cloneFrame(play.frames[play.frames.length - 1]);
  return withFrames(play, [...play.frames, { players: last.players, ball: last.ball, rivals: last.rivals, arrows: [] }]);
}
/** Inserts a copy of paso `i` right after it. */
export function duplicateFrame(play: Play, i: number): Play {
  if (play.frames.length >= L.framesMax || !validIndex(play, i)) return play;
  const frames = play.frames.slice();
  frames.splice(i + 1, 0, cloneFrame(frames[i]));
  return withFrames(play, frames);
}
/** Removes paso `i` (a jugada keeps at least two). */
export function removeFrame(play: Play, i: number): Play {
  if (play.frames.length <= L.framesMin || !validIndex(play, i)) return play;
  return withFrames(play, play.frames.filter((_, k) => k !== i));
}
/** Reorders: paso `from` goes to position `to`. */
export function moveFrame(play: Play, from: number, to: number): Play {
  if (!validIndex(play, from) || !validIndex(play, to) || from === to) return play;
  const frames = play.frames.slice();
  const [f] = frames.splice(from, 1);
  frames.splice(to, 0, f);
  return withFrames(play, frames);
}
export function setFrameText(play: Play, i: number, text: { title?: string; note?: string }): Play {
  return editFrame(play, i, (f) => {
    if (text.title !== undefined) {
      const t = text.title.trim().slice(0, L.frameTitle);
      if (t) f.title = t;
      else delete f.title;
    }
    if (text.note !== undefined) {
      const n = text.note.trim().slice(0, L.frameNote);
      if (n) f.note = n;
      else delete f.note;
    }
  });
}

/** Moves one of ours in paso `i` (added to the paso if absent, while there is room for seven). */
export function movePlayer(play: Play, i: number, playerId: string, to: BoardPoint): Play {
  if (!validIndex(play, i)) return play;
  const f = play.frames[i];
  if (!(playerId in f.players) && Object.keys(f.players).length >= L.framePlayers) return play;
  return editFrame(play, i, (g) => {
    g.players[playerId] = clampPoint(to);
  });
}
export const moveBall = (play: Play, i: number, to: BoardPoint): Play =>
  editFrame(play, i, (f) => {
    f.ball = clampPoint(to);
  });
export const moveRival = (play: Play, i: number, rivalId: string, to: BoardPoint): Play =>
  validIndex(play, i) && play.frames[i].rivals.some((r) => r.id === rivalId)
    ? editFrame(play, i, (f) => {
        f.rivals = f.rivals.map((r) => (r.id === rivalId ? { id: r.id, ...clampPoint(to) } : r));
      })
    : play;
/** Adds a rival to every paso at the same spot (≤ 7). */
export function addRival(play: Play, at: BoardPoint): Play {
  if (play.frames.some((f) => f.rivals.length >= L.rivals)) return play;
  const used = new Set(play.frames.flatMap((f) => f.rivals.map((r) => r.id)));
  let n = 1;
  while (used.has(`r${n}`)) n++;
  const rival = { id: `r${n}`, ...clampPoint(at) };
  return withFrames(play, play.frames.map((f) => ({ ...cloneFrame(f), rivals: [...f.rivals.map((r) => ({ ...r })), { ...rival }] })));
}
export const removeRival = (play: Play, rivalId: string): Play =>
  withFrames(play, play.frames.map((f) => ({ ...cloneFrame(f), rivals: f.rivals.filter((r) => r.id !== rivalId).map((r) => ({ ...r })) })));

/** Adds an arrow to paso `i` (≤ 10; a zero-length arrow is ignored). */
export function addArrow(play: Play, i: number, arrow: PlayArrow): Play {
  if (!validIndex(play, i) || play.frames[i].arrows.length >= L.arrows) return play;
  const from = clampPoint(arrow.from), to = clampPoint(arrow.to);
  if (dist(from, to) < 1) return play;
  return editFrame(play, i, (f) => {
    f.arrows.push({ from, to, kind: arrow.kind });
  });
}
export const removeArrow = (play: Play, i: number, index: number): Play =>
  validIndex(play, i) && index >= 0 && index < play.frames[i].arrows.length
    ? editFrame(play, i, (f) => {
        f.arrows.splice(index, 1);
      })
    : play;

/**
 * Arrows for the move from one paso to the next, as the design draws them: the ball's path (a
 * conducción if one of ours carries it, else a pase) and the runs of those who move far enough.
 * At most `max` arrows, the ball first.
 */
export function deriveArrows(from: PlayFrame, to: PlayFrame, max = 4): PlayArrow[] {
  const out: PlayArrow[] = [];
  if (dist(from.ball, to.ball) > 3) {
    const carrier = Object.keys(from.players).find((id) => to.players[id] && dist(from.players[id], from.ball) < 4 && dist(to.players[id], to.ball) < 4);
    out.push({ from: { ...from.ball }, to: { ...to.ball }, kind: carrier ? "conduccion" : "pase" });
  }
  for (const [id, a] of Object.entries(from.players)) {
    const b = to.players[id];
    if (out.length >= max) break;
    if (b && Math.abs(a.x - b.x) + Math.abs(a.y - b.y) > 9) out.push({ from: { ...a }, to: { ...b }, kind: "carrera" });
  }
  return out.slice(0, Math.min(max, L.arrows));
}

// ───────────────────────────── the replay ─────────────────────────────

/** Share of each move spent still on the paso (arrows draw) before the players run. */
export const HOLD = 0.2;
/** Highest arc of a pass, pitch % (a 2D board lifts the ball by this much at mid-flight). */
export const MAX_ARC = 12;

export interface PlayPose {
  players: Record<string, BoardPoint>;
  ball: BoardPoint & { /** Height of the ball over the grass (pitch %), > 0 only in the air on a pase. */ h: number };
  rivals: PlayRival[];
  /** The paso the pose is at or leaving (0..frames-1). */
  frame: number;
  /** Progress of the move out of `frame`, eased (0 = still on it, 1 = arrived at the next). */
  u: number;
}

/** Each entity's spot in every paso: carried forward when a paso omits it, back-filled from its first one. */
function tracks<T extends BoardPoint>(frames: PlayFrame[], at: (f: PlayFrame) => Record<string, T>): Map<string, BoardPoint[]> {
  const ids: string[] = [];
  for (const f of frames) for (const id of Object.keys(at(f))) if (!ids.includes(id)) ids.push(id);
  const out = new Map<string, BoardPoint[]>();
  for (const id of ids) {
    let last: BoardPoint | null = null;
    const pts = frames.map((f) => {
      const p = at(f)[id];
      if (p) last = { x: p.x, y: p.y };
      return last;
    });
    const first = pts.find((p): p is BoardPoint => p !== null)!;
    out.set(id, pts.map((p) => p ?? first));
  }
  return out;
}
function catmull(p0: BoardPoint, p1: BoardPoint, p2: BoardPoint, p3: BoardPoint, t: number): BoardPoint {
  const t2 = t * t, t3 = t2 * t;
  const c = (a: number, b: number, cc: number, d: number) => 0.5 * (2 * b + (-a + cc) * t + (2 * a - 5 * b + 4 * cc - d) * t2 + (-a + 3 * b - 3 * cc + d) * t3);
  return { x: c(p0.x, p1.x, p2.x, p3.x), y: c(p0.y, p1.y, p2.y, p3.y) };
}
/** Smooth path through all the pasos (Catmull-Rom), clamped to the pitch. */
function along(pts: BoardPoint[], i: number, u: number): BoardPoint {
  const n = pts.length;
  if (u <= 0) return { ...pts[i] };
  if (u >= 1) return { ...pts[Math.min(n - 1, i + 1)] };
  const p = catmull(pts[Math.max(0, i - 1)], pts[i], pts[Math.min(n - 1, i + 1)], pts[Math.min(n - 1, i + 2)], u);
  return { x: clamp(p.x, 0, 100), y: clamp(p.y, 0, 100) };
}

/**
 * Where everything is at `t` ∈ [0, 1] of the jugada (equal time per move; each move first holds
 * the paso, then everyone runs with an eased curve). On a pase the ball leaves a touch late, flies
 * on an arc (`ball.h`) and lands as the move ends; on a conducción it stays at the carrier's feet.
 */
export function playPoseAt(play: Play, t: number): PlayPose {
  const frames = play.frames;
  const n = frames.length;
  const players = tracks(frames, (f) => f.players);
  const rivals = tracks(frames, (f) => Object.fromEntries(f.rivals.map((r) => [r.id, r])));
  const balls = frames.map((f) => f.ball);
  if (n < 2) {
    const f = frames[0];
    return { players: Object.fromEntries([...players].map(([id, p]) => [id, p[0]])), ball: { ...(f?.ball ?? { x: 50, y: 50 }), h: 0 }, rivals: f ? f.rivals.map((r) => ({ ...r })) : [], frame: 0, u: 0 };
  }
  const T = clamp(Number.isFinite(t) ? t : 0, 0, 1) * (n - 1);
  const seg = Math.min(n - 2, Math.floor(T));
  const s = T - seg;
  const lin = clamp((s - HOLD) / (1 - HOLD), 0, 1);
  const u = easeInOutCubic(lin);
  const pose: PlayPose = {
    players: Object.fromEntries([...players].map(([id, pts]) => [id, along(pts, seg, u)])),
    ball: { x: 0, y: 0, h: 0 },
    rivals: [...rivals].map(([id, pts]) => ({ id, ...along(pts, seg, u) })),
    frame: u >= 1 ? seg + 1 : seg,
    u,
  };
  const A = balls[seg], B = balls[seg + 1];
  const kinds = new Set(frames[seg].arrows.map((a) => a.kind));
  const d = dist(A, B);
  if (d > 0.5 && kinds.has("pase") && !kinds.has("conduccion")) {
    const k = clamp((lin - 0.1) / 0.85, 0, 1);
    const e = 1 - Math.pow(1 - k, 1.6);
    pose.ball = { x: A.x + (B.x - A.x) * e, y: A.y + (B.y - A.y) * e, h: k > 0 && k < 1 ? Math.min(MAX_ARC, d * 0.25) * Math.sin(Math.PI * k) : 0 };
  } else pose.ball = { x: A.x + (B.x - A.x) * u, y: A.y + (B.y - A.y) * u, h: 0 };
  pose.ball.x = clamp(pose.ball.x, 0, 100);
  pose.ball.y = clamp(pose.ball.y, 0, 100);
  return pose;
}

// ───────────────────────────── a board's list ─────────────────────────────

export const canAddPlay = (list: Play[]) => list.length < L.plays;
/** Adds (or replaces, by id) a jugada; the same list back if it is invalid or the board is full (≤ 12). */
export function savePlay(list: Play[], play: Play): Play[] {
  if (!isValidPlay(play)) return list;
  const i = list.findIndex((p) => p.id === play.id);
  if (i >= 0) return list.map((p, k) => (k === i ? play : p));
  return canAddPlay(list) ? [...list, play] : list;
}
export const removePlay = (list: Play[], id: string): Play[] => list.filter((p) => p.id !== id);
/** A copy of jugada `id` (own, editable: kind kept, «(copia)» in the name). */
export function duplicatePlay(list: Play[], id: string): Play[] {
  const src = list.find((p) => p.id === id);
  if (!src || !canAddPlay(list)) return list;
  const name = `${src.name.slice(0, L.playName - 8)} (copia)`;
  return [...list, { ...src, id: newId("j"), name, frames: src.frames.map(cloneFrame) }];
}

// ───────────────────────────── limits, storage ─────────────────────────────

/** What is wrong with a jugada (Spanish, for the editor), or [] when it can be saved. */
export function validatePlay(play: Play): string[] {
  const r = playSchema.safeParse(play);
  if (r.success) return [];
  const msgs = new Set<string>();
  for (const issue of r.error.issues) {
    const where = issue.path[0];
    if (where === "name") msgs.add(`El nombre lleva entre 1 y ${L.playName} caracteres.`);
    else if (where === "frames" && issue.path.length === 1) msgs.add(`Una jugada tiene entre ${L.framesMin} y ${L.framesMax} pasos.`);
    else if (where === "frames") msgs.add(issue.message.startsWith("Como") || issue.message.startsWith("Rivales") ? issue.message : "Hay un paso con datos fuera del campo o de los límites.");
    else msgs.add("La jugada no es válida.");
  }
  return [...msgs];
}
export const isValidPlay = (play: Play) => playSchema.safeParse(play).success;

/** Firestore payload (no `undefined`). */
export function playToData(play: Play): Record<string, unknown> {
  return { id: play.id, name: play.name, kind: play.kind, frames: play.frames.map((f) => ({ ...cloneFrame(f) })) };
}

/** Reads the `plays` of a stored board: invalid jugadas are dropped (and reported), ≤ 12 kept. */
export function parsePlays(raw: unknown, docId = "-"): Play[] {
  if (!Array.isArray(raw)) return [];
  const out: Play[] = [];
  raw.forEach((item, i) => {
    const r = playSchema.safeParse(item);
    if (r.success) out.push(r.data);
    else reportDroppedDoc("lineups.plays", `${docId}#${i}`, r.error.issues);
  });
  return out.slice(0, L.plays);
}

// ───────────────────────────── the 3D engine ─────────────────────────────

/** Board point → engine point (the engine counts y from our goal line). */
export const toEnginePoint = (p: BoardPoint) => ({ x: p.x, y: 100 - p.y });

/** Every rival of the jugada at its first spot, for the engine's setRivals (call it before play()). */
export function engineRivals(play: Play): RivalSpec[] {
  const first = new Map<string, PlayRival>();
  for (const f of play.frames) for (const r of f.rivals) if (!first.has(r.id)) first.set(r.id, r);
  return [...first.values()].map((r) => ({ id: r.id, ...toEnginePoint(r) }));
}

/** The jugada as the engine plays it: ours and the rivals by id, the ball and the arrows of each paso. */
export function toEngineFrames(play: Play): EngineFrame[] {
  return play.frames.map((f) => ({
    players: [
      ...Object.entries(f.players).map(([id, p]) => ({ id, ...toEnginePoint(p) })),
      ...f.rivals.map((r) => ({ id: r.id, ...toEnginePoint(r) })),
    ],
    ball: toEnginePoint(f.ball),
    arrows: f.arrows.map((a): ArrowSpec => ({ from: toEnginePoint(a.from), to: toEnginePoint(a.to), kind: a.kind })),
  }));
}
