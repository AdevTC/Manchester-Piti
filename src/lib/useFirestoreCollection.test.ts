import { describe, it, expect } from "vitest";
import type { QuerySnapshot } from "firebase/firestore";
import { mapSnapshotDocs } from "./useFirestoreCollection";

describe("mapSnapshotDocs", () => {
  it("aplica el mapper a cada doc con su id", () => {
    const snap = { docs: [{ id: "a", data: () => ({ n: 1 }) }, { id: "b", data: () => ({ n: 2 }) }] };
    const out = mapSnapshotDocs(snap as unknown as QuerySnapshot, (id, data) => ({ id, n: (data as { n: number }).n }));
    expect(out).toEqual([{ id: "a", n: 1 }, { id: "b", n: 2 }]);
  });
});
