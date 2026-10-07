// The board's hands: one pointer controller (mouse, touch and pen) for dragging cromos from the pitch
// and the bench (magnetic ghost slots + swap arc), the línea defensiva, the sheet's handle, and the
// long-press. While a finger moves, only the dragged element's style changes (no re-render per frame);
// everything it touched is put back before the drop is turned into a lineup change.
import { useEffect, useRef, type PointerEvent as ReactPointerEvent, type RefObject } from "react";
import { CAMS, proj, unproj, nearestLine, type CamName } from "./geometry";
import { CLICK_GUARD_MS, DRAG_SLOP, LONG_PRESS_MS, pickMagnet, swapArc, tilt, type Magnet } from "./drag";
import type { DragSource, DropTarget } from "./ops";
import { dragHeight, SNAP_H, type Snap } from "./sheet";
import type { Lineup } from "../formations";
import { slotPos } from "./geometry";

export interface DragState {
  lineup: Lineup;
  cam: CamName;
  snap: Snap;
  /** Cromos can be moved (editing mode, an editable board, loaded). */
  canMove: boolean;
  /** The línea defensiva can be moved. */
  canLine: boolean;
  /** Ghost slots exist (system mode, editing). */
  magnets: boolean;
}

export interface DragHandlers {
  onStart: (kind: "tok" | "line", id: string | null, from: DragSource["from"] | null) => void;
  onEnd: () => void;
  onDrop: (src: DragSource, target: DropTarget | null, at: [number, number] | null) => void;
  onLongPress: (id: string, from: DragSource["from"], el: Element) => void;
  onLine: (value: string | null) => void;
  onGrab: (height: number, velocity: number, full: number) => void;
  onBaja: () => void;
}

interface Refs {
  root: RefObject<HTMLDivElement | null>;
  frame: RefObject<HTMLDivElement | null>;
  sheet: RefObject<HTMLElement | null>;
  layer: RefObject<HTMLDivElement | null>;
  swp: RefObject<SVGPathElement | null>;
}

type Drag =
  | { kind: "grab"; y0: number; lastY: number; lastT: number; v: number; on: boolean; start: number; full: number; sh: number }
  | { kind: "line"; el: HTMLElement; y0: number; on: boolean; val: string | null }
  | {
      kind: "tok";
      el: HTMLElement;
      id: string;
      from: DragSource["from"];
      i0: number;
      x0: number;
      y0: number;
      lx: number;
      on: boolean;
      mag: number | null;
      ghost: HTMLElement | null;
    };

/** Inline styles, attributes and text the drag overrode, to put back exactly (React keeps owning them). */
class Restore {
  private saved: [HTMLElement | SVGElement, string, string][] = [];
  private attrs: [Element, string, string | null][] = [];
  private texts: [Text, string][] = [];
  set(el: HTMLElement | SVGElement, prop: string, value: string) {
    if (!this.saved.some(([e, p]) => e === el && p === prop)) this.saved.push([el, prop, el.style.getPropertyValue(prop)]);
    el.style.setProperty(prop, value);
  }
  attr(el: Element, name: string, value: string) {
    if (!this.attrs.some(([e, n]) => e === el && n === name)) this.attrs.push([el, name, el.getAttribute(name)]);
    el.setAttribute(name, value);
  }
  /** Change a text in place (the same node React rendered, so React can still update it). */
  text(node: Text, value: string) {
    if (!this.texts.some(([t]) => t === node)) this.texts.push([node, node.nodeValue ?? ""]);
    node.nodeValue = value;
  }
  undo() {
    this.texts.forEach(([t, v]) => (t.nodeValue = v));
    this.texts = [];
    this.saved.forEach(([el, prop, v]) => (v ? el.style.setProperty(prop, v) : el.style.removeProperty(prop)));
    this.attrs.forEach(([el, name, v]) => (v == null ? el.removeAttribute(name) : el.setAttribute(name, v)));
    this.saved = [];
    this.attrs = [];
  }
}

export function useDragController(refs: Refs, state: DragState, h: DragHandlers) {
  // Latest values for the window listeners (written after each render).
  const latest = useRef({ state, h });
  useEffect(() => {
    latest.current = { state, h };
  });
  const drag = useRef<Drag | null>(null);
  const lpTimer = useRef(0);
  const guardUntil = useRef(0);
  const restore = useRef(new Restore());
  const hovEl = useRef<Element | null>(null);
  const detach = useRef<(() => void) | null>(null);

  useEffect(
    () => () => {
      window.clearTimeout(lpTimer.current);
      detach.current?.();
    },
    [],
  );

  /** True right after a drag or a long press: the click it produces must not count as a tap. */
  const guarded = () => Date.now() < guardUntil.current;
  const guard = () => (guardUntil.current = Date.now() + CLICK_GUARD_MS);

  const framePoint = (x: number, y: number) => {
    const fe = refs.frame.current;
    if (!fe) return null;
    const r = fe.getBoundingClientRect();
    if (!r.width || !r.height) return null;
    const X = ((x - r.left) / r.width) * 100;
    const Y = ((y - r.top) / r.height) * 100;
    return { X, Y, inside: X >= 0 && X <= 100 && Y >= 0 && Y <= 100, r };
  };
  const hover = (el: Element | null) => {
    if (hovEl.current === el) return;
    hovEl.current?.classList.remove("hov");
    hovEl.current = el;
    el?.classList.add("hov");
  };
  const under = (x: number, y: number, me: HTMLElement): Element | null => {
    const prev = me.style.getPropertyValue("pointer-events");
    me.style.setProperty("pointer-events", "none");
    const u = typeof document.elementFromPoint === "function" ? document.elementFromPoint(x, y) : null;
    if (prev) me.style.setProperty("pointer-events", prev);
    else me.style.removeProperty("pointer-events");
    return u;
  };
  const clearMag = () => {
    refs.root.current?.querySelectorAll(".gs.mg").forEach((g) => g.classList.remove("mg"));
    if (refs.swp.current) {
      refs.swp.current.style.removeProperty("d");
      refs.swp.current.removeAttribute("d");
    }
  };
  const cleanup = () => {
    window.clearTimeout(lpTimer.current);
    refs.root.current?.querySelectorAll(".lp").forEach((x) => x.classList.remove("lp"));
    const d = drag.current;
    if (d?.kind === "tok") {
      d.el.classList.remove("drag", "snapd", "lift");
      d.ghost?.remove();
    }
    if (d?.kind === "grab" && refs.sheet.current) {
      refs.sheet.current.classList.remove("drg");
      refs.sheet.current.style.removeProperty("transform");
    }
    restore.current.undo();
    clearMag();
    hover(null);
    drag.current = null;
    detach.current?.();
    detach.current = null;
  };

  const move = (e: PointerEvent) => {
    const d = drag.current;
    if (!d) return;
    const { state: st } = latest.current;
    const C = CAMS[st.cam];
    if (d.kind === "grab") {
      const dy = e.clientY - d.y0;
      if (!d.on && Math.abs(dy) < 4) return;
      d.on = true;
      const now = Date.now();
      d.v = (e.clientY - d.lastY) / Math.max(1, now - d.lastT);
      d.lastY = e.clientY;
      d.lastT = now;
      d.sh = dragHeight(d.start, dy, d.full);
      const sh = refs.sheet.current;
      if (sh) {
        sh.classList.add("drg");
        sh.style.setProperty("transform", `translateY(${d.full - d.sh}px)`);
      }
      e.preventDefault();
      return;
    }
    if (d.kind === "line") {
      const q = framePoint(e.clientX, e.clientY);
      if (!q) return;
      if (!d.on && Math.abs(e.clientY - d.y0) < 4) return;
      if (!d.on) {
        d.on = true;
        latest.current.h.onStart("line", null, null);
      }
      const v = Math.max(50, Math.min(90, unproj(C, 50, q.Y).v));
      const a = proj(C, 0, v);
      const b = proj(C, 100, v);
      restore.current.set(d.el, "--y", a.y.toFixed(2));
      restore.current.set(d.el, "--x", (b.x - 0.5).toFixed(2));
      const dl = refs.root.current?.querySelector<SVGPathElement>(".dline");
      if (dl) {
        const path = `M${(a.x * 10).toFixed(1)} ${(a.y * 10).toFixed(1)}L${(b.x * 10).toFixed(1)} ${(b.y * 10).toFixed(1)}`;
        restore.current.set(dl, "d", `path('${path}')`);
        restore.current.attr(dl, "d", path);
      }
      d.val = nearestLine(st.lineup, v);
      const tn = d.el.querySelector("span")?.firstChild;
      if (tn && tn.nodeType === Node.TEXT_NODE) restore.current.text(tn as Text, "LÍNEA " + d.val.toUpperCase());
      e.preventDefault();
      return;
    }
    const dx = e.clientX - d.x0;
    const dy = e.clientY - d.y0;
    if (!d.on && Math.hypot(dx, dy) < DRAG_SLOP) return;
    if (!d.on) {
      d.on = true;
      window.clearTimeout(lpTimer.current);
      d.el.classList.remove("lp");
      d.el.classList.add("drag");
      if (d.from === "bench") {
        // The album cromo travels as a copy over the whole app (the sheet would clip it).
        const layer = refs.layer.current;
        const host = layer?.parentElement;
        if (layer && host) {
          const r = d.el.getBoundingClientRect();
          const hr = host.getBoundingClientRect();
          const g = d.el.cloneNode(true) as HTMLElement;
          g.removeAttribute("data-tok");
          g.removeAttribute("id");
          g.setAttribute("aria-hidden", "true");
          g.classList.add("drag", "ac-ghost");
          g.style.setProperty("left", r.left - hr.left + "px");
          g.style.setProperty("top", r.top - hr.top + "px");
          g.style.setProperty("width", r.width + "px");
          layer.appendChild(g);
          d.ghost = g;
          d.el.classList.add("lift");
        }
      }
      latest.current.h.onStart("tok", d.id, d.from);
    }
    const q = framePoint(e.clientX, e.clientY);
    let mag: number | null = null;
    if (q?.inside && st.magnets) {
      const magnets: Magnet[] = st.lineup.slots.map((_, i) => {
        const p = slotPos(st.lineup, i);
        const s = proj(C, p.u, p.v);
        return { i, x: q.r.left + (s.x / 100) * q.r.width, y: q.r.top + (s.y / 100) * q.r.height };
      });
      mag = pickMagnet(e.clientX, e.clientY, magnets);
    }
    clearMag();
    d.mag = mag;
    if (mag != null) refs.root.current?.querySelector(`.gs[data-gs="${mag}"]`)?.classList.add("mg");
    if (d.from === "pitch") {
      restore.current.set(d.el, "animation", "none");
      if (mag != null) {
        const p = slotPos(st.lineup, mag);
        const s = proj(C, p.u, p.v);
        d.el.classList.add("snapd");
        restore.current.set(d.el, "--x", s.x.toFixed(2));
        restore.current.set(d.el, "--y", s.y.toFixed(2));
      } else if (q) {
        d.el.classList.remove("snapd");
        restore.current.set(d.el, "--x", q.X.toFixed(2));
        restore.current.set(d.el, "--y", (q.Y + 4).toFixed(2));
      }
      restore.current.set(d.el, "--tl", tilt(e.clientX - d.lx).toFixed(1) + "deg");
      d.lx = e.clientX;
      // Swap arc: the cromo living in the target slot will fly to where this one came from.
      const occ = mag != null ? st.lineup.slots[mag]?.playerId : null;
      if (refs.swp.current && mag != null && occ && occ !== d.id && d.i0 >= 0) {
        const arc = swapArc(C, slotPos(st.lineup, mag), slotPos(st.lineup, d.i0));
        refs.swp.current.style.setProperty("d", `path('${arc}')`);
        refs.swp.current.setAttribute("d", arc);
      }
    } else if (d.ghost) {
      d.ghost.style.setProperty("translate", `${dx}px ${dy}px`);
    }
    const u = under(e.clientX, e.clientY, d.ghost ?? d.el);
    const tg = u && (u.closest(".cd[data-tok]") || u.closest("[data-slot]"));
    hover(tg && tg !== d.el ? tg : null);
    e.preventDefault();
  };

  const up = (e: PointerEvent) => {
    window.clearTimeout(lpTimer.current);
    const d = drag.current;
    const { h: hh } = latest.current;
    if (!d) return cleanup();
    if (d.kind === "grab") {
      const on = d.on;
      cleanup();
      if (!on) return;
      guard();
      hh.onGrab(d.sh, d.v, d.full);
      return;
    }
    if (d.kind === "line") {
      const { on, val } = d;
      cleanup();
      hh.onEnd();
      if (!on) return;
      guard();
      hh.onLine(val);
      return;
    }
    if (!d.on) return cleanup();
    guard();
    const u = under(e.clientX, e.clientY, d.ghost ?? d.el);
    const pt = framePoint(e.clientX, e.clientY);
    const tok = u?.closest("[data-tok]");
    const sl = u?.closest("[data-slot]");
    const be = u?.closest("[data-bench]");
    const tokZone = tok?.getAttribute("data-zone");
    let t: DropTarget | null = null;
    if (d.mag != null) t = { k: "gslot", i: d.mag };
    else if (tok && tok !== d.el && tokZone !== "x") t = { k: "tok", id: tok.getAttribute("data-tok") ?? "", from: tokZone === "p" ? "pitch" : "bench" };
    else if (sl) t = { k: "slot", i: Number(sl.getAttribute("data-slot")) };
    else if (be) t = { k: "bench" };
    else if (pt?.inside) {
      const p = unproj(CAMS[latest.current.state.cam], pt.X, pt.Y + 4);
      t = { k: "pitch", u: p.u, v: p.v };
    }
    const at: [number, number] | null = d.from === "pitch" && pt ? [+pt.X.toFixed(2), +(pt.Y + 4).toFixed(2)] : null;
    const src: DragSource = { id: d.id, from: d.from };
    cleanup();
    hh.onEnd();
    hh.onDrop(src, t, at);
  };

  const cancel = () => {
    const was = drag.current;
    cleanup();
    if (was && was.kind !== "grab" && was.on) latest.current.h.onEnd();
  };

  const attach = () => {
    detach.current?.();
    window.addEventListener("pointermove", move, { passive: false });
    window.addEventListener("pointerup", up);
    window.addEventListener("pointercancel", cancel);
    detach.current = () => {
      window.removeEventListener("pointermove", move);
      window.removeEventListener("pointerup", up);
      window.removeEventListener("pointercancel", cancel);
    };
  };

  const onPointerDown = (e: ReactPointerEvent<HTMLElement>) => {
    if (e.button > 0 || drag.current) return;
    const { state: st, h: hh } = latest.current;
    const target = e.target as Element;
    const grab = target.closest("[data-grab]");
    if (grab && refs.sheet.current) {
      const full = refs.sheet.current.offsetHeight || SNAP_H.full;
      const start = st.snap === "full" ? full : Math.min(SNAP_H[st.snap], full);
      drag.current = { kind: "grab", y0: e.clientY, lastY: e.clientY, lastT: Date.now(), v: 0, on: false, start, full, sh: start };
      attach();
      return;
    }
    const dl = target.closest<HTMLElement>("[data-dline]");
    if (dl) {
      if (!st.canLine) return;
      drag.current = { kind: "line", el: dl, y0: e.clientY, on: false, val: null };
      attach();
      return;
    }
    const tk = target.closest<HTMLElement>("[data-tok]");
    if (!tk || !refs.root.current?.contains(tk)) return;
    const zone = tk.getAttribute("data-zone");
    if (zone === "x") {
      if (st.canMove) hh.onBaja();
      return;
    }
    if (!st.canMove) return;
    const id = tk.getAttribute("data-tok") ?? "";
    const from: DragSource["from"] = zone === "p" ? "pitch" : "bench";
    drag.current = { kind: "tok", el: tk, id, from, i0: from === "pitch" ? st.lineup.slots.findIndex((s) => s.playerId === id) : -1, x0: e.clientX, y0: e.clientY, lx: e.clientX, on: false, mag: null, ghost: null };
    tk.classList.add("lp");
    window.clearTimeout(lpTimer.current);
    lpTimer.current = window.setTimeout(() => {
      const d = drag.current;
      if (!d || d.kind !== "tok" || d.on || d.id !== id) return;
      cleanup();
      guard();
      latest.current.h.onLongPress(id, from, from === "pitch" ? (tk.querySelector(".cc") ?? tk) : tk);
    }, LONG_PRESS_MS);
    attach();
  };

  return { onPointerDown, guarded };
}
