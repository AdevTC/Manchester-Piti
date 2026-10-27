// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { _resetTapsForTesting, followHistory, pageChangeTypes, pageKeyOf, startPageTransition, tapsSkipTransitions } from "./pageTransition";

type FakeTransition = { finished: Promise<void>; skipTransition: ReturnType<typeof vi.fn>; end: () => void };
function fakeDocument() {
  const doc = document.implementation.createHTMLDocument("t");
  const started: FakeTransition[] = [];
  (doc as unknown as { startViewTransition: () => FakeTransition }).startViewTransition = () => {
    let end = () => {};
    const finished = new Promise<void>((resolve) => (end = resolve));
    const t = { finished, skipTransition: vi.fn(), end };
    started.push(t);
    return t;
  };
  const start = () => (doc as unknown as { startViewTransition: () => FakeTransition }).startViewTransition();
  const tap = () => doc.dispatchEvent(new Event("pointerdown"));
  return { doc, start, tap, started };
}

afterEach(() => _resetTapsForTesting());

describe("a tap during a View Transition", () => {
  it("finishes the running transition at once", () => {
    const { doc, start, tap } = fakeDocument();
    tapsSkipTransitions(doc);
    const t = start();
    tap();
    expect(t.skipTransition).toHaveBeenCalledTimes(1);
  });

  it("does nothing once the transition is over", async () => {
    const { doc, start, tap } = fakeDocument();
    tapsSkipTransitions(doc);
    const t = start();
    t.end();
    await t.finished;
    tap();
    expect(t.skipTransition).not.toHaveBeenCalled();
  });

  it("follows the latest transition only", () => {
    const { doc, start, tap } = fakeDocument();
    tapsSkipTransitions(doc);
    const first = start();
    const second = start();
    tap();
    expect(first.skipTransition).not.toHaveBeenCalled();
    expect(second.skipTransition).toHaveBeenCalledTimes(1);
  });
});

describe("the page an address belongs to", () => {
  it("keeps a page's screens together and tells pages apart", () => {
    expect(pageKeyOf("/")).toBe("inicio");
    expect(pageKeyOf("/hoy/campo")).toBe("inicio");
    expect(pageKeyOf("/partidos/tabla")).toBe("partidos");
    expect(pageKeyOf("/partidos/abc/siete")).toBe("partido:abc");
    expect(pageKeyOf("/partidos/xyz")).toBe("partido:xyz");
    expect(pageKeyOf("/estadisticas/juego/tabla")).toBe("stats");
    expect(pageKeyOf("/jugadores/p1/temporada")).toBe("plantilla");
    expect(pageKeyOf("/plantilla/")).toBe("plantilla");
    expect(pageKeyOf("/club/vitrina/copa")).toBe("club");
    expect(pageKeyOf("/avisos/a-medida")).toBe("tu");
  });

  it("leaves the apps of their own out (the Sala de control, the pizarra, la mesa)", () => {
    expect(pageKeyOf("/admin/partidos")).toBeNull();
    expect(pageKeyOf("/pizarra")).toBeNull();
    expect(pageKeyOf("/partidos/abc/mesa")).toBeNull();
  });
});

describe("the router's default transition", () => {
  type Listener = (opts: { action: { type: string; index?: number } }) => void;
  const history = () => {
    const subs = new Set<Listener>();
    return {
      subscribe: (cb: Listener) => {
        subs.add(cb);
        return () => subs.delete(cb);
      },
      go: (type: string, index?: number) => subs.forEach((cb) => cb({ action: { type, index } })),
    };
  };
  const info = (from: string | null, to: string) => ({ fromLocation: from ? { pathname: from } : undefined, toLocation: { pathname: to }, pathChanged: from !== to });
  const root = () => document.documentElement.dataset;
  const doc = document as unknown as { startViewTransition?: unknown };
  const had = doc.startViewTransition;
  beforeEach(() => {
    doc.startViewTransition = () => undefined;
  });
  afterEach(() => {
    doc.startViewTransition = had;
    delete root().vdDir;
    delete root().vdPage;
    delete root().vdCalm;
  });

  it("animates a change of page, forward to the right", () => {
    const h = history();
    followHistory(h);
    h.go("PUSH");
    expect(pageChangeTypes(info("/partidos", "/jugadores/p1"))).toEqual(["vd-page", "vd-forward"]);
    expect(root().vdDir).toBe("right");
    expect("vdPage" in root()).toBe(true);
  });

  it("goes left on the browser's back", () => {
    const h = history();
    followHistory(h);
    h.go("BACK");
    expect(pageChangeTypes(info("/club", "/estadisticas"))).toEqual(["vd-page", "vd-back"]);
    expect(root().vdDir).toBe("left");
  });

  it("leaves the first load, a change inside a page and the apps alone", () => {
    expect(pageChangeTypes(info(null, "/"))).toBe(false);
    expect(pageChangeTypes(info("/partidos", "/partidos/tabla"))).toBe(false);
    expect(pageChangeTypes(info("/admin", "/"))).toBe(false);
    expect("vdPage" in root()).toBe(false);
  });

  it("adds none when the browser already animated the step back (a swipe)", () => {
    const h = history();
    followHistory(h);
    const pop = new PopStateEvent("popstate");
    Object.defineProperty(pop, "hasUAVisualTransition", { value: true });
    window.dispatchEvent(pop);
    h.go("BACK");
    expect(pageChangeTypes(info("/club", "/"))).toBe(false);
  });
});

describe("a change of page through the transition", () => {
  const doc = document as unknown as { startViewTransition?: unknown };
  const had = doc.startViewTransition;
  afterEach(() => {
    doc.startViewTransition = had;
    document.body.innerHTML = "";
  });

  it("marks what leaves, unmarks what the next page keeps, and clears it all at the end", async () => {
    let update: (() => Promise<void>) | undefined;
    let end = () => {};
    const finished = new Promise<void>((resolve) => (end = resolve));
    doc.startViewTransition = (opts: { update?: () => Promise<void> } | (() => Promise<void>)) => {
      update = typeof opts === "function" ? opts : opts.update;
      return { finished, updateCallbackDone: Promise.resolve(), ready: Promise.resolve(), skipTransition: () => {} };
    };
    tapsSkipTransitions(document);
    document.body.innerHTML = '<div class="vx"><main><section class="vd-reg-1">a</section></main></div>';
    const main = document.querySelector("main")!;
    const region = document.querySelector("section")!;
    startPageTransition("right");
    expect(main.hasAttribute("data-vd-out")).toBe(true);
    expect(region.hasAttribute("data-vd-out")).toBe(true);
    (document as unknown as { startViewTransition: (cb: () => Promise<void>) => unknown }).startViewTransition(async () => {
      region.remove();
    });
    await update?.();
    // (the next page kept the main: it no longer leaves)
    expect(main.hasAttribute("data-vd-out")).toBe(false);
    expect("vdPage" in document.documentElement.dataset).toBe(true);
    end();
    await finished;
    await Promise.resolve();
    expect("vdPage" in document.documentElement.dataset).toBe(false);
  });
});
