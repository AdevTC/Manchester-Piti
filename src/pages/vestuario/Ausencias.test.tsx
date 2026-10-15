import { act, fireEvent, render, screen, within } from "@testing-library/react";
import { beforeEach, expect, it, vi } from "vitest";
import type { ClubMatch } from "../../lib/clubData";
import type { Absence } from "../../lib/derived/absences";

// «Mis ausencias»: members only, the form's words, the count after saving, your list and «Quitar» asked
// first. The absences reader and the writes are stubbed (their shape: writes.absences.test.ts).
const state = vi.hoisted(() => ({
  absences: [] as unknown[],
  loading: false,
  calls: [] as [string, boolean | undefined][],
  addAbsence: vi.fn(async () => undefined),
  deleteAbsence: vi.fn(async () => undefined),
}));
vi.mock("./live", () => ({
  useAbsences: (today: string, enabled?: boolean) => {
    state.calls.push([today, enabled]);
    return { data: state.absences, loading: state.loading, error: false };
  },
}));
vi.mock("./writes", () => ({
  useMe: () => ({ uid: "u1", name: "erik", playerId: "erik" }),
  addAbsence: state.addAbsence,
  deleteAbsence: state.deleteAbsence,
}));
vi.mock("../../lib/clubApi", () => ({ apiError: () => "No se pudo guardar." }));

const { Ausencias } = await import("./Ausencias");

// 15 Oct 2026, 12:00 Madrid
const NOW = Date.UTC(2026, 9, 15, 10);
const match = (id: string, date: number, status = "scheduled") => ({ id, seasonId: "t1", version: 2, status, rival: "R", date }) as unknown as ClubMatch;
const MATCHES = [match("j1", Date.UTC(2026, 9, 18, 10)), match("j2", Date.UTC(2026, 9, 19, 21, 30)), match("j3", Date.UTC(2026, 9, 26, 10)), match("old", Date.UTC(2026, 9, 11, 10), "finished")];
const abs = (extra: Partial<Absence>): Absence => ({ id: "a1", uid: "u1", playerId: "erik", name: "erik", from: "2026-10-18", to: "2026-10-19", note: "", createdAt: 1, ...extra });
const renderIt = (member = true) => render(<Ausencias member={member} matches={MATCHES} now={NOW} />);
const dates = () => [screen.getByLabelText("Desde"), screen.getByLabelText("Hasta")] as HTMLInputElement[];
const pick = (from: string, to: string) => {
  const [f, t] = dates();
  fireEvent.change(f, { target: { value: from } });
  fireEvent.change(t, { target: { value: to } });
};

beforeEach(() => {
  state.absences = [];
  state.loading = false;
  state.calls = [];
  state.addAbsence.mockClear();
  state.deleteAbsence.mockClear();
});

it("members only: a fan renders nothing and never opens the absences reader", () => {
  const { container } = renderIt(false);
  expect(container).toBeEmptyDOMElement();
  expect(state.calls).toEqual([]);
  renderIt();
  expect(screen.getByRole("heading", { name: "Mis ausencias" })).toBeInTheDocument();
  expect(state.calls.at(-1)).toEqual(["2026-10-15", true]);
  expect(screen.getByText("No tienes ausencias apuntadas.")).toBeInTheDocument();
  // the note says who sees it
  expect(screen.getByText(/La ve todo el equipo/)).toBeInTheDocument();
});

it("the form says what is wrong, and saves nothing then", () => {
  renderIt();
  expect(dates()[0].value).toBe("2026-10-15");
  fireEvent.click(screen.getByRole("button", { name: /Añadir/ }));
  expect(screen.getByRole("alert")).toHaveTextContent("Elige las dos fechas.");
  pick("2026-10-20", "2026-10-18");
  expect(screen.getByRole("alert")).toHaveTextContent("La fecha final va después de la inicial");
  pick("2026-10-20", "2027-02-17");
  expect(screen.getByRole("alert")).toHaveTextContent("Como mucho 120 días");
  pick("2026-10-01", "2026-10-14");
  expect(screen.getByRole("alert")).toHaveTextContent("Esa fecha ya pasó");
  fireEvent.click(screen.getByRole("button", { name: /Añadir/ }));
  expect(state.addAbsence).not.toHaveBeenCalled();
});

it("«Añadir» writes the range and the note, then says how many matches got «No puedo»", async () => {
  renderIt();
  pick("2026-10-16", "2026-10-19");
  fireEvent.change(screen.getByLabelText("Nota (opcional)"), { target: { value: "Boda en Cádiz" } });
  expect(screen.getByText(/13\/140/)).toBeInTheDocument();
  expect(screen.queryByRole("alert")).toBeNull();
  await act(async () => {
    fireEvent.click(screen.getByRole("button", { name: /Añadir/ }));
  });
  expect(state.addAbsence).toHaveBeenCalledWith({ uid: "u1", name: "erik", playerId: "erik" }, "2026-10-16", "2026-10-19", "Boda en Cádiz");
  // the 18th and the 19th at 23:30 Madrid: two
  expect(screen.getByRole("status")).toHaveTextContent("Del 16 al 19 oct. Guardada. Contestamos «No puedo» en 2 partidos.");
  // the form is ready for the next one
  expect(dates()[1].value).toBe("");
  expect((screen.getByLabelText("Nota (opcional)") as HTMLInputElement).value).toBe("");
});

it("no match in those dates yet: it says what will happen", async () => {
  renderIt();
  pick("2026-11-02", "2026-11-04");
  await act(async () => {
    fireEvent.click(screen.getByRole("button", { name: /Añadir/ }));
  });
  expect(screen.getByRole("status")).toHaveTextContent(/No hay partidos en esas fechas todavía: si se publica alguno, contestamos «No puedo» por ti/);
});

it("your list only (not the team's), and «Quitar» asks first", async () => {
  state.absences = [abs({ note: "Vacaciones" }), abs({ id: "a2", from: "2026-10-12", to: "2026-10-16" }), abs({ id: "x", uid: "u2", name: "adri", playerId: "adri" })];
  renderIt();
  const list = screen.getByRole("list", { name: "Apuntadas" });
  const rows = within(list).getAllByRole("listitem");
  expect(rows).toHaveLength(2);
  expect(rows[0]).toHaveTextContent("Del 18 al 19 oct");
  expect(rows[0]).toHaveTextContent("2 partidos en esas fechas");
  expect(rows[0]).toHaveTextContent("Vacaciones");
  // under way today
  expect(rows[1]).toHaveTextContent("Del 12 al 16 oct · ahora");
  expect(rows[1]).toHaveTextContent("Sin partidos en esas fechas por ahora");

  fireEvent.click(within(rows[0]).getByRole("button", { name: "Quitar la ausencia del 18 al 19 oct" }));
  const ask = within(rows[0]).getByRole("group", { name: "Quitar la ausencia del 18 al 19 oct" });
  expect(ask).toHaveTextContent("Borramos el «No puedo» de los partidos que no cambiaste a mano.");
  expect(within(ask).getByRole("button", { name: "Sí, quitarla" })).toHaveFocus();
  fireEvent.click(within(ask).getByRole("button", { name: "Cancelar" }));
  expect(state.deleteAbsence).not.toHaveBeenCalled();
  expect(within(rows[0]).getByRole("button", { name: /Quitar la ausencia/ })).toHaveFocus();

  fireEvent.click(within(rows[0]).getByRole("button", { name: /Quitar la ausencia/ }));
  await act(async () => {
    fireEvent.click(within(rows[0]).getByRole("button", { name: "Sí, quitarla" }));
  });
  expect(state.deleteAbsence).toHaveBeenCalledWith("a1");
});

it("while the absences arrive: a short line, not an empty list", () => {
  state.loading = true;
  renderIt();
  expect(screen.getByText("Mirando tus ausencias…")).toBeInTheDocument();
});
