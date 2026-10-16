import { beforeEach, expect, it, vi } from "vitest";

// The absences writes, as firestore.rules absenceOk() checks them: exactly uid, playerId, name, from, to,
// the note only when there is one, and createdAt = the server's time. «Quitar» deletes the doc.
const fs = vi.hoisted(() => ({
  addDoc: vi.fn(async (_ref: unknown, _data: unknown) => ({ id: "new" })),
  deleteDoc: vi.fn(async (_ref: unknown) => undefined),
}));
vi.mock("firebase/firestore", async (importOriginal) => ({
  ...(await importOriginal<typeof import("firebase/firestore")>()),
  collection: (_db: unknown, ...path: string[]) => ({ path: path.join("/") }),
  doc: (_db: unknown, ...path: string[]) => ({ path: path.join("/") }),
  addDoc: fs.addDoc,
  deleteDoc: fs.deleteDoc,
  serverTimestamp: () => "SERVER_TIME",
}));
vi.mock("../../firebase", () => ({ db: {} }));
vi.mock("../../context/AuthContext", () => ({ useAuth: () => ({ user: null, profile: null }) }));
vi.mock("../../lib/clubApi", () => ({ savePrediction: vi.fn() }));

const { addAbsence, deleteAbsence } = await import("./writes");
const ME = { uid: "u1", name: "erik", playerId: "erik" };

beforeEach(() => {
  fs.addDoc.mockClear();
  fs.deleteDoc.mockClear();
});

it("addAbsence: an auto-id absences doc with the rules' exact shape", async () => {
  await addAbsence(ME, "2026-10-12", "2026-10-19", "  Boda en Cádiz  ");
  expect(fs.addDoc).toHaveBeenCalledTimes(1);
  const [ref, data] = fs.addDoc.mock.calls[0];
  expect(ref).toEqual({ path: "absences" });
  expect(data).toEqual({ uid: "u1", playerId: "erik", name: "erik", from: "2026-10-12", to: "2026-10-19", note: "Boda en Cádiz", createdAt: "SERVER_TIME" });
});

it("no note: the field is left out; no ficha: playerId null", async () => {
  await addAbsence({ ...ME, playerId: null }, "2026-10-12", "2026-10-12", "   ");
  const data = fs.addDoc.mock.calls[0][1] as Record<string, unknown>;
  expect(Object.keys(data).sort()).toEqual(["createdAt", "from", "name", "playerId", "to", "uid"]);
  expect(data.playerId).toBeNull();
});

it("deleteAbsence: deletes absences/{id}", async () => {
  await deleteAbsence("a1");
  expect(fs.deleteDoc).toHaveBeenCalledWith({ path: "absences/a1" });
});
