// @vitest-environment jsdom
import { afterEach, describe, expect, it, vi } from "vitest";
import type { AnyRouter } from "@tanstack/react-router";
import { navProgress, NAV_PROGRESS_DELAY } from "./navProgress";

type Handler = (e: { pathChanged: boolean }) => void;
function fakeRouter() {
  const subs = new Map<string, Set<Handler>>();
  return {
    router: {
      subscribe: (type: string, fn: Handler) => {
        const set = subs.get(type) ?? new Set<Handler>();
        set.add(fn);
        subs.set(type, set);
        return () => set.delete(fn);
      },
    } as unknown as AnyRouter,
    emit: (type: string, e: { pathChanged: boolean }) => subs.get(type)?.forEach((fn) => fn(e)),
  };
}

let stop = () => {};
afterEach(() => {
  stop();
  vi.useRealTimers();
});

describe("the line across the top", () => {
  it("shows only for a change of page that keeps waiting, and runs out when it is in", () => {
    vi.useFakeTimers();
    const { router, emit } = fakeRouter();
    stop = navProgress(router);
    const bar = document.querySelector<HTMLElement>(".vd-navprogress")!;
    emit("onBeforeLoad", { pathChanged: true });
    vi.advanceTimersByTime(NAV_PROGRESS_DELAY - 10);
    expect("on" in bar.dataset).toBe(false);
    vi.advanceTimersByTime(20);
    expect("on" in bar.dataset).toBe(true);
    emit("onResolved", { pathChanged: true });
    expect("on" in bar.dataset).toBe(false);
    expect("done" in bar.dataset).toBe(true);
  });

  it("never shows for a quick change, nor for one that stays on the same page", () => {
    vi.useFakeTimers();
    const { router, emit } = fakeRouter();
    stop = navProgress(router);
    const bar = document.querySelector<HTMLElement>(".vd-navprogress")!;
    emit("onBeforeLoad", { pathChanged: true });
    emit("onResolved", { pathChanged: true });
    emit("onBeforeLoad", { pathChanged: false });
    vi.advanceTimersByTime(1000);
    expect("on" in bar.dataset).toBe(false);
    expect("done" in bar.dataset).toBe(false);
  });
});
