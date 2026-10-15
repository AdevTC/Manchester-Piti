import { createElement, type ReactNode } from "react";
import { afterEach, expect, it, vi } from "vitest";
import { act, cleanup, renderHook, waitFor } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";

const listeners = vi.hoisted(() => new Map<string, (snap: unknown) => void>());
vi.mock("../firebase", () => ({ db: {} }));
vi.mock("firebase/firestore", async (original) => ({
  ...(await original<typeof import("firebase/firestore")>()),
  collection: (_db: unknown, ...path: string[]) => ({ path: path.join("/") }),
  doc: (_db: unknown, ...path: string[]) => ({ path: path.join("/") }),
  query: (ref: unknown) => ref,
  onSnapshot: (ref: { path: string }, _options: unknown, next: (snap: unknown) => void) => {
    listeners.set(ref.path, next);
    return () => listeners.delete(ref.path);
  },
}));

import { _resetSharedSubsForTesting } from "./useFirestoreCollection";
import { useSeasonLineupDocs } from "../pages/pizarra/seasonLineups";
import { useMvpResults } from "../pages/vestuario/live";
import { MATCHES_KEY } from "./publicData";
import { _resetSnapshotMetaForTesting } from "./syncStatus";

type Row = { id: string; data: Record<string, unknown> };
const emit = (path: string, rows: Row[]) => act(() => listeners.get(path)?.({
  docs: rows.map(r => ({ id: r.id, data: () => r.data })),
  docChanges: () => [{}], metadata: { fromCache: false, hasPendingWrites: false },
}));

afterEach(() => {
  cleanup();
  _resetSharedSubsForTesting();
  _resetSnapshotMetaForTesting();
  listeners.clear();
});

it("removes archived and deleted parents from realtime MVPs and linked boards without waiting for child cleanup", async () => {
  const qc = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  const wrapper = ({ children }: { children: ReactNode }) => createElement(QueryClientProvider, { client: qc }, children);
  const view = renderHook(() => ({ mvps: useMvpResults(), boards: useSeasonLineupDocs("s") }), { wrapper });
  const match = { seasonId: "s", rival: "Rival", date: 1000, status: "finished", goalsFor: 2, goalsAgainst: 1 };
  emit("mvpResults", [{ id: "m", data: { counts: { a: 2 }, total: 2 } }]);
  emit("lineups", [
    { id: "linked", data: { seasonId: "s", matchId: "m", ownerUid: "me", name: "Del partido" } },
    { id: "seasonal", data: { seasonId: "s", ownerUid: "me", name: "De temporada" } },
  ]);
  emit("matches", [{ id: "m", data: match }]);
  await waitFor(() => expect(view.result.current.boards.data?.map(b => b.id)).toEqual(["linked", "seasonal"]));
  expect(view.result.current.mvps.get("m")?.total).toBe(2);

  emit("matches", [{ id: "m", data: { ...match, archived: true, individuallyArchived: true } }]);
  await waitFor(() => expect(view.result.current.mvps.size).toBe(0));
  expect(qc.getQueryData(MATCHES_KEY)).toEqual([]);
  expect(view.result.current.boards.data?.map(b => b.id)).toEqual(["seasonal"]);

  emit("matches", [{ id: "m", data: { ...match, archived: false, individuallyArchived: false } }]);
  await waitFor(() => expect(view.result.current.mvps.get("m")?.total).toBe(2));
  expect(view.result.current.boards.data?.map(b => b.id)).toEqual(["linked", "seasonal"]);

  emit("matches", []);
  await waitFor(() => expect(view.result.current.mvps.size).toBe(0));
  expect(view.result.current.boards.data?.map(b => b.id)).toEqual(["seasonal"]);
  qc.clear();
});
