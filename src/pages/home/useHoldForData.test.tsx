import { afterEach, describe, expect, it, vi } from "vitest";
import { act, renderHook } from "@testing-library/react";
import { useHoldForData } from "./useHoldForData";

afterEach(() => vi.useRealTimers());

describe("useHoldForData (Inicio arrived at before the data)", () => {
  it("never holds when the data is already in (server page, change of page)", () => {
    const { result } = renderHook(() => useHoldForData(false));
    expect(result.current).toBe(false);
  });

  it("holds while loading and shows the content in the same render the data arrives", () => {
    const { result, rerender } = renderHook(({ loading }) => useHoldForData(loading), { initialProps: { loading: true } });
    expect(result.current).toBe(true);
    rerender({ loading: false });
    expect(result.current).toBe(false);
  });

  it("never holds longer than the cap", () => {
    vi.useFakeTimers();
    const { result } = renderHook(() => useHoldForData(true, 4000));
    act(() => {
      vi.advanceTimersByTime(3999);
    });
    expect(result.current).toBe(true);
    act(() => {
      vi.advanceTimersByTime(1);
    });
    expect(result.current).toBe(false);
  });

  it("once shown, a later load never blanks the content", () => {
    const { result, rerender } = renderHook(({ loading }) => useHoldForData(loading), { initialProps: { loading: true } });
    rerender({ loading: false });
    rerender({ loading: true });
    expect(result.current).toBe(false);
  });
});
