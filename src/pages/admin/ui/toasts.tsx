// The admin's confirmations as lower thirds (`.lt`, kit/LowerThird): one at a time, bottom-left of the
// frame (phones: above the bar / the workspace footer / the pads, via the shell's `--ltb`), 5.2 s.
//   show()  — a plain caption, optionally with «Deshacer» (undo) or, for errors, «Reintentar» (retry).
//   defer() — the reversible-action pattern (like the door's): the change shows at once in the UI, the
//             write waits `delay` ms behind a «Deshacer» caption and only then commits. A second defer()
//             commits the first straight away; leaving the admin commits what is pending. A failed commit
//             calls onError (restore the UI) and shows a red caption with «Reintentar».
// Normal captions live in a polite status region, errors in an alert region; both sit outside the app
// (in the layer host) so they stay usable while a modal makes the app inert.
import { useCallback, useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import { createPortal } from "react-dom";
import { apiError } from "../../../lib/clubApi";
import { LowerThird } from "../kit/LowerThird";
import { ToastContext, UNDO_WINDOW_MS, type DeferOptions, type ToastApi, type ToastOptions } from "./toastContext";
import { useLayerHost } from "./layerCore";

interface Shown extends ToastOptions {
  key: number;
}
interface Pending {
  options: DeferOptions;
  timer: ReturnType<typeof setTimeout>;
}

/** Provides useToast() and renders the caption into the layer host (needs a LayerProvider above). */
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
      const ms = options.duration ?? (options.tone === "error" ? 8_000 : UNDO_WINDOW_MS);
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
  const act = toast?.undo ?? toast?.retry;
  const body = toast && (
    <LowerThird
      key={toast.key}
      tag={toast.tag ?? (error ? "!" : "OK")}
      tone={error ? "error" : "ok"}
      message={toast.message}
      action={
        act
          ? {
              label: toast.undo ? "Deshacer" : "Reintentar",
              icon: toast.undo ? "undo" : "back",
              onClick: () => {
                dismiss();
                act();
              },
            }
          : undefined
      }
    />
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
