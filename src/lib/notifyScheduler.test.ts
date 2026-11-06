import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { createPressAwareScheduler, MAX_HOLD_MS } from "./notifyScheduler";

/** A window stand-in: real (fake-timer) timeouts, frames run by hand, events fired by hand. */
function makeHost() {
  const listeners = new Map<string, ((e: Event) => void)[]>();
  const frames: (() => void)[] = [];
  const host = {
    addEventListener: (type: string, fn: (e: Event) => void) => listeners.set(type, [...(listeners.get(type) ?? []), fn]),
    requestAnimationFrame: (cb: () => void) => frames.push(cb),
    setTimeout: (cb: () => void, ms: number) => setTimeout(cb, ms),
    clearTimeout: (id: unknown) => clearTimeout(id as ReturnType<typeof setTimeout>),
  };
  const fire = (type: string, init: Record<string, unknown> = {}) => {
    for (const fn of listeners.get(type) ?? []) fn({ type, pointerId: 1, code: "Enter", repeat: false, ...init } as unknown as Event);
  };
  const frame = () => frames.splice(0).forEach((cb) => cb());
  return { host, fire, frame };
}

describe("createPressAwareScheduler", () => {
  beforeEach(() => vi.useFakeTimers());
  afterEach(() => vi.useRealTimers());

  it("outside a press, runs each notification in its own timeout, as Query's default does", () => {
    const { host } = makeHost();
    const schedule = createPressAwareScheduler(host);
    const ran: string[] = [];
    schedule(() => ran.push("a"));
    expect(ran).toEqual([]);
    vi.advanceTimersByTime(0);
    expect(ran).toEqual(["a"]);
  });

  it("holds notifications while a finger is down and releases them after the frame that follows the release", () => {
    const { host, fire, frame } = makeHost();
    const schedule = createPressAwareScheduler(host);
    const ran: string[] = [];
    fire("pointerdown");
    schedule(() => ran.push("a"));
    schedule(() => ran.push("b"));
    vi.advanceTimersByTime(100);
    expect(ran).toEqual([]);
    fire("pointerup");
    vi.advanceTimersByTime(100);
    expect(ran).toEqual([]); // no frame yet: the tap's own answer paints first
    frame();
    expect(ran).toEqual([]);
    vi.advanceTimersByTime(0);
    expect(ran).toEqual(["a", "b"]);
    // and afterwards it is back to the default
    schedule(() => ran.push("c"));
    vi.advanceTimersByTime(0);
    expect(ran).toEqual(["a", "b", "c"]);
  });

  it("a new press before the release keeps holding", () => {
    const { host, fire, frame } = makeHost();
    const schedule = createPressAwareScheduler(host);
    const ran: string[] = [];
    fire("pointerdown");
    schedule(() => ran.push("a"));
    fire("pointerup");
    fire("pointerdown");
    frame();
    vi.advanceTimersByTime(0);
    expect(ran).toEqual([]);
    fire("pointerup");
    frame();
    vi.advanceTimersByTime(0);
    expect(ran).toEqual(["a"]);
  });

  it("never holds longer than MAX_HOLD_MS (a drag), nor past a cancelled pointer or a key", () => {
    const { host, fire, frame } = makeHost();
    const schedule = createPressAwareScheduler(host);
    const ran: string[] = [];
    fire("pointerdown");
    schedule(() => ran.push("drag"));
    vi.advanceTimersByTime(MAX_HOLD_MS);
    expect(ran).toEqual(["drag"]);
    schedule(() => ran.push("after"));
    vi.advanceTimersByTime(0);
    expect(ran).toEqual(["drag", "after"]);

    fire("pointerdown", { pointerId: 2 });
    schedule(() => ran.push("cancel"));
    fire("pointercancel", { pointerId: 2 });
    frame();
    vi.advanceTimersByTime(0);
    expect(ran.at(-1)).toBe("cancel");

    fire("keydown");
    schedule(() => ran.push("key"));
    fire("keyup");
    vi.advanceTimersByTime(0);
    expect(ran.at(-1)).toBe("cancel");
    frame();
    vi.advanceTimersByTime(0);
    expect(ran.at(-1)).toBe("key");
  });

  it("leaving the tab mid-press releases everything at once", () => {
    const { host, fire } = makeHost();
    const schedule = createPressAwareScheduler(host);
    const ran: string[] = [];
    fire("pointerdown");
    schedule(() => ran.push("a"));
    fire("blur");
    expect(ran).toEqual(["a"]);
  });
});
