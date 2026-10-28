// «Buscar» in the top bar (TU boards, shell.html `tu-cbtn tu-cbtn--sr`): a round 46 px glass magnifier; from
// 1100 px it says «Buscar» with its key (Ctrl K, ⌘K on a Mac). Ctrl/⌘ K and «/» open it too (never while typing
// or while another dialog is up: searchShortcut.ts). On a desktop or a tablet the search is a dialog over the page
// that leaves the address alone, growing out of the button (a View Transition: the button lends it its name,
// tu-search, as the board's go({from, name}) does) and shrinking back into it; on a phone (where the board draws it
// as the whole screen) it is the address /buscar, so «atrás» closes it. The dialog (SearchDialog: the data and the
// results) loads when it is first wanted; the focus goes back to wherever it was when the search opened. Another
// place (the Sala de control) passes its own dialog, keeps it a dialog on the phone too and may leave «/» alone.
import { useCallback, useEffect, useRef, useState, type ComponentType } from "react";
import { flushSync } from "react-dom";
import { useRouter } from "@tanstack/react-router";
import { TuIcon } from "../vidrio/tu/ui";
import { tuGo } from "../vidrio/tu/kit";
import { isShot, supportsViewTransitions } from "../vidrio/env";
import { isSearchShortcut } from "./searchShortcut";
import "./search.css";

/** What the launcher opens: closed with `refocus` false when a result was chosen (the next screen is on its way). */
export type SearchDialogComponent = ComponentType<{ onClose: (refocus?: boolean) => void }>;
export type SearchDialogLoader = () => Promise<SearchDialogComponent>;

const webDialog: SearchDialogLoader = () => import("./SearchDialog").then((m) => m.SearchDialog);
/** Each dialog's chunk, asked for once (a hover, a focus, the opening): a failure lets the next try ask again. */
const pending = new Map<SearchDialogLoader, Promise<SearchDialogComponent>>();
function loadDialog(loader: SearchDialogLoader): Promise<SearchDialogComponent> {
  let p = pending.get(loader);
  if (!p) {
    p = loader().catch((e: unknown) => {
      pending.delete(loader);
      throw e;
    });
    pending.set(loader, p);
  }
  return p;
}

/** Another dialog is up (the avisos panel, a sheet): the keys leave it alone. */
const modalOpen = () => !!document.querySelector('[aria-modal="true"]');

const isMac = () => typeof navigator !== "undefined" && /Mac|iPhone|iPad/.test(navigator.platform || navigator.userAgent);

/** The phone, where the board draws the search as the whole screen (its @container tupg max-width:699px). */
const isPhone = () => typeof window !== "undefined" && typeof window.matchMedia === "function" && window.matchMedia("(max-width: 699px)").matches;

const NAME = "tu-search";
/** Will tuGo run a View Transition (so the button may lend its name)? */
const morphs = () => supportsViewTransitions() && !isShot();

/** The button keeps the name until the transition is over (tuGo clears html[data-vd-dir] then). */
function lendUntilDone(el: HTMLElement) {
  el.style.viewTransitionName = NAME;
  const d = document.documentElement;
  const done = () => {
    el.style.viewTransitionName = "";
    mo.disconnect();
    window.clearTimeout(t);
  };
  const mo = new MutationObserver(() => {
    if (!d.hasAttribute("data-vd-dir")) done();
  });
  mo.observe(d, { attributes: true, attributeFilter: ["data-vd-dir"] });
  const t = window.setTimeout(done, 2000);
}

export interface SearchLauncherProps {
  /** The dialog to open (default: the web's SearchDialog). */
  loader?: SearchDialogLoader;
  /** On a phone, go to /buscar (default) or open the dialog there too (false). */
  phoneRoute?: boolean;
  /** «/» opens it too (default); false leaves «/» to the page (the sala's list search). */
  slash?: boolean;
}

export function SearchLauncher({ loader = webDialog, phoneRoute = true, slash = true }: SearchLauncherProps = {}) {
  const router = useRouter({ warn: false });
  const [open, setOpen] = useState(false);
  /** The dialog, once its chunk is here (it stays for the next openings). */
  const [Dialog, setDialog] = useState<SearchDialogComponent | null>(null);
  /** The dialog's chunk failed to arrive (offline, a new deploy): said once, in words, instead of nothing. */
  const [failed, setFailed] = useState(false);
  const button = useRef<HTMLButtonElement>(null);
  const returnTo = useRef<HTMLElement | null>(null);

  const show = useCallback(() => {
    const at = document.activeElement;
    returnTo.current = at instanceof HTMLElement && at !== document.body ? at : button.current;
    setFailed(false);
    const btn = button.current;
    if (router && phoneRoute && isPhone()) {
      // (the phone: the address /buscar, its screen growing out of the button)
      if (btn && morphs()) btn.style.viewTransitionName = NAME;
      tuGo("up", async () => {
        if (btn) btn.style.viewTransitionName = "";
        await router.navigate({ to: "/buscar" });
      });
      return;
    }
    loadDialog(loader).then(
      (c) => {
        const opening = () => {
          if (btn) btn.style.viewTransitionName = "";
          flushSync(() => {
            setDialog(() => c);
            setOpen(true);
          });
        };
        if (btn && morphs()) btn.style.viewTransitionName = NAME;
        tuGo("up", opening, true);
      },
      (e: unknown) => {
        console.error("No se pudo cargar el buscador:", e);
        setOpen(false);
        setFailed(true);
      },
    );
  }, [router, phoneRoute, loader]);

  const close = useCallback((refocus = true) => {
    if (!refocus) {
      // (a result was chosen: the next screen is on its way, no shrinking back)
      setOpen(false);
      return;
    }
    const btn = button.current;
    const refocusNow = () => {
      const to = returnTo.current?.isConnected ? returnTo.current : btn;
      to?.focus({ preventScroll: true });
    };
    tuGo(
      "left",
      () => {
        flushSync(() => setOpen(false));
        if (btn && morphs()) lendUntilDone(btn);
        refocusNow();
      },
      true,
    );
  }, []);

  useEffect(() => {
    if (open) return;
    const onKey = (e: KeyboardEvent) => {
      if (!isSearchShortcut(e) || (!slash && e.key === "/") || modalOpen()) return;
      e.preventDefault();
      show();
    };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [open, show, slash]);

  const key = isMac() ? "⌘K" : "Ctrl K";

  return (
    <div className="tu-srw">
      <button
        ref={button}
        type="button"
        className="vd-glass vd-press tu-cbtn tu-cbtn--sr"
        aria-label={`Buscar (${key})`}
        title={`Buscar (${key})`}
        aria-haspopup="dialog"
        aria-expanded={open}
        aria-keyshortcuts={`${isMac() ? "Meta+K" : "Control+K"}${slash ? " /" : ""}`}
        onClick={show}
        onPointerEnter={() => void loadDialog(loader).catch(() => undefined)}
        onFocus={() => void loadDialog(loader).catch(() => undefined)}
      >
        <TuIcon name="search" />
        <span className="tu-cbtn__t">Buscar</span>
        <kbd className="tu-cbtn__k">{key}</kbd>
      </button>
      {/* (one polite region, there from the start: a failed opening is announced once, and shown under the button) */}
      <span className={failed ? "sr-fail" : "sr-hide"} role="status">
        {failed ? "No se ha podido abrir el buscador. Comprueba la conexión y vuelve a intentarlo." : ""}
      </span>
      {open && Dialog && <Dialog onClose={close} />}
    </div>
  );
}
