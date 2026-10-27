// The capsule's five sections, warmed while the visitor reads the first one: at idle moments their code and styles
// arrive and run once, one section at a time, so the first tap on each never waits for a download or a first run.
// Not on a connection that asks to save data, nor on 2G.
import type { AnyRouter } from "@tanstack/react-router";
import { pageKeyOf } from "../components/celeste/pageTransition";

export const SECTIONS = ["/", "/partidos", "/plantilla", "/estadisticas", "/club"] as const;

interface Connection {
  saveData?: boolean;
  effectiveType?: string;
}

export function warmSections(router: AnyRouter, delay = 2500, win: Window = window): void {
  const conn = (win.navigator as Navigator & { connection?: Connection }).connection;
  if (conn?.saveData || /(^|-)2g$/.test(conn?.effectiveType ?? "")) return;
  const idle = (run: () => void) => {
    if (typeof win.requestIdleCallback === "function") win.requestIdleCallback(run, { timeout: 4000 });
    else win.setTimeout(run, 300);
  };
  const queue: string[] = [...SECTIONS];
  const next = (): void => {
    const here = pageKeyOf(router.state.location.pathname);
    const to = queue.shift();
    if (!to) return;
    if (pageKeyOf(to) === here) return next();
    idle(() => {
      router
        .preloadRoute({ to })
        .catch(() => undefined)
        .finally(next);
    });
  };
  win.setTimeout(next, delay);
}
