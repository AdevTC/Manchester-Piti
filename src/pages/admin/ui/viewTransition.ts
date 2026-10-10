// View Transitions for the admin: a state change the browser morphs (shared elements fly by their
// `view-transition-name`), or a plain update where the API is missing or the user asked for less motion.
import { flushSync } from "react-dom";

export function canTransition(): boolean {
  if (typeof document === "undefined" || typeof document.startViewTransition !== "function") return false;
  return !window.matchMedia?.("(prefers-reduced-motion: reduce)").matches;
}

/** Runs `update` inside a view transition (synchronously flushed); resolves when the morph has finished. */
export function viewTransition(update: () => void): Promise<void> {
  if (!canTransition()) {
    update();
    return Promise.resolve();
  }
  const t = document.startViewTransition(() => flushSync(update));
  return t.finished.catch(() => undefined);
}

/** A `view-transition-name` from an id (Firestore ids are safe; anything else is replaced). */
export const vtName = (prefix: string, id: string) => `${prefix}-${id.replace(/[^a-zA-Z0-9_-]/g, "_")}`;
