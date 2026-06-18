import { describe, it, expect, vi } from "vitest";
import type { QuerySnapshot } from "firebase/firestore";
import type { QueryClient } from "@tanstack/react-query";
import { mapSnapshotDocs, handleSnapshotError } from "./useFirestoreCollection";

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
