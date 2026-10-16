// «Buscar»'s recent searches: the last 5 queries that led somewhere, newest first, in this browser only
// (localStorage). Storage may be missing, full or blocked (private mode, a strict browser): every access is
// wrapped, and the search simply works without a memory then.
import { normalize } from "./derived/search";

export const RECENT_KEY = "mp:buscar:recientes";
export const RECENT_MAX = 5;

function storage(): Storage | null {
  try {
    return typeof window === "undefined" ? null : window.localStorage;
  } catch {
    return null;
  }
}

/** The stored searches (an empty list when there are none, or storage fails or holds garbage). */
export function readRecent(): string[] {
  try {
    const raw = storage()?.getItem(RECENT_KEY);
    if (!raw) return [];
    const list: unknown = JSON.parse(raw);
    if (!Array.isArray(list)) return [];
    return list.filter((x): x is string => typeof x === "string" && x.trim() !== "").slice(0, RECENT_MAX);
  } catch {
    return [];
  }
}

/** `query` first (a repeat, accents and case aside, moves up instead of doubling), 5 at most. Returns the
 *  new list, also when it could not be stored. */
export function rememberSearch(query: string): string[] {
  const q = query.trim();
  if (!q) return readRecent();
  const key = normalize(q);
  const next = [q, ...readRecent().filter((r) => normalize(r) !== key)].slice(0, RECENT_MAX);
  try {
    storage()?.setItem(RECENT_KEY, JSON.stringify(next));
  } catch {
    // full or blocked: this visit keeps the list, the next one starts without it
  }
  return next;
}
