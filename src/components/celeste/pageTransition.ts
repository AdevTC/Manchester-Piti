// Moving between pages (V-Vivo frames «De Inicio a Plantilla»): the page leaves first (160 ms, fade + 8 px + a
// little blur, region by region where the page marks regions), the shared objects morph (the floating score ↔
// Inicio's lens ↔ the match page's scoreboard: one view-transition-name each, one mounted at a time), then the next
// page comes in from the direction of travel (220 ms). Never both pages at full opacity. The top bar and the tab bar
// stay where they are: the next page's bar shows at once and its bead slides from where the last one left it.
// The router runs the View Transition: the capsule and the tab bar ask for it (Link `viewTransition`), and every
// other change of page — another page's link, the browser's back and forward — gets it from the router's default
// (`pageChangeTypes`). This tells the CSS which way to go and what travels (html[data-vd-dir] + html[data-vd-page]:
// styles/vidrio/chrome.css and transitions.css). Reduced motion: the 120 ms crossfade. No View Transitions: an
// instant swap.
import { prefersReducedMotion, supportsViewTransitions } from "../vidrio/env";
import type { SwapDirection } from "../vidrio/transitions";

/** The capsule's order (a page outside it — a match, a ficha, the vestuario — sits after Club). */
const ORDER = ["inicio", "partidos", "plantilla", "stats", "club"];

export function pageDirection(from: string, to: string): SwapDirection {
  const a = ORDER.indexOf(from);
  const b = ORDER.indexOf(to);
  return (b < 0 ? ORDER.length : b) >= (a < 0 ? ORDER.length : a) ? "right" : "left";
}

/**
 * The page an address belongs to: one page component, mounted across all its screens (a change of screen inside
 * it is the page's own business, with its own choreography). Each match is a page of its own. The Sala de control,
 * the pizarra and la mesa are apps of their own: `null`, no change-of-page transition into or out of them.
 */
export function pageKeyOf(pathname: string): string | null {
  const p = pathname.length > 1 ? pathname.replace(/\/+$/, "") : pathname;
  if (p === "/" || p === "/camiseta" || p.startsWith("/hoy/")) return "inicio";
  if (p === "/partidos" || p === "/partidos/tabla" || p === "/partidos/balance") return "partidos";
  if (/^\/partidos\/[^/]+\/mesa$/.test(p)) return null;
  const match = /^\/partidos\/([^/]+)/.exec(p);
  if (match) return `partido:${match[1]}`;
  if (p === "/estadisticas" || p.startsWith("/estadisticas/")) return "stats";
  if (p === "/plantilla" || p.startsWith("/plantilla/") || p.startsWith("/jugadores/")) return "plantilla";
  if (p === "/club" || p.startsWith("/club/")) return "club";
  if (p === "/vestuario" || p.startsWith("/vestuario/")) return "vestuario";
  if (p === "/perfil" || p.startsWith("/perfil/") || p === "/avisos" || p.startsWith("/avisos/")) return "tu";
  if (p === "/buscar") return "buscar";
  if (p === "/admin" || p.startsWith("/admin/") || p === "/pizarra" || p.startsWith("/invitacion/")) return null;
  return "otra";
}

/** The change of page waiting for its View Transition (the router's starts a moment after the tap), and the parts of
 *  the page that leaves (its content and its regions, marked [data-vd-out]). */
let armed: { id: number; clear: () => void; out: Element[] } | null = null;
let watch = 0;
/** Marks the direction for the router's View Transition about to run (html[data-vd-page], and [data-vd-out] on what
 *  leaves), and clears it once that transition is over: a page whose code is still downloading starts its
 *  transition late, so a fixed timer would clear it too soon. */
export function startPageTransition(direction: SwapDirection): void {
  if (typeof document === "undefined" || !supportsViewTransitions()) return;
  const root = document.documentElement;
  root.dataset.vdDir = direction;
  root.dataset.vdPage = "";
  if (prefersReducedMotion()) root.dataset.vdCalm = "";
  else delete root.dataset.vdCalm;
  const content = document.querySelector(".vx > main, .vx > .nu-main");
  const out = content ? [content, ...content.querySelectorAll('[class*="vd-reg-"]')] : [];
  for (const el of out) el.setAttribute("data-vd-out", "");
  const mine = ++watch;
  const clear = () => {
    for (const el of out) el.removeAttribute("data-vd-out");
    if (mine !== watch) return;
    delete root.dataset.vdDir;
    delete root.dataset.vdPage;
    delete root.dataset.vdCalm;
  };
  armed = { id: mine, clear, out };
  // (a page change that never transitions — a redirect elsewhere, a failed load — lets go after a while)
  setTimeout(() => {
    if (armed?.id !== mine) return;
    armed = null;
    clear();
  }, 6000);
}

/** Whether a page change (not an in-page one) owns the transition attributes right now. */
export const pageTransitionActive = (): boolean => typeof document !== "undefined" && "vdPage" in document.documentElement.dataset;

/** How the address last changed (the history's own word: PUSH, REPLACE, BACK, FORWARD, GO) and, for a step through
 *  the history, whether the browser already animated it (a swipe back on a phone: no second animation). */
let lastAction: { type: string; index?: number } = { type: "PUSH" };
let browserAnimated = false;
interface HistoryLike {
  subscribe: (cb: (opts: { action: { type: string; index?: number } }) => void) => () => void;
}
/** Follows the router's history (call once, before the app renders: the router's own listener comes after). */
export function followHistory(history: HistoryLike, win: Window = window): void {
  history.subscribe(({ action }) => {
    lastAction = action;
  });
  win.addEventListener(
    "popstate",
    (e) => {
      browserAnimated = !!(e as PopStateEvent & { hasUAVisualTransition?: boolean }).hasUAVisualTransition;
    },
    { capture: true },
  );
}

let running: ViewTransition | null = null;
/** Whether a View Transition is on now (from its start to its end). */
export const transitionRunning = (): boolean => running !== null;

interface ChangeInfo {
  fromLocation?: { pathname: string };
  toLocation: { pathname: string };
  pathChanged: boolean;
}
/**
 * The router's default for every navigation that did not ask for a transition itself: a change of page gets the
 * choreography (forward to the right, back to the left), anything else — a change inside a page, the first load,
 * a transition already running (an in-page swap navigates inside its own), the browser's own back animation — none.
 */
export function pageChangeTypes(info: ChangeInfo): string[] | false {
  const action = lastAction;
  const animated = browserAnimated;
  browserAnimated = false;
  if (!info.fromLocation || !info.pathChanged || transitionRunning() || pageTransitionActive()) return false;
  const from = pageKeyOf(info.fromLocation.pathname);
  const to = pageKeyOf(info.toLocation.pathname);
  if (from === null || to === null || from === to) return false;
  const step = action.type === "BACK" || action.type === "FORWARD" || action.type === "GO";
  if (step && animated) return false;
  const back = action.type === "BACK" || (action.type === "GO" && (action.index ?? 0) < 0);
  const forward = action.type === "FORWARD" || (action.type === "GO" && (action.index ?? 0) > 0);
  const direction: SwapDirection = back ? "left" : forward ? "right" : pageDirection(from, to);
  startPageTransition(direction);
  return ["vd-page", back ? "vd-back" : "vd-forward"];
}

/** The router's default View Transition, where the browser names transitions by type (without types the router
 *  would run one for every navigation, a slider's included: none then, as before). */
export function pageChangeTransition(): { types: (info: ChangeInfo) => string[] | false } | undefined {
  if (typeof CSS === "undefined" || typeof CSS.supports !== "function" || !supportsViewTransitions()) return undefined;
  return CSS.supports("selector(:active-view-transition-type(a))") ? { types: pageChangeTypes } : undefined;
}

let tapsInstalled = false;
const watchers = new Set<(t: ViewTransition, page: boolean) => void>();
/** Told of every View Transition as it starts (`page`: a change of page, not one inside a page): lib/vitals
 *  measures its frames. Returns the unsubscribe. */
export function onViewTransition(watch: (t: ViewTransition, page: boolean) => void): () => void {
  watchers.add(watch);
  return () => watchers.delete(watch);
}
/**
 * Every View Transition started through `document.startViewTransition` (the router's, the in-page ones) is
 * followed here:
 * - a tap during one finishes it at once and reaches what was tapped (Chrome's guidance): while one runs, its
 *   pseudo-elements cover the page and would swallow the tap (a page change is ~380 ms);
 * - a change of page takes the attributes startPageTransition armed and clears them when it is over. Once the next
 *   page is in, what it kept of the last one (a match page showing another match keeps its elements) is no longer
 *   leaving: the page that leaves and the one that comes are two groups, each where it is.
 */
export function tapsSkipTransitions(doc: Document = document): void {
  if (tapsInstalled || typeof doc.startViewTransition !== "function") return;
  tapsInstalled = true;
  const start = doc.startViewTransition.bind(doc);
  doc.startViewTransition = (arg?: ViewTransitionUpdateCallback | StartViewTransitionOptions) => {
    const page = armed;
    armed = null;
    const arrived = () => {
      for (const el of page?.out ?? []) if (el.isConnected) el.removeAttribute("data-vd-out");
    };
    const wrap = (update: ViewTransitionUpdateCallback | null | undefined): ViewTransitionUpdateCallback => async () => {
      try {
        await update?.();
      } finally {
        arrived();
      }
    };
    const options: ViewTransitionUpdateCallback | StartViewTransitionOptions | undefined = !page
      ? arg
      : typeof arg === "function" || arg === undefined
        ? wrap(arg)
        : { ...arg, update: wrap(arg.update) };
    const t = start(options);
    running = t;
    const done = () => {
      if (running === t) running = null;
      page?.clear();
    };
    t.finished.then(done, done);
    for (const watch of watchers) watch(t, page !== null || pageTransitionActive());
    return t;
  };
  doc.addEventListener("pointerdown", () => running?.skipTransition(), { capture: true, passive: true });
}

/** Test-only. */
export function _resetTapsForTesting(): void {
  tapsInstalled = false;
  running = null;
  armed = null;
  lastAction = { type: "PUSH" };
  browserAnimated = false;
}
