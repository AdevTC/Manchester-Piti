import { act, renderHook } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { useCharla } from "./useCharla";
import { useReplay } from "./useReplay";

// The transports act at once on every press, from where the charla / the replay really is: quick
// presses add up even when the board (or the 3D stadium) has not drawn the previous one yet — here, many
// presses inside one act(), before any re-render.

describe("la charla's transport", () => {
  const charla = (onMove = vi.fn()) =>
    renderHook(() => useCharla({ on: true, last: 13, rm: false, engine: () => true, onMove }));

  it("every press of «siguiente» counts, however quick", () => {
    const onMove = vi.fn();
    const { result } = charla(onMove);
    const api = result.current;
    act(() => {
      for (let k = 0; k < 14; k++) api.step1(1);
    });
    expect(result.current.step).toBe(13);
    expect(result.current.playing).toBe(false);
    // each step was told once, in order, as a press
    expect(onMove.mock.calls.map((c) => c[0])).toEqual([1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13]);
    expect(onMove.mock.calls.every((c) => c[1] === "user")).toBe(true);
    act(() => {
      api.step1(-1);
      api.step1(-1);
      api.seek(4);
      api.step1(1);
    });
    expect(result.current.step).toBe(5);
  });

  it("a late report of the 3D stadium never undoes a press", () => {
    const { result } = charla();
    const api = result.current;
    act(() => {
      api.step1(1);
      api.step1(1);
      // the engine was still filming step 1
      api.reached(2);
    });
    expect(result.current.step).toBe(2);
    act(() => api.reached(5));
    expect(result.current.step).toBe(2);
  });

  it("play / pause pressed twice quickly is back where it was", () => {
    const { result } = charla();
    const api = result.current;
    act(() => {
      api.toggle();
      api.toggle();
    });
    expect(result.current.playing).toBe(true);
  });
});

describe("the replay's transport", () => {
  it("every press counts, however quick (and play / pause twice is a no-op)", () => {
    const onMove = vi.fn();
    const { result } = renderHook(() => useReplay({ key: "b:j", n: 4, slow: false, loop: true, frozen: false, onMove }));
    const api = result.current;
    act(() => {
      api.step(1);
      api.step(1);
      api.step(1);
      api.step(1);
    });
    expect(result.current.frame).toBe(3);
    expect(onMove.mock.calls.map((c) => c[0])).toEqual([1, 2, 3]);
    act(() => {
      api.step(-1);
      api.seek(0);
      api.step(1);
    });
    expect(result.current.frame).toBe(1);
    act(() => {
      api.toggle();
      api.toggle();
    });
    expect(result.current.playing).toBe(false);
    // play at the last paso starts over: the wipe is asked for once
    onMove.mockClear();
    act(() => {
      api.seek(3);
      api.play();
      api.play();
    });
    expect(result.current).toMatchObject({ frame: 0, playing: true });
    expect(onMove.mock.calls).toEqual([
      [3, "user"],
      [0, "wrap"],
    ]);
  });
});
