import { act, renderHook } from "@testing-library/react";
import type { ReactNode } from "react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import * as api from "../../../lib/clubApi";
import { ToastContext, type ToastApi } from "../ui/toastContext";
import type { AdminMatch } from "./adminLogic";
import { NOTICE_DELAY_MS, resetConvocatorias, useConvocatoria } from "./useConvocatoria";

vi.mock("../../../lib/clubApi", () => ({
  apiError: (e: unknown) => String(e),
  setConvocatoria: vi.fn((o: { notify: boolean }) => Promise.resolve({ data: { at: Date.now(), revision: 1, notice: o.notify ? "first" : null } })),
}));
const setConv = vi.mocked(api.setConvocatoria);
const toast: ToastApi = { show: vi.fn(), defer: vi.fn(), dismiss: vi.fn() };
const wrap = ({ children }: { children: ReactNode }) => <ToastContext.Provider value={toast}>{children}</ToastContext.Provider>;
const SEVEN = ["a", "b", "c", "d", "e", "f", "g"];
const m8 = { id: "m8", rival: "MAD SKY", published: true, draft: false, jornada: 3, starters: SEVEN, bench: ["h"] } as AdminMatch;

beforeEach(() => {
  vi.useFakeTimers();
  resetConvocatorias();
  setConv.mockClear();
  vi.mocked(toast.show).mockClear();
});
afterEach(() => vi.useRealTimers());

const flush = async () => {
  await act(async () => {
    await Promise.resolve();
    await Promise.resolve();
  });
};

describe("useConvocatoria · «Mandar la convocatoria»", () => {
  it("B-HOY-01: a change in the 5 s is not undone and the notice goes with the seven there is then", async () => {
    const { result } = renderHook(() => useConvocatoria(m8), { wrapper: wrap });
    act(() => result.current.publish({ tag: "J3", sent: () => "mandada" }));
    expect(result.current.pending).toBe(true);
    expect(setConv).not.toHaveBeenCalled();
    // ERIK («g») down to the banquillo while the notice waits
    act(() => result.current.set({ starters: SEVEN.slice(0, 6), bench: ["h", "g"] }));
    await flush();
    expect(setConv).toHaveBeenCalledTimes(1);
    expect(setConv.mock.calls[0][0]).toMatchObject({ notify: false, starters: SEVEN.slice(0, 6) });
    expect(result.current.pending).toBe(true);
    await act(async () => {
      vi.advanceTimersByTime(NOTICE_DELAY_MS);
    });
    await flush();
    expect(setConv).toHaveBeenCalledTimes(2);
    expect(setConv.mock.calls[1][0]).toMatchObject({ notify: true, starters: SEVEN.slice(0, 6), bench: ["h", "g"] });
    expect(result.current.lineup.starters).toEqual(SEVEN.slice(0, 6));
    expect(result.current.pending).toBe(false);
  });

  it("«Deshacer» in the 5 s: nobody is told, the convocatoria stays as it is", async () => {
    const { result } = renderHook(() => useConvocatoria(m8), { wrapper: wrap });
    act(() => result.current.publish({ tag: "J3", sent: () => "mandada" }));
    act(() => result.current.cancel());
    await act(async () => {
      vi.advanceTimersByTime(NOTICE_DELAY_MS * 2);
    });
    expect(setConv).not.toHaveBeenCalled();
    expect(result.current.pending).toBe(false);
    expect(toast.show).toHaveBeenLastCalledWith(expect.objectContaining({ message: "El aviso de la convocatoria no sale" }));
  });

  it("the wait survives the station unmounting: leaving Convocatoria does not lose the notice", async () => {
    const first = renderHook(() => useConvocatoria(m8), { wrapper: wrap });
    act(() => first.result.current.publish({ tag: "J3", sent: () => "mandada" }));
    first.unmount();
    await act(async () => {
      vi.advanceTimersByTime(NOTICE_DELAY_MS);
    });
    await flush();
    expect(setConv).toHaveBeenCalledExactlyOnceWith(expect.objectContaining({ matchId: "m8", notify: true, starters: SEVEN }));
  });
});
