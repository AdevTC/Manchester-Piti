// «¿Salir sin guardar?» — the unsaved-changes guard.
//
// GuardProvider (GuardProvider.tsx, in AdminLayout) owns the one alertdialog. useUnsavedGuard(dirty, { what }) then:
//   · blocks router navigation while `dirty` (TanStack useBlocker + the browser's beforeunload) and asks;
//   · gives `run(action)` for the layer closes (X, Esc, scrim) and in-view switches: it runs the action
//     at once when clean, otherwise asks first — Seguir editando (nothing) / Descartar cambios (the action)
//     / an optional third action (e.g. «Guardar borrador y salir»: `alt.run`, then the action).
// After «Descartar» the next navigation (≤ 1 s) passes unasked, so an action that itself navigates
// (closing a drawer that lives in the URL) is not asked twice.
import { createContext, useCallback, useContext, useLayoutEffect, useRef } from "react";
import { useBlocker } from "@tanstack/react-router";

export type GuardChoice = "stay" | "discard" | "alt";
export interface GuardAsk {
  /** What has the changes, completing «Hay cambios sin guardar en …» (e.g. «la ficha de ERIK», «el acta de la J7»). */
  what: string;
  /** Label of the optional third action (e.g. «Guardar borrador y salir»). */
  altLabel?: string;
}
export type Ask = (ask: GuardAsk) => Promise<GuardChoice>;
export const GuardContext = createContext<Ask | null>(null);

/** Ask «¿Salir sin guardar?» directly (most code wants useUnsavedGuard instead). */
export function useGuardAsk(): Ask {
  const ask = useContext(GuardContext);
  if (!ask) throw new Error("useUnsavedGuard needs a <GuardProvider> (AdminLayout provides one).");
  return ask;
}

export interface UnsavedGuardOptions {
  /** Completes «Hay cambios sin guardar en …». */
  what: string;
  /** Optional third action, e.g. { label: "Guardar borrador y salir", run: saveDraft }. */
  alt?: { label: string; run: () => unknown };
  /** Which navigations to guard (default: all while dirty). Return false to let one through, e.g. a
   *  search-only change inside the same view. */
  shouldBlock?: (args: { current: { pathname: string; search: unknown }; next: { pathname: string; search: unknown } }) => boolean;
}
export interface UnsavedGuard {
  /** Runs `action` now when clean; otherwise asks first and runs it on «Descartar» (or after `alt`). */
  run: (action: () => void) => void;
  /** Asks (when dirty) and resolves with the choice; "discard" when clean. */
  confirm: () => Promise<GuardChoice>;
}

export function useUnsavedGuard(dirty: boolean, options: UnsavedGuardOptions): UnsavedGuard {
  const ask = useGuardAsk();
  const latest = useRef({ dirty, options });
  useLayoutEffect(() => {
    latest.current = { dirty, options };
  });
  const passUntil = useRef(0);

  const confirm = useCallback(async (): Promise<GuardChoice> => {
    const { dirty: d, options: o } = latest.current;
    if (!d) return "discard";
    const choice = await ask({ what: o.what, altLabel: o.alt?.label });
    if (choice === "alt") await o.alt?.run();
    if (choice !== "stay") passUntil.current = Date.now() + 1000;
    return choice;
  }, [ask]);

  useBlocker({
    shouldBlockFn: async ({ current, next }) => {
      const { dirty: d, options: o } = latest.current;
      if (!d) return false;
      if (Date.now() < passUntil.current) {
        passUntil.current = 0;
        return false;
      }
      if (o.shouldBlock && !o.shouldBlock({ current: { pathname: current.pathname, search: current.search }, next: { pathname: next.pathname, search: next.search } })) return false;
      const choice = await confirm();
      passUntil.current = 0;
      return choice === "stay";
    },
    enableBeforeUnload: dirty,
  });

  const run = useCallback(
    (action: () => void) => {
      if (!latest.current.dirty) {
        action();
        return;
      }
      void confirm().then((choice) => {
        if (choice !== "stay") action();
      });
    },
    [confirm],
  );
  return { run, confirm };
}
