// r14 «La pizarra» · rendimiento: a change of place runs its View Transition without waiting for a frame (inside the
// update callback the page does not render: a requestAnimationFrame there never fires and Chrome froze the screen
// for 4 s before aborting the transition), and a lazily loaded part that was preloaded renders without suspending.
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { Suspense } from "react";
import { act, render, screen } from "@testing-library/react";
import { makeTestStore } from "./testkit";
import { lazyPart, partPreload } from "./lazyPart";
import { preloadPlace, registerPlace } from "./registry";

describe("P.nav's View Transition", () => {
  let updates: Promise<void>[];
  let raf: ReturnType<typeof vi.fn>;
  beforeEach(() => {
    updates = [];
    // like Chrome during the update callback: no frame is ever rendered
    raf = vi.fn(() => 0);
    vi.stubGlobal("requestAnimationFrame", raf);
    vi.stubGlobal("matchMedia", (q: string) => ({ matches: false, media: q, addEventListener() {}, removeEventListener() {} }));
    const start = (cb: () => Promise<void> | void) => {
      const r = cb();
      updates.push(Promise.resolve(r));
      return { ready: Promise.resolve(), finished: Promise.resolve(), updateCallbackDone: Promise.resolve() };
    };
    Object.defineProperty(document, "startViewTransition", { configurable: true, writable: true, value: start });
  });
  afterEach(() => {
    Reflect.deleteProperty(document, "startViewTransition");
    vi.unstubAllGlobals();
  });

  it("the update callback ends once the address reached the store, with no frame in between", async () => {
    const { P, host } = makeTestStore({ place: "siete" });
    P.nav("/pizarra/plan");
    await vi.waitFor(() => expect(updates).toHaveLength(1));
    expect(host.navigate).toHaveBeenCalled();
    expect(P.state.route.place).toBe("plan");
    let done = false;
    void updates[0].then(() => (done = true));
    // (the router answered at once: a task later the callback is over — never 400 ms, never a frame)
    await new Promise((r) => setTimeout(r, 20));
    expect(done).toBe(true);
    expect(raf).not.toHaveBeenCalled();
  });

  it("waits (briefly) for a place's chunk that isn't here yet, then runs the change", async () => {
    let resolve: () => void = () => undefined;
    const Comp = lazyPart(() => new Promise<() => null>((r) => (resolve = () => r(() => null))));
    registerPlace("pachanga", { Component: Comp });
    const { P, host } = makeTestStore({ place: "siete" });
    P.nav("/pizarra/pachanga");
    await new Promise((r) => setTimeout(r, 10));
    expect(host.navigate).not.toHaveBeenCalled();
    resolve();
    await vi.waitFor(() => expect(host.navigate).toHaveBeenCalled());
    expect(preloadPlace("pachanga")).toBeNull();
  });
});

describe("lazyPart", () => {
  it("suspends before its chunk is here, renders directly once preloaded", async () => {
    const load = vi.fn(async () => (p: { t: string }) => <b>{p.t}</b>);
    const Part = lazyPart(load);
    expect(Part.loaded()).toBe(false);
    await act(async () => {
      await partPreload(Part);
    });
    expect(Part.loaded()).toBe(true);
    expect(partPreload(Part)).toBeNull();
    // (no fallback: it never suspends now)
    render(
      <Suspense fallback={<i>cargando</i>}>
        <Part t="El siete" />
      </Suspense>,
    );
    expect(screen.getByText("El siete")).toBeTruthy();
    expect(screen.queryByText("cargando")).toBeNull();
    expect(load).toHaveBeenCalledTimes(1);
  });

  it("not preloaded: Suspense shows its fallback until the chunk arrives, then the part", async () => {
    const Part = lazyPart(async () => (p: { t: string }) => <b>{p.t}</b>);
    render(
      <Suspense fallback={<i>cargando</i>}>
        <Part t="Plan" />
      </Suspense>,
    );
    expect(screen.getByText("cargando")).toBeTruthy();
    expect(await screen.findByText("Plan")).toBeTruthy();
  });

  it("a failed fetch is tried again", async () => {
    let n = 0;
    const Part = lazyPart(async () => {
      n++;
      if (n === 1) throw new Error("offline");
      return () => null;
    });
    await expect(Part.preload()).rejects.toThrow("offline");
    await Part.preload();
    expect(Part.loaded()).toBe(true);
  });
});
