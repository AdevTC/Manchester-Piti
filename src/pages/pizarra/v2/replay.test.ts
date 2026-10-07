import { act, renderHook } from "@testing-library/react";
import { useState } from "react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { hide, holdMs, replay0, seek, show, stepBy, tick, toggle } from "./replay";
import { useReplay, type ReplayArgs } from "./useReplay";

// The replay of a jugada («REPETICIÓN»): the controller (play / pause / seek / speed / loop, the hidden
// tab) and its clock.

describe("the replay controller", () => {
  it("each beat goes to the next paso; at the end it goes round again or stops", () => {
    const s = { ...replay0("k", true), frame: 2 };
    expect(tick(s, 4, true)).toEqual({ s: { ...s, frame: 3 }, wrapped: false });
    expect(tick({ ...s, frame: 3 }, 4, true)).toEqual({ s: { ...s, frame: 0 }, wrapped: true });
    expect(tick({ ...s, frame: 3 }, 4, false)).toEqual({ s: { ...s, frame: 3, playing: false }, wrapped: false });
    // paused, nothing moves
    const p = replay0("k");
    expect(tick(p, 4, true).s).toBe(p);
  });

  it("play / pause; play at the last paso starts over from the first", () => {
    const p = replay0("k");
    expect(toggle(p, 4)).toEqual({ s: { ...p, playing: true }, restarted: false });
    expect(toggle({ ...p, playing: true }, 4).s.playing).toBe(false);
    expect(toggle({ ...p, frame: 3 }, 4)).toEqual({ s: { ...p, frame: 0, playing: true }, restarted: true });
  });

  it("seek and step pause on a paso inside the jugada", () => {
    const s = { ...replay0("k", true), frame: 1 };
    expect(seek(s, 3, 4)).toEqual({ ...s, frame: 3, playing: false });
    expect(seek(s, 9, 4).frame).toBe(3);
    expect(seek(s, -2, 4).frame).toBe(0);
    expect(seek(s, Number.NaN, 4).frame).toBe(0);
    expect(stepBy(s, -1, 4).frame).toBe(0);
    expect(stepBy({ ...s, frame: 0 }, -1, 4).frame).toBe(0);
    expect(stepBy({ ...s, frame: 3 }, 1, 4).frame).toBe(3);
  });

  it("a hidden tab pauses it and the tab coming back resumes it (only if it was playing)", () => {
    const s = replay0("k", true);
    const h = hide(s);
    expect(h).toMatchObject({ playing: false, resume: true });
    expect(show(h)).toMatchObject({ playing: true, resume: false });
    const paused = replay0("k");
    expect(show(hide(paused))).toBe(paused);
  });

  it("holds each paso as designed, longer at the end and at 0,5×", () => {
    expect(holdMs(false, false)).toBe(2300);
    expect(holdMs(true, false)).toBe(2600);
    expect(holdMs(false, true)).toBeCloseTo(4370);
  });
});

describe("the replay's clock", () => {
  beforeEach(() => vi.useFakeTimers());
  afterEach(() => {
    vi.useRealTimers();
    Reflect.deleteProperty(document, "hidden");
  });
  const setup = (over: Partial<ReplayArgs> = {}) => {
    const onMove = vi.fn();
    const args: ReplayArgs = { key: "b1:lib-corner", n: 4, slow: false, loop: true, frozen: false, onMove, ...over };
    const r = renderHook((p: ReplayArgs) => useReplay(p), { initialProps: args });
    return { ...r, onMove, args };
  };

  it("plays through the pasos, goes round again and tells every move first", () => {
    const { result, onMove } = setup();
    expect(result.current).toMatchObject({ frame: 0, playing: false });
    act(() => result.current.toggle());
    expect(result.current.playing).toBe(true);
    act(() => {
      vi.advanceTimersByTime(2299);
    });
    expect(result.current.frame).toBe(0);
    act(() => {
      vi.advanceTimersByTime(1);
    });
    expect(result.current.frame).toBe(1);
    expect(onMove).toHaveBeenLastCalledWith(1, "tick");
    act(() => {
      vi.advanceTimersByTime(2300);
    });
    act(() => {
      vi.advanceTimersByTime(2300);
    });
    expect(result.current.frame).toBe(3);
    // the last paso holds a little longer, then round again (the wipe)
    act(() => {
      vi.advanceTimersByTime(2300);
    });
    expect(result.current.frame).toBe(3);
    act(() => {
      vi.advanceTimersByTime(300);
    });
    expect(result.current.frame).toBe(0);
    expect(onMove).toHaveBeenLastCalledWith(0, "wrap");
  });

  it("without the loop it stops at the end; play again starts over", () => {
    const { result, onMove } = setup({ loop: false, n: 2 });
    act(() => result.current.play());
    act(() => {
      vi.advanceTimersByTime(2300);
    });
    expect(result.current).toMatchObject({ frame: 1, playing: true });
    act(() => {
      vi.advanceTimersByTime(2600);
    });
    expect(result.current).toMatchObject({ frame: 1, playing: false });
    act(() => result.current.toggle());
    expect(result.current).toMatchObject({ frame: 0, playing: true });
    expect(onMove).toHaveBeenLastCalledWith(0, "wrap");
  });

  it("0,5× holds every paso 1.9× longer", () => {
    const { result } = setup({ slow: true });
    act(() => result.current.play());
    act(() => {
      vi.advanceTimersByTime(4369);
    });
    expect(result.current.frame).toBe(0);
    act(() => {
      vi.advanceTimersByTime(2);
    });
    expect(result.current.frame).toBe(1);
  });

  it("seek, step and pause stop the clock; the user's moves are told too", () => {
    const { result, onMove } = setup();
    act(() => result.current.play());
    act(() => result.current.seek(2));
    expect(result.current).toMatchObject({ frame: 2, playing: false });
    expect(onMove).toHaveBeenLastCalledWith(2, "user");
    act(() => {
      vi.advanceTimersByTime(10000);
    });
    expect(result.current.frame).toBe(2);
    act(() => result.current.step(1));
    expect(result.current.frame).toBe(3);
    act(() => result.current.step(1));
    expect(result.current.frame).toBe(3);
    expect(onMove).toHaveBeenCalledTimes(2);
    act(() => result.current.play());
    act(() => result.current.pause());
    act(() => {
      vi.advanceTimersByTime(10000);
    });
    expect(result.current.playing).toBe(false);
  });

  it("frozen (the 3D engine plays it): the clock stands still and the engine reports the pasos", () => {
    const { result, rerender, args, onMove } = setup();
    act(() => result.current.play());
    rerender({ ...args, frozen: true });
    act(() => {
      vi.advanceTimersByTime(10000);
    });
    expect(result.current.frame).toBe(0);
    act(() => result.current.reached(2));
    expect(result.current).toMatchObject({ frame: 2, playing: true });
    expect(onMove).not.toHaveBeenCalled();
    rerender({ ...args, frozen: false });
    act(() => {
      vi.advanceTimersByTime(2300);
    });
    expect(result.current.frame).toBe(3);
  });

  it("pauses while the tab is hidden and goes on when it comes back", () => {
    const { result } = setup();
    act(() => result.current.play());
    act(() => {
      Object.defineProperty(document, "hidden", { value: true, configurable: true });
      document.dispatchEvent(new Event("visibilitychange"));
    });
    expect(result.current.playing).toBe(false);
    act(() => {
      vi.advanceTimersByTime(10000);
    });
    expect(result.current.frame).toBe(0);
    act(() => {
      Object.defineProperty(document, "hidden", { value: false, configurable: true });
      document.dispatchEvent(new Event("visibilitychange"));
    });
    expect(result.current.playing).toBe(true);
    act(() => {
      vi.advanceTimersByTime(2300);
    });
    expect(result.current.frame).toBe(1);
  });

  it("a paused replay stays paused when the tab comes back", () => {
    const { result } = setup();
    act(() => {
      Object.defineProperty(document, "hidden", { value: true, configurable: true });
      document.dispatchEvent(new Event("visibilitychange"));
      Object.defineProperty(document, "hidden", { value: false, configurable: true });
      document.dispatchEvent(new Event("visibilitychange"));
    });
    expect(result.current.playing).toBe(false);
  });

  it("another jugada (or board) starts paused at its first paso, or playing when it opens from a link", () => {
    const { result, rerender, args } = setup();
    act(() => result.current.seek(3));
    rerender({ ...args, key: "b1:lib-falta", n: 3 });
    expect(result.current).toMatchObject({ frame: 0, playing: false });
    rerender({ ...args, key: "b2:lib-falta", n: 3, autoplay: true });
    expect(result.current).toMatchObject({ frame: 0, playing: true });
  });

  it("the same jugada under a new id (a built-in one just made yours) keeps its paso", () => {
    const r = renderHook(() => {
      const [key, setKey] = useState("b1:lib-corner");
      return { api: useReplay({ key, n: 4, slow: false, loop: true, frozen: false, onMove: () => {} }), setKey };
    });
    act(() => r.result.current.api.seek(2));
    act(() => {
      r.result.current.setKey("b1:j1");
      r.result.current.api.reset("b1:j1", false, 2);
    });
    expect(r.result.current.api).toMatchObject({ frame: 2, playing: false });
  });

  it("a jugada that loses pasos keeps the paso on screen inside it", () => {
    const { result, rerender, args } = setup();
    act(() => result.current.seek(3));
    rerender({ ...args, n: 2 });
    expect(result.current.frame).toBe(1);
  });
});
