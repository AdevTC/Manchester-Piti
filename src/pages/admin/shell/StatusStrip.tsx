// The franja de estado (law 5): a strip reserved at the foot of the frame (on the phone, under the dock) that
// says «Guardado · Deshacer», the errors and, at rest, «Todo guardado · 20:00» (or, offline, what is kept here
// and what needs the network: M-22). It never covers a control. It answers the same API today's views already
// call (useToast(): show · defer · dismiss; useStatus() is its name in the sala):
//   show()  — a line, with «Deshacer» (undo) or, for an error, «Reintentar» (retry); 5.2 s, errors 8 s.
//   defer() — the reversible write: the change shows at once, the write waits 5.2 s behind «Deshacer» and only
//             then commits (a second defer() commits the first at once; leaving the sala, closing the tab or
//             hiding the app commits what waits). A failed commit calls onError and shows the error with «Reintentar».
// Normal lines are announced politely, errors as an alert.
import { useCallback, useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import { apiError } from "../../../lib/clubApi";
import { VIcon } from "../../../components/vidrio/VIcon";
import { ToastContext, UNDO_WINDOW_MS, type DeferOptions, type ToastApi, type ToastOptions } from "../ui/toastContext";
import { StatusShownContext, useStatusLine, type StatusLine } from "./statusContext";

interface Pending {
  options: DeferOptions;
  timer: ReturnType<typeof setTimeout>;
}

export function StatusProvider({ children }: { children: ReactNode }) {
  const [line, setLine] = useState<StatusLine | null>(null);
  const seq = useRef(0);
  const hide = useRef<ReturnType<typeof setTimeout> | null>(null);
  const pending = useRef<Pending | null>(null);

  const dismiss = useCallback(() => {
    if (hide.current) clearTimeout(hide.current);
    hide.current = null;
    setLine(null);
  }, []);
  const show = useCallback(
    (o: ToastOptions) => {
      if (hide.current) clearTimeout(hide.current);
      seq.current += 1;
      const error = o.tone === "error";
      const act = o.undo ? { label: "Deshacer" as const, run: o.undo } : o.retry ? { label: "Reintentar" as const, run: o.retry } : undefined;
      setLine({ key: seq.current, tag: o.tag ?? (error ? "Error" : "Guardado"), message: o.message, tone: error ? "error" : "ok", act });
      const ms = o.duration ?? (error ? 8_000 : UNDO_WINDOW_MS);
      hide.current = ms ? setTimeout(dismiss, ms) : null;
    },
    [dismiss],
  );
  const run = useCallback(
    (options: DeferOptions) => {
      const attempt = () => {
        options.commit().then(
          (result: unknown) => options.onDone?.(result),
          (e: unknown) => {
            options.onError?.(e);
            show({ tone: "error", message: `${options.errorMessage ?? "No se ha podido guardar"}: ${apiError(e)}`, retry: attempt });
          },
        );
      };
      attempt();
    },
    [show],
  );
  const flush = useCallback(() => {
    const p = pending.current;
    if (!p) return;
    clearTimeout(p.timer);
    pending.current = null;
    run(p.options);
  }, [run]);
  const defer = useCallback(
    (options: DeferOptions) => {
      flush();
      const delay = options.delay ?? UNDO_WINDOW_MS;
      const entry: Pending = {
        options,
        timer: setTimeout(() => {
          if (pending.current !== entry) return;
          pending.current = null;
          run(options);
        }, delay),
      };
      pending.current = entry;
      show({
        message: options.message,
        tag: options.tag,
        duration: delay,
        undo: () => {
          if (pending.current !== entry) return;
          clearTimeout(entry.timer);
          pending.current = null;
          options.onUndo?.();
        },
      });
    },
    [flush, run, show],
  );
  // Leaving the sala mid-undo still applies the decision.
  useEffect(
    () => () => {
      if (hide.current) clearTimeout(hide.current);
      flush();
    },
    [flush],
  );
  // …and so does closing the tab or leaving the app (the phone may never come back to fire the timer): the write
  // goes to Firestore's local queue at once, which uploads it now or on the next visit.
  useEffect(() => {
    const away = () => {
      if (document.visibilityState === "hidden") flush();
    };
    window.addEventListener("pagehide", flush);
    document.addEventListener("visibilitychange", away);
    return () => {
      window.removeEventListener("pagehide", flush);
      document.removeEventListener("visibilitychange", away);
    };
  }, [flush]);
  const api = useMemo<ToastApi>(() => ({ show, defer, dismiss }), [show, defer, dismiss]);
  const shown = useMemo(() => ({ line, dismiss }), [line, dismiss]);
  return (
    <ToastContext.Provider value={api}>
      <StatusShownContext.Provider value={shown}>{children}</StatusShownContext.Provider>
    </ToastContext.Provider>
  );
}

/** The strip itself (the frame's last row). `rest`: what it says when nothing happened lately. */
export function StatusStrip({ rest }: { rest: string }) {
  const { line, dismiss } = useStatusLine();
  const error = line?.tone === "error";
  const body = line && (
    <>
      <span className="sc-status__tag">{line.tag}</span>
      <span className="sc-status__msg">{line.message}</span>
      {line.act && (
        <button
          type="button"
          className="sc-status__act"
          // (pressing it never takes the focus from the field being typed: its blur would save what «Deshacer» undoes)
          onMouseDown={(e) => e.preventDefault()}
          onClick={() => {
            const act = line.act;
            dismiss();
            act?.run();
          }}
        >
          {line.act.label === "Deshacer" && <VIcon name="undo" size={16} />}
          {line.act.label}
        </button>
      )}
      {error && (
        <button type="button" className="sc-status__x" onClick={dismiss} aria-label="Cerrar el aviso">
          <VIcon name="close" size={16} />
        </button>
      )}
    </>
  );
  return (
    // (the live regions stay mounted: a region inserted with its text is not always announced)
    <footer className={`sc-status${line ? " is-on" : ""}${error ? " is-error" : ""}`}>
      <div className="sc-status__live" role="status" aria-live="polite">
        {!error && body}
      </div>
      <div className="sc-status__live" role="alert">
        {error && body}
      </div>
      {!line && <span className="sc-status__rest">{rest}</span>}
    </footer>
  );
}
