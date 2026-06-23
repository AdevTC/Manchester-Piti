import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import type { QuerySnapshot, Query } from "firebase/firestore";
import type { QueryClient } from "@tanstack/react-query";
import { mapSnapshotDocs, handleSnapshotError, subscribeShared, _resetSharedSubsForTesting } from "./useFirestoreCollection";

// onSnapshot is mocked so subscribeShared can be exercised without a live
// Firestore: each call returns a distinct unsubscribe spy we can assert on.
const onSnapshotMock = vi.fn();
vi.mock("firebase/firestore", () => ({
  onSnapshot: (...args: unknown[]) => onSnapshotMock(...args),
}));

describe("mapSnapshotDocs", () => {
  it("aplica el mapper a cada doc con su id", () => {
    const snap = { docs: [{ id: "a", data: () => ({ n: 1 }) }, { id: "b", data: () => ({ n: 2 }) }] };
    const out = mapSnapshotDocs(snap as unknown as QuerySnapshot, (id, data) => ({ id, n: (data as { n: number }).n }));
    expect(out).toEqual([{ id: "a", n: 1 }, { id: "b", n: 2 }]);
  });

  it("filtra los docs cuyo mapper devuelve null", () => {
    const snap = {
      docs: [
        { id: "a", data: () => ({ valid: true }) },
        { id: "b", data: () => ({ valid: false }) },
        { id: "c", data: () => ({ valid: true }) },
      ],
    };
    const out = mapSnapshotDocs(
      snap as unknown as QuerySnapshot,
      (_id, data) => ((data as { valid: boolean }).valid ? data : null),
    );
    expect(out).toEqual([{ valid: true }, { valid: true }]);
  });
});

describe("handleSnapshotError", () => {
  it("llama a setQueryData con la key y un array vacío", () => {
    const key = ["seasons"] as const;
    const fakeQc = { setQueryData: vi.fn() } as unknown as Pick<QueryClient, "setQueryData">;
    handleSnapshotError(fakeQc, key, new Error("Firestore error"));
    expect(fakeQc.setQueryData).toHaveBeenCalledOnce();
    expect(fakeQc.setQueryData).toHaveBeenCalledWith(key, []);
  });
});

describe("subscribeShared", () => {
  const fakeQc = { setQueryData: vi.fn() } as unknown as Pick<QueryClient, "setQueryData">;
  const q = {} as Query;
  const map = (id: string, data: unknown) => ({ id, ...(data as object) });

  beforeEach(() => {
    // Clear the module-level registry so leftover ref counts can't leak in.
    _resetSharedSubsForTesting();
    onSnapshotMock.mockReset();
    // Each onSnapshot call returns its own unsubscribe spy.
    onSnapshotMock.mockImplementation(() => vi.fn());
  });

  afterEach(() => {
    _resetSharedSubsForTesting();
  });

  it("abre una sola suscripción onSnapshot para varios consumidores de la misma key", () => {
    const a = subscribeShared(fakeQc, ["players"], q, map);
    const b = subscribeShared(fakeQc, ["players"], q, map);
    expect(onSnapshotMock).toHaveBeenCalledOnce();
    a();
    b();
  });

  it("solo desuscribe cuando el último consumidor se va (ref-count)", () => {
    const unsub = vi.fn();
    onSnapshotMock.mockImplementationOnce(() => unsub);
    const a = subscribeShared(fakeQc, ["matches"], q, map);
    const b = subscribeShared(fakeQc, ["matches"], q, map);
    a();
    expect(unsub).not.toHaveBeenCalled();
    b();
    expect(unsub).toHaveBeenCalledOnce();
  });

  it("usa suscripciones independientes para keys distintas", () => {
    const a = subscribeShared(fakeQc, ["lineups", "s1"], q, map);
    const b = subscribeShared(fakeQc, ["lineups", "s2"], q, map);
    expect(onSnapshotMock).toHaveBeenCalledTimes(2);
    a();
    b();
  });

  it("vuelve a abrir la suscripción si todos se fueron y luego entra uno nuevo", () => {
    const a = subscribeShared(fakeQc, ["users"], q, map);
    a();
    const b = subscribeShared(fakeQc, ["users"], q, map);
    expect(onSnapshotMock).toHaveBeenCalledTimes(2);
    b();
  });
});
