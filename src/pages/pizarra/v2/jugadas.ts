// La pizarra «Noche de partido» — the jugadas around the board: the library (córner, falta, banda, salida,
// built from the seven on the board) and the board's own ones, the editor's rules (a built-in jugada
// becomes yours on your first change; the arrows of each paso follow from the moves), and what the
// replay draws for a paso: the cromos as discs, the rivals, the ball (on an arc when it is a pase), the
// calco of the paso before, the estelas, the follow-cam and the «REPETICIÓN» bug. Pure.
import type { BoardPoint } from "../../../lib/schemas";
import type { Lineup } from "../formations";
import { libraryPlayId, libraryPlays } from "../playLibrary";
import { deriveArrows, newPlay, playPoseAt, setFrameText, type Play, type PlayKind, type PlayPose, type PlayRival } from "../plays";
import { PIZARRA_LIMITS } from "../../../lib/schemas";
import { CAMS, depthScale, f1, proj, slotPos, slotZone, type CamName } from "./geometry";
import { galonesOf, type Squad } from "./model";
import type { CardView, Fx } from "./view";

const L_ = PIZARRA_LIMITS;

/** The jugada shown when none is picked (as designed: the córner). */
export const DEFAULT_JUGADA = libraryPlayId("corner");
/** The library's short labels (the jugada's own name is the label of yours). */
export const LIB_SHORT: Record<Exclude<PlayKind, "propia">, string> = { corner: "Córner", falta: "Falta", banda: "Banda", salida: "Salida" };

export interface JugadaItem {
  play: Play;
  /** Stored on the board (yours); else built-in. */
  own: boolean;
  short: string;
}

/** The library for the seven on the board, then the board's own jugadas. */
export function jugadaList(L: Lineup): JugadaItem[] {
  return [
    ...libraryPlays(L).map((play) => ({ play, own: false, short: LIB_SHORT[play.kind as Exclude<PlayKind, "propia">] ?? play.name })),
    ...(L.plays ?? []).map((play) => ({ play, own: true, short: play.name })),
  ];
}

/** The jugada with this id (or the first one, the córner, when it is gone). */
export const pickJugada = (list: JugadaItem[], id: string): JugadaItem => list.find((j) => j.play.id === id) ?? list[0];

/** The arrows of every paso, derived again from the moves (after any change to the pasos). */
export function rederive(play: Play): Play {
  return { ...play, frames: play.frames.map((f, i) => ({ ...f, arrows: play.frames[i + 1] ? deriveArrows(f, play.frames[i + 1]) : [] })) };
}

/** A name not used yet among `taken`: «base», «base 2», «base 3»… (kept within the limit). */
export function freeName(base: string, taken: string[]): string {
  const used = new Set(taken.map((t) => t.trim().toLowerCase()));
  const b = base.trim().slice(0, L_.playName);
  if (!used.has(b.toLowerCase())) return b;
  for (let n = 2; ; n++) {
    const tail = " " + n;
    const c = b.slice(0, L_.playName - tail.length) + tail;
    if (!used.has(c.toLowerCase())) return c;
  }
}

/** The name of a built-in jugada once it is yours: «Córner a favor (tuya)» (unique among `taken`). */
export function forkName(name: string, taken: string[]): string {
  const tail = " (tuya)";
  return freeName(name.slice(0, L_.playName - tail.length) + tail, taken);
}

/** A built-in jugada made yours: stored under a new id, «(tuya)» in the name, its own copy of the pasos. */
export function forkPlay(src: Play, taken: string[], id: string): Play {
  return { ...src, id, name: forkName(src.name, taken), frames: src.frames.map((f) => structuredClone(f)) };
}

/** «Tu jugada 1», «Tu jugada 2»… */
export const ownName = (plays: Play[]): string => {
  let n = plays.length + 1;
  const used = new Set(plays.map((p) => p.name.toLowerCase()));
  while (used.has(("Tu jugada " + n).toLowerCase())) n++;
  return "Tu jugada " + n;
};

/** Where the seven stand on the board now (pitch %, rounded), by player. */
export function boardSpots(L: Lineup): Record<string, BoardPoint> {
  const out: Record<string, BoardPoint> = {};
  L.slots.forEach((s, i) => {
    if (!s.playerId) return;
    const p = slotPos(L, i);
    out[s.playerId] = { x: Math.round(p.u), y: Math.round(p.v) };
  });
  return out;
}

/** A new jugada from where the seven stand now (null with nobody on the pitch). As designed, its first
 *  paso is the «Salida». */
export function playFromBoard(L: Lineup, name: string): Play | null {
  const spots = boardSpots(L);
  if (!Object.keys(spots).length) return null;
  return setFrameText(newPlay(name, spots), 0, { title: "Salida" });
}

/** Players of the jugada, in the order they first appear. */
export function participants(play: Play): string[] {
  const ids: string[] = [];
  for (const f of play.frames) for (const id of Object.keys(f.players)) if (!ids.includes(id)) ids.push(id);
  return ids;
}

/** Those of the seven on the board who are not in the jugada yet. */
export function missingFrom(play: Play, L: Lineup): string[] {
  const inPlay = new Set(participants(play));
  return L.slots.map((s) => s.playerId).filter((id): id is string => !!id && !inPlay.has(id));
}

/** Those in the jugada who are no longer among the seven on the board (a change since it was made). */
export function goneFrom(play: Play, L: Lineup): string[] {
  const on = new Set(L.slots.map((s) => s.playerId).filter(Boolean));
  return participants(play).filter((id) => !on.has(id));
}

/** Takes players out of every paso (to make room for the ones now in the seven). */
export function dropPlayers(play: Play, ids: string[]): Play {
  const out = new Set(ids);
  return { ...play, frames: play.frames.map((f) => ({ ...f, players: Object.fromEntries(Object.entries(f.players).filter(([id]) => !out.has(id))) })) };
}

/** Adds players to every paso at their spot on the board (while a paso has room for seven). */
export function addPlayers(play: Play, ids: string[], L: Lineup): Play {
  const spots = boardSpots(L);
  return {
    ...play,
    frames: play.frames.map((f) => {
      const players = { ...f.players };
      for (const id of ids) if (spots[id] && !(id in players) && Object.keys(players).length < L_.framePlayers) players[id] = { ...spots[id] };
      return { ...f, players };
    }),
  };
}

/** Where everything stands at paso i (carried forward when a paso leaves someone out). */
export function pasoPose(play: Play, i: number): PlayPose {
  const n = play.frames.length;
  return playPoseAt(play, n > 1 ? Math.max(0, Math.min(n - 1, i)) / (n - 1) : 0);
}

/** How the ball goes from paso i - 1 to paso i: on the ground with one of ours (conducción), else in
 *  the air (a pase), or it does not move. */
export function ballMove(play: Play, i: number): "pase" | "conduccion" | null {
  const a = play.frames[i - 1];
  const b = play.frames[i];
  if (!a || !b || Math.abs(a.ball.x - b.ball.x) + Math.abs(a.ball.y - b.ball.y) <= 3) return null;
  return a.arrows.some((x) => x.kind === "conduccion") ? "conduccion" : "pase";
}

// ───────────────────────────── what the replay draws ─────────────────────────────

export interface PieceView {
  id: string;
  cls: string;
  x: string;
  y: string;
  fx: string;
  fy: string;
  mx: string;
  my: string;
  sc: string;
  sel: boolean;
}
export interface TrailView {
  key: string;
  cls: string;
  /** "b" = the ball's (dotted). */
  k: string;
  d: string;
}
export interface JugadaStage {
  cards: CardView[];
  rivals: PieceView[];
  ball: PieceView | null;
  ghosts: { key: string; x: string; y: string; sc: string }[];
  trails: TrailView[];
  /** The follow-cam's transform of the frame ("none" = the whole pitch). */
  camT: string;
  /** Where everything is drawn now (frame %), for the next glide to start from. */
  drawn: { p: Record<string, [number, number]>; r: Record<string, [number, number]>; b: [number, number] | null };
}

export interface JugadaStageArgs {
  play: Play;
  frame: number;
  L: Lineup;
  sq: Squad;
  cam: CamName;
  fx: Fx;
  meId: string | null;
  /** The paso can be retouched (an editable board, paused). */
  edit: boolean;
  selRival: string | null;
  onion: boolean;
  trails: boolean;
  rivals: boolean;
  ball: boolean;
  /** Follow the ball with the 2D camera. */
  follow: boolean;
}

const n2 = (n: number): number => +n.toFixed(2);
/** The follow-cam's zoom, as designed. */
export const FOLLOW_ZOOM = 1.34;

/** The follow-cam: zoomed in on the ball, kept inside the clipped frame. */
export function followCam(ball: { x: number; y: number }): string {
  const lim = 50 - 50 / FOLLOW_ZOOM + 4;
  const tx = Math.max(-lim, Math.min(lim, 50 - ball.x));
  const ty = Math.max(-lim - 4, Math.min(lim, 54 - ball.y));
  return "scale(" + FOLLOW_ZOOM + ") translate(" + tx.toFixed(2) + "%, " + ty.toFixed(2) + "%)";
}

export function jugadaStage(a: JugadaStageArgs): JugadaStage {
  const { play, L, sq, fx } = a;
  const C = CAMS[a.cam];
  const n = play.frames.length;
  const jf = Math.max(0, Math.min(n - 1, a.frame));
  const pose = pasoPose(play, jf);
  const prev = jf > 0 ? pasoPose(play, jf - 1) : null;
  const fk = fx.k;
  const mc = fk % 2 ? "ma" : "mb";
  const drawn: JugadaStage["drawn"] = { p: {}, r: {}, b: null };

  const cards: CardView[] = [];
  participants(play).forEach((id, k) => {
    const p = sq.byId.get(id);
    const at = pose.players[id];
    if (!p || !at) return;
    const sp = proj(C, at.x, at.y);
    const x = n2(sp.x);
    const y = n2(sp.y);
    drawn.p[id] = [x, y];
    const f = fx.from?.[id];
    const fxx = f ? f[0] : x;
    const fyy = f ? f[1] : y;
    const dist = Math.hypot(fxx - x, fyy - y);
    const si = L.slots.findIndex((s) => s.playerId === id);
    const zone = si >= 0 ? slotZone(L, si) : (p.pos ?? "");
    cards.push({
      id,
      i: si >= 0 ? si : 7 + k,
      x,
      y,
      fx: fxx,
      fy: fyy,
      mx: ((fxx + x) / 2).toFixed(2),
      my: ((fyy + y) / 2 - Math.min(9, dist * 0.35)).toFixed(2),
      sc: depthScale(C, sp.s).toFixed(3),
      z: Math.round(y * 10),
      rd: "0s",
      cls: [mc, fx.slow ? "slow" : "", si === 0 ? "gk" : "", "mini", fx.from && !f ? "in" : "", fx.rip.includes(id) ? "land" : "", a.meId === id ? "me" : ""].filter(Boolean).join(" "),
      rt: p.rt,
      num: p.num,
      name: p.name,
      zoneTxt: zone,
      oop: false,
      gal: galonesOf(L, id).map((g) => g.letter),
      tag: "",
      q: [true, false, false],
      spin: false,
      reel: [],
      sel: false,
      me: a.meId === id,
      aria: p.name + ", dorsal " + p.num + ", paso " + (jf + 1) + " de " + n + (a.edit ? ": arrástralo para recolocarlo en este paso" : ""),
    });
  });

  const rivals: PieceView[] = [];
  if (a.rivals)
    pose.rivals.forEach((r) => {
      const q = proj(C, r.x, r.y);
      const x = n2(q.x);
      const y = n2(q.y);
      drawn.r[r.id] = [x, y];
      const f = fx.rfrom?.[r.id];
      rivals.push({ id: r.id, cls: mc, x: x.toFixed(2), y: y.toFixed(2), fx: String(f ? f[0] : x), fy: String(f ? f[1] : y), mx: x.toFixed(2), my: y.toFixed(2), sc: depthScale(C, q.s).toFixed(3), sel: a.selRival === r.id });
    });

  const bq = proj(C, pose.ball.x, pose.ball.y);
  let ball: PieceView | null = null;
  if (a.ball) {
    const x = n2(bq.x);
    const y = n2(bq.y);
    drawn.b = [x, y];
    const bf = fx.bfrom;
    const bfx = bf ? bf[0] : x;
    const bfy = bf ? bf[1] : y;
    const d = Math.hypot(bfx - x, bfy - y);
    // a pase flies (the glide arcs up); a conducción stays on the grass
    const lift = ballMove(play, jf) === "conduccion" ? 0 : Math.min(14, d * 0.5);
    ball = { id: "b", cls: mc, x: x.toFixed(2), y: y.toFixed(2), fx: String(bfx), fy: String(bfy), mx: ((bfx + x) / 2).toFixed(2), my: ((bfy + y) / 2 - lift).toFixed(2), sc: "1", sel: false };
  }

  const ghosts: JugadaStage["ghosts"] = [];
  const trails: TrailView[] = [];
  if (prev) {
    if (a.onion)
      participants(play).forEach((id) => {
        const g = prev.players[id];
        if (!g || !sq.byId.has(id)) return;
        const q = proj(C, g.x, g.y);
        ghosts.push({ key: id, x: q.x.toFixed(2), y: q.y.toFixed(2), sc: depthScale(C, q.s).toFixed(3) });
      });
    if (a.trails) {
      const box = (p: { x: number; y: number }): [number, number] => {
        const q = proj(C, p.x, p.y);
        return [q.x * 10, q.y * 10];
      };
      participants(play).forEach((id) => {
        const p0 = prev.players[id];
        const p1 = pose.players[id];
        if (!p0 || !p1 || !sq.byId.has(id) || Math.abs(p0.x - p1.x) + Math.abs(p0.y - p1.y) < 4) return;
        const A = box(p0);
        const B = box(p1);
        const mx = (A[0] + B[0]) / 2 + (B[1] - A[1]) * 0.08;
        const my = (A[1] + B[1]) / 2 - (B[0] - A[0]) * 0.08;
        trails.push({ key: id, cls: "c-s", k: "", d: "M" + f1(A[0]) + " " + f1(A[1]) + "Q" + f1(mx) + " " + f1(my) + " " + f1(B[0]) + " " + f1(B[1]) });
      });
      const mv = ballMove(play, jf);
      if (mv) {
        const A = box(prev.ball);
        const B = box(pose.ball);
        const my = mv === "conduccion" ? (A[1] + B[1]) / 2 : Math.min(A[1], B[1]) - 40;
        trails.push({ key: "ball", cls: "c-g", k: "b", d: "M" + f1(A[0]) + " " + f1(A[1]) + "Q" + f1((A[0] + B[0]) / 2) + " " + f1(my) + " " + f1(B[0]) + " " + f1(B[1]) });
      }
    }
  }

  return { cards, rivals, ball, ghosts, trails, camT: a.follow ? followCam(bq) : "none", drawn };
}

export interface ReplayHud {
  bugA: string;
  bugB: string;
  bugK: string;
  bugAria: string;
  ticks: { n: number; l: string; cls: string }[];
  pct: string;
  lab: string;
  stepT: string;
  stepD: string;
}

/** The broadcast bug, the timeline and the caption of paso `frame`. `cam3d` = « · 3D», « · CÁMARA TV» or "". */
export function replayHud(item: JugadaItem, frame: number, cam3d: string, edit: boolean): ReplayHud {
  const fs = item.play.frames;
  const n = fs.length;
  const jf = Math.max(0, Math.min(n - 1, frame));
  const title = fs[jf]?.title || "Paso " + (jf + 1);
  return {
    bugA: "REPETICIÓN · " + item.short.toUpperCase() + " · " + (jf + 1) + "/" + n + cam3d,
    bugB: title,
    bugK: jf % 2 ? "ba" : "bb",
    bugAria: "Repetición: " + item.play.name + ", paso " + (jf + 1) + " de " + n + ", " + title + ". Abrir la biblioteca",
    ticks: fs.map((_, k) => ({ n: k + 1, l: (n > 1 ? (k / (n - 1)) * 100 : 0).toFixed(1) + "%", cls: k < jf ? "done" : k === jf ? "cur" : "" })),
    pct: (n > 1 ? (jf / (n - 1)) * 100 : 0).toFixed(1) + "%",
    lab: jf + 1 + "/" + n,
    stepT: "Paso " + (jf + 1) + " · " + title,
    stepD: fs[jf]?.note || (edit ? "Arrastra los cromos, el balón o los rivales para colocar este paso." : ""),
  };
}

/** Where a new rival starts: in the rival half, off the rivals already there. */
export const rivalSpot = (play: Play): BoardPoint => {
  const taken = play.frames[0]?.rivals ?? [];
  const spots: BoardPoint[] = [
    { x: 50, y: 30 },
    { x: 30, y: 20 },
    { x: 70, y: 20 },
    { x: 50, y: 45 },
    { x: 20, y: 40 },
    { x: 80, y: 40 },
    { x: 50, y: 15 },
  ];
  return spots.find((s) => !taken.some((r: PlayRival) => Math.abs(r.x - s.x) + Math.abs(r.y - s.y) < 6)) ?? { x: 50, y: 30 };
};
