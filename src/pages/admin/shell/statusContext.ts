// The status strip's shown line (the provider is StatusStrip.tsx; the API every screen uses is useStatus(), the
// same one today's views call useToast(): show · defer · dismiss — ui/toastContext).
import { createContext, useContext, type ReactNode } from "react";
import { useToast, type ToastApi } from "../ui/toastContext";

export interface StatusLine {
  key: number;
  /** The short tag before the message («Guardado», «J3», «Error»…). */
  tag: string;
  message: ReactNode;
  tone: "ok" | "error";
  /** «Deshacer» / «Reintentar»: the strip closes the line when pressed. */
  act?: { label: "Deshacer" | "Reintentar"; run: () => void };
}
export interface StatusShown {
  line: StatusLine | null;
  dismiss: () => void;
}
export const StatusShownContext = createContext<StatusShown>({ line: null, dismiss: () => undefined });
export const useStatusLine = (): StatusShown => useContext(StatusShownContext);

/** The franja de estado: `show({ message, tag?, tone?, undo?, retry?, duration? })`, `defer({ message, commit,
 *  onUndo?, onError? … })` for an undoable write (it waits 5.2 s behind «Deshacer»), `dismiss()`. */
export const useStatus = (): ToastApi => useToast();
