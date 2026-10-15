import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { beforeEach, expect, it, vi } from "vitest";
import type { ClubMatch } from "../../lib/clubData";
import type { Prediction } from "../../../functions/src/predictions";
const state = vi.hoisted(() => ({ data: null as Prediction | null, loading: false, error: false, save: vi.fn() }));
vi.mock("../../pages/vestuario/live", () => ({ useMyPrediction: () => state }));
vi.mock("../../pages/vestuario/writes", () => ({ useMe: () => ({ uid: "u", name: "Socio", playerId: null }), predictScore: state.save }));
import { PredictionForm, PredictionResult } from "./PredictionForm";
const match: ClubMatch = { id: "m", status: "scheduled", seasonId: "s", date: 1, duration: 50, events: [], rival: "Rival" };
const players = [{ id: "a", shirtName: "Adrián", seasons: ["s"] }, { id: "b", shirtName: "Erik", seasons: ["s"] }, { id: "old", shirtName: "Antiguo", seasons: ["other"] }];
beforeEach(() => { state.data = null; state.loading = false; state.error = false; state.save.mockReset().mockResolvedValue({}); });
it("exige goleador, deja asistencia opcional y guarda aunque la hora prevista haya pasado", async () => {
  render(<PredictionForm match={match} players={players} uid="u" />);
  fireEvent.click(screen.getByRole("button", { name: "Un gol más del Piti" }));
  expect(screen.getByRole("button", { name: "Guardar mi porra" })).toBeDisabled();
  fireEvent.change(screen.getByLabelText("Goleador del gol 1"), { target: { value: "a" } });
  expect(screen.queryByRole("option", { name: "Antiguo" })).toBeNull();
  fireEvent.click(screen.getByRole("button", { name: "Guardar mi porra" }));
  await waitFor(() => expect(state.save).toHaveBeenCalledWith(expect.anything(), "m", 1, 0, [{ playerId: "a" }]));
});
it("editar mantiene las jugadas y elimina la autoasistencia al cambiar goleador", async () => {
  state.data = { goalsFor: 1, goalsAgainst: 1, goals: [{ playerId: "a", assistPlayerId: "b" }] };
  render(<PredictionForm match={match} players={players} uid="u" />);
  expect(screen.getByRole("button", { name: "Porra guardada" })).toBeDisabled();
  fireEvent.change(screen.getByLabelText("Goleador del gol 1"), { target: { value: "b" } });
  expect(screen.getByLabelText("Asistencia del gol 1")).toHaveValue("");
  fireEvent.change(screen.getByLabelText("Asistencia del gol 1"), { target: { value: "none" } });
  fireEvent.click(screen.getByRole("button", { name: "Cambiar mi porra" }));
  await waitFor(() => expect(state.save).toHaveBeenCalledWith(expect.anything(), "m", 1, 1, [{ playerId: "b", assistPlayerId: null }]));
});
it("no guarda mientras carga, muestra errores y conserva el borrador para reintentar", async () => {
  state.save.mockRejectedValue(new Error("Sin conexión"));
  const { rerender } = render(<PredictionForm match={match} players={players} uid="u" />);
  fireEvent.click(screen.getByRole("button", { name: "Guardar mi porra" }));
  await screen.findByRole("alert");
  expect(screen.getByRole("button", { name: "Guardar mi porra" })).toBeEnabled();
  state.loading = true;
  rerender(<PredictionForm match={match} players={players} uid="u" />);
  expect(screen.getByRole("button", { name: "Guardar mi porra" })).toBeDisabled();
});
it("el inicio recibido en directo bloquea el formulario y permite consultar la leyenda", () => {
  const { rerender } = render(<PredictionForm match={match} players={players} uid="u" />);
  rerender(<PredictionForm match={{ ...match, liveEndedAt: 100 }} players={players} uid="u" />);
  expect(screen.getByRole("button", { name: "Un gol más del Piti" })).toBeDisabled();
  expect(screen.queryByRole("button", { name: "Guardar mi porra" })).toBeNull();
  fireEvent.click(screen.getByRole("button", { name: /Cómo se puntúa/ }));
  expect(screen.getByRole("heading", { name: "Los puntos de la porra" })).toBeVisible();
  expect(screen.getByRole("button", { name: /Cómo se puntúa/ })).toHaveAttribute("aria-expanded", "true");
});
it("explica los puntos de la jugada sin asistencia al terminar", () => {
  render(<PredictionResult prediction={{ goalsFor: 1, goalsAgainst: 0, goals: [{ playerId: "a", assistPlayerId: null }] }} match={{ ...match, goalsFor: 1, goalsAgainst: 0, events: [{ id: "g", type: "goal", playerId: "a" }] }} players={players} />);
  expect(screen.getByText("8")).toBeVisible();
  expect(screen.getByText("Jugadas clavadas · 1")).toBeVisible();
  expect(screen.getByText("Sin asistencia")).toBeVisible();
});
