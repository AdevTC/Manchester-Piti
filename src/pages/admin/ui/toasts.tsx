// The admin's toasts (`.tst`): one at a time, bottom right on desktop / over the bar on phones, spring in.
//   show()  — a plain message, optionally with «Deshacer» (undo) or, for errors, «Reintentar» (retry).
//   defer() — the reversible-action pattern (like the door's): the change shows at once in the UI, the
//             write waits `delay` ms behind a «Deshacer» toast and only then commits. A second defer()
//             commits the first straight away; leaving the admin commits what is pending. A failed commit
//             calls onError (restore the UI) and shows a red toast with «Reintentar».
// Normal toasts live in a polite status region, errors in an alert region; both sit outside the app
// (in the layer host) so they stay usable while a modal makes the app inert.
import { useCallback, useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import { createPortal } from "react-dom";
import { apiError } from "../../../lib/clubApi";
import { AdIcon } from "./icons";
import { ToastContext, UNDO_WINDOW_MS, type DeferOptions, type ToastApi, type ToastOptions } from "./toastContext";
import { useLayerHost } from "./layerCore";

interface Shown extends ToastOptions {
  key: number;
}
interface Pending {
  options: DeferOptions;
  timer: ReturnType<typeof setTimeout>;
}

/** Provides useToast() and renders the toast into the layer host (needs a LayerProvider above). */
export function ToastProvider({ children }: { children: ReactNode }) {
  const host = useLayerHost();
  const [toast, setToast] = useState<Shown | null>(null);
  const seq = useRef(0);
  const hide = useRef<ReturnType<typeof setTimeout> | null>(null);
  const pending = useRef<Pending | null>(null);

  const dismiss = useCallback(() => {
    if (hide.current) clearTimeout(hide.current);
    hide.current = null;
    setToast(null);
  }, []);
  const show = useCallback(
    (options: ToastOptions) => {
      if (hide.current) clearTimeout(hide.current);
      seq.current += 1;
      setToast({ ...options, key: seq.current });
      const ms = options.duration ?? (options.tone === "error" ? 8_000 : 5_000);
      hide.current = ms ? setTimeout(dismiss, ms) : null;
    },
    [dismiss],
  );
  const run = useCallback(
    (options: DeferOptions) => {
      const attempt = () => {
        options.commit().then(
          () => options.onDone?.(),
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
  // Leaving the admin mid-undo still applies the decision.
  useEffect(
    () => () => {
      if (hide.current) clearTimeout(hide.current);
      flush();
    },
    [flush],
  );
  const api = useMemo<ToastApi>(() => ({ show, defer, dismiss }), [show, defer, dismiss]);

  const error = toast?.tone === "error";
  const body = toast && (
    <div key={toast.key} className={`tst ${toast.key % 2 ? "tA" : "tB"}${error ? " err" : ""}`}>
      <AdIcon name={error ? "alert" : "check"} size={16} />
      <span>{toast.message}</span>
      {toast.undo || toast.retry ? (
        <button
          type="button"
          onClick={() => {
            const act = toast.undo ?? toast.retry;
            dismiss();
            act?.();
          }}
        >
          {toast.undo ? "Deshacer" : "Reintentar"}
        </button>
      ) : (
        <button type="button" className="ad-tst-x" onClick={dismiss} aria-label="Cerrar aviso">
          <AdIcon name="x" size={16} />
        </button>
      )}
    </div>
  );
  return (
    <ToastContext.Provider value={api}>
      {children}
      {host &&
        createPortal(
          <>
            <div className="adm-toasts" role="status" aria-live="polite">
              {!error && body}
            </div>
            <div className="adm-toasts" role="alert">
              {error && body}
            </div>
          </>,
          host,
        )}
    </ToastContext.Provider>
  );
}
