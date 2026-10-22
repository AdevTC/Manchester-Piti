// Inicio's addresses: the portada (/) and its screens (/hoy/campo, /hoy/jugadas, /hoy/lo-tuyo, /camiseta), the
// moviola's minute (?min=, carried from screen to screen), a sheet (?hoja=porra · mvp · cartel) and the open row
// on /hoy/campo (?jugador=). A screen change is a router navigation inside a View Transition with the kit's
// choreography (html[data-vd-dir]): deeper goes right, back to the portada goes left.
import { useCallback, useEffect, useRef } from "react";
import { useRouter, useRouterState } from "@tanstack/react-router";
import { isShot, prefersReducedMotion } from "../../../components/vidrio/env";

export type Screen = "portada" | "campo" | "jugadas" | "lo-tuyo" | "camiseta";
export const SCREENS: readonly Screen[] = ["portada", "campo", "jugadas", "lo-tuyo", "camiseta"];
export const SCREEN_PATH: Record<Screen, string> = { portada: "/", campo: "/hoy/campo", jugadas: "/hoy/jugadas", "lo-tuyo": "/hoy/lo-tuyo", camiseta: "/camiseta" };
export type Hoja = "porra" | "mvp" | "cartel";

/** The screen an address is. */
export function screenOf(pathname: string): Screen {
  const p = pathname.replace(/\/+$/, "") || "/";
  return (SCREENS.find((s) => SCREEN_PATH[s] === p) ?? "portada") as Screen;
}

const str = (v: unknown) => (typeof v === "string" ? v : typeof v === "number" ? String(v) : "");

/** The parts of the search the screens read. */
export function readSearch(search: Record<string, unknown>): { min: number | null; hoja: Hoja | null; jugador: string | null } {
  const m = Number(str(search.min));
  const h = str(search.hoja);
  const j = str(search.jugador);
  return { min: str(search.min) !== "" && Number.isFinite(m) && m >= 0 ? Math.round(m) : null, hoja: h === "porra" || h === "mvp" || h === "cartel" ? h : null, jugador: j || null };
}

/** An Inicio address: `screen` with the minute (when it is not the edge), the sheet and the open row. */
export function hrefOf(screen: Screen, o: { min?: number | null; hoja?: Hoja | null; jugador?: string | null }): string {
  const q: string[] = [];
  if (o.min !== null && o.min !== undefined && screen !== "lo-tuyo" && screen !== "camiseta") q.push(`min=${o.min}`);
  if (o.hoja) q.push(`hoja=${o.hoja}`);
  if (o.jugador && screen === "campo") q.push(`jugador=${encodeURIComponent(o.jugador)}`);
  return `${SCREEN_PATH[screen]}${q.length ? `?${q.join("&")}` : ""}`;
}

/** The direction of travel between two screens. */
export const travelOf = (from: Screen, to: Screen): "left" | "right" => (to === "portada" ? "left" : from === "portada" ? "right" : SCREENS.indexOf(to) > SCREENS.indexOf(from) ? "right" : "left");

export function useInicioNav() {
  const router = useRouter();
  const loc = useRouterState({ select: (s) => s.location });
  const screen = screenOf(loc.pathname);
  const q = readSearch(loc.search as Record<string, unknown>);
  const pushedSheet = useRef(false);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  // (a sheet closed by the browser's own back is no longer ours to go back from)
  useEffect(() => {
    if (!q.hoja) pushedSheet.current = false;
  }, [q.hoja]);
  useEffect(
    () => () => {
      if (timer.current) clearTimeout(timer.current);
    },
    [],
  );

  const go = useCallback(
    (to: Screen, o: { min?: number | null; jugador?: string | null } = {}) => {
      if (to === screen) return;
      const root = document.documentElement;
      const calm = prefersReducedMotion();
      root.dataset.vdDir = travelOf(screen, to);
      if (calm) root.dataset.vdCalm = "";
      else delete root.dataset.vdCalm;
      if (timer.current) clearTimeout(timer.current);
      const clear = () => {
        delete root.dataset.vdDir;
        delete root.dataset.vdCalm;
      };
      const href = hrefOf(to, { min: o.min ?? null, jugador: o.jugador ?? null });
      const doc = document as Document & { startViewTransition?: (cb: () => Promise<void>) => { ready: Promise<void>; finished: Promise<void> } };
      if (typeof doc.startViewTransition !== "function" || isShot()) {
        clear();
        void router.navigate({ href });
        return;
      }
      // (our own View Transition, so a skipped one — another navigation, a hidden tab — is no uncaught error; the
      // new screen is in the DOM once the router has committed and React has flushed)
      // (a page that paints no frame — a background window — never captures the old state: past 400 ms the
      // screen changes without the transition rather than waiting)
      let went = false;
      const late = setTimeout(() => {
        went = true;
        void router.navigate({ href });
      }, 400);
      const vt = doc.startViewTransition(async () => {
        clearTimeout(late);
        if (went) return;
        went = true;
        await router.navigate({ href });
        await new Promise((r) => setTimeout(r, 0));
      });
      vt.ready.catch(() => undefined);
      vt.finished.catch(() => undefined).finally(clear);
      timer.current = setTimeout(clear, 1500);
    },
    [router, screen],
  );

  /** The moviola's minute in the address (null: the edge), without a new history entry. */
  const setMin = useCallback(
    (min: number | null, jugador?: string | null) => {
      void router.navigate({ href: hrefOf(screen, { min, hoja: q.hoja, jugador: jugador === undefined ? q.jugador : jugador }), replace: true, resetScroll: false });
    },
    [router, screen, q.hoja, q.jugador],
  );

  const openSheet = useCallback(
    (hoja: Hoja, min: number | null) => {
      pushedSheet.current = true;
      void router.navigate({ href: hrefOf(screen, { min, hoja, jugador: q.jugador }), resetScroll: false });
    },
    [router, screen, q.jugador],
  );
  const closeSheet = useCallback(
    (min: number | null) => {
      if (pushedSheet.current) {
        pushedSheet.current = false;
        router.history.back();
        return;
      }
      void router.navigate({ href: hrefOf(screen, { min, jugador: q.jugador }), replace: true, resetScroll: false });
    },
    [router, screen, q.jugador],
  );
  return { screen, min: q.min, hoja: q.hoja, jugador: q.jugador, go, setMin, openSheet, closeSheet };
}
