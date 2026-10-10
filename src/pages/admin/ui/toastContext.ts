// The toasts' API (types, context, hook); the provider and the behaviour are in toasts.tsx. In the v2 they
// are lower thirds (kit/LowerThird): a short tag + the message + «Deshacer» / «Reintentar», 5.2 s.
import { createContext, useContext, type ReactNode } from "react";

export interface ToastOptions {
  message: ReactNode;
  /** The caption's short tag: J8, FICHA, ALTA, BAJA, WEB, C, FINAL… (default «OK»; errors «!»). */
  tag?: string;
  /** `error` = red, role=alert, longer on screen. */
  tone?: "ok" | "error";
  /** Shows «Deshacer»; the caption closes when pressed. */
  undo?: () => void;
  /** Shows «Reintentar» (errors); the caption closes when pressed. */
  retry?: () => void;
  /** ms on screen (default 5.2 s, errors 8 s; 0 = until replaced or dismissed). */
  duration?: number;
}
export interface DeferOptions {
  /** What the caption says while the change waits (e.g. «@nuevo.socio ya es KEVIN · su carta y su voto, activos»). */
  message: ReactNode;
  /** The caption's tag (default «OK»). */
  tag?: string;
  /** The real write; runs after `delay` unless undone. */
  commit: () => Promise<unknown>;
  /** Undo pressed: put the UI back (the write never happens). */
  onUndo?: () => void;
  /** The write failed: put the UI back. A red «Reintentar» caption is shown too. */
  onError?: (error: unknown) => void;
  /** Prefix of the error caption (default «No se ha podido guardar»). */
  errorMessage?: string;
  /** Called when the write succeeded (with what it resolved to). */
  onDone?: (result: unknown) => void;
  /** Undo window, ms (default 5200). */
  delay?: number;
}
export interface ToastApi {
  show: (options: ToastOptions) => void;
  defer: (options: DeferOptions) => void;
  dismiss: () => void;
}
/** How long a caption stays (and so the undo window of defer()). */
export const UNDO_WINDOW_MS = 5_200;

export const ToastContext = createContext<ToastApi | null>(null);

/** The admin's lower thirds (inside AdminLayout): show(), defer() (undoable writes), dismiss(). */
export function useToast(): ToastApi {
  const ctx = useContext(ToastContext);
  if (!ctx) throw new Error("useToast needs a <ToastProvider> (AdminLayout provides one).");
  return ctx;
}
