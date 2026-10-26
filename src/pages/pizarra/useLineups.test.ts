// @vitest-environment jsdom
import { act, renderHook } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { seedLineup } from "./lineupOps";

// useLineups over a fake Firestore (an in-memory map of paths): what an autosave writes, a board
// created offline, the official published in one transaction, and the reactions it leaves behind.

type Data = Record<string, unknown>;
const fs = vi.hoisted(() => ({
  store: new Map<string, Record<string, unknown>>(),
  /** setDoc never acks (offline) while true. */
  offline: false,
  auto: 0,
  updates: [] as { path: string; data: Record<string, unknown> }[],
  /** Docs a query does not see (it ran before they were written: the race between two captains). */
  staleQuery: new Set<string>(),
  /** What each transaction read and wrote (one entry per runTransaction), and the plain deletes. */
  txs: [] as { gets: string[]; writes: string[] }[],
  deletes: [] as string[],
  /** runTransaction fails with this (e.g. offline) instead of running. */
  txError: null as unknown,
  failedQuery: null as string | null,
  failedDelete: null as string | null,
}));

vi.mock("../../firebase", () => ({ db: {} }));
vi.mock("../../context/AuthContext", () => ({ useAuth: () => ({ user: { uid: "me" }, profile: { nickname: "yo" } }) }));
vi.mock("../../lib/useFirestoreCollection", () => ({ useFirestoreCollection: () => ({ data: [], isPending: false }) }));
vi.mock("firebase/firestore", () => {
  type Ref = { path: string; id: string };
  const ref = (path: string): Ref => ({ path, id: path.split("/").pop() ?? "" });
  const snap = (r: Ref) => {
    const d = fs.store.get(r.path);
    return { id: r.id, ref: r, exists: () => d !== undefined, data: () => (d ? { ...d } : undefined) };
  };
  const apply = (r: Ref, data: Record<string, unknown>, merge: boolean) => {
    const next: Record<string, unknown> = merge ? { ...(fs.store.get(r.path) ?? {}) } : {};
    for (const [k, v] of Object.entries(data)) {
      if (v === "__delete__") delete next[k];
      else next[k] = v;
    }
    fs.store.set(r.path, next);
  };
  const children = (path: string) => [...fs.store.keys()].filter((k) => k.startsWith(path + "/") && !k.slice(path.length + 1).includes("/"));
  return {
    collection: (base: { path?: string }, ...segs: string[]) => ({ path: [base.path, ...segs].filter(Boolean).join("/") }),
    doc: (base: { path?: string }, ...segs: string[]) =>
      segs.length ? ref([base.path, ...segs].filter(Boolean).join("/")) : ref(`${base.path}/auto${++fs.auto}`),
    where: (field: string, _op: string, value: unknown) => ({ field, value }),
    orderBy: () => ({}),
    query: (c: { path: string }, ...wheres: { field: string; value: unknown }[]) => ({ path: c.path, wheres }),
    getDocs: async (q: { path: string; wheres?: { field: string; value: unknown }[] }) => {
      if (q.path === fs.failedQuery) throw new Error("No se pudo leer la colección");
      const docs = children(q.path)
        .filter((p) => !fs.staleQuery.has(p) && (q.wheres ?? []).every((w) => fs.store.get(p)?.[w.field] === w.value))
        .map((p) => snap(ref(p)));
      return { docs, empty: docs.length === 0 };
    },
    serverTimestamp: () => "__ts__",
    deleteField: () => "__delete__",
    setDoc: (r: Ref, data: Record<string, unknown>) => {
      apply(r, data, false); // the local cache has it at once…
      return fs.offline ? new Promise(() => {}) : Promise.resolve(); // …the server ack, when online
    },
    updateDoc: async (r: Ref, data: Record<string, unknown>) => {
      fs.updates.push({ path: r.path, data });
      apply(r, data, true);
    },
    deleteDoc: async (r: Ref) => {
      fs.deletes.push(r.path);
      fs.store.delete(r.path);
    },
    writeBatch: () => {
      const paths: string[] = [];
      return { delete: (r: Ref) => void paths.push(r.path), commit: async () => {
        if (paths.includes(fs.failedDelete ?? "")) throw new Error("No se pudo borrar el contenido");
        paths.forEach((path) => fs.store.delete(path));
      } };
    },
    runTransaction: async <T,>(_db: unknown, fn: (tx: unknown) => Promise<T>): Promise<T> => {
      if (fs.txError) throw fs.txError;
      // (writes are applied at commit, after the function: all or nothing)
      const t = { gets: [] as string[], writes: [] as string[] };
      fs.txs.push(t);
      const ops: (() => void)[] = [];
      const out = await fn({
        get: async (r: Ref) => (t.gets.push(r.path), snap(r)),
        update: (r: Ref, d: Record<string, unknown>) => (t.writes.push(r.path), void ops.push(() => apply(r, d, true))),
        set: (r: Ref, d: Record<string, unknown>) => (t.writes.push(r.path), void ops.push(() => apply(r, d, false))),
        delete: (r: Ref) => (t.writes.push(r.path), void ops.push(() => fs.store.delete(r.path))),
      });
      ops.forEach((f) => f());
      return out;
    },
  };
});

const { useLineups, saveData, officialScopeId } = await import("./useLineups");

const board = (over: Data = {}): Data => ({ ownerUid: "me", ownerNickname: "yo", seasonId: "t1", name: "Mi siete", isOfficial: false, matchId: null, ...over });
const officials = () => [...fs.store.entries()].filter(([p, d]) => p.startsWith("lineups/") && p.split("/").length === 2 && d.isOfficial === true).map(([p]) => p.slice(8));

beforeEach(() => {
  fs.store.clear();
  fs.updates.length = 0;
  fs.offline = false;
  fs.staleQuery.clear();
  fs.txs.length = 0;
  fs.deletes.length = 0;
  fs.txError = null;
  fs.failedQuery = null;
  fs.failedDelete = null;
});

describe("useLineups · autosave", () => {
  it("writes only the board's fields: a rename or a publish made elsewhere is never reverted", async () => {
    fs.store.set("lineups/b1", board({ name: "Renombrado en el móvil", isOfficial: true, matchId: "m8", bench: ["x"], pinned: [] }));
    const { result } = renderHook(() => useLineups("t1"));
    await act(() => result.current.save("b1", seedLineup("3-2-1", ["a", "b"])));
    const written = fs.updates[0].data;
    for (const k of ["name", "isOfficial", "matchId", "ownerNickname", "ownerUid", "seasonId"]) expect(written).not.toHaveProperty(k);
    expect(fs.store.get("lineups/b1")).toMatchObject({ name: "Renombrado en el móvil", isOfficial: true, matchId: "m8", formation: "3-2-1" });
    // the dead weight goes: no bench (the whole squad) nor «pinned» stored any more
    expect(fs.store.get("lineups/b1")).not.toHaveProperty("bench");
    expect(fs.store.get("lineups/b1")).not.toHaveProperty("pinned");
  });

  it("links a match only when one is passed", () => {
    const L = seedLineup("2-3-1", []);
    expect(saveData(L)).not.toHaveProperty("matchId");
    expect(saveData(L, "m9")).toHaveProperty("matchId", "m9");
    expect(saveData(L, null)).toHaveProperty("matchId", null);
  });
});

describe("useLineups · a new board offline", () => {
  it("resolves at once with its id (the write waits for the connection in the cache)", async () => {
    fs.offline = true;
    const { result } = renderHook(() => useLineups("t1"));
    let id = "";
    await act(async () => {
      id = await result.current.create(seedLineup("2-3-1", ["a"]), "Tablero nuevo");
    });
    expect(id).toMatch(/^auto\d+$/);
    expect(fs.store.get("lineups/" + id)).toMatchObject({ name: "Tablero nuevo", ownerUid: "me", ownerNickname: "yo", seasonId: "t1", isOfficial: false });
  });
});

describe("useLineups · the official", () => {
  it("publishing replaces the scope's official in one go, even one the other captain's query didn't see", async () => {
    fs.store.set("lineups/a", board());
    fs.store.set("lineups/b", board());
    fs.store.set("lineups/c", board());
    const { result } = renderHook(() => useLineups("t1"));
    await act(() => result.current.markOfficial("a", { matchId: "m8" }));
    expect(officials()).toEqual(["a"]);
    expect(fs.store.get("lineupOfficials/" + officialScopeId("t1", "m8"))).toMatchObject({ lineupId: "a" });
    // b: the scope doc names a → a is unmarked in the same transaction
    await act(() => result.current.markOfficial("b", { matchId: "m8" }));
    expect(officials()).toEqual(["b"]);
    // c, published by a captain whose query ran before b was published (it found nobody): the scope doc
    // still names b, so b goes — never two officials
    fs.staleQuery.add("lineups/b");
    await act(() => result.current.markOfficial("c", { matchId: "m8" }));
    expect(officials()).toEqual(["c"]);
    // another scope (the season) keeps its own official
    await act(() => result.current.markOfficial("a", { matchId: null }));
    expect(officials().sort()).toEqual(["a", "c"]);
  });

  it("officials from before the scope doc are found and unmarked too", async () => {
    fs.store.set("lineups/old", board({ isOfficial: true, matchId: "m8" }));
    fs.store.set("lineups/new", board());
    const { result } = renderHook(() => useLineups("t1"));
    await act(() => result.current.markOfficial("new", { matchId: "m8" }));
    expect(officials()).toEqual(["new"]);
  });

  it("unpublishing, replacing or deleting a board clears its reactions", async () => {
    fs.store.set("lineups/a", board());
    fs.store.set("lineups/b", board());
    const { result } = renderHook(() => useLineups("t1"));
    await act(() => result.current.markOfficial("a", { matchId: "m8" }));
    fs.store.set("lineups/a/reactions/u1", { value: "ok" });
    fs.store.set("lineups/a/reactions/u2", { value: "dudas" });
    await act(() => result.current.markOfficial("b", { matchId: "m8" }));
    expect([...fs.store.keys()].filter((k) => k.startsWith("lineups/a/reactions/"))).toEqual([]);
    fs.store.set("lineups/b/reactions/u1", { value: "ok" });
    await act(() => result.current.markOfficial("b", null));
    expect(officials()).toEqual([]);
    expect(fs.store.has("lineups/b/reactions/u1")).toBe(false);
    expect(fs.store.has("lineupOfficials/" + officialScopeId("t1", "m8"))).toBe(false);
    fs.store.set("lineups/b/reactions/u3", { value: "ok" });
    await act(() => result.current.remove("b"));
    expect([...fs.store.keys()].filter((k) => k.startsWith("lineups/b"))).toEqual([]);
  });

  it("deleting the official frees its scope doc (a link to the match's pizarra never names a gone board)", async () => {
    fs.store.set("lineups/a", board());
    fs.store.set("lineups/b", board());
    const { result } = renderHook(() => useLineups("t1"));
    await act(() => result.current.markOfficial("a", { matchId: "m8" }));
    expect(fs.store.get("lineupOfficials/" + officialScopeId("t1", "m8"))).toMatchObject({ lineupId: "a" });
    // a non-official board leaves the scope doc alone
    await act(() => result.current.remove("b"));
    expect(fs.store.has("lineupOfficials/" + officialScopeId("t1", "m8"))).toBe(true);
    await act(() => result.current.remove("a"));
    expect(fs.store.has("lineups/a")).toBe(false);
    expect(fs.store.has("lineupOfficials/" + officialScopeId("t1", "m8"))).toBe(false);
  });

  it.each([
    ["reactions", "read"], ["reactions", "delete"], ["voz", "read"], ["voz", "delete"],
  ] as const)("keeps the board and match scope when %s cleanup fails to %s, then retries safely", async (collection, failure) => {
    const lock = "lineupOfficials/" + officialScopeId("t1", "m8");
    fs.store.set("lineups/a", board({ isOfficial: true, matchId: "m8" }));
    fs.store.set(lock, { lineupId: "a", seasonId: "t1", matchId: "m8" });
    fs.store.set("lineups/a/reactions/u1", { value: "ok" });
    fs.store.set("lineups/a/voz/v0", { data: "audio" });
    const child = `lineups/a/${collection}/${collection === "voz" ? "v0" : "u1"}`;
    if (failure === "read") fs.failedQuery = `lineups/a/${collection}`;
    else fs.failedDelete = child;
    const { result } = renderHook(() => useLineups("t1"));

    await expect(result.current.remove("a")).rejects.toThrow("No se pudo");
    expect(fs.store.get("lineups/a")).toMatchObject({ matchId: "m8", isOfficial: true });
    expect(fs.store.get(lock)).toMatchObject({ lineupId: "a" });
    expect(fs.store.has(child)).toBe(true);
    expect(fs.txs).toHaveLength(0);
    expect(fs.deletes).toEqual([]);

    fs.failedQuery = null;
    fs.failedDelete = null;
    await act(() => result.current.remove("a"));
    expect([...fs.store.keys()].filter((path) => path === lock || path.startsWith("lineups/a"))).toEqual([]);
  });

  it("still reports an already committed unpublish as successful when reactions cleanup fails", async () => {
    const lock = "lineupOfficials/" + officialScopeId("t1", "m8");
    fs.store.set("lineups/a", board({ isOfficial: true, matchId: "m8" }));
    fs.store.set(lock, { lineupId: "a", seasonId: "t1", matchId: "m8" });
    fs.store.set("lineups/a/reactions/u1", { value: "ok" });
    fs.failedDelete = "lineups/a/reactions/u1";
    const quiet = vi.spyOn(console, "error").mockImplementation(() => {});
    try {
      const { result } = renderHook(() => useLineups("t1"));
      await act(() => result.current.markOfficial("a", null));
      expect(fs.store.get("lineups/a")).toMatchObject({ isOfficial: false });
      expect(fs.store.has(lock)).toBe(false);
      expect(fs.store.has("lineups/a/reactions/u1")).toBe(true);
    } finally {
      quiet.mockRestore();
    }
  });

  it("the official and its scope doc go in ONE transaction (no plain delete after it)", async () => {
    const lock = "lineupOfficials/" + officialScopeId("t1", "m8");
    fs.store.set("lineups/a", board({ isOfficial: true, matchId: "m8" }));
    fs.store.set(lock, { lineupId: "a", seasonId: "t1", matchId: "m8" });
    const { result } = renderHook(() => useLineups("t1"));
    await act(() => result.current.remove("a"));
    expect(fs.txs).toHaveLength(1);
    expect(fs.txs[0]).toEqual({ gets: ["lineups/a", lock], writes: [lock, "lineups/a"] });
    expect(fs.deletes).toEqual([]);
    expect(fs.store.has("lineups/a")).toBe(false);
    expect(fs.store.has(lock)).toBe(false);
  });

  it("a scope doc that names another board stays (only this board goes)", async () => {
    const lock = "lineupOfficials/" + officialScopeId("t1", null);
    fs.store.set("lineups/a", board({ isOfficial: true, matchId: null }));
    fs.store.set(lock, { lineupId: "z", seasonId: "t1", matchId: null });
    const { result } = renderHook(() => useLineups("t1"));
    await act(() => result.current.remove("a"));
    expect(fs.store.has("lineups/a")).toBe(false);
    expect(fs.store.get(lock)).toMatchObject({ lineupId: "z" });
  });

  it("a member's own board (not official): one transaction that never reads nor writes a scope doc", async () => {
    const lock = "lineupOfficials/" + officialScopeId("t1", "m8");
    fs.store.set("lineups/mine", board({ matchId: "m8" }));
    fs.store.set(lock, { lineupId: "mine", seasonId: "t1", matchId: "m8" });
    const { result } = renderHook(() => useLineups("t1"));
    await act(() => result.current.remove("mine"));
    expect(fs.txs).toEqual([{ gets: ["lineups/mine"], writes: ["lineups/mine"] }]);
    expect(fs.store.has("lineups/mine")).toBe(false);
    expect(fs.store.has(lock)).toBe(true);
  });

  it("offline (the transaction can't run): the board is still deleted, a plain delete for the cache", async () => {
    fs.store.set("lineups/b", board());
    fs.txError = Object.assign(new Error("offline"), { code: "unavailable" });
    const quiet = vi.spyOn(console, "error").mockImplementation(() => {});
    const { result } = renderHook(() => useLineups("t1"));
    await act(() => result.current.remove("b"));
    expect(fs.deletes).toEqual(["lineups/b"]);
    expect(fs.store.has("lineups/b")).toBe(false);
    quiet.mockRestore();
  });

  it("refused (the rules said no): it fails and nothing is deleted, so the board comes back on screen", async () => {
    fs.store.set("lineups/b", board());
    fs.txError = Object.assign(new Error("no"), { code: "permission-denied" });
    const { result } = renderHook(() => useLineups("t1"));
    await expect(result.current.remove("b")).rejects.toMatchObject({ code: "permission-denied" });
    expect(fs.deletes).toEqual([]);
    expect(fs.store.has("lineups/b")).toBe(true);
  });
});
