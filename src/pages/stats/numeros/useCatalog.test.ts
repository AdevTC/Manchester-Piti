// @vitest-environment jsdom
import { act, renderHook, waitFor } from "@testing-library/react";
import { beforeEach, expect, it, vi } from "vitest";
import { loadCatalog, type CatRow } from "./catalog";
import { useCatalog } from "./useCatalog";

vi.mock("./catalog", () => ({ loadCatalog: vi.fn() }));
const rows: CatRow[] = [["151", "Pases", "Pases intentados", "Definición", "Narración", 0, "Jugador"]];
beforeEach(() => vi.mocked(loadCatalog).mockReset());

it("does not request definitions until needed, then keeps them when closing and reopening", async () => {
  vi.mocked(loadCatalog).mockResolvedValue(rows);
  const { result, rerender } = renderHook(({ enabled }) => useCatalog(enabled), { initialProps: { enabled: false } });
  expect(loadCatalog).not.toHaveBeenCalled();
  rerender({ enabled: true });
  await waitFor(() => expect(result.current.catalog).toBe(rows));
  rerender({ enabled: false });
  rerender({ enabled: true });
  expect(loadCatalog).toHaveBeenCalledOnce();
});

it("exposes a retry after failure and recovers without losing the screen", async () => {
  vi.mocked(loadCatalog).mockRejectedValueOnce(Error("offline")).mockResolvedValueOnce(rows);
  const { result } = renderHook(() => useCatalog(true));
  await waitFor(() => expect(result.current.error).toBe(true));
  expect(result.current.catalog).toBeNull();
  act(() => result.current.retry());
  await waitFor(() => expect(result.current.catalog).toBe(rows));
  expect(result.current.error).toBe(false);
  expect(loadCatalog).toHaveBeenCalledTimes(2);
});

it("ignores a late response after closing the catalogue", async () => {
  let resolve!: (rows: CatRow[]) => void;
  vi.mocked(loadCatalog).mockReturnValue(new Promise((done) => { resolve = done; }));
  const { result, rerender } = renderHook(({ enabled }) => useCatalog(enabled), { initialProps: { enabled: true } });
  rerender({ enabled: false });
  await act(async () => { resolve(rows); });
  expect(result.current.catalog).toBeNull();
  expect(result.current.error).toBe(false);
});
