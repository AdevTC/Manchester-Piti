// @vitest-environment jsdom
import { act, renderHook } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { STADIUM_IDLE_MS, useReducedMotion, useStadiumMount } from "./useDevice";
import { parsePrefs, PREFS0, v3Default } from "./prefs";

// The 3D policy: «Estadio 3D» starts on only where it is cheap; the stadium is mounted while 3D moments
// want it and given back after a minute without them; reduced motion is read live.

afterEach(() => {
  vi.useRealTimers();
  Reflect.deleteProperty(window, "matchMedia");
});

describe("«Estadio 3D» by default", () => {
  it("on only for a capable device that doesn't save data: never on a phone, with Save-Data or little memory", () => {
    expect(v3Default({})).toBe(true);
    expect(v3Default({ memory: 8 })).toBe(true);
    expect(v3Default({ touch: true, memory: 8 })).toBe(false);
    expect(v3Default({ saveData: true })).toBe(false);
    expect(v3Default({ memory: 2 })).toBe(false);
    expect(v3Default({ memory: 4 })).toBe(true);
  });

  it("a first visit takes the device's default; a stored choice always wins", () => {
    expect(parsePrefs(null, false)).toEqual({ ...PREFS0, v3: false });
    expect(parsePrefs("{nope", false).v3).toBe(false);
    expect(parsePrefs(JSON.stringify({ snd: true }), false)).toEqual({ ...PREFS0, snd: true, v3: false });
    expect(parsePrefs(JSON.stringify({ v3: true }), false).v3).toBe(true);
    expect(parsePrefs(null, true)).toBe(PREFS0);
  });

  it("reads the device: a phone (coarse pointer only) starts in 2D", () => {
    window.matchMedia = vi.fn((q: string) => ({ matches: q === "(pointer: coarse)", media: q }) as MediaQueryList);
    expect(v3Default()).toBe(false);
    window.matchMedia = vi.fn((q: string) => ({ matches: q === "(pointer: coarse)" || q === "(any-pointer: fine)", media: q }) as MediaQueryList);
    expect(v3Default()).toBe(true);
  });
});

describe("the stadium's mount", () => {
  it("mounts on demand, stays between moments, unmounts after a minute without one, mounts again", () => {
    vi.useFakeTimers();
    const { result, rerender } = renderHook(({ can, want }) => useStadiumMount(can, want), { initialProps: { can: true, want: false } });
    expect(result.current).toBe(false);
    rerender({ can: true, want: true });
    expect(result.current).toBe(true);
    rerender({ can: true, want: false });
    act(() => {
      vi.advanceTimersByTime(STADIUM_IDLE_MS - 1);
    });
    expect(result.current).toBe(true);
    // another moment within the minute: the clock starts again after it
    rerender({ can: true, want: true });
    rerender({ can: true, want: false });
    act(() => {
      vi.advanceTimersByTime(STADIUM_IDLE_MS - 1);
    });
    expect(result.current).toBe(true);
    act(() => {
      vi.advanceTimersByTime(1);
    });
    expect(result.current).toBe(false);
    rerender({ can: true, want: true });
    expect(result.current).toBe(true);
    // the device can't (3D off, it failed): gone at once
    rerender({ can: false, want: true });
    expect(result.current).toBe(false);
  });
});

describe("reduced motion, live", () => {
  it("follows the system setting while the page is open", () => {
    let matches = false;
    const listeners = new Set<() => void>();
    window.matchMedia = vi.fn(
      (q: string) =>
        ({
          get matches() {
            return matches;
          },
          media: q,
          addEventListener: (_: string, f: () => void) => listeners.add(f),
          removeEventListener: (_: string, f: () => void) => listeners.delete(f),
        }) as unknown as MediaQueryList,
    );
    const { result, unmount } = renderHook(() => useReducedMotion());
    expect(result.current).toBe(false);
    act(() => {
      matches = true;
      listeners.forEach((f) => f());
    });
    expect(result.current).toBe(true);
    unmount();
    expect(listeners.size).toBe(0);
  });

  it("no matchMedia: full motion", () => {
    Reflect.deleteProperty(window, "matchMedia");
    expect(renderHook(() => useReducedMotion()).result.current).toBe(false);
  });
});
