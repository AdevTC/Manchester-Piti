import { beforeEach, expect, it, vi } from "vitest";

// Tras el partido's writes, as firestore.rules checks them: matches/{id}/reactions/{uid} with exactly moments,
// name, playerId and at (the server's time), deleted when no reaction is left; matches/{id}/ratings/{uid} with
// exactly score, name, playerId and at; taking the nota back deletes it.
const fs = vi.hoisted(() => ({
  setDoc: vi.fn(async (_ref: unknown, _data: unknown) => undefined),
  deleteDoc: vi.fn(async (_ref: unknown) => undefined),
}));
vi.mock("firebase/firestore", async (importOriginal) => ({
  ...(await importOriginal<typeof import("firebase/firestore")>()),
  doc: (_db: unknown, ...path: string[]) => ({ path: path.join("/") }),
  setDoc: fs.setDoc,
  deleteDoc: fs.deleteDoc,
  serverTimestamp: () => "SERVER_TIME",
}));
vi.mock("../../firebase", () => ({ db: {} }));
vi.mock("../../context/AuthContext", () => ({ useAuth: () => ({ user: null, profile: null }) }));
vi.mock("../../lib/clubApi", () => ({ savePrediction: vi.fn() }));

const { rateMatch, setReactions, unrateMatch } = await import("./writes");
const ME = { uid: "u1", name: "erik", playerId: "erik" };

beforeEach(() => {
  fs.setDoc.mockClear();
  fs.deleteDoc.mockClear();
});

it("setReactions: the member's one doc, with every moment, signed and stamped by the server", async () => {
  await setReactions(ME, "j5", { g1: "fuego", final: "aplauso" });
  expect(fs.setDoc).toHaveBeenCalledWith({ path: "matches/j5/reactions/u1" }, { moments: { g1: "fuego", final: "aplauso" }, name: "erik", playerId: "erik", at: "SERVER_TIME" });
  const [, data] = fs.setDoc.mock.calls[0] as [unknown, Record<string, unknown>];
  expect(Object.keys(data).sort()).toEqual(["at", "moments", "name", "playerId"]);
});

it("setReactions with nothing left: the doc is deleted", async () => {
  await setReactions(ME, "j5", {});
  expect(fs.setDoc).not.toHaveBeenCalled();
  expect(fs.deleteDoc).toHaveBeenCalledWith({ path: "matches/j5/reactions/u1" });
});

it("rateMatch / unrateMatch: matches/{id}/ratings/{uid} with exactly score, name, playerId and at", async () => {
  await rateMatch({ uid: "u2", name: "raul", playerId: null }, "j5", 4);
  expect(fs.setDoc).toHaveBeenCalledWith({ path: "matches/j5/ratings/u2" }, { score: 4, name: "raul", playerId: null, at: "SERVER_TIME" });
  await unrateMatch(ME, "j5");
  expect(fs.deleteDoc).toHaveBeenCalledWith({ path: "matches/j5/ratings/u1" });
});
