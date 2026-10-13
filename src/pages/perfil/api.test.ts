import { beforeEach, describe, expect, it, vi } from "vitest";

// «Tus posiciones»: the member's write is exactly what firestore.rules allows him — updateDoc on his own
// ficha with only `positionsProposal` ({main, also, at: serverTimestamp()}) or null. Firestore is faked.

const fs = vi.hoisted(() => ({ calls: [] as { path: string; data: unknown }[], STAMP: { __serverTimestamp: true } }));

vi.mock("../../firebase", () => ({ db: { path: "" }, functions: {} }));
vi.mock("firebase/functions", () => ({ httpsCallable: () => vi.fn() }));
vi.mock("../../lib/clubApi", () => ({ apiError: vi.fn(), requestPlayerClaim: vi.fn() }));
vi.mock("firebase/firestore", () => ({
  doc: (_db: unknown, ...segs: string[]) => ({ path: segs.join("/") }),
  getDoc: vi.fn(),
  serverTimestamp: () => fs.STAMP,
  updateDoc: vi.fn(async (ref: { path: string }, data: unknown) => {
    fs.calls.push({ path: ref.path, data });
  }),
  setDoc: vi.fn(async () => {
    throw new Error("setDoc no: la regla del socio solo deja updateDoc de positionsProposal");
  }),
}));

import { proposePositions } from "./api";

beforeEach(() => {
  fs.calls.length = 0;
});

describe("proposePositions", () => {
  it("enviar: solo positionsProposal, limpia y con la hora del servidor", async () => {
    await proposePositions("erik", { main: "MCD", also: ["MC", "MCD", "DFC"] });
    expect(fs.calls).toEqual([{ path: "players/erik", data: { positionsProposal: { main: "MCD", also: ["MC", "DFC"], at: fs.STAMP } } }]);
  });
  it("retirar: positionsProposal a null", async () => {
    await proposePositions("erik", null);
    expect(fs.calls).toEqual([{ path: "players/erik", data: { positionsProposal: null } }]);
  });
});
