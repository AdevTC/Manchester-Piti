import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { beforeEach, expect, it, vi } from "vitest";
import type { Prediction } from "../../../../functions/src/predictions";
const api = vi.hoisted(() => ({ save: vi.fn(async (_data: unknown) => undefined) }));
const live = vi.hoisted(() => ({ prediction: null as Prediction | null }));
vi.mock("firebase/firestore", () => ({ doc: vi.fn(), setDoc: vi.fn(), serverTimestamp: vi.fn(), collection: vi.fn(), deleteDoc: vi.fn(), writeBatch: vi.fn() }));
vi.mock("../../../firebase", () => ({ db: {} }));
vi.mock("../../../context/AuthContext", () => ({ useAuth: () => ({ user: { uid: "u1" }, profile: { nickname: "ADRI", playerId: "adri" } }) }));
vi.mock("../live", () => ({ useMyPrediction: () => ({ data: live.prediction, loading: false, error: false }) }));
vi.mock("../../../lib/clubData", () => ({ nameFor: (p: { id: string } | undefined) => p?.id ?? "Jugador" }));
vi.mock("../../../lib/clubApi", () => ({ savePrediction: api.save, apiError: (e: Error) => e.message }));
const { PorraCard } = await import("./PorraCard");
const MATCH = { id: "j8", status: "scheduled", date: 1, rival: "MAD SKY", seasonId: "t1", published: true } as const;
const PLAYERS = [{ id: "adri", seasons: ["t1"] }, { id: "erik", seasons: ["t1"] }];
const btn = (name: string) => screen.getByRole("button", { name });
const view = () => render(<PorraCard match={MATCH} players={PLAYERS} uid="u1" />);
beforeEach(() => { api.save.mockReset(); api.save.mockResolvedValue(undefined); live.prediction = null; });
it("remains editable past the scheduled time, with the scoring legend available", () => {
  view(); expect(btn("Guardar mi porra")).toBeEnabled();
  fireEvent.click(btn("Cómo se puntúa"));
  expect(screen.getByText("Cada gol del goleador elegido")).toBeInTheDocument();
  expect(screen.getByText("Goleador + «Sin asistencia», acertados")).toBeInTheDocument();
});
it("uses the authenticated callable with a scorer and optional assistant for every predicted goal", async () => {
  view(); fireEvent.click(btn("Un gol más del Piti"));
  expect(btn("Guardar mi porra")).toBeDisabled();
  fireEvent.change(screen.getByLabelText("Goleador del gol 1"), { target: { value: "adri" } });
  fireEvent.change(screen.getByLabelText("Asistencia del gol 1"), { target: { value: "erik" } });
  fireEvent.click(btn("Guardar mi porra"));
  await waitFor(() => expect(api.save).toHaveBeenCalledWith({ matchId: "j8", goalsFor: 1, goalsAgainst: 0, goals: [{ playerId: "adri", assistPlayerId: "erik" }] }));
  expect(await screen.findByText("Porra guardada: 1 a 0.")).toHaveAttribute("aria-live", "polite");
  for (const output of document.querySelectorAll("output")) expect(output).toHaveAttribute("aria-live", "off");
});
it("a refused write retains the unsaved draft for retry", async () => {
  api.save.mockRejectedValueOnce(new Error("Sin conexión"));
  view(); fireEvent.click(btn("Un gol más del rival")); fireEvent.click(btn("Guardar mi porra"));
  expect(await screen.findByRole("alert")).toHaveTextContent("Sin conexión");
  expect([...document.querySelectorAll("output")].map(x=>x.textContent)).toEqual(["0","1"]);
  expect(btn("Guardar mi porra")).toBeEnabled();
});
it("closes on shared kickoff and keeps the saved prediction visible", () => {
  live.prediction = { goalsFor: 1, goalsAgainst: 0, goals: [{ playerId: "adri", assistPlayerId: null }] };
  const {rerender}=view();
  rerender(<PorraCard match={{...MATCH, clock:{phase:"first",revision:1,firstStartedAt:1000}}} players={PLAYERS} uid="u1"/>);
  expect(btn("Un gol más del Piti")).toBeDisabled();
  expect(screen.queryByRole("button",{name:"Guardar mi porra"})).toBeNull();
  expect(screen.getByLabelText("Goleador del gol 1")).toHaveValue("adri");
});
it("caps the score at thirty", () => {live.prediction={goalsFor:30,goalsAgainst:0};view();expect(btn("Un gol más del Piti")).toBeDisabled();});
it("does not open for an unavailable match or a visitor", () => {
 const {rerender}=render(<PorraCard match={{...MATCH,status:"cancelled"}} players={PLAYERS} uid="u1"/>);
 expect(btn("Un gol más del Piti")).toBeDisabled();
 rerender(<PorraCard match={MATCH} players={PLAYERS} uid={undefined}/>);
 expect(screen.queryByRole("group",{name:/Tu porra/})).toBeNull();
});
