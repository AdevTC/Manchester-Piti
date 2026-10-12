// La pizarra — what Ctrl Z / Ctrl Shift Z (and the command bar's Deshacer / Rehacer) undo, by the tool on
// screen: the siete (and Química, where cromos move too) rewinds the lineup; Dibujar its strokes; Jugadas
// the edits of the jugadas; any other panel nothing. Strokes and jugadas are undone by id, never by
// putting back a whole old list, so what another tab added meanwhile stays. Pure.
import type { Play, Stroke } from "../../../lib/schemas";
import type { Modo } from "./view";

export type UndoScope = "lineup" | "ink" | "jugada" | null;

export function undoScopeOf(modo: Modo): UndoScope {
  if (modo === "editar" || modo === "quimica") return "lineup";
  if (modo === "dibujar") return "ink";
  if (modo === "jugadas") return "jugada";
  return null;
}

export const UNDO_MAX = 40;

export interface Stack<T> {
  past: T[];
  future: T[];
}
export const emptyStack = <T>(): Stack<T> => ({ past: [], future: [] });

// ── the strokes ──
/** One change to the strokes: the ones it added, and the ones it took away (with where they were). */
export interface InkOp {
  add: Stroke[];
  del: { s: Stroke; at: number }[];
}

/** The change from `before` to `after` (by stroke id). */
export function inkOp(before: Stroke[], after: Stroke[]): InkOp {
  const was = new Set(before.map((s) => s.id));
  const now = new Set(after.map((s) => s.id));
  return {
    add: after.filter((s) => !was.has(s.id)),
    del: before.flatMap((s, at) => (now.has(s.id) ? [] : [{ s, at }])),
  };
}
const without = (list: Stroke[], ids: ReadonlySet<string>): Stroke[] => list.filter((s) => !ids.has(s.id));
/** Undo `op` on the strokes there are now: its additions go, what it took away comes back where it was. */
export function inkBack(cur: Stroke[], op: InkOp): Stroke[] {
  const out = without(cur, new Set(op.add.map((s) => s.id)));
  const have = new Set(out.map((s) => s.id));
  op.del
    .slice()
    .sort((a, b) => a.at - b.at)
    .forEach(({ s, at }) => {
      if (have.has(s.id)) return;
      out.splice(Math.min(at, out.length), 0, s);
      have.add(s.id);
    });
  return out;
}
/** Redo `op` on the strokes there are now. */
export function inkForward(cur: Stroke[], op: InkOp): Stroke[] {
  const out = without(cur, new Set(op.del.map((d) => d.s.id)));
  const have = new Set(out.map((s) => s.id));
  return out.concat(op.add.filter((s) => !have.has(s.id)));
}

// ── the jugadas ──
/** One edit of one jugada (null = it didn't exist / it was deleted), and which jugada was on screen. */
export interface PlayOp {
  id: string;
  before: Play | null;
  after: Play | null;
  /** The jugada on screen before and after (a built-in one edited becomes a copy with a new id). */
  jid0: string;
  jid1: string;
  /** Consecutive edits with the same tag are one step (typing a paso's title). */
  tag?: string;
}

/** The board's jugadas with jugada `id` set to `p` (null removes it), the others as they are now. */
export function withPlay(list: Play[], id: string, p: Play | null): Play[] {
  const i = list.findIndex((x) => x.id === id);
  if (!p) return i < 0 ? list : list.filter((x) => x.id !== id);
  if (i < 0) return list.concat([p]);
  const out = list.slice();
  out[i] = p;
  return out;
}

/** A new change on top (the future is dropped); a change with the last one's tag merges into it. */
export function pushOp<T>(s: Stack<T>, op: T, merge?: (last: T, op: T) => T | null): Stack<T> {
  const last = s.past[s.past.length - 1];
  const m = last && merge ? merge(last, op) : null;
  const past = m ? s.past.slice(0, -1).concat([m]) : s.past.concat([op]);
  return { past: past.slice(-UNDO_MAX), future: [] };
}
/** Two edits of the same jugada with the same tag are one step: from the first's before to the last's after. */
export const mergePlay = (last: PlayOp, op: PlayOp): PlayOp | null => (op.tag && last.tag === op.tag && last.id === op.id ? { ...op, before: last.before, jid0: last.jid0 } : null);

/** Takes the last change off the past (to undo it): it waits in the future. */
export function popPast<T>(s: Stack<T>): { op: T; stack: Stack<T> } | null {
  const op = s.past[s.past.length - 1];
  return op === undefined ? null : { op, stack: { past: s.past.slice(0, -1), future: s.future.concat([op]) } };
}
/** Takes the next change off the future (to redo it): it goes back to the past. */
export function popFuture<T>(s: Stack<T>): { op: T; stack: Stack<T> } | null {
  const op = s.future[s.future.length - 1];
  return op === undefined ? null : { op, stack: { past: s.past.concat([op]).slice(-UNDO_MAX), future: s.future.slice(0, -1) } };
}
