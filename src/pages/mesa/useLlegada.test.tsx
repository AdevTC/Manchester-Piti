// @vitest-environment jsdom
import { act, renderHook } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const calls: { present: string[]; done: (ok: boolean) => void }[] = [];
vi.mock("../../lib/clubApi", () => ({
  apiError: (e: unknown) => String((e as Error)?.message ?? e),
  setMatchPresent: vi.fn(({ present }: { present: string[] }) => new Promise((ok, ko) => calls.push({ present, done: (y) => (y ? ok({ data: {} }) : ko(new Error("sin red"))) }))),
}));
vi.mock("../pizarra/v2/useBoardData", () => ({ useBoardData: () => ({ squad: { byId: new Map() }, loading: false }) }));
vi.mock("../pizarra/v2/useConvocatoria", () => ({ useConvocatoria: () => ({ conv: null }) }));

import { SAVE_DELAY_MS, useLlegada } from "./useLlegada";

const CALLED = ["a", "b", "c"];
beforeEach(() => {
  vi.useFakeTimers();
  calls.length = 0;
});
afterEach(() => vi.useRealTimers());

describe("«¿Quién ha venido?» guarda de uno en uno", () => {
  it("una lista tocada mientras otra sube espera a que acabe y sale detrás: el servidor se queda con la última", async () => {
    const { result } = renderHook(() => useLlegada("m1", "t1", [], CALLED));
    act(() => result.current.toggle("a"));
    act(() => void vi.advanceTimersByTime(SAVE_DELAY_MS));
    expect(calls.map((c) => c.present)).toEqual([["a"]]);
    act(() => result.current.toggle("b"));
    act(() => void vi.advanceTimersByTime(SAVE_DELAY_MS));
    // (the first is still on its way: the second waits)
    expect(calls).toHaveLength(1);
    expect(result.current.save).toBe("saving");
    await act(async () => calls[0].done(true));
    expect(calls.map((c) => c.present)).toEqual([["a"], ["a", "b"]]);
    expect(result.current.save).toBe("saving");
    await act(async () => calls[1].done(true));
    expect(result.current.save).toBe("saved");
  });

  it("si la que subía falla pero hay otra detrás, sube la de detrás; el error solo se dice si es la última", async () => {
    const { result } = renderHook(() => useLlegada("m1", "t1", [], CALLED));
    act(() => result.current.toggle("a"));
    act(() => void vi.advanceTimersByTime(SAVE_DELAY_MS));
    act(() => result.current.toggle("b"));
    act(() => void vi.advanceTimersByTime(SAVE_DELAY_MS));
    await act(async () => calls[0].done(false));
    expect(calls).toHaveLength(2);
    expect(result.current.save).toBe("saving");
    await act(async () => calls[1].done(false));
    expect(result.current.save).toBe("error");
    expect(result.current.error).toBe("sin red");
  });
});
