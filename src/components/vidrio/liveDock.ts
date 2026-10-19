// Where the live score lives on the current page. The floating score reads
// this store; pages declare themselves:
//   useLiveDock(lensRef, "lens")     «my lens shows the match»: while it is on screen the float stays away
//                                     (never the match twice) — Inicio's Hoy lens.
//   useLiveDock(segmentRef, "anchor") «dock the float on this element» — Partidos' tonight segment.
// Otherwise the float floats. `live` (set by the live system) lights the chrome's dot on «Partidos»; `hidden`
// («Ocultar hasta el próximo gol») leaves the score as a small chip beside «Partidos» that brings it back.
// Server render: hooks do nothing and the snapshot is the calm one (not live, floating).
import { useEffect, useSyncExternalStore, type RefObject } from "react";

export type DockMode = "lens" | "anchor";
export interface LiveDockState {
  /** A match of ours is live now (the chrome's dot, the float's presence). */
  live: boolean;
  /** Where the score shows: floating, inside a page's lens, or docked on a page's element. */
  mode: "float" | "lens" | "anchor";
  /** The element to dock on (mode «anchor»). */
  anchor: Element | null;
  /** The float is hidden until the next goal: the score the capsule keeps beside «Partidos» («2–1») and what a
   *  screen reader hears («Piti 2, Orduña fc 1»); null when it shows. */
  hidden: { score: string; said: string } | null;
}

interface Entry {
  mode: DockMode;
  el: Element;
  shown: boolean;
}

const CALM: LiveDockState = { live: false, mode: "float", anchor: null, hidden: null };
const entries = new Map<object, Entry>();
const listeners = new Set<() => void>();
let live = false;
let hidden: LiveDockState["hidden"] = null;
let reveal: (() => void) | null = null;
let state: LiveDockState = CALM;

function compute(): LiveDockState {
  const list = [...entries.values()];
  const lens = list.some((e) => e.mode === "lens" && e.shown);
  const anchor = list.find((e) => e.mode === "anchor" && e.shown)?.el ?? null;
  return { live, mode: lens ? "lens" : anchor ? "anchor" : "float", anchor: lens ? null : anchor, hidden };
}

function publish(): void {
  const next = compute();
  if (next.live === state.live && next.mode === state.mode && next.anchor === state.anchor && next.hidden?.score === state.hidden?.score && next.hidden?.said === state.hidden?.said) return;
  state = next;
  listeners.forEach((l) => l());
}

export const liveDock = {
  subscribe(listener: () => void): () => void {
    listeners.add(listener);
    return () => listeners.delete(listener);
  },
  get(): LiveDockState {
    return state;
  },
  /** The live system says whether a match of ours is on. */
  setLive(on: boolean): void {
    live = on;
    publish();
  },
  /** The live system hid the float (the chip's score and words, and how to bring it back), or shows it again. */
  setHidden(h: { score: string; said: string } | null, onReveal?: () => void): void {
    hidden = h;
    reveal = h ? (onReveal ?? null) : null;
    publish();
  },
  /** The capsule's chip was tapped: the float comes back. */
  reveal(): void {
    reveal?.();
  },
  /** A page's lens or anchor (key: any object owned by the caller), shown or not. */
  declare(key: object, mode: DockMode, el: Element, shown = true): void {
    entries.set(key, { mode, el, shown });
    publish();
  },
  release(key: object): void {
    entries.delete(key);
    publish();
  },
  /** Tests: forget everything. */
  reset(): void {
    entries.clear();
    live = false;
    hidden = null;
    reveal = null;
    state = CALM;
    listeners.forEach((l) => l());
  },
};

/** The dock state (the calm one on the server and while hydrating). */
export function useLiveDockState(): LiveDockState {
  return useSyncExternalStore(liveDock.subscribe, liveDock.get, () => CALM);
}

/** Whether a match of ours is live (the chrome's dot). */
export function useLiveNow(): boolean {
  return useLiveDockState().live;
}

/** Declares `ref`'s element as the page's live lens (counts while it is on screen) or as the float's anchor
 *  (while mounted). Without IntersectionObserver the lens counts while mounted. */
export function useLiveDock(ref: RefObject<Element | null>, mode: DockMode): void {
  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const key = {};
    if (mode === "anchor" || typeof IntersectionObserver !== "function") {
      liveDock.declare(key, mode, el, true);
      return () => liveDock.release(key);
    }
    liveDock.declare(key, mode, el, false);
    // (a sliver of the lens under the top bar doesn't count: the float comes back as the score leaves)
    const io = new IntersectionObserver(([entry]) => liveDock.declare(key, mode, el, !!entry?.isIntersecting), { rootMargin: "-72px 0px 0px 0px" });
    io.observe(el);
    return () => {
      io.disconnect();
      liveDock.release(key);
    };
  }, [ref, mode]);
}
