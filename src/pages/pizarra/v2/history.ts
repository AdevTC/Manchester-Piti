// La pizarra «Noche de partido» — undo/redo as a rewind: two stacks of lineups, bounded. Pure.
import type { Lineup } from "../formations";

export const HISTORY_MAX = 40;

export interface History {
  past: Lineup[];
  future: Lineup[];
}

export const EMPTY_HISTORY: History = { past: [], future: [] };

/** A new change: the current lineup goes to the past, the future is dropped. */
export function pushHistory(h: History, current: Lineup): History {
  return { past: h.past.concat([current]).slice(-HISTORY_MAX), future: [] };
}

/** Undo: the last past lineup comes back; the current one waits in the future. */
export function undo(h: History, current: Lineup): { history: History; lineup: Lineup } | null {
  if (!h.past.length) return null;
  return { lineup: h.past[h.past.length - 1], history: { past: h.past.slice(0, -1), future: h.future.concat([current]) } };
}

export function redo(h: History, current: Lineup): { history: History; lineup: Lineup } | null {
  if (!h.future.length) return null;
  return { lineup: h.future[h.future.length - 1], history: { past: h.past.concat([current]).slice(-HISTORY_MAX), future: h.future.slice(0, -1) } };
}
