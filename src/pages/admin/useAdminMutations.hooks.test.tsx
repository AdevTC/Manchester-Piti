import { describe, it, expect, vi, beforeEach } from "vitest";
import { act, renderHook, waitFor } from "@testing-library/react";
import type { QueryClient } from "@tanstack/react-query";
import { makeTestQueryClient, makeQueryWrapper } from "../../test/renderWithProviders";

// The pure transforms (removeById/mergeById) + the cache round-trip are already
// unit-tested in useAdminMutations.test.ts. Here we mount the REAL hooks
// (renderHook) over a mocked Firestore to cover what that test cannot: the
// isPending transition and the onError rollback path firing through React Query
// when the mutationFn rejects.

vi.mock("../../firebase", () => ({ db: {} }));

const setDoc = vi.fn();
const addDoc = vi.fn();
const deleteDoc = vi.fn();
vi.mock("firebase/firestore", () => ({
  doc: (...args: unknown[]) => ({ __ref: args }),
  collection: (...args: unknown[]) => ({ __coll: args }),
  setDoc: (...args: unknown[]) => setDoc(...args),
  addDoc: (...args: unknown[]) => addDoc(...args),
  deleteDoc: (...args: unknown[]) => deleteDoc(...args),
}));

import { useUpsertSeason, useDeleteSeason } from "./useAdminMutations";

type Doc = { id: string; name?: string };
const KEY = ["seasons"] as const;

let qc: QueryClient;
beforeEach(() => {
  setDoc.mockReset();
  addDoc.mockReset();
  deleteDoc.mockReset();
  qc = makeTestQueryClient();
});

describe("useUpsertSeason — isPending transition (edit)", () => {
  it("isPending pasa false→true→false alrededor de una escritura que resuelve", async () => {
    // A setDoc we resolve manually so we can observe isPending mid-flight.
    let resolveWrite!: () => void;
    setDoc.mockReturnValue(new Promise<void>((res) => { resolveWrite = res; }));

    const { result } = renderHook(() => useUpsertSeason(), { wrapper: makeQueryWrapper(qc) });
    expect(result.current.isPending).toBe(false);

    act(() => {
      result.current.mutate({ id: "s1", data: { name: "Nueva" } });
    });

    // In-flight: the mutationFn promise hasn't resolved yet.
    await waitFor(() => expect(result.current.isPending).toBe(true));

    act(() => { resolveWrite(); });

    await waitFor(() => expect(result.current.isPending).toBe(false));
    expect(result.current.isSuccess).toBe(true);
    expect(setDoc).toHaveBeenCalledTimes(1);
  });
});

describe("useUpsertSeason — onError rollback (edit)", () => {
  it("revierte el patch optimista a la instantánea cuando setDoc rechaza", async () => {
    // Seed the shared-cache slot the optimistic patch will edit.
    qc.setQueryData<Doc[]>(KEY, [
      { id: "s1", name: "Vieja" },
      { id: "s2", name: "Otra" },
    ]);
    // Deferred write: stays pending so the optimistic patch is observable, then
    // we reject it to drive onError. (A synchronous reject would roll back
    // before the first assertion could see the transient patch — fragile.)
    let rejectWrite!: (e: Error) => void;
    setDoc.mockReturnValue(new Promise<void>((_, rej) => { rejectWrite = rej; }));

    const { result } = renderHook(() => useUpsertSeason(), { wrapper: makeQueryWrapper(qc) });

    act(() => {
      result.current.mutate({ id: "s1", data: { name: "Optimista" } });
    });

    // The optimistic onMutate merges "Optimista" into s1 while the write is in flight.
    await waitFor(() =>
      expect(qc.getQueryData<Doc[]>(KEY)?.find((d) => d.id === "s1")?.name).toBe("Optimista"),
    );

    // Now fail the write; onError must roll the cache back to the snapshot.
    act(() => { rejectWrite(new Error("permission-denied")); });

    await waitFor(() => expect(result.current.isError).toBe(true));
    expect(qc.getQueryData<Doc[]>(KEY)).toEqual([
      { id: "s1", name: "Vieja" },
      { id: "s2", name: "Otra" },
    ]);
  });
});

describe("useUpsertSeason — create path applies no optimistic patch", () => {
  it("no toca la caché en onMutate (id null) y onError no revierte nada", async () => {
    qc.setQueryData<Doc[]>(KEY, [{ id: "s1", name: "Vieja" }]);
    addDoc.mockRejectedValue(new Error("offline"));

    const { result } = renderHook(() => useUpsertSeason(), { wrapper: makeQueryWrapper(qc) });

    act(() => {
      result.current.mutate({ id: null, data: { name: "Creada" } });
    });

    await waitFor(() => expect(result.current.isError).toBe(true));
    // Cache untouched: create never patches (no temp-id dup-flicker), so the
    // snapshot is identical whether the create succeeds or fails.
    expect(qc.getQueryData<Doc[]>(KEY)).toEqual([{ id: "s1", name: "Vieja" }]);
    expect(addDoc).toHaveBeenCalledTimes(1);
  });
});

describe("useDeleteSeason — onError rollback restores the removed row", () => {
  it("quita la fila optimistamente y la restaura cuando deleteDoc rechaza", async () => {
    qc.setQueryData<Doc[]>(KEY, [
      { id: "s1", name: "Uno" },
      { id: "s2", name: "Dos" },
    ]);
    // Deferred delete: pending until we reject, so the optimistic removal is
    // observable before the rollback (see the edit test for the rationale).
    let rejectDelete!: (e: Error) => void;
    deleteDoc.mockReturnValue(new Promise<void>((_, rej) => { rejectDelete = rej; }));

    const { result } = renderHook(() => useDeleteSeason(), { wrapper: makeQueryWrapper(qc) });

    act(() => {
      result.current.mutate("s1");
    });

    // Optimistic removal while the delete is in flight.
    await waitFor(() =>
      expect(qc.getQueryData<Doc[]>(KEY)?.some((d) => d.id === "s1")).toBe(false),
    );

    // Fail the delete; rollback on error restores the full list.
    act(() => { rejectDelete(new Error("network")); });
    await waitFor(() => expect(result.current.isError).toBe(true));
    expect(qc.getQueryData<Doc[]>(KEY)).toEqual([
      { id: "s1", name: "Uno" },
      { id: "s2", name: "Dos" },
    ]);
  });
});
