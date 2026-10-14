import { fireEvent, render, screen } from "@testing-library/react";
import { beforeEach, expect, it, vi } from "vitest";

// «¿Cómo acaba?»: the shared porra. The real write (vestuario/writes.ts) runs on a stubbed Firestore, so
// the test sees the exact document and payload; my saved prediction comes from a stubbed listener.
const fs = vi.hoisted(() => ({ setDoc: vi.fn(async (_ref: unknown, _data: unknown) => undefined) }));
const live = vi.hoisted(() => ({ prediction: null as { goalsFor: number; goalsAgainst: number } | null, asked: [] as unknown[] }));
vi.mock("firebase/firestore", () => ({
  doc: (_db: unknown, ...path: string[]) => ({ path: path.join("/") }),
  setDoc: fs.setDoc,
  serverTimestamp: () => "SERVER_TIME",
  collection: vi.fn(),
  deleteDoc: vi.fn(),
  writeBatch: vi.fn(),
}));
vi.mock("../../../firebase", () => ({ db: {} }));
vi.mock("../../../context/AuthContext", () => ({ useAuth: () => ({ user: { uid: "u1" }, profile: { nickname: "ADRI", playerId: "adri" } }) }));
vi.mock("../live", () => ({
  useMyPrediction: (matchId: string, uid: string) => {
    live.asked = [matchId, uid];
    return { data: live.prediction };
  },
}));
// (clubData also opens the whole data layer: the porra only needs its dateMillis)
vi.mock("../../../lib/clubData", async () => ({ dateMillis: (await import("../../../../functions/src/matchEngine")).dateMillis }));
vi.mock("../../../lib/clubApi", () => ({ apiError: (e: unknown) => `No se pudo guardar: ${(e as Error).message}` }));

const { PorraCard, PORRA_RULE } = await import("./PorraCard");

const NOW = Date.UTC(2026, 10, 6, 12);
const MATCH = { id: "j8", status: "scheduled", date: NOW + 2 * 86_400_000, rival: "MAD SKY" } as const;
const btn = (name: string) => screen.getByRole("button", { name });
const scores = () => screen.getAllByRole("status").map((o) => o.textContent);

beforeEach(() => {
  fs.setDoc.mockReset();
  fs.setDoc.mockResolvedValue(undefined);
  live.prediction = null;
});

it("open, nothing saved: 0–0, the rule and when it closes in sight", () => {
  render(<PorraCard match={MATCH} now={NOW} uid="u1" />);
  expect(live.asked).toEqual(["j8", "u1"]);
  expect(screen.getByRole("group", { name: "Tu porra: Piti contra MAD SKY" })).toBeInTheDocument();
  expect(scores()).toEqual(["0", "0"]);
  expect(screen.getByText(`Cierra en 2 d 0 h 0 min. ${PORRA_RULE}`)).toBeInTheDocument();
  expect(PORRA_RULE).toBe("3 puntos si clavas el resultado, 1 si aciertas quién gana.");
  expect(btn("Un gol menos del Piti")).toBeDisabled();
  expect(btn("Un gol menos de MAD SKY")).toBeDisabled();
  expect(btn("Guardar mi porra")).toBeEnabled();
});

it("the steppers set the score and saving writes matchPrivate/{match}/predictions/{uid}", () => {
  render(<PorraCard match={MATCH} now={NOW} uid="u1" />);
  fireEvent.click(btn("Un gol más del Piti"));
  fireEvent.click(btn("Un gol más del Piti"));
  fireEvent.click(btn("Un gol más de MAD SKY"));
  expect(scores()).toEqual(["2", "1"]);
  fireEvent.click(btn("Guardar mi porra"));
  expect(fs.setDoc).toHaveBeenCalledTimes(1);
  expect(fs.setDoc).toHaveBeenCalledWith({ path: "matchPrivate/j8/predictions/u1" }, { goalsFor: 2, goalsAgainst: 1, name: "ADRI", playerId: "adri", at: "SERVER_TIME" });
});

it("a saved porra: «Porra guardada» until it changes, then «Cambiar mi porra»", () => {
  live.prediction = { goalsFor: 3, goalsAgainst: 2 };
  render(<PorraCard match={MATCH} now={NOW} uid="u1" />);
  expect(scores()).toEqual(["3", "2"]);
  expect(btn("Porra guardada")).toBeDisabled();
  fireEvent.click(btn("Un gol menos de MAD SKY"));
  fireEvent.click(btn("Cambiar mi porra"));
  expect(fs.setDoc).toHaveBeenCalledWith({ path: "matchPrivate/j8/predictions/u1" }, { goalsFor: 3, goalsAgainst: 1, name: "ADRI", playerId: "adri", at: "SERVER_TIME" });
});

it("30 a side at most (the rules' limit)", () => {
  live.prediction = { goalsFor: 30, goalsAgainst: 0 };
  render(<PorraCard match={MATCH} now={NOW} uid="u1" />);
  expect(btn("Un gol más del Piti")).toBeDisabled();
  expect(btn("Un gol menos del Piti")).toBeEnabled();
});

it("a match without a rival says «del rival»", () => {
  render(<PorraCard match={{ id: "j8", status: "scheduled", date: MATCH.date }} now={NOW} uid="u1" />);
  expect(btn("Un gol más del rival")).toBeInTheDocument();
  expect(screen.getByRole("group", { name: "Tu porra: Piti contra Rival" })).toBeInTheDocument();
});

it("closed at the match's date: my porra stays in sight, no steppers nor saving, the rule still there", () => {
  live.prediction = { goalsFor: 1, goalsAgainst: 1 };
  render(<PorraCard match={MATCH} now={MATCH.date} uid="u1" />);
  expect(scores()).toEqual(["1", "1"]);
  for (const name of ["Un gol más del Piti", "Un gol menos del Piti", "Un gol más de MAD SKY", "Un gol menos de MAD SKY"]) expect(btn(name)).toBeDisabled();
  expect(screen.queryByRole("button", { name: /porra/ })).toBeNull();
  expect(screen.getByText(`La porra se cerró a la hora del partido. ${PORRA_RULE}`)).toBeInTheDocument();
});

it("before the match has a date it is not open yet", () => {
  render(<PorraCard match={{ id: "j8", status: "scheduled", rival: "MAD SKY" }} now={NOW} uid="u1" />);
  expect(screen.getByText(`La porra se abre cuando el partido tenga fecha. ${PORRA_RULE}`)).toBeInTheDocument();
  expect(screen.queryByRole("button", { name: /porra/ })).toBeNull();
});

it("a refused write says why", async () => {
  fs.setDoc.mockRejectedValueOnce(new Error("permission-denied"));
  render(<PorraCard match={MATCH} now={NOW} uid="u1" />);
  fireEvent.click(btn("Guardar mi porra"));
  expect(await screen.findByRole("alert")).toHaveTextContent("No se pudo guardar: permission-denied");
});

it("a refused write keeps the score the member set, under the error", async () => {
  live.prediction = { goalsFor: 1, goalsAgainst: 0 };
  fs.setDoc.mockRejectedValueOnce(new Error("permission-denied"));
  render(<PorraCard match={MATCH} now={NOW} uid="u1" />);
  fireEvent.click(btn("Un gol más del Piti"));
  fireEvent.click(btn("Un gol más de MAD SKY"));
  fireEvent.click(btn("Cambiar mi porra"));
  expect(await screen.findByRole("alert")).toHaveTextContent("permission-denied");
  expect(scores()).toEqual(["2", "1"]);
  expect(btn("Cambiar mi porra")).toBeEnabled();
});

it("a saved write drops the draft and announces it once; the scores themselves stay silent", async () => {
  const { rerender } = render(<PorraCard match={MATCH} now={NOW} uid="u1" />);
  for (const o of document.querySelectorAll("output")) expect(o).toHaveAttribute("aria-live", "off");
  fireEvent.click(btn("Un gol más del Piti"));
  fireEvent.click(btn("Un gol más de MAD SKY"));
  fireEvent.click(btn("Guardar mi porra"));
  expect(await screen.findByText("Porra guardada: 1 a 1.")).toHaveAttribute("aria-live", "polite");
  // (the draft is gone: the scores follow what the listener says is saved)
  live.prediction = { goalsFor: 5, goalsAgainst: 4 };
  rerender(<PorraCard match={MATCH} now={NOW} uid="u1" />);
  expect(scores()).toEqual(["5", "4"]);
});

it("a future match that is not scheduled (legacy, without status) does not claim it closed", () => {
  render(<PorraCard match={{ id: "j8", rival: "MAD SKY", date: MATCH.date }} now={NOW} uid="u1" />);
  expect(screen.getByText(`Este partido no admite porra. ${PORRA_RULE}`)).toBeInTheDocument();
  expect(screen.queryByRole("button", { name: /porra/ })).toBeNull();
});
