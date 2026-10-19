// A draggable glass thing (the floating score, the in-page «Sacar el marcador» window): drag it anywhere, let go
// and it springs to the nearest anchor (anchors.ts), remembers its spot per key (localStorage), double-click or
// Home sends it home, arrow keys on the handle hop between anchors. It writes --vd-fx / --vd-fy on the element
// (the CSS translates it: no React render per move) and .is-drag while held; a click right after a drag is
// swallowed so letting go never opens anything. Server render, shots: it rests at home and remembers nothing.
import { useEffect, useRef, type RefObject } from "react";
import { DRAG_SLOP, clampPos, dragTo, isStepKey, nearestAnchor, parsePos, stepAnchor, type AnchorOptions, type Box, type Pos } from "./anchors";
import { isShot } from "./env";

export interface DraggableOptions extends AnchorOptions {
  /** Remembers the spot under localStorage «vd-pos-<storageKey>» (per page: «inicio», «partidos», «pip»…). */
  storageKey?: string;
  /** Its home in the zone (default: centred, at `top`). */
  home?: (b: Box) => Pos;
  /** The part you grab (default: the element itself). */
  handle?: RefObject<HTMLElement | null>;
  /** The area it moves in: the viewport (position: fixed things, the default) or its offset parent. */
  zone?: "viewport" | "parent";
  /** Off: no listeners (the page docks it somewhere instead). */
  enabled?: boolean;
  /** Called after it settles on an anchor (or home). */
  onSettle?: (p: Pos) => void;
}

export interface Draggable {
  /** Sends it home and forgets the saved spot. */
  home: () => void;
}

const PREFIX = "vd-pos-";

function read(key: string | undefined): Pos | null {
  if (!key || isShot()) return null;
  try {
    return parsePos(localStorage.getItem(PREFIX + key));
  } catch {
    return null;
  }
}
function write(key: string | undefined, p: Pos | null): void {
  if (!key) return;
  try {
    if (p) localStorage.setItem(PREFIX + key, JSON.stringify({ x: Math.round(p.x), y: Math.round(p.y) }));
    else localStorage.removeItem(PREFIX + key);
  } catch {
    // (storage blocked: the spot lasts until the page reloads)
  }
}

export function useDraggable(ref: RefObject<HTMLElement | null>, options: DraggableOptions = {}): Draggable {
  const opts = useRef(options);
  const api = useRef<Draggable | null>(null);
  useEffect(() => {
    opts.current = options;
  });
  const { storageKey, enabled = true, axis, anchors, zone = "viewport" } = options;

  useEffect(() => {
    const el = ref.current;
    if (!el || !enabled) return;
    const handle = opts.current.handle?.current ?? el;
    const box = (): Box => {
      const parent = el.offsetParent instanceof HTMLElement ? el.offsetParent : null;
      const W = zone === "parent" && parent ? parent.clientWidth : document.documentElement.clientWidth || window.innerWidth;
      const H = zone === "parent" && parent ? parent.clientHeight : window.innerHeight;
      return { W, H, w: el.offsetWidth, h: el.offsetHeight };
    };
    const o = (): AnchorOptions => ({ ...opts.current, axis, anchors });
    const homePos = (): Pos => {
      const b = box();
      return clampPos(opts.current.home ? opts.current.home(b) : { x: (b.W - b.w) / 2, y: opts.current.top ?? opts.current.margin ?? 16 }, b, o());
    };
    let cur: Pos = { x: 0, y: 0 };
    const set = (p: Pos) => {
      cur = p;
      el.style.setProperty("--vd-fx", `${Math.round(p.x)}px`);
      el.style.setProperty("--vd-fy", `${Math.round(p.y)}px`);
    };
    const saved = read(storageKey);
    set(saved ? clampPos(saved, box(), o()) : homePos());
    el.dataset.vdPlaced = "1";

    let start: { x: number; y: number; at: Pos; id: number } | null = null;
    let moved = false;
    const down = (e: PointerEvent) => {
      if (e.button > 0) return;
      if (e.target instanceof Element && e.target.closest("[data-vd-nodrag]")) return;
      start = { x: e.clientX, y: e.clientY, at: cur, id: e.pointerId };
      moved = false;
    };
    const move = (e: PointerEvent) => {
      if (!start || e.pointerId !== start.id) return;
      const dx = e.clientX - start.x;
      const dy = e.clientY - start.y;
      if (!moved && Math.abs(dx) + Math.abs(dy) < DRAG_SLOP) return;
      if (!moved) {
        moved = true;
        el.classList.add("is-drag");
        try {
          handle.setPointerCapture(e.pointerId);
        } catch {
          // (capture can fail on a pointer already gone)
        }
      }
      set(dragTo(start.at, dx, dy, box(), o()));
    };
    const up = () => {
      if (!start) return;
      start = null;
      if (!moved) return;
      el.classList.remove("is-drag");
      const p = nearestAnchor(cur, box(), o());
      set(p);
      write(storageKey, p);
      opts.current.onSettle?.(p);
      setTimeout(() => {
        moved = false;
      }, 0);
    };
    const click = (e: MouseEvent) => {
      if (!moved) return;
      e.preventDefault();
      e.stopPropagation();
    };
    const goHome = () => {
      const p = homePos();
      set(p);
      write(storageKey, null);
      opts.current.onSettle?.(p);
    };
    const dbl = (e: MouseEvent) => {
      if (e.target instanceof Element && e.target.closest("[data-vd-nodrag]")) return;
      goHome();
    };
    const key = (e: KeyboardEvent) => {
      if (e.target !== handle) return;
      if (e.key === "Home") {
        e.preventDefault();
        goHome();
        return;
      }
      if (!isStepKey(e.key)) return;
      const p = stepAnchor(cur, e.key, box(), o());
      if (!p) return;
      e.preventDefault();
      set(p);
      write(storageKey, p);
      opts.current.onSettle?.(p);
    };
    const resize = () => set(clampPos(cur, box(), o()));
    api.current = { home: goHome };
    handle.addEventListener("pointerdown", down);
    window.addEventListener("pointermove", move);
    window.addEventListener("pointerup", up);
    window.addEventListener("pointercancel", up);
    el.addEventListener("click", click, true);
    el.addEventListener("dblclick", dbl);
    handle.addEventListener("keydown", key);
    window.addEventListener("resize", resize);
    // (its own size changes too: the score unfolds for a play, the window is resized by its grip)
    const ro = typeof ResizeObserver === "function" ? new ResizeObserver(resize) : null;
    ro?.observe(el);
    return () => {
      ro?.disconnect();
      api.current = null;
      handle.removeEventListener("pointerdown", down);
      window.removeEventListener("pointermove", move);
      window.removeEventListener("pointerup", up);
      window.removeEventListener("pointercancel", up);
      el.removeEventListener("click", click, true);
      el.removeEventListener("dblclick", dbl);
      handle.removeEventListener("keydown", key);
      window.removeEventListener("resize", resize);
      el.classList.remove("is-drag");
    };
  }, [ref, storageKey, enabled, axis, anchors, zone]);

  return { home: () => api.current?.home() };
}
