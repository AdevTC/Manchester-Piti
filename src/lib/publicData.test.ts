import { afterEach, expect, it, vi } from "vitest";
import { QueryClient } from "@tanstack/react-query";

// The boot waits for every public collection the server render painted, the MVP tallies included
// (L3: without them the MVP badges popped in after hydration). Firestore is stubbed: each onSnapshot
// call is kept by the path it listens to, and the test delivers the first snapshots by hand.
const listeners = vi.hoisted(() => new Map<string, (snap: unknown) => void>());
vi.mock("../firebase", () => ({ db: {} }));
vi.mock("firebase/firestore", () => ({
  collection: (_db: unknown, path: string) => ({ path }),
  doc: (_db: unknown, ...parts: string[]) => ({ path: parts.join("/") }),
  query: (q: { path: string }) => q,
  orderBy: () => ({}),
  onSnapshot: (ref: { path: string }, ...rest: unknown[]) => {
    const next = rest.find((r) => typeof r === "function") as (snap: unknown) => void;
    listeners.set(ref.path, next);
    return () => listeners.delete(ref.path);
  },
}));

const { CONTENT_KEY, MVP_RESULTS_KEY, STANDINGS_KEY, primePublicData } = await import("./publicData");

const docs = (rows: { id: string; data: object }[]) => ({
  docs: rows.map((r) => ({ id: r.id, data: () => r.data })),
  docChanges: () => rows,
  metadata: { fromCache: true, hasPendingWrites: false },
});

afterEach(() => listeners.clear());

it("waits for the MVP tallies too, and caches them with the shared mapper", async () => {
  const qc = new QueryClient();
  let ready = false;
  const prime = primePublicData(qc, 60_000).then(() => (ready = true));
  expect([...listeners.keys()].sort()).toEqual(["clubContent/main", "matches", "mvpResults", "players", "seasons", "standings"]);
  listeners.get("matches")!(docs([]));
  listeners.get("players")!(docs([]));
  listeners.get("seasons")!(docs([]));
  listeners.get("clubContent/main")!({ exists: () => false });
  listeners.get("standings")!(docs([]));
  await Promise.resolve();
  expect(ready).toBe(false);
  expect(qc.getQueryData(CONTENT_KEY)).toBeDefined();

  listeners.get("mvpResults")!(docs([{ id: "j5", data: { counts: { erik: 2 }, total: 2 } }, { id: "j6", data: {} }]));
  await prime;
  expect(ready).toBe(true);
  expect(qc.getQueryData(MVP_RESULTS_KEY)).toEqual([
    { id: "j5", counts: { erik: 2 }, total: 2 },
    { id: "j6", counts: {}, total: 0 },
  ]);
  expect(qc.getQueryData(STANDINGS_KEY)).toEqual([]);
});

it("waits for the league tables too (the position paints with the page)", async () => {
  const { _resetSharedSubsForTesting } = await import("./useFirestoreCollection");
  _resetSharedSubsForTesting();
  const qc = new QueryClient();
  let ready = false;
  const prime = primePublicData(qc, 60_000).then(() => (ready = true));
  for (const k of ["matches", "players", "seasons", "mvpResults"]) listeners.get(k)!(docs([]));
  listeners.get("clubContent/main")!({ exists: () => false });
  await Promise.resolve();
  expect(ready).toBe(false);
  const rows = [
    { team: "Rayo", pj: 1, g: 1, e: 0, p: 0, gf: 2, gc: 0, pts: 3, isUs: false },
    { team: "Piti", pj: 1, g: 0, e: 0, p: 1, gf: 0, gc: 2, pts: 0, isUs: true },
  ];
  listeners.get("standings")!(docs([{ id: "t1", data: { competition: "Liga", jornada: 1, updatedAt: null, updatedBy: "u", rows } }]));
  await prime;
  expect(ready).toBe(true);
  expect(qc.getQueryData(STANDINGS_KEY)).toEqual([{ id: "t1", competition: "Liga", jornada: 1, updatedAt: 0, updatedBy: "u", rows }]);
});
