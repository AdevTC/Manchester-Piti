import { beforeEach, expect, it, vi } from "vitest";
import { Timestamp } from "firebase/firestore";

// The polls writes, as firestore.rules checks them: polls/{id} with exactly question, options, multi,
// authorUid, authorName, createdAt (the server's time) and closesAt (a Timestamp); the vote doc
// polls/{id}/votes/{uid} with exactly optionIds, name, playerId and at; close = only closedAt; delete.
const fs = vi.hoisted(() => ({
  addDoc: vi.fn(async (_ref: unknown, _data: unknown) => ({ id: "new" })),
  setDoc: vi.fn(async (_ref: unknown, _data: unknown) => undefined),
  updateDoc: vi.fn(async (_ref: unknown, _data: unknown) => undefined),
  deleteDoc: vi.fn(async (_ref: unknown) => undefined),
}));
vi.mock("firebase/firestore", async (importOriginal) => ({
  ...(await importOriginal<typeof import("firebase/firestore")>()),
  collection: (_db: unknown, ...path: string[]) => ({ path: path.join("/") }),
  doc: (_db: unknown, ...path: string[]) => ({ path: path.join("/") }),
  addDoc: fs.addDoc,
  setDoc: fs.setDoc,
  updateDoc: fs.updateDoc,
  deleteDoc: fs.deleteDoc,
  serverTimestamp: () => "SERVER_TIME",
}));
vi.mock("../../firebase", () => ({ db: {} }));
vi.mock("../../context/AuthContext", () => ({ useAuth: () => ({ user: null, profile: null }) }));
vi.mock("../../lib/clubApi", () => ({ savePrediction: vi.fn() }));

const { closePoll, createPoll, deletePoll, votePoll } = await import("./writes");
const ME = { uid: "u1", name: "erik", playerId: "erik" };
const NOW = Date.UTC(2026, 9, 16, 10);
const POLL = {
  id: "p1",
  options: [
    { id: "o1", label: "Sí" },
    { id: "o2", label: "No" },
  ],
  multi: false,
};

beforeEach(() => {
  fs.addDoc.mockClear();
  fs.setDoc.mockClear();
  fs.updateDoc.mockClear();
  fs.deleteDoc.mockClear();
});

it("createPoll: an auto-id polls doc with the rules' exact shape", async () => {
  await createPoll(ME, { question: " ¿Cena el viernes? ", options: ["Sí", " ", "No"], multi: false, duration: "3d" }, NOW);
  const [ref, data] = fs.addDoc.mock.calls[0] as [unknown, Record<string, unknown>];
  expect(ref).toEqual({ path: "polls" });
  expect(Object.keys(data).sort()).toEqual(["authorName", "authorUid", "closesAt", "createdAt", "multi", "options", "question"]);
  expect(data).toMatchObject({
    question: "¿Cena el viernes?",
    options: [
      { id: "o1", label: "Sí" },
      { id: "o2", label: "No" },
    ],
    multi: false,
    authorUid: "u1",
    authorName: "erik",
    createdAt: "SERVER_TIME",
  });
  expect(data.closesAt).toBeInstanceOf(Timestamp);
  // 3 days and a minute of margin
  expect((data.closesAt as Timestamp).toMillis()).toBe(NOW + 3 * 86_400_000 + 60_000);
});

it("votePoll: the member's own vote doc, one id unless multi, signed like the availability", async () => {
  await votePoll(ME, POLL, ["o2", "o1"]);
  const [ref, data] = fs.setDoc.mock.calls[0];
  expect(ref).toEqual({ path: "polls/p1/votes/u1" });
  expect(data).toEqual({ optionIds: ["o2"], name: "erik", playerId: "erik", at: "SERVER_TIME" });

  await votePoll({ ...ME, playerId: null }, { ...POLL, multi: true }, ["o1", "o2", "zz"]);
  expect(fs.setDoc.mock.calls[1][1]).toEqual({ optionIds: ["o1", "o2"], name: "erik", playerId: null, at: "SERVER_TIME" });
});

it("closePoll sets only closedAt; deletePoll deletes the doc", async () => {
  await closePoll("p1");
  expect(fs.updateDoc).toHaveBeenCalledWith({ path: "polls/p1" }, { closedAt: "SERVER_TIME" });
  await deletePoll("p1");
  expect(fs.deleteDoc).toHaveBeenCalledWith({ path: "polls/p1" });
});
