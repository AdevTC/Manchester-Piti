import { createElement, type ReactNode } from "react";
import { beforeAll, afterEach, beforeEach, expect, it, vi } from "vitest";
import { loadFirebase } from "../../lib/fb";
import { act, cleanup, renderHook, waitFor } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";

const state = vi.hoisted(() => ({
  listeners: new Map<string, Set<(snap: unknown) => void>>(),
  uid: "captain" as string | null,
  role: "admin",
}));
vi.mock("../../firebase", () => ({ db: {} }));
vi.mock("../../context/AuthContext", () => ({
  useAuth: () => ({ user: state.uid ? { uid: state.uid } : null, profile: { nickname: "Capitán", role: state.role } }),
}));
vi.mock("firebase/firestore", async (original) => ({
  ...(await original<typeof import("firebase/firestore")>()),
  collection: (_db: unknown, ...path: string[]) => ({ path: path.join("/") }),
  doc: (_db: unknown, ...path: string[]) => ({ path: path.join("/") }),
  query: (ref: unknown) => ref,
  onSnapshot: (ref: { path: string }, _options: unknown, next: (snap: unknown) => void) => {
    const listeners = state.listeners.get(ref.path) ?? new Set();
    listeners.add(next);
    state.listeners.set(ref.path, listeners);
    return () => listeners.delete(next);
  },
}));

import { useLineups } from "./useLineups";
import { MATCHES_KEY } from "../../lib/publicData";
import { _resetSharedSubsForTesting } from "../../lib/useFirestoreCollection";
import { _resetSnapshotMetaForTesting } from "../../lib/syncStatus";

type Row = { id: string; data: Record<string, unknown> };
const match = { seasonId: "s", rival: "Rival", date: 1000, status: "scheduled" };
const rows = (entries: [string, Record<string, unknown>?][]): Row[] => entries.map(([id, extra]) => ({ id, data: { ...match, ...extra } }));
const board = (id: string, matchId?: string): Row => ({ id, data: { seasonId: "s", matchId, ownerUid: "captain", name: id } });
const emit = (path: string, docs: Row[]) => act(() => {
  for (const next of state.listeners.get(path) ?? []) next({
    docs: docs.map(r => ({ id: r.id, data: () => r.data })),
    docChanges: () => [{}], metadata: { fromCache: false, hasPendingWrites: false },
  });
});
const clients: QueryClient[] = [];
function setup() {
  const qc = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  clients.push(qc);
  const wrapper = ({ children }: { children: ReactNode }) => createElement(QueryClientProvider, { client: qc }, children);
  return { qc, ...renderHook(() => useLineups("s"), { wrapper }) };
}
beforeEach(() => { state.uid = "captain"; state.role = "admin"; });
afterEach(() => {
  cleanup();
  _resetSharedSubsForTesting();
  _resetSnapshotMetaForTesting();
  state.listeners.clear();
  clients.splice(0).forEach(qc => qc.clear());
});

// (the listeners and writes go through lib/fb: Firebase in, with this file's mocks, before the tests)
beforeAll(() => loadFirebase());

it("keeps active draft-only boards for admins while archived published parents override stale drafts", async () => {
  const { result, qc } = setup();
  emit("lineups", [board("public", "published"), board("draft", "draft-only"), board("archived", "archived"), board("archived-draft", "archived-draft"), board("season")]);
  emit("matchDrafts", rows([["draft-only"], ["archived"], ["archived-draft", { archived: true }]]));
  // Drafts alone cannot establish that a published parent is absent or active.
  await waitFor(() => expect(result.current.all.map(b => b.id)).toEqual(["season"]));
  emit("matches", rows([["published"], ["archived", { archived: true, individuallyArchived: true }]]));
  await waitFor(() => expect(result.current.all.map(b => b.id)).toEqual(["public", "draft", "season"]));
  expect(result.current.loading).toBe(false);
  expect(qc.getQueryData<{ id: string }[]>(MATCHES_KEY)?.map(m => m.id)).toEqual(["published"]);

  emit("matchDrafts", rows([["draft-only", { archived: true }], ["archived"]]));
  await waitFor(() => expect(result.current.all.map(b => b.id)).toEqual(["public", "season"]));
  emit("matchDrafts", rows([["draft-only"], ["archived"]]));
  await waitFor(() => expect(result.current.all.map(b => b.id)).toEqual(["public", "draft", "season"]));
  emit("matchDrafts", []);
  await waitFor(() => expect(result.current.all.map(b => b.id)).toEqual(["public", "season"]));
});

it.each(["user", "scorer"])("does not request private draft parents for the %s role", async role => {
  state.role = role;
  const { result } = setup();
  emit("lineups", [board("public", "published"), board("draft", "draft-only"), board("season")]);
  emit("matches", rows([["published"]]));
  await waitFor(() => expect(result.current.all.map(b => b.id)).toEqual(["public", "season"]));
  expect(state.listeners.has("matchDrafts")).toBe(false);
  expect(state.listeners.get("matches")?.size).toBe(1);
});

it("drops cached draft-only boards immediately when the admin role or session is lost", async () => {
  state.role = "superadmin";
  const { result, rerender } = setup();
  emit("lineups", [board("public", "published"), board("draft", "draft-only")]);
  emit("matches", rows([["published"]]));
  emit("matchDrafts", rows([["draft-only"]]));
  await waitFor(() => expect(result.current.all.map(b => b.id)).toEqual(["public", "draft"]));

  state.role = "user";
  rerender();
  expect(result.current.all.map(b => b.id)).toEqual(["public"]);
  state.role = "superadmin";
  rerender();
  expect(result.current.all.map(b => b.id)).toEqual(["public", "draft"]);
  state.uid = null;
  rerender();
  expect(result.current.all.map(b => b.id)).toEqual(["public"]);
});
