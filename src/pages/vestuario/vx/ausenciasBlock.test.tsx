import { act, fireEvent, render, screen } from "@testing-library/react";
import { beforeEach, expect, it, vi } from "vitest";
import type { Absence } from "../../../lib/derived/absences";
import type { VxCtx } from "./ctx";

// The board's «Mis ausencias» body with real data: the form, the list with its matches, «Quitar» asked first
// and the team's line.
const state = vi.hoisted(() => ({
  absences: [] as unknown[],
  addAbsence: vi.fn(async (..._a: unknown[]) => ({ id: "new" })),
  deleteAbsence: vi.fn(async (_id: string) => undefined),
}));
vi.mock("../live", () => ({ useAbsences: () => ({ data: state.absences, loading: false, error: false }) }));
vi.mock("../writes", () => ({ addAbsence: state.addAbsence, deleteAbsence: state.deleteAbsence }));
vi.mock("../../../lib/clubApi", () => ({ apiError: () => "No se pudo guardar." }));

const { AusenciasBlock } = await import("./Ausencias");

const NOW = Date.UTC(2026, 9, 23, 10);
const abs = (extra: Partial<Absence>): Absence => ({ id: "a1", uid: "u1", playerId: "erik", name: "erik", from: "2026-10-31", to: "2026-11-09", note: "", createdAt: 1, ...extra });
const say = vi.fn();
const matches = [{ id: "m3", seasonId: "s1", status: "scheduled", date: Date.UTC(2026, 10, 1, 13), rival: "Red Demons" }];
const ctx = () =>
  ({ me: { uid: "u1", name: "erik", playerId: "erik" }, uid: "u1", now: NOW, matches, players: [{ id: "andia" }], nameOf: (id: string) => (id === "andia" ? "Andia" : id), say }) as unknown as VxCtx;

beforeEach(() => {
  state.absences = [];
  state.addAbsence.mockClear();
  state.deleteAbsence.mockClear();
  say.mockClear();
});

it("none: says so, and no team line", () => {
  render(<AusenciasBlock c={ctx()} />);
  expect(screen.getByText("No tienes ausencias apuntadas.")).toBeTruthy();
  expect(screen.queryByText(/En el equipo/)).toBeNull();
});

it("the list with its matches, «Quitar» asked first, and the team", async () => {
  state.absences = [abs({}), abs({ id: "a2", uid: "u2", playerId: "andia", name: "andi", from: "2026-10-20", to: "2026-10-27", note: "viaje" })];
  render(<AusenciasBlock c={ctx()} />);
  expect(screen.getByText("Del 31 oct al 9 nov")).toBeTruthy();
  expect(screen.getByText("1 partido en esas fechas: J1 contra Red Demons")).toBeTruthy();
  expect(screen.getByText("En el equipo: Andia, hasta el 27 (viaje).")).toBeTruthy();
  fireEvent.click(screen.getByRole("button", { name: /Quitar/ }));
  expect(screen.getByText("Borramos el «No puedo» de los partidos que no cambiaste a mano.")).toBeTruthy();
  await act(async () => fireEvent.click(screen.getByRole("button", { name: "Sí, quitarla" })));
  expect(state.deleteAbsence).toHaveBeenCalledWith("a1");
  expect(say).toHaveBeenCalledWith("Ausencia quitada.");
});

it("«Añadir» checks the dates, then saves and says how many matches", async () => {
  render(<AusenciasBlock c={ctx()} />);
  fireEvent.click(screen.getByRole("button", { name: "Añadir" }));
  expect(screen.getByText("Elige las dos fechas.")).toBeTruthy();
  fireEvent.change(screen.getByLabelText("Desde"), { target: { value: "2026-10-31" } });
  fireEvent.change(screen.getByLabelText("Hasta"), { target: { value: "2026-11-09" } });
  fireEvent.change(screen.getByLabelText(/Nota/), { target: { value: "boda" } });
  expect(screen.getByText("La ve todo el equipo · 4/80")).toBeTruthy();
  await act(async () => fireEvent.click(screen.getByRole("button", { name: "Añadir" })));
  expect(state.addAbsence).toHaveBeenCalledWith(expect.objectContaining({ uid: "u1" }), "2026-10-31", "2026-11-09", "boda");
  expect(say).toHaveBeenCalledWith("Del 31 oct al 9 nov. Guardada. Contestamos «No puedo» en 1 partido.");
});
