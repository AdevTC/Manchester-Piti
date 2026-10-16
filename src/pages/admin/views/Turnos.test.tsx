import { render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";
import type { Rota } from "../../../lib/derived/rota";
import { adminFixture } from "../../../test/adminKit";

// The editor alone: the sala's data, the toast and the rota's listener and save are stubbed.
const h = vi.hoisted(() => ({
  rota: null as Rota | null,
  saveRota: vi.fn((..._args: unknown[]) => Promise.resolve()),
}));
const data = adminFixture();
vi.mock("../shell/context", () => ({ useAdmin: () => data }));
vi.mock("../ui/toastContext", () => ({ useToast: () => ({ show: vi.fn() }) }));
vi.mock("../../../lib/useRotaTurns", () => ({ useRota: () => ({ data: h.rota, loading: false, error: false }) }));
vi.mock("../data/useTurnos", () => ({ useTurnosWrites: () => ({ saveRota: h.saveRota, pin: vi.fn(), unpin: vi.fn() }) }));
const { Turnos } = await import("./Turnos");

const roster = data.players.filter((p) => p.seasons?.includes("t1")).map((p) => p.id);

describe("Turnos (admin)", () => {
  beforeEach(() => {
    h.rota = null;
    h.saveRota.mockClear();
  });

  it("no rota yet: «Empezar con los turnos de siempre» offers the three jobs with the season's squad, and saves them", async () => {
    const user = userEvent.setup();
    render(<Turnos />);
    expect(screen.getByText("Aún no hay turnos esta temporada")).toBeInTheDocument();
    await user.click(screen.getByRole("button", { name: /Empezar con los turnos de siempre/ }));
    expect(screen.getByRole("heading", { name: "Lavar la equipación" })).toBeInTheDocument();
    expect(screen.getByRole("heading", { name: "Balones y petos" })).toBeInTheDocument();
    const coche = screen.getByRole("heading", { name: "Coche a los partidos fuera" }).closest("section") as HTMLElement;
    expect(within(coche).getByRole("checkbox", { name: "Solo partidos fuera" })).toBeChecked();
    await user.click(screen.getByRole("button", { name: /Guardar los turnos/ }));
    expect(h.saveRota).toHaveBeenCalledTimes(1);
    const [season, jobs] = h.saveRota.mock.calls[0] as [string, Rota["jobs"]];
    expect(season).toBe("t1");
    expect(jobs.map((j) => j.id)).toEqual(["lavar", "balones", "coche"]);
    expect(jobs[0].order).toEqual(roster.slice(0, 40));
  });

  it("«Subir» and «Bajar»: focus follows the moved member and a live region says where he is", async () => {
    const [a, b] = roster;
    h.rota = { jobs: [{ id: "lavar", name: "Lavar la equipación", icon: "shirt", awayOnly: false, order: [a, b] }] };
    const user = userEvent.setup();
    render(<Turnos />);
    const list = screen.getByRole("list", { name: "Orden de Lavar la equipación" });
    const second = within(list).getAllByRole("listitem")[1];
    const up = within(second).getByRole("button", { name: /^Subir a / });
    const name = up.getAttribute("aria-label")?.replace("Subir a ", "") ?? "";
    await user.click(up);
    // (at the top «Subir» is off: focus moves to his «Bajar»)
    expect(screen.getByRole("button", { name: `Bajar a ${name}` })).toHaveFocus();
    expect(screen.getByRole("status")).toHaveTextContent(`${name}, ahora el 1.º en «Lavar la equipación»`);
  });

  it("what the rules refuse is said before saving: a job without a name", async () => {
    h.rota = { jobs: [{ id: "lavar", name: "", icon: "shirt", awayOnly: false, order: [] }] };
    const user = userEvent.setup();
    render(<Turnos />);
    expect(screen.getByRole("list", { name: "Falta para guardar" })).toHaveTextContent("El turno 1 necesita un nombre.");
    await user.click(screen.getByRole("button", { name: /Guardar los turnos/ }));
    expect(h.saveRota).not.toHaveBeenCalled();
  });
});
