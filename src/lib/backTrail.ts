// «Volver» that remembers where you came from. The router numbers every history entry of this tab
// (location.state.__TSR_index: 0 on a first load or a deep link, +1 on each in-app navigation, and the
// browser keeps it across a reload). The trail notes the page shown at each index, in sessionStorage
// (this tab only, it survives a reload), so a back link can tell whether the entry behind it is another
// page of the app, and how many entries back that page is (a page's own tab changes add entries too).
import { useEffect } from "react";
import { useRouterState } from "@tanstack/react-router";

const KEY = "mp:trail";
/** Indices further back than this are forgotten (a long session must not grow the storage forever). */
const KEEP = 200;

type Trail = Record<number, string>;
// The copy in memory, for when sessionStorage is blocked (private mode) or throws.
let memory: Trail = {};

function read(): Trail {
  try {
    const raw = sessionStorage.getItem(KEY);
    if (raw) {
      const parsed: unknown = JSON.parse(raw);
      if (parsed && typeof parsed === "object") return parsed as Trail;
    }
  } catch {
    /* blocked or malformed: the in-memory copy */
  }
  return memory;
}

function write(trail: Trail) {
  memory = trail;
  try {
    sessionStorage.setItem(KEY, JSON.stringify(trail));
  } catch {
    /* blocked or full: the in-memory copy still serves this visit */
  }
}

/** Notes that the entry at `index` shows `pathname` (a push, a replace or a step through history). */
export function recordTrail(index: number, pathname: string) {
  if (!Number.isInteger(index) || index < 0) return;
  const trail = read();
  if (trail[index] === pathname) return;
  const next: Trail = {};
  for (const [k, v] of Object.entries(trail)) if (Number(k) > index - KEEP) next[Number(k)] = v;
  next[index] = pathname;
  write(next);
}

/**
 * How many entries back the previous page of the app is: the nearest earlier entry whose path is not
 * `pathname` (the same page with another tab or season does not count). 0 = none, or not known (a first
 * load, a deep link, or a trail with a gap): the caller falls back to the section.
 */
export function stepsBack(index: number, pathname: string): number {
  if (!Number.isInteger(index) || index <= 0) return 0;
  const trail = read();
  for (let i = index - 1; i >= 0; i--) {
    const at = trail[i];
    if (at === undefined) return 0;
    if (at !== pathname) return index - i;
  }
  return 0;
}

/** The current entry's index (0 when the history state has none). */
export function useHistoryIndex(): number {
  return useRouterState({ select: (s) => s.location.state.__TSR_index ?? 0 });
}

/** Mounted once (RootLayout): notes every location the app shows. */
export function useRecordTrail() {
  const index = useHistoryIndex();
  const pathname = useRouterState({ select: (s) => s.location.pathname });
  useEffect(() => recordTrail(index, pathname), [index, pathname]);
}

/** Test-only: forgets the trail. */
export function _resetTrailForTesting() {
  memory = {};
  try {
    sessionStorage.removeItem(KEY);
  } catch {
    /* nothing to clear */
  }
}
