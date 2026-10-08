// The toasts' API (types, context, hook); the provider and the behaviour are in toasts.tsx.
import { createContext, useContext, type ReactNode } from "react";

export interface ToastOptions {
  message: ReactNode;
  /** `error` = red, role=alert, longer on screen. */
  tone?: "ok" | "error";
  /** Shows «Deshacer»; the toast closes when pressed. */
  undo?: () => void;
  /** Shows «Reintentar» (errors); the toast closes when pressed. */
  retry?: () => void;
  /** ms on screen (default 5 s, errors 8 s; 0 = until replaced or dismissed). */
  duration?: number;
}
export interface DeferOptions {
  /** What the toast says while the change waits (e.g. «Ficha aprobada · KEVIN ya es suyo.»). */
  message: ReactNode;
  /** The real write; runs after `delay` unless undone. */
  commit: () => Promise<unknown>;
  /** Undo pressed: put the UI back (the write never happens). */
  onUndo?: () => void;
  /** The write failed: put the UI back. A red «Reintentar» toast is shown too. */
  onError?: (error: unknown) => void;
  /** Prefix of the error toast (default «No se ha podido guardar»). */
  errorMessage?: string;
  /** Called when the write succeeded. */
  onDone?: () => void;
  /** Undo window, ms (default 5000). */
  delay?: number;
}
export interface ToastApi {
  show: (options: ToastOptions) => void;
  defer: (options: DeferOptions) => void;
  dismiss: () => void;
}
export const UNDO_WINDOW_MS = 5_000;

export const ToastContext = createContext<ToastApi | null>(null);

/** The admin's toasts (inside AdminLayout): show(), defer() (undoable writes), dismiss(). */
export function useToast(): ToastApi {
  const ctx = useContext(ToastContext);
  if (!ctx) throw new Error("useToast needs a <ToastProvider> (AdminLayout provides one).");
  return ctx;
}
