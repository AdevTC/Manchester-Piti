// The admin's layers — Modal, ConfirmModal, Drawer, Sheet and Popover — on one stack.
//
// Every open layer registers on the LayerProvider's stack (an external store, so registering never sets
// React state inside an effect). The stack gives each layer its depth (z-index, scrim, `inert` when it is
// not on top) and drives the shared keyboard: Esc closes the TOP layer only, Tab / Shift+Tab cycle inside
// the top layer when it traps focus. A layer focuses itself (or `initialFocus`) when it opens — always
// with `preventScroll`, so opening never scrolls a list — and gives the focus back to whatever had it
// (the trigger) when it closes. While any modal layer is open the app behind (`appRef`, the `.app`) is
// `inert` + aria-hidden, and so is every layer covered by a modal one. Those attributes are set by the
// provider synchronously on every stack change (not on the next render), so the focus can go back to
// the trigger the moment a layer closes.
//
// Layers render through a portal into the provider's host (inside the `.vx.adm` frame, after `.app`),
// except the Popover, which renders in place (anchored inside its scroll container) and turns into a
// bottom Sheet when the frame is narrower than `sheetBelow` (1000 px by default).
import { useEffect, useId, useLayoutEffect, useRef, useState, type ReactNode, type RefObject } from "react";
import { createPortal } from "react-dom";
import { AdIcon } from "./icons";
import { useFrame } from "./frame";
import { focusablesIn, LayerContext, LayerStore, useLayer, useLayerHost } from "./layerCore";

/**
 * Hosts the admin's layers: the stack, the shared Esc / focus-trap keyboard and the portal host. Wrap the
 * admin frame with it (AdminLayout does); tests wrap the component under test.
 */
export function LayerProvider({ children, appRef }: { children: ReactNode; appRef?: RefObject<HTMLElement | null> }) {
  const [store] = useState(() => new LayerStore());
  const [host, setHost] = useState<HTMLDivElement | null>(null);
  // inert + aria-hidden on the app (any modal open) and on each layer covered by a modal one.
  useLayoutEffect(() => {
    const mark = (el: HTMLElement | null | undefined, on: boolean) => {
      if (!el) return;
      el.toggleAttribute("inert", on);
      if (on) el.setAttribute("aria-hidden", "true");
      else el.removeAttribute("aria-hidden");
    };
    const apply = () => {
      const list = store.getSnapshot();
      mark(appRef?.current, list.some((e) => e.modal));
      list.forEach((e, i) => mark(e.el(), list.slice(i + 1).some((x) => x.modal)));
    };
    apply();
    return store.subscribe(apply);
  }, [store, appRef]);
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const top = store.top();
      if (!top || e.defaultPrevented) return;
      if (e.key === "Escape") {
        e.preventDefault();
        top.close();
        return;
      }
      if (e.key !== "Tab" || !top.trap) return;
      const el = top.el();
      if (!el) return;
      const f = focusablesIn(el);
      if (!f.length) {
        e.preventDefault();
        el.focus({ preventScroll: true });
        return;
      }
      const first = f[0];
      const last = f[f.length - 1];
      const active = document.activeElement;
      if (!el.contains(active)) {
        e.preventDefault();
        (e.shiftKey ? last : first).focus({ preventScroll: true });
      } else if (e.shiftKey && (active === first || active === el)) {
        e.preventDefault();
        last.focus({ preventScroll: true });
      } else if (!e.shiftKey && active === last) {
        e.preventDefault();
        first.focus({ preventScroll: true });
      }
    };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [store]);
  return (
    <LayerContext.Provider value={{ store, host }}>
      {children}
      <div className="adm-layers" ref={setHost} />
    </LayerContext.Provider>
  );
}

/** z-index per depth: the scrim of a layer sits right under it, so a modal over a drawer dims the drawer. */
const zLayer = (depth: number) => 21 + depth * 2;
const zScrim = (depth: number) => 20 + depth * 2;

function Scrim({ depth, onClick }: { depth: number; onClick?: () => void }) {
  return <div className={depth ? "scrim hi" : "scrim"} style={{ zIndex: zScrim(depth) }} onClick={onClick} aria-hidden="true" />;
}

function CloseButton({ onClick, label = "Cerrar" }: { onClick: () => void; label?: string }) {
  return (
    <button type="button" className="ib" onClick={onClick} aria-label={label}>
      <AdIcon name="x" />
    </button>
  );
}

export type StatusTone = "" | "ok" | "warn";
/** «✓ Guardado 12:04 · hora de Madrid» / «● Cambios sin guardar» — the `.svd` line under a title. */
export interface LayerStatus {
  text: ReactNode;
  tone?: StatusTone;
}

// ───────────────────────── Modal ─────────────────────────
export interface ModalProps {
  open: boolean;
  /** Called by the X, Esc and the scrim (wrap it with an unsaved guard when the modal holds edits). */
  onClose: () => void;
  title: ReactNode;
  kicker?: ReactNode;
  /** The lead paragraph (`.lede`); it also describes the dialog (aria-describedby). */
  lede?: ReactNode;
  /** `red` = destructive (red outline). */
  tone?: "" | "red";
  /** `alertdialog` for confirmations that interrupt (deletes, unsaved changes). */
  role?: "dialog" | "alertdialog";
  children?: ReactNode;
  /** The `.ov-f` row (buttons). */
  footer?: ReactNode;
  initialFocus?: RefObject<HTMLElement | null>;
  returnFocus?: RefObject<HTMLElement | null>;
  className?: string;
}
/** `.ovl.mdl`: a centred modal (full width on phones), scale + spring in. */
export function Modal(props: ModalProps) {
  return props.open ? <ModalLayer {...props} /> : null;
}
function ModalLayer({ onClose, title, kicker, lede, tone = "", role = "dialog", children, footer, initialFocus, returnFocus, className = "" }: ModalProps) {
  const ref = useRef<HTMLDivElement>(null);
  const host = useLayerHost();
  const { depth, isTop } = useLayer({ modal: true, trap: true, onClose, ref, initialFocus, returnFocus });
  const tid = useId();
  const did = useId();
  const node = (
    <>
      <Scrim depth={depth} onClick={isTop ? onClose : undefined} />
      <div
        ref={ref}
        className={`ovl mdl ${tone} ${className}`.replace(/\s+/g, " ").trim()}
        role={role}
        aria-modal="true"
        aria-labelledby={tid}
        aria-describedby={lede ? did : undefined}
        tabIndex={-1}
        style={{ zIndex: zLayer(depth) }}
      >
        <div className="ov-h">
          <div className="t">
            {kicker && (
              <p className="kk">
                <i />
                {kicker}
              </p>
            )}
            <h2 className="h2s" id={tid}>
              {title}
            </h2>
          </div>
          <CloseButton onClick={onClose} />
        </div>
        <div className="ov-b scr">
          {lede && (
            <p className="lede" id={did}>
              {lede}
            </p>
          )}
          {children}
        </div>
        {footer && <div className="ov-f">{footer}</div>}
      </div>
    </>
  );
  return host ? createPortal(node, host) : null;
}

// ───────────────────────── ConfirmModal ─────────────────────────
/** A consequence line: `r` = se pierde / afecta (⚠), `o` = se conserva (✓), `g` = aviso dorado (i), `` = info (i). */
export interface Consequence {
  tone: "r" | "o" | "g" | "";
  text: ReactNode;
}
export function ConsequenceList({ items }: { items: Consequence[] }) {
  if (!items.length) return null;
  return (
    <ul className="csq">
      {items.map((c, i) => (
        <li key={i} className={c.tone}>
          <AdIcon name={c.tone === "o" ? "check" : c.tone === "r" ? "alert" : "info"} size={14} />
          <span>{c.text}</span>
        </li>
      ))}
    </ul>
  );
}
export interface ConfirmModalProps extends Omit<ModalProps, "footer" | "role"> {
  consequences?: Consequence[];
  confirmLabel: ReactNode;
  onConfirm: () => void;
  cancelLabel?: ReactNode;
  /** The confirm button's look: `pri` (default), `gold`, `red` (outline) or `red solid`. */
  confirmTone?: "pri" | "gold" | "red" | "red solid";
  /** aria-disabled (stays focusable): clicking does nothing. */
  confirmDisabled?: boolean;
  /** While the action runs: the confirm button reads «…» and is aria-disabled. */
  busy?: boolean;
  /** An optional third action before Cancel (e.g. «Guardar borrador y salir»). */
  alt?: { label: ReactNode; onClick: () => void };
  /** A failure to show above the buttons (role=alert). */
  error?: ReactNode;
  /** Defaults to alertdialog when the confirm is red. */
  role?: "dialog" | "alertdialog";
}
/** A modal that asks before doing something, listing what will happen (`.csq`). */
export function ConfirmModal({
  consequences = [],
  confirmLabel,
  onConfirm,
  cancelLabel = "Cancelar",
  confirmTone = "pri",
  confirmDisabled,
  busy,
  alt,
  error,
  role,
  children,
  ...modal
}: ConfirmModalProps) {
  const off = !!confirmDisabled || !!busy;
  return (
    <Modal
      {...modal}
      role={role ?? (confirmTone.startsWith("red") ? "alertdialog" : "dialog")}
      footer={
        <>
          {error && (
            <p className="note ad-ferr" role="alert">
              <AdIcon name="alert" size={15} />
              {error}
            </p>
          )}
          {alt && (
            <button type="button" className="btn sm line" onClick={alt.onClick}>
              {alt.label}
            </button>
          )}
          <button type="button" className="btn sm line" onClick={modal.onClose}>
            {cancelLabel}
          </button>
          <button type="button" className={`btn sm ${confirmTone}`} aria-disabled={off} onClick={() => !off && onConfirm()}>
            {busy ? "Un momento…" : confirmLabel}
          </button>
        </>
      }
    >
      {children}
      <ConsequenceList items={consequences} />
    </Modal>
  );
}

// ───────────────────────── Drawer ─────────────────────────
export interface DrawerProps {
  open: boolean;
  onClose: () => void;
  title: ReactNode;
  kicker?: ReactNode;
  /** The save state under the title (`.svd`). */
  status?: LayerStatus;
  footer?: ReactNode;
  /** A save error shown in the footer (role=alert). */
  error?: ReactNode;
  children?: ReactNode;
  initialFocus?: RefObject<HTMLElement | null>;
  returnFocus?: RefObject<HTMLElement | null>;
  className?: string;
}
/** `.ovl.drw`: a 480 px panel from the right on desktop, a bottom sheet (with grab) on phones. */
export function Drawer(props: DrawerProps) {
  return props.open ? <DrawerLayer {...props} /> : null;
}
function DrawerLayer({ onClose, title, kicker, status, footer, error, children, initialFocus, returnFocus, className = "" }: DrawerProps) {
  const ref = useRef<HTMLElement>(null);
  const host = useLayerHost();
  const { depth, isTop } = useLayer({ modal: true, trap: true, onClose, ref, initialFocus, returnFocus });
  const tid = useId();
  const node = (
    <>
      <Scrim depth={depth} onClick={isTop ? onClose : undefined} />
      <aside
        ref={ref}
        className={`ovl drw ${className}`.trim()}
        role="dialog"
        aria-modal="true"
        aria-labelledby={tid}
        tabIndex={-1}
        style={{ zIndex: zLayer(depth) }}
      >
        <div className="ov-h">
          <span className="grab" aria-hidden="true" />
          <div className="t">
            {kicker && (
              <p className="kk">
                <i />
                {kicker}
              </p>
            )}
            <h2 className="h2s" id={tid}>
              {title}
            </h2>
          </div>
          <CloseButton onClick={onClose} />
          {status && (
            <p className={`svd ${status.tone ?? ""}`.trim()} role="status">
              {status.text}
            </p>
          )}
        </div>
        <div className="ov-b scr">{children}</div>
        {(footer || error) && (
          <div className="ov-f">
            {error && (
              <p className="note ad-ferr" role="alert">
                <AdIcon name="alert" size={15} />
                {error}
              </p>
            )}
            {footer}
          </div>
        )}
      </aside>
    </>
  );
  return host ? createPortal(node, host) : null;
}

// ───────────────────────── Sheet ─────────────────────────
export interface SheetProps {
  open: boolean;
  onClose: () => void;
  title: ReactNode;
  kicker?: ReactNode;
  footer?: ReactNode;
  children?: ReactNode;
  /** Extra class on `.ovl.sht` (`mas` = the «Más» sheet, `pks` = the scorer picker). */
  className?: string;
  /** Extra class on the body (`.ov-b.scr`). */
  bodyClassName?: string;
  initialFocus?: RefObject<HTMLElement | null>;
  returnFocus?: RefObject<HTMLElement | null>;
  closeLabel?: string;
}
/** `.ovl.sht`: a bottom sheet (grab, title, close) — the phone's way to show a menu or a picker. */
export function Sheet(props: SheetProps) {
  return props.open ? <SheetLayer {...props} /> : null;
}
function SheetLayer({ onClose, title, kicker, footer, children, className = "", bodyClassName = "", initialFocus, returnFocus, closeLabel }: SheetProps) {
  const ref = useRef<HTMLDivElement>(null);
  const host = useLayerHost();
  const { depth, isTop } = useLayer({ modal: true, trap: true, onClose, ref, initialFocus, returnFocus });
  const tid = useId();
  const node = (
    <>
      <Scrim depth={depth} onClick={isTop ? onClose : undefined} />
      <div
        ref={ref}
        className={`ovl sht ${className}`.trim()}
        role="dialog"
        aria-modal="true"
        aria-labelledby={tid}
        tabIndex={-1}
        style={{ zIndex: zLayer(depth) }}
      >
        <div className="ov-h">
          <span className="grab" aria-hidden="true" />
          <div className="t">
            {kicker && (
              <p className="kk">
                <i />
                {kicker}
              </p>
            )}
            <h2 className="h2s" id={tid}>
              {title}
            </h2>
          </div>
          <CloseButton onClick={onClose} label={closeLabel} />
        </div>
        <div className={`ov-b scr ${bodyClassName}`.trim()}>{children}</div>
        {footer && <div className="ov-f">{footer}</div>}
      </div>
    </>
  );
  return host ? createPortal(node, host) : null;
}

// ───────────────────────── Popover ─────────────────────────
export interface PopoverProps {
  open: boolean;
  onClose: () => void;
  /** The element it points at (and gives the focus back to). */
  anchorRef: RefObject<HTMLElement | null>;
  /** The scroll container it must stay inside; by default the anchor's closest `.scr`. */
  containerRef?: RefObject<HTMLElement | null>;
  /** `.pk-h` title (popover) / sheet title (phones). Names the dialog. */
  title: ReactNode;
  /** `.pk-h small` (popover) / the accent `.lbl` line (sheet), e.g. «Paso 1 de 2 · goleador». */
  subtitle?: ReactNode;
  /** Sheet kicker on phones, e.g. «Acta · J7 · 3–1». */
  kicker?: ReactNode;
  /** `.pk-x` row (popover) / `.ov-f` (sheet). */
  footer?: ReactNode;
  children?: ReactNode;
  /** Below this frame width it is a bottom sheet (default 1000; 0 = always a popover). */
  sheetBelow?: number;
  /** Gap between the anchor and the popover, px (default 12). */
  gap?: number;
  initialFocus?: RefObject<HTMLElement | null>;
  className?: string;
}
/**
 * `.pop`: a dialog anchored under (or, when there is no room, over) its anchor, kept inside its scroll
 * container WITHOUT scrolling it; re-placed when the container scrolls or resizes. Render it inside a
 * `position: relative` wrapper as wide as the popover should be (the acta: `.ac-main`). Esc / a click
 * outside close it; the focus goes back to the anchor. On phones it becomes a bottom Sheet.
 */
export function Popover(props: PopoverProps) {
  const { width } = useFrame();
  if (!props.open) return null;
  const sheetBelow = props.sheetBelow ?? 1000;
  if (width < sheetBelow) {
    return (
      <Sheet
        open
        onClose={props.onClose}
        title={props.title}
        kicker={props.kicker}
        footer={props.footer}
        className={`pks ${props.className ?? ""}`.trim()}
        bodyClassName="pk ad-pk-sheet"
        initialFocus={props.initialFocus}
        returnFocus={props.anchorRef}
      >
        {props.subtitle && <p className="lbl ad-pk-step">{props.subtitle}</p>}
        {props.children}
      </Sheet>
    );
  }
  return <PopoverLayer {...props} />;
}
function PopoverLayer({ onClose, anchorRef, containerRef, title, subtitle, footer, children, gap = 12, initialFocus, className = "" }: PopoverProps) {
  const ref = useRef<HTMLDivElement>(null);
  useLayer({ modal: false, trap: false, onClose, ref, initialFocus, returnFocus: anchorRef });
  const tid = useId();
  useLayoutEffect(() => {
    const pop = ref.current;
    const anchor = anchorRef.current;
    if (!pop || !anchor) return;
    const scroller = containerRef?.current ?? anchor.closest<HTMLElement>(".scr");
    const place = () => {
      const parent = (pop.offsetParent as HTMLElement | null) ?? pop.parentElement;
      if (!parent) return;
      const a = anchor.getBoundingClientRect();
      const p = parent.getBoundingClientRect();
      const view = scroller ? scroller.getBoundingClientRect() : { top: 0, bottom: window.innerHeight };
      pop.style.maxHeight = "";
      const h = pop.offsetHeight;
      const below = view.bottom - a.bottom - gap - 8;
      const above = a.top - view.top - gap - 8;
      const up = below < h && above > below;
      const room = up ? above : below;
      if (h > room && room > 0) {
        pop.style.maxHeight = `${Math.max(160, room)}px`;
        pop.style.overflow = "auto";
      }
      const height = Math.min(h, pop.offsetHeight);
      pop.style.top = `${up ? a.top - p.top - gap - height : a.bottom - p.top + gap}px`;
      pop.style.setProperty("--ad-arrow", `${Math.max(16, Math.min(p.width - 30, a.left + a.width / 2 - p.left - 7))}px`);
      pop.classList.toggle("up", up);
      pop.style.visibility = "visible";
    };
    place();
    const ro = typeof ResizeObserver !== "undefined" ? new ResizeObserver(place) : null;
    ro?.observe(pop);
    if (scroller) ro?.observe(scroller);
    scroller?.addEventListener("scroll", place, { passive: true });
    window.addEventListener("resize", place);
    return () => {
      ro?.disconnect();
      scroller?.removeEventListener("scroll", place);
      window.removeEventListener("resize", place);
    };
  }, [anchorRef, containerRef, gap]);
  // A press outside (and not on the anchor, which toggles it itself) closes it.
  useEffect(() => {
    const onDown = (e: PointerEvent) => {
      const t = e.target as Node | null;
      if (!t || ref.current?.contains(t) || anchorRef.current?.contains(t)) return;
      onClose();
    };
    document.addEventListener("pointerdown", onDown);
    return () => document.removeEventListener("pointerdown", onDown);
  }, [anchorRef, onClose]);
  return (
    <div ref={ref} className={`pop ${className}`.trim()} role="dialog" aria-labelledby={tid} tabIndex={-1}>
      <div className="pk-h">
        <b id={tid}>{title}</b>
        {subtitle && <small>{subtitle}</small>}
      </div>
      {children}
      {footer && <div className="pk-x">{footer}</div>}
    </div>
  );
}
