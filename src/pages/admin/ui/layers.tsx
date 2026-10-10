// The admin's layers (v2 «Sala de control») — Dialog, Modal, ConfirmModal, Drawer, Sheet and Popover — on
// one stack.
//
// Every open layer registers on the LayerProvider's stack (an external store, so registering never sets
// React state inside an effect). The stack gives each layer its depth (z-index, scrim, `inert` when it is
// not on top) and drives the shared keyboard: Esc closes the TOP layer only, Tab / Shift+Tab cycle inside
// the top layer when it traps focus. A layer focuses itself (or `initialFocus`) when it opens — always
// with `preventScroll`, so opening never scrolls a list — and gives the focus back to whatever had it
// (the trigger) when it closes. While any modal layer is open the app behind (`appRef`) is `inert` +
// aria-hidden, and so is every layer covered by a modal one. Those attributes are set by the provider
// synchronously on every stack change (not on the next render), so the focus can go back to the trigger
// the moment a layer closes.
//
// Markup = the canvas' (stats-gen/ad-v2-full.mjs): `.scrim`, `.md` (modal: h2, `.cs` consequences, `.ac`
// buttons), `.sheet` (phones: `.gb` grab, `.hh` title row), `.drw` (drawer: `.drh`, a top slot for the
// cromo, `.fx2` body, `.ft` footer), `.picker` (the in-flow «¿Quién marcó?» panel under its row). Modal
// layers portal into the provider's host (inside the `.vx.adm` frame, after the app); an inline Drawer and
// the Popover render in place; below 1000 px the Popover is a Sheet and an inline Drawer an overlay.
import { useEffect, useId, useLayoutEffect, useRef, useState, type ReactNode, type RefObject } from "react";
import { createPortal } from "react-dom";
import { AdIcon } from "./icons";
import { useFrame } from "./frame";
import { focusablesIn, LayerContext, LayerStore, useLayer, useLayerHost, zLayer, zScrim } from "./layerCore";

/**
 * Hosts the admin's layers: the stack, the shared Esc / focus-trap keyboard and the portal host. Wrap the
 * admin frame with it (AdminLayout does); tests wrap the component under test.
 */
export function LayerProvider({ children, appRef }: { children: ReactNode; appRef?: RefObject<HTMLElement | null> }) {
  const [store] = useState(() => new LayerStore());
  const [host, setHost] = useState<HTMLDivElement | null>(null);
  const [legacyHost, setLegacyHost] = useState<HTMLDivElement | null>(null);
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
    <LayerContext.Provider value={{ store, host, legacyHost }}>
      {children}
      <div className="adm-layers" ref={setHost} />
      {/* TEMPORARY (V0): the legacy views' layers (layersV1.tsx), styled by admin-v1.css. */}
      <div className="adm-layers v1" ref={setLegacyHost} />
    </LayerContext.Provider>
  );
}


function Scrim({ depth, onClick }: { depth: number; onClick?: () => void }) {
  return <div className={depth ? "scrim hi" : "scrim"} style={{ zIndex: zScrim(depth) }} onClick={onClick} aria-hidden="true" />;
}

/** The round «×» of a layer's title row (`.ib2.x`). */
export function CloseButton({ onClick, label = "Cerrar" }: { onClick: () => void; label?: string }) {
  return (
    <button type="button" className="ib2 x" onClick={onClick} aria-label={label}>
      <AdIcon name="x" />
    </button>
  );
}

// ───────────────────────── Dialog (the base) ─────────────────────────
export interface DialogProps {
  open: boolean;
  /** Called by Esc and the scrim (wrap it with an unsaved guard when the layer holds edits). */
  onClose: () => void;
  /** The layer's own class: `md` (modal), `lpk` (the live picker), `pal` (palette), `sheet`… */
  className: string;
  /** Names the dialog: the id of its visible title… */
  labelledBy?: string;
  /** …or a label when it has none. */
  label?: string;
  describedBy?: string;
  role?: "dialog" | "alertdialog";
  children?: ReactNode;
  initialFocus?: RefObject<HTMLElement | null>;
  returnFocus?: RefObject<HTMLElement | null>;
}
/**
 * A modal layer with the canvas' look given by `className`: scrim + the panel, portalled into the layer
 * host, focus trapped, Esc / scrim close it. Modal, Sheet and the live picker are built on it; use it for
 * any other centred panel.
 */
export function Dialog(props: DialogProps) {
  return props.open ? <DialogLayer {...props} /> : null;
}
function DialogLayer({ onClose, className, labelledBy, label, describedBy, role = "dialog", children, initialFocus, returnFocus }: DialogProps) {
  const ref = useRef<HTMLDivElement>(null);
  const host = useLayerHost();
  const { depth, isTop } = useLayer({ modal: true, trap: true, onClose, ref, initialFocus, returnFocus });
  const node = (
    <>
      <Scrim depth={depth} onClick={isTop ? onClose : undefined} />
      <div ref={ref} className={className} role={role} aria-modal="true" aria-labelledby={labelledBy} aria-label={labelledBy ? undefined : label} aria-describedby={describedBy} tabIndex={-1} style={{ zIndex: zLayer(depth) }}>
        {children}
      </div>
    </>
  );
  return host ? createPortal(node, host) : null;
}

// ───────────────────────── Modal ─────────────────────────
export interface ModalProps {
  open: boolean;
  /** Called by Esc and the scrim (and usually «Cancelar» in the footer). */
  onClose: () => void;
  title: ReactNode;
  /** A lead paragraph under the title; it also describes the dialog (aria-describedby). */
  lede?: ReactNode;
  /** `dz` = destructive (its consequences get the red ⚠). */
  tone?: "" | "dz";
  /** `alertdialog` for confirmations that interrupt (deletes, unsaved changes). */
  role?: "dialog" | "alertdialog";
  children?: ReactNode;
  /** The `.ac` row (buttons, right-aligned). */
  footer?: ReactNode;
  initialFocus?: RefObject<HTMLElement | null>;
  returnFocus?: RefObject<HTMLElement | null>;
  className?: string;
}
/** `.md`: the centred modal (full width minus 16 px on phones). */
export function Modal({ open, onClose, title, lede, tone = "", role = "dialog", children, footer, initialFocus, returnFocus, className = "" }: ModalProps) {
  const tid = useId();
  const did = useId();
  return (
    <Dialog open={open} onClose={onClose} className={`md ${tone} ${className}`.replace(/\s+/g, " ").trim()} role={role} labelledBy={tid} describedBy={lede ? did : undefined} initialFocus={initialFocus} returnFocus={returnFocus}>
      <h2 id={tid}>{title}</h2>
      {lede && (
        <p className="lede" id={did}>
          {lede}
        </p>
      )}
      {children}
      {footer && <div className="ac">{footer}</div>}
    </Dialog>
  );
}

// ───────────────────────── ConfirmModal ─────────────────────────
/** What will happen, one line each (`.cs`): a ✓ — or a red ⚠ when the modal is destructive (`tone="dz"`). */
export function ConsequenceList({ items, danger = false }: { items: ReactNode[]; danger?: boolean }) {
  if (!items.length) return null;
  return (
    <ul className="cs">
      {items.map((t, i) => (
        <li key={i}>
          <AdIcon name={danger ? "alert" : "check"} size={16} />
          <span>{t}</span>
        </li>
      ))}
    </ul>
  );
}
export interface ConfirmModalProps extends Omit<ModalProps, "footer" | "role"> {
  consequences?: ReactNode[];
  confirmLabel: ReactNode;
  onConfirm: () => void;
  cancelLabel?: ReactNode;
  /** The confirm button: `sky` (default), `gold` (THE action of the moment) or `redf` (destructive, solid). */
  confirmTone?: "sky" | "gold" | "redf";
  /** aria-disabled (stays focusable): clicking does nothing. */
  confirmDisabled?: boolean;
  /** While the action runs: the confirm button reads «Un momento…» and is aria-disabled. */
  busy?: boolean;
  /** An optional third action before Cancel (e.g. «Guardar borrador y salir»). */
  alt?: { label: ReactNode; onClick: () => void };
  /** A failure to show above the buttons (role=alert). */
  error?: ReactNode;
  /** Defaults to alertdialog when the confirm is red. */
  role?: "dialog" | "alertdialog";
}
/** A modal that asks before doing something, listing what will happen (`.cs`). */
export function ConfirmModal({
  consequences = [],
  confirmLabel,
  onConfirm,
  cancelLabel = "Cancelar",
  confirmTone = "sky",
  confirmDisabled,
  busy,
  alt,
  error,
  role,
  children,
  tone,
  ...modal
}: ConfirmModalProps) {
  const off = !!confirmDisabled || !!busy;
  const danger = tone === "dz" || confirmTone === "redf";
  return (
    <Modal
      {...modal}
      tone={danger ? "dz" : ""}
      role={role ?? (confirmTone === "redf" ? "alertdialog" : "dialog")}
      footer={
        <>
          {alt && (
            <button type="button" className="btn line" onClick={alt.onClick}>
              {alt.label}
            </button>
          )}
          <button type="button" className="btn line" onClick={modal.onClose}>
            {cancelLabel}
          </button>
          <button type="button" className={`btn ${confirmTone}`} aria-disabled={off} onClick={() => !off && onConfirm()}>
            {busy ? "Un momento…" : confirmLabel}
          </button>
        </>
      }
    >
      {children}
      <ConsequenceList items={consequences} danger={danger} />
      {error && (
        <p className="ferr" role="alert">
          <AdIcon name="alert" size={15} />
          {error}
        </p>
      )}
    </Modal>
  );
}

// ───────────────────────── Sheet ─────────────────────────
export interface SheetProps {
  open: boolean;
  onClose: () => void;
  /** The `.hh` title row (with ×). Leave it out when the children bring their own header (`labelledBy` / `label`). */
  title?: ReactNode;
  /** The accent line over the title (e.g. «GOL · 31′ · paso 1 de 2»). */
  kicker?: ReactNode;
  labelledBy?: string;
  label?: string;
  footer?: ReactNode;
  children?: ReactNode;
  className?: string;
  initialFocus?: RefObject<HTMLElement | null>;
  returnFocus?: RefObject<HTMLElement | null>;
  closeLabel?: string;
}
/** `.sheet`: the phone's bottom sheet (grab, optional title row, body, footer). */
export function Sheet({ open, onClose, title, kicker, labelledBy, label, footer, children, className = "", initialFocus, returnFocus, closeLabel }: SheetProps) {
  const tid = useId();
  return (
    <Dialog open={open} onClose={onClose} className={`sheet ${className}`.trim()} labelledBy={title ? tid : labelledBy} label={label} initialFocus={initialFocus} returnFocus={returnFocus}>
      <span className="gb" aria-hidden="true" />
      {title && (
        <div className="hh">
          <span>
            {kicker && <small>{kicker}</small>}
            <b id={tid}>{title}</b>
          </span>
          <CloseButton onClick={onClose} label={closeLabel} />
        </div>
      )}
      {children}
      {footer && <div className="ft">{footer}</div>}
    </Dialog>
  );
}

// ───────────────────────── Drawer ─────────────────────────
export type StatusTone = "" | "ok" | "warn";
/** «● Cambios sin guardar» (warn) / «Guardado 12:04» — the line next to a drawer's title. */
export interface LayerStatus {
  text: ReactNode;
  tone?: StatusTone;
}
export interface DrawerProps {
  open: boolean;
  onClose: () => void;
  title: ReactNode;
  status?: LayerStatus;
  /** Between the title row and the body, not scrolling (the plantilla's cromo). */
  top?: ReactNode;
  /** The `.ft` row (buttons). */
  footer?: ReactNode;
  /** A save error shown above the footer (role=alert). */
  error?: ReactNode;
  children?: ReactNode;
  /**
   * Desktop: render in place as a column of the view (the plantilla's cajón beside the percha), not modal.
   * Below 1000 px it is always a modal overlay from the bottom.
   */
  inline?: boolean;
  initialFocus?: RefObject<HTMLElement | null>;
  returnFocus?: RefObject<HTMLElement | null>;
  className?: string;
}
/** `.drw`: a side panel (inline on desktop, or an overlay on the right) and a bottom sheet on phones. */
export function Drawer(props: DrawerProps) {
  const { desktop } = useFrame();
  if (!props.open) return null;
  return props.inline && desktop ? <InlineDrawer {...props} /> : <OverlayDrawer {...props} />;
}
function DrawerBody({ title, status, top, footer, error, children, onClose, tid }: DrawerProps & { tid: string }) {
  return (
    <>
      <div className="drh">
        <span>
          <b id={tid}>{title}</b>
          {status && (
            <small className={`svd ${status.tone ?? ""}`.trim()} role="status">
              {" · "}
              {status.text}
            </small>
          )}
        </span>
        <CloseButton onClick={onClose} />
      </div>
      {top}
      <div className="fx2">{children}</div>
      {error && (
        <p className="ferr" role="alert" style={{ padding: "0 16px" }}>
          <AdIcon name="alert" size={15} />
          {error}
        </p>
      )}
      {footer && <div className="ft">{footer}</div>}
    </>
  );
}
function InlineDrawer(props: DrawerProps) {
  const ref = useRef<HTMLElement>(null);
  const tid = useId();
  useLayer({ modal: false, trap: false, onClose: props.onClose, ref, initialFocus: props.initialFocus, returnFocus: props.returnFocus });
  return (
    <aside ref={ref} className={`drw ${props.className ?? ""}`.trim()} role="dialog" aria-labelledby={tid} tabIndex={-1}>
      <DrawerBody {...props} tid={tid} />
    </aside>
  );
}
function OverlayDrawer(props: DrawerProps) {
  const ref = useRef<HTMLElement>(null);
  const host = useLayerHost();
  const tid = useId();
  const { depth, isTop } = useLayer({ modal: true, trap: true, onClose: props.onClose, ref, initialFocus: props.initialFocus, returnFocus: props.returnFocus });
  const node = (
    <>
      <Scrim depth={depth} onClick={isTop ? props.onClose : undefined} />
      <aside ref={ref} className={`drw ovl ${props.className ?? ""}`.trim()} role="dialog" aria-modal="true" aria-labelledby={tid} tabIndex={-1} style={{ zIndex: zLayer(depth) }}>
        <DrawerBody {...props} tid={tid} />
      </aside>
    </>
  );
  return host ? createPortal(node, host) : null;
}

// ───────────────────────── Popover ─────────────────────────
export interface PopoverProps {
  open: boolean;
  onClose: () => void;
  /** The element it belongs to (and gives the focus back to): the acta's goal row button. */
  anchorRef: RefObject<HTMLElement | null>;
  /** The panel that scrolls (the row is brought to its top on open); by default the anchor's closest `.db` / `.scr`. */
  containerRef?: RefObject<HTMLElement | null>;
  /** The question (`.pkh b`), e.g. «¿Quién marcó?». Names the dialog. */
  title: ReactNode;
  /** The accent line over it (`.pkh small`), e.g. «Gol 3 (46′) · paso 1 de 2». */
  subtitle?: ReactNode;
  /** The extra buttons row (`.pkx`): «Autogol de …», «Lo completo luego». */
  footer?: ReactNode;
  children?: ReactNode;
  /** Below this frame width it is a bottom sheet (default 1000; 0 = always in place). */
  sheetBelow?: number;
  initialFocus?: RefObject<HTMLElement | null>;
  className?: string;
}
/**
 * `.picker`: a non-modal panel rendered IN PLACE, right after its anchor's row (put it there in the
 * markup); on open the row is brought to the top of its scrolling panel. Esc / a press outside close it;
 * the focus goes back to the anchor. On phones it becomes a bottom Sheet (modal).
 */
export function Popover(props: PopoverProps) {
  const { width } = useFrame();
  if (!props.open) return null;
  const sheetBelow = props.sheetBelow ?? 1000;
  if (width < sheetBelow) return <PickerSheet {...props} />;
  return <PopoverLayer {...props} />;
}
function PickerHead({ title, subtitle, onClose, tid }: { title: ReactNode; subtitle?: ReactNode; onClose: () => void; tid: string }) {
  return (
    <div className="pkh">
      <span>
        {subtitle && <small>{subtitle}</small>}
        <b id={tid}>{title}</b>
      </span>
      <CloseButton onClick={onClose} />
    </div>
  );
}
function PickerSheet({ open, onClose, anchorRef, title, subtitle, footer, children, initialFocus, className = "" }: PopoverProps) {
  const tid = useId();
  return (
    <Sheet open={open} onClose={onClose} labelledBy={tid} className={className} initialFocus={initialFocus} returnFocus={anchorRef}>
      <PickerHead title={title} subtitle={subtitle} onClose={onClose} tid={tid} />
      {children}
      {footer && <div className="pkx">{footer}</div>}
    </Sheet>
  );
}
function PopoverLayer({ onClose, anchorRef, containerRef, title, subtitle, footer, children, initialFocus, className = "" }: PopoverProps) {
  const ref = useRef<HTMLDivElement>(null);
  const tid = useId();
  useLayer({ modal: false, trap: false, onClose, ref, initialFocus, returnFocus: anchorRef });
  // The row goes to the top of its panel (12 px of air), so the picker below it is in view.
  useLayoutEffect(() => {
    const anchor = anchorRef.current;
    if (!anchor) return;
    const scroller = containerRef?.current ?? anchor.closest<HTMLElement>(".db, .scr");
    if (!scroller) return;
    const row = anchor.closest<HTMLElement>(".gr") ?? anchor;
    scroller.scrollBy?.({ top: row.getBoundingClientRect().top - scroller.getBoundingClientRect().top - 12 });
  }, [anchorRef, containerRef]);
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
    <div ref={ref} className={`picker ${className}`.trim()} role="dialog" aria-labelledby={tid} tabIndex={-1}>
      <PickerHead title={title} subtitle={subtitle} onClose={onClose} tid={tid} />
      {children}
      {footer && <div className="pkx">{footer}</div>}
    </div>
  );
}
