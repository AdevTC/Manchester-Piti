// The sala's layer stack and its one confirmation, ConfirmModal.
//
// Every open layer (the sala's sheet, the account and match menus, the palette…) registers on the LayerProvider's
// stack (an external store, so registering never sets React state inside an effect). The stack gives each layer
// its depth and drives the shared keyboard: Esc closes the TOP layer only, Tab / Shift+Tab cycle inside the top
// layer when it traps focus. A layer focuses itself (or `initialFocus`) when it opens — always with
// `preventScroll`, so opening never scrolls a list — and gives the focus back to whatever had it (the trigger)
// when it closes. While any modal layer is open the app behind (`appRef`) is `inert` + aria-hidden, and so is
// every layer covered by a modal one. Those attributes are set by the provider synchronously on every stack change
// (not on the next render), so the focus can go back to the trigger the moment a layer closes.
//
// ConfirmModal asks before doing something, saying what will happen: it is the sala's sheet (SalaSheet), centred
// on the desktop, as an alertdialog («¿Salir sin guardar?», «¿Salir en este dispositivo?», archivar / borrar un
// partido). Vidrio: the buttons are glass, the confirmation the one primary; a destructive one says so in a word
// and an icon, not only in its colour.
import { useEffect, useId, useLayoutEffect, useState, type ReactNode, type RefObject } from "react";
import { SalaSheet } from "../shell/Sheet";
import { focusablesIn, LayerContext, LayerStore } from "./layerCore";

/**
 * Hosts the sala's layers: the stack, the shared Esc / focus-trap keyboard and the portal host. Wrap the sala's
 * frame with it (AdminLayout does); tests wrap the component under test.
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
      <div className="sc-layers" ref={setHost} />
    </LayerContext.Provider>
  );
}

/** The warning mark of a destructive confirmation and of its error line (with the word beside it, never alone). */
function Warn() {
  return (
    <svg className="sc-confirm__warn" viewBox="0 0 24 24" width="18" height="18" aria-hidden="true" focusable="false">
      <path d="M12 3.5 22 20.5H2L12 3.5Z" fill="none" stroke="currentColor" strokeWidth="2" strokeLinejoin="round" />
      <path d="M12 10v4.5" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" />
      <circle cx="12" cy="17.4" r="1.25" fill="currentColor" />
    </svg>
  );
}
function Tick() {
  return (
    <svg className="sc-confirm__tick" viewBox="0 0 24 24" width="16" height="16" aria-hidden="true" focusable="false">
      <path d="m5 12.5 4.2 4.2L19 7" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

/** What will happen, one line each: a ✓ — or a warning mark when the confirmation is destructive. */
export function ConsequenceList({ items, danger = false }: { items: ReactNode[]; danger?: boolean }) {
  if (!items.length) return null;
  return (
    <ul className="sc-confirm__cs">
      {items.map((t, i) => (
        <li key={i}>
          {danger ? <Warn /> : <Tick />}
          <span>{t}</span>
        </li>
      ))}
    </ul>
  );
}

export interface ConfirmModalProps {
  open: boolean;
  /** Called by Esc, the scrim, «Cerrar» and «Cancelar». */
  onClose: () => void;
  title: ReactNode;
  /** A lead line under the title; it also describes the dialog (aria-describedby). */
  lede?: ReactNode;
  /** `dz` = destructive (its consequences get the warning mark). */
  tone?: "" | "dz";
  consequences?: ReactNode[];
  confirmLabel: ReactNode;
  onConfirm: () => void;
  cancelLabel?: ReactNode;
  /** The confirmation: `sky` (default) and `gold` are the primary; `redf` is destructive (word + icon + colour). */
  confirmTone?: "sky" | "gold" | "redf";
  /** aria-disabled (stays focusable): clicking does nothing. */
  confirmDisabled?: boolean;
  /** While the action runs: the confirmation reads «Un momento…» and is aria-disabled. */
  busy?: boolean;
  /** An optional third action before «Cancelar» (e.g. «Guardar y salir»). */
  alt?: { label: ReactNode; onClick: () => void };
  /** A failure to show above the buttons (role=alert). */
  error?: ReactNode;
  /** `dialog` for a question that does not interrupt; an alertdialog by default. */
  role?: "dialog" | "alertdialog";
  children?: ReactNode;
  initialFocus?: RefObject<HTMLElement | null>;
  returnFocus?: RefObject<HTMLElement | null>;
  className?: string;
}

/** Asks before doing something, listing what will happen (the sala's sheet, centred on the desktop). */
export function ConfirmModal({
  open,
  onClose,
  title,
  lede,
  tone = "",
  consequences = [],
  confirmLabel,
  onConfirm,
  cancelLabel = "Cancelar",
  confirmTone = "sky",
  confirmDisabled,
  busy,
  alt,
  error,
  role = "alertdialog",
  children,
  initialFocus,
  returnFocus,
  className = "",
}: ConfirmModalProps) {
  const did = useId();
  const off = !!confirmDisabled || !!busy;
  const danger = tone === "dz" || confirmTone === "redf";
  return (
    <SalaSheet
      open={open}
      onClose={onClose}
      title={title}
      center
      alert={role === "alertdialog"}
      describedBy={lede ? did : undefined}
      initialFocus={initialFocus}
      returnFocus={returnFocus}
      className={`sc-confirm${danger ? " is-danger" : ""} ${className}`.trim()}
      footer={
        <>
          {alt && (
            <button type="button" className="vd-btn vd-glass vd-press" onClick={alt.onClick}>
              {alt.label}
            </button>
          )}
          <button type="button" className="vd-btn vd-glass vd-press" onClick={onClose}>
            {cancelLabel}
          </button>
          <button type="button" className={`vd-btn vd-glass vd-press ${danger ? "sc-danger" : "vd-btn--pri"}`} aria-disabled={off || undefined} onClick={() => !off && onConfirm()}>
            {danger && !busy && <Warn />}
            {busy ? "Un momento…" : confirmLabel}
          </button>
        </>
      }
    >
      {lede && (
        <p className="sc-confirm__lede" id={did}>
          {lede}
        </p>
      )}
      {children}
      <ConsequenceList items={consequences} danger={danger} />
      {error && (
        <p className="sc-confirm__err" role="alert">
          <Warn />
          <span>{error}</span>
        </p>
      )}
    </SalaSheet>
  );
}
