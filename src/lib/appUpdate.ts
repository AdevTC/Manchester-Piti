// A new deploy reaching a tab that is already open.
//
// Why people kept seeing the previous version: every move inside the app is a client-side navigation, so
// the browser never asks for a new sw.js while the tab stays open; and a reload is answered by the worker
// already installed, from its precache (shell.html and the old chunks), so the first reload after a deploy
// paints the old version again while the new worker installs behind it. When that worker takes over
// (skipWaiting + clientsClaim, vite.config.ts) the page in front is still the old code, and the old chunks
// it may still ask for are no longer cached nor deployed.
//
// So: the page asks for a new sw.js when the tab comes back, every half hour and on navigations; when a new
// worker takes over a page that was already controlled, the page is stale and moves to the new version at a
// safe moment: the next navigation to another page (a full load of the destination), the tab going to the
// background, or a page just opened or brought back and not touched yet. Never while a field is being
// filled, a dialog is open or a write is in flight, nor on la mesa, the admin or the pizarra (live scoring
// and unsaved boards). Meanwhile UpdateNotice offers «Hay una versión nueva · Actualizar».

/** What the controller needs from the router (the app's TanStack router fits). */
export type UpdateRouter = {
  subscribe(event: "onBeforeNavigate", fn: (e: { pathChanged: boolean }) => void): () => void;
  state: { location: { pathname: string } };
};

type Sw = Pick<ServiceWorkerContainer, "controller" | "register" | "addEventListener" | "removeEventListener">;

export type UpdateOptions = {
  router: UpdateRouter;
  /** A write in flight (React Query mutations): a reload now could cut it. */
  busy: () => boolean;
  sw?: Sw;
  win?: Window;
  doc?: Document;
  now?: () => number;
  reload?: () => void;
};

/** A page opened or brought back counts as untouched for this long. */
export const QUIET_MS = 20_000;
export const CHECK_EVERY_MS = 30 * 60_000;
/** Least time between two update checks (tab back, online). */
export const CHECK_GAP_MS = 60_000;
/** Least time between two update checks triggered by navigations. */
export const NAV_CHECK_GAP_MS = 5 * 60_000;
/** A failed chunk preload reloads once in this time, never in a loop. */
const PRELOAD_RELOAD_KEY = "piti-update-reload";
const PRELOAD_RELOAD_MS = 30_000;

// Pages where nothing reloads by itself: the live scoring (la mesa, the admin's «en juego» and its forms)
// and the pizarra (a board being drawn).
const HELD_PATHS = [/^\/matches\/[^/]+\/mesa\/?$/, /^\/admin(\/|$)/, /^\/pizarra\/?$/];
const TYPED = new Set(["", "text", "email", "number", "tel", "url", "search", "password", "date", "time", "datetime-local", "month", "week"]);

/** True when switching now could lose what someone is doing on this page. */
export function holdsUpdate(doc: Document, pathname: string): boolean {
  if (HELD_PATHS.some((re) => re.test(pathname))) return true;
  const active = doc.activeElement;
  if (active && active !== doc.body && (active.matches("input, textarea, select") || (active as HTMLElement).isContentEditable)) return true;
  const shown = (el: Element) => !el.closest('[hidden], [aria-hidden="true"], [inert]');
  if ([...doc.querySelectorAll('dialog[open], [aria-modal="true"], [role="dialog"], [role="alertdialog"]')].some(shown)) return true;
  for (const el of doc.querySelectorAll<HTMLInputElement | HTMLTextAreaElement>("form textarea, form input")) {
    if (el.tagName === "INPUT" && !TYPED.has(el.type)) continue;
    if (el.value.trim() !== "" && shown(el)) return true;
  }
  return false;
}

// ---- the state the notice reads
let stale = false;
let applyFn: () => void = () => window.location.reload();
const listeners = new Set<() => void>();
const set = (next: boolean) => {
  if (stale === next) return;
  stale = next;
  for (const fn of listeners) fn();
};
export const appUpdate = {
  /** A newer version took over this page's worker: the page is the previous one. */
  get: () => stale,
  subscribe(fn: () => void) {
    listeners.add(fn);
    return () => void listeners.delete(fn);
  },
  /** «Actualizar»: switch now, whatever the page. */
  apply: () => applyFn(),
};

/** Registers the service worker and keeps this tab on the latest deploy. Returns a stop (tests). */
export function startAppUpdates(o: UpdateOptions): () => void {
  const win = o.win ?? window;
  const doc = o.doc ?? document;
  const sw = o.sw ?? navigator.serviceWorker;
  const now = o.now ?? Date.now;
  const reload = o.reload ?? (() => win.location.reload());
  const offs: (() => void)[] = [];
  const on = (target: Pick<EventTarget, "addEventListener" | "removeEventListener">, type: string, fn: (e: Event) => void, opts?: AddEventListenerOptions) => {
    target.addEventListener(type, fn, opts);
    offs.push(() => target.removeEventListener(type, fn, opts));
  };

  let registration: ServiceWorkerRegistration | undefined;
  let controlled = !!sw.controller;
  let lastCheck = now();
  let quietSince = now();
  let touched = false;
  let switching = false;

  const switchNow = () => {
    if (switching) return;
    switching = true;
    reload();
  };
  applyFn = switchNow;
  const safe = () => !o.busy() && !holdsUpdate(doc, o.router.state.location.pathname);
  const quiet = () => !touched && now() - quietSince < QUIET_MS;
  const check = (gap = CHECK_GAP_MS) => {
    if (!registration || stale || now() - lastCheck < gap || win.navigator.onLine === false) return;
    lastCheck = now();
    registration.update().catch(() => {});
  };

  const register = () => {
    sw.register("/sw.js", { scope: "/" }).then(
      (reg) => void (registration = reg),
      () => {},
    );
  };
  if (doc.readyState === "complete") register();
  else on(win, "load", register, { once: true });

  // The first worker claiming a page that had none is not a new version (first visit).
  on(sw, "controllerchange", () => {
    if (!controlled) {
      controlled = true;
      return;
    }
    set(true);
    if (quiet() && safe()) switchNow();
  });

  for (const type of ["pointerdown", "keydown", "wheel", "touchstart"]) on(win, type, () => void (touched = true), { capture: true, passive: true });

  on(doc, "visibilitychange", () => {
    if (doc.visibilityState === "hidden") {
      if (stale && safe()) switchNow();
      return;
    }
    quietSince = now();
    touched = false;
    if (stale && safe()) switchNow();
    else check();
  });
  on(win, "online", () => check());
  const every = win.setInterval(() => doc.visibilityState === "visible" && check(), CHECK_EVERY_MS);
  offs.push(() => win.clearInterval(every));

  // A navigation to another page: the stale page lets the browser load the destination from the new
  // version. The history entry is written in a microtask (TanStack history), so reload after it.
  offs.push(
    o.router.subscribe("onBeforeNavigate", ({ pathChanged }) => {
      if (!pathChanged) return;
      if (stale && !o.busy()) {
        switching = true;
        win.setTimeout(reload, 0);
      } else check(NAV_CHECK_GAP_MS);
    }),
  );

  // A chunk or its CSS that will not load (a deploy removed it): load the page again, once.
  on(win, "vite:preloadError", (e) => {
    let last = 0;
    try {
      last = Number(win.sessionStorage.getItem(PRELOAD_RELOAD_KEY)) || 0;
    } catch {
      // storage blocked: still reload once per page
    }
    if (switching || now() - last < PRELOAD_RELOAD_MS) return;
    e.preventDefault();
    try {
      win.sessionStorage.setItem(PRELOAD_RELOAD_KEY, String(now()));
    } catch {
      // storage blocked
    }
    switchNow();
  });

  return () => {
    for (const off of offs) off();
    set(false);
    applyFn = () => window.location.reload();
  };
}
