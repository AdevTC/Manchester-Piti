// «Buscar»: the header's magnifier and its keys (⌘K / Ctrl+K and «/», searchShortcut.ts). The dialog
// (SearchDialog: the data and the results) loads only when it is first wanted; focus goes back to wherever it
// was when the search opened.
import { useCallback, useEffect, useRef, useState } from "react";
import { VIcon } from "../vidrio/VIcon";
import { isSearchShortcut } from "./searchShortcut";
import "./search.css";

type DialogComponent = typeof import("./SearchDialog").SearchDialog;
/** The dialog's chunk, asked for once (a hover, a focus, the opening): a failure lets the next try ask again. */
let pending: Promise<DialogComponent> | null = null;
const loadDialog = (): Promise<DialogComponent> =>
  (pending ??= import("./SearchDialog").then(
    (m) => m.SearchDialog,
    (e: unknown) => {
      pending = null;
      throw e;
    },
  ));

/** Another dialog is up (the avisos panel, a sheet): the keys leave it alone. */
const modalOpen = () => !!document.querySelector('[aria-modal="true"]');

const isMac = () => typeof navigator !== "undefined" && /Mac|iPhone|iPad/.test(navigator.platform || navigator.userAgent);

export function SearchLauncher() {
  const [open, setOpen] = useState(false);
  /** The dialog, once its chunk is here (it stays for the next openings). */
  const [Dialog, setDialog] = useState<DialogComponent | null>(null);
  /** The dialog's chunk failed to arrive (offline, a new deploy): said once, in words, instead of nothing. */
  const [failed, setFailed] = useState(false);
  const button = useRef<HTMLButtonElement>(null);
  const returnTo = useRef<HTMLElement | null>(null);

  useEffect(() => {
    if (!open || Dialog) return;
    let live = true;
    loadDialog()
      .then((c) => live && setDialog(() => c))
      .catch((e: unknown) => {
        console.error("No se pudo cargar el buscador:", e);
        if (!live) return;
        setOpen(false);
        setFailed(true);
      });
    return () => {
      live = false;
    };
  }, [open, Dialog]);

  const show = useCallback(() => {
    const at = document.activeElement;
    returnTo.current = at instanceof HTMLElement && at !== document.body ? at : button.current;
    setFailed(false);
    setOpen(true);
  }, []);

  const close = useCallback((refocus = true) => {
    setOpen(false);
    if (!refocus) return;
    const to = returnTo.current?.isConnected ? returnTo.current : button.current;
    to?.focus();
  }, []);

  useEffect(() => {
    if (open) return;
    const onKey = (e: KeyboardEvent) => {
      if (!isSearchShortcut(e) || modalOpen()) return;
      e.preventDefault();
      show();
    };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [open, show]);

  const mac = isMac();

  return (
    <div className="sr-wrap">
      <button
        ref={button}
        type="button"
        className="sr-btn"
        aria-label={`Buscar (${mac ? "⌘K" : "Ctrl K"})`}
        title={`Buscar (${mac ? "⌘K" : "Ctrl K"})`}
        aria-haspopup="dialog"
        aria-expanded={open}
        aria-keyshortcuts={mac ? "Meta+K /" : "Control+K /"}
        onClick={show}
        onPointerEnter={() => void loadDialog().catch(() => undefined)}
        onFocus={() => void loadDialog().catch(() => undefined)}
      >
        <VIcon name="search" size={20} />
      </button>
      {/* (one polite region, there from the start: a failed opening is announced once, and shown under the button) */}
      <span className={failed ? "sr-fail" : "sr-hide"} role="status">
        {failed ? "No se ha podido abrir el buscador. Comprueba la conexión y vuelve a intentarlo." : ""}
      </span>
      {open && Dialog && <Dialog onClose={close} />}
    </div>
  );
}
