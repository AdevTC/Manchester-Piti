// Bloque 5 · mover varias fichas a la vez (pure). In free mode (the seven anywhere) and in a jugada's paso
// being edited, several fichas can be picked (Shift / Ctrl-click, or «Seleccionar» on a touch screen) and
// moved together: dragged (the frame's delta, through the TV camera) or with the arrows (a pitch delta,
// held back at the edge so the group keeps its shape). Group keys: in free mode the player's id; in a
// jugada the piece («p:<id>», «r:<id>», «b»). Unit-tested in multiSel.test.ts.
import type { Lineup } from "../formations";
import { proj, unproj, type CamName, CAMS } from "./geometry";
import { freeSpot } from "./ops";
import { moveBall, movePlayer, moveRival, type Play } from "../plays";
import { plural } from "./plural";

type Pt = { x: number; y: number };

/** The key in or out of the group. */
export const toggleKey = (list: readonly string[], k: string): string[] => (list.includes(k) ? list.filter((x) => x !== k) : [...list, k]);

/** Only the keys still there (a player benched, a rival removed, another paso). */
export const keepKeys = (list: readonly string[], there: (k: string) => boolean): string[] => {
  const out = list.filter(there);
  return out.length === list.length ? (list as string[]) : out;
};

/** «3 fichas». */
export const fichasTxt = (n: number): string => plural(n, "ficha", "fichas");

/** The largest step (dx, dy) the whole group can take while every point stays within [lo, hi]. */
export function clampGroupDelta(points: readonly Pt[], dx: number, dy: number, lo: number, hi: number): [number, number] {
  if (!points.length) return [0, 0];
  const xs = points.map((p) => p.x);
  const ys = points.map((p) => p.y);
  const cx = Math.max(lo - Math.min(...xs), Math.min(hi - Math.max(...xs), dx));
  const cy = Math.max(lo - Math.min(...ys), Math.min(hi - Math.max(...ys), dy));
  return [+cx.toFixed(2), +cy.toFixed(2)];
}

/** Where a pitch point goes when the frame point it is drawn at moves by (dX, dY) frame %. */
export function frameShift(cam: CamName, p: Pt, dX: number, dY: number): Pt {
  const C = CAMS[cam];
  const f = proj(C, p.x, p.y);
  const q = unproj(C, f.x + dX, f.y + dY);
  return { x: q.u, y: q.v };
}

/** Free mode: the group's players (their slot spots), as pitch points. */
export function freePoints(L: Lineup, ids: readonly string[]): Pt[] {
  return L.slots.filter((s) => !!s.playerId && ids.includes(s.playerId)).map((s) => ({ x: s.x, y: s.y }));
}

/** Free mode: each player of the group goes where `to` sends his spot (kept on the pitch, on the grid
 *  when it is on). The same lineup when nothing moved (or the board is not in free mode). */
export function moveFreeGroup(L: Lineup, ids: readonly string[], to: (p: Pt) => Pt, grid: boolean): Lineup {
  if (!L.freeMode || !ids.length) return L;
  let moved = false;
  const slots = L.slots.map((s) => {
    if (!s.playerId || !ids.includes(s.playerId)) return s;
    const t = to({ x: s.x, y: s.y });
    const [x, y] = freeSpot(t.x, t.y, grid);
    if (x === s.x && y === s.y) return s;
    moved = true;
    return { ...s, x, y };
  });
  return moved ? { ...L, slots } : L;
}

/** A jugada's paso: where each piece of the group stands (pitch points), by key. */
export function piecePoints(play: Play, frame: number, keys: readonly string[]): Map<string, Pt> {
  const f = play.frames[frame];
  const out = new Map<string, Pt>();
  if (!f) return out;
  for (const k of keys) {
    if (k === "b") out.set(k, { x: f.ball.x, y: f.ball.y });
    else if (k.startsWith("r:")) {
      const r = f.rivals.find((x) => x.id === k.slice(2));
      if (r) out.set(k, { x: r.x, y: r.y });
    } else if (k.startsWith("p:")) {
      const p = f.players[k.slice(2)];
      if (p) out.set(k, { x: p.x, y: p.y });
    }
  }
  return out;
}

/** A jugada's paso: every piece of the group goes where `to` sends it (one edit). The same jugada when
 *  nothing moved. */
export function movePiecesGroup(play: Play, frame: number, keys: readonly string[], to: (p: Pt) => Pt): Play {
  let next = play;
  for (const [k, p] of piecePoints(play, frame, keys)) {
    const t = to(p);
    if (k === "b") next = moveBall(next, frame, t);
    else if (k.startsWith("r:")) next = moveRival(next, frame, k.slice(2), t);
    else next = movePlayer(next, frame, k.slice(2), t);
  }
  const same = next.frames[frame] && JSON.stringify(next.frames[frame]) === JSON.stringify(play.frames[frame]);
  return same ? play : next;
}

/** The middle of the group (where it is said to have gone). */
export function centreOf(points: readonly Pt[]): Pt {
  const n = Math.max(1, points.length);
  return { x: points.reduce((a, p) => a + p.x, 0) / n, y: points.reduce((a, p) => a + p.y, 0) / n };
}
