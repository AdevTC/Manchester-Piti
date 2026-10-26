// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { appUpdate, CHECK_GAP_MS, holdsUpdate, NAV_CHECK_GAP_MS, QUIET_MS, startAppUpdates, type UpdateRouter } from "./appUpdate";

// ---- fakes: a service worker container, the router, the clock and the tab's visibility
class FakeSw extends EventTarget {
  controller: ServiceWorker | null;
  update = vi.fn(() => Promise.resolve());
  register = vi.fn(() => Promise.resolve({ update: this.update } as unknown as ServiceWorkerRegistration));
  constructor(controlled: boolean) {
    super();
    this.controller = controlled ? ({} as ServiceWorker) : null;
  }
  takeOver() {
    this.controller = {} as ServiceWorker;
    this.dispatchEvent(new Event("controllerchange"));
  }
}

let t = 0;
let visibility: DocumentVisibilityState = "visible";
let navigate: (e: { pathChanged: boolean }) => void = () => {};
const router: UpdateRouter = {
  subscribe: (_event, fn) => {
    navigate = fn;
    return () => void (navigate = () => {});
  },
  state: { location: { pathname: "/" } },
};
let stop: () => void = () => {};

const start = (opts: { controlled?: boolean; busy?: () => boolean } = {}) => {
  const sw = new FakeSw(opts.controlled ?? true);
  const reload = vi.fn();
  stop = startAppUpdates({ router, busy: opts.busy ?? (() => false), sw, reload, now: () => t });
  return { sw, reload };
};
const setVisibility = (v: DocumentVisibilityState) => {
  visibility = v;
  document.dispatchEvent(new Event("visibilitychange"));
};
const touch = () => window.dispatchEvent(new Event("pointerdown"));

beforeEach(() => {
  vi.useFakeTimers();
  t = 1_000_000;
  visibility = "visible";
  Object.defineProperty(document, "visibilityState", { configurable: true, get: () => visibility });
  router.state.location.pathname = "/";
  document.body.innerHTML = "";
});
afterEach(() => {
  stop();
  vi.useRealTimers();
  sessionStorage.clear();
});

describe("startAppUpdates", () => {
  it("registers the worker", async () => {
    const { sw } = start();
    expect(sw.register).toHaveBeenCalledWith("/sw.js", { scope: "/" });
  });

  it("the first worker claiming a page that had none is not a new version", () => {
    const { sw, reload } = start({ controlled: false });
    sw.takeOver();
    expect(appUpdate.get()).toBe(false);
    expect(reload).not.toHaveBeenCalled();
    sw.takeOver(); // a later deploy
    expect(appUpdate.get()).toBe(true);
  });

  it("a page just opened and not touched switches at once", () => {
    const { sw, reload } = start();
    t += 3_000;
    sw.takeOver();
    expect(appUpdate.get()).toBe(true);
    expect(reload).toHaveBeenCalledTimes(1);
  });

  it("a page in use keeps going and waits for a safe moment (the notice shows)", () => {
    const { sw, reload } = start();
    touch();
    sw.takeOver();
    expect(appUpdate.get()).toBe(true);
    expect(reload).not.toHaveBeenCalled();
  });

  it("a page left alone past the quiet time does not switch under the reader", () => {
    const { sw, reload } = start();
    t += QUIET_MS + 1;
    sw.takeOver();
    expect(reload).not.toHaveBeenCalled();
  });

  it("a stale page keeps moving between pages without reloading (the previous deploy's chunks stay reachable)", () => {
    const { sw, reload } = start();
    touch();
    sw.takeOver();
    navigate({ pathChanged: false });
    navigate({ pathChanged: true });
    vi.runOnlyPendingTimers();
    expect(reload).not.toHaveBeenCalled();
    expect(appUpdate.get()).toBe(true);
  });

  it("never switches while a write is in flight, even when the tab goes to the background", () => {
    let busy = true;
    const { sw, reload } = start({ busy: () => busy });
    touch();
    sw.takeOver();
    setVisibility("hidden");
    expect(reload).not.toHaveBeenCalled();
    busy = false;
    setVisibility("visible");
    setVisibility("hidden");
    expect(reload).toHaveBeenCalledTimes(1);
  });

  it("switches when the tab goes to the background, or comes back, if nothing is held", () => {
    const { sw, reload } = start();
    touch();
    sw.takeOver();
    setVisibility("hidden");
    expect(reload).toHaveBeenCalledTimes(1);

    stop();
    const second = start();
    touch();
    router.state.location.pathname = "/partidos/m1/mesa";
    second.sw.takeOver();
    setVisibility("hidden");
    expect(second.reload).not.toHaveBeenCalled();
    router.state.location.pathname = "/partidos";
    setVisibility("visible");
    expect(second.reload).toHaveBeenCalledTimes(1);
  });

  it("la mesa never switches by itself, but the tab hidden after leaving it does", () => {
    router.state.location.pathname = "/partidos/m1/mesa";
    const { sw, reload } = start();
    sw.takeOver(); // untouched, just opened: still held
    setVisibility("hidden");
    setVisibility("visible");
    expect(reload).not.toHaveBeenCalled();
    expect(appUpdate.get()).toBe(true);
    router.state.location.pathname = "/partidos";
    navigate({ pathChanged: true });
    vi.advanceTimersByTime(0);
    expect(reload).not.toHaveBeenCalled();
    setVisibility("hidden");
    expect(reload).toHaveBeenCalledTimes(1);
  });

  it("«Actualizar» switches now, on any page", () => {
    router.state.location.pathname = "/partidos/m1/mesa";
    const { sw, reload } = start();
    sw.takeOver();
    appUpdate.apply();
    expect(reload).toHaveBeenCalledTimes(1);
    appUpdate.apply(); // already on its way
    expect(reload).toHaveBeenCalledTimes(1);
  });

  it("asks for a new worker when the tab comes back, now and then, and on navigations (spaced)", async () => {
    const { sw } = start();
    await Promise.resolve(); // the registration
    setVisibility("hidden");
    setVisibility("visible");
    expect(sw.update).not.toHaveBeenCalled(); // checked at start, too soon
    t += CHECK_GAP_MS;
    setVisibility("visible");
    expect(sw.update).toHaveBeenCalledTimes(1);
    navigate({ pathChanged: true });
    expect(sw.update).toHaveBeenCalledTimes(1);
    t += NAV_CHECK_GAP_MS;
    navigate({ pathChanged: true });
    expect(sw.update).toHaveBeenCalledTimes(2);
    t += 30 * 60_000;
    vi.advanceTimersByTime(30 * 60_000);
    expect(sw.update).toHaveBeenCalledTimes(3);
  });

  it("a chunk that will not load reloads once, never in a loop", () => {
    const { reload } = start();
    const first = new Event("vite:preloadError", { cancelable: true });
    window.dispatchEvent(first);
    expect(first.defaultPrevented).toBe(true);
    expect(reload).toHaveBeenCalledTimes(1);

    stop();
    const again = start(); // the reloaded page, a few seconds later
    t += 5_000;
    const second = new Event("vite:preloadError", { cancelable: true });
    window.dispatchEvent(second);
    expect(second.defaultPrevented).toBe(false);
    expect(again.reload).not.toHaveBeenCalled();
  });
});

describe("holdsUpdate", () => {
  it("holds on la mesa, the admin and the pizarra", () => {
    expect(holdsUpdate(document, "/partidos/abc/mesa")).toBe(true);
    expect(holdsUpdate(document, "/admin/partidos/en-juego/abc")).toBe(true);
    expect(holdsUpdate(document, "/pizarra")).toBe(true);
    expect(holdsUpdate(document, "/partidos/abc")).toBe(false);
    expect(holdsUpdate(document, "/")).toBe(false);
  });

  it("holds while a field has the focus or a form has something typed", () => {
    document.body.innerHTML = `<form><input id="a" type="text"><input id="c" type="checkbox" checked><textarea id="b"></textarea></form><input id="s">`;
    expect(holdsUpdate(document, "/")).toBe(false);
    (document.getElementById("s") as HTMLInputElement).focus();
    expect(holdsUpdate(document, "/")).toBe(true);
    (document.activeElement as HTMLElement).blur();
    (document.getElementById("b") as HTMLTextAreaElement).value = "Gran partido";
    expect(holdsUpdate(document, "/")).toBe(true);
  });

  it("holds while a dialog is open, not for one kept hidden", () => {
    document.body.innerHTML = `<div hidden><div role="dialog"></div></div>`;
    expect(holdsUpdate(document, "/")).toBe(false);
    document.body.innerHTML = `<div role="dialog" aria-modal="true"></div>`;
    expect(holdsUpdate(document, "/")).toBe(true);
  });
});
