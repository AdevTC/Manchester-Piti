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

  it("«Añadir a la lista»: choosing a player adds nothing until «Añadir»", async () => {
    const [a, b] = roster;
    h.rota = { jobs: [{ id: "lavar", name: "Lavar la equipación", icon: "shirt", awayOnly: false, order: [a] }] };
    const user = userEvent.setup();
    render(<Turnos />);
    const list = () => within(screen.getByRole("list", { name: "Orden de Lavar la equipación" })).getAllByRole("listitem");
    expect(list()).toHaveLength(1);
    const add = screen.getByRole("button", { name: "Añadir a la lista de Lavar la equipación" });
    expect(add).toBeDisabled();
    await user.selectOptions(screen.getByRole("combobox", { name: "Añadir a la lista" }), b);
    expect(list()).toHaveLength(1);
    await user.click(add);
    expect(list()).toHaveLength(2);
  });

  it("another captain's save: adopted when nothing is being edited; with edits, «Otro capitán ha cambiado los turnos · Recargar»", async () => {
    const [a, b, c] = roster;
    const job = (order: string[], name = "Lavar la equipación") => ({ jobs: [{ id: "lavar", name, icon: "shirt" as const, awayOnly: false, order }] });
    h.rota = job([a, b]);
    const user = userEvent.setup();
    const { rerender } = render(<Turnos />);
    // nothing edited: the new rota just shows
    h.rota = job([a, b], "Lavar los petos");
    rerender(<Turnos />);
    expect(screen.getByRole("heading", { name: "Lavar los petos" })).toBeInTheDocument();
    expect(screen.queryByText("Otro capitán ha cambiado los turnos")).not.toBeInTheDocument();
    // edited here, then changed there: the edits stay, and the captain is told
    const name = screen.getByRole("textbox", { name: "Nombre" });
    await user.clear(name);
    await user.type(name, "Mi cambio");
    h.rota = job([b, a, c], "Lavar los petos");
    rerender(<Turnos />);
    expect(screen.getByRole("textbox", { name: "Nombre" })).toHaveValue("Mi cambio");
    expect(screen.getByText("Otro capitán ha cambiado los turnos")).toBeInTheDocument();
    await user.click(screen.getByRole("button", { name: "Recargar" }));
    expect(screen.getByRole("textbox", { name: "Nombre" })).toHaveValue("Lavar los petos");
    expect(within(screen.getByRole("list", { name: "Orden de Lavar los petos" })).getAllByRole("listitem")).toHaveLength(3);
    expect(screen.queryByText("Otro capitán ha cambiado los turnos")).not.toBeInTheDocument();
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
