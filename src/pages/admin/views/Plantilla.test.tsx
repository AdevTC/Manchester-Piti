import { act, fireEvent, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { adminFixture, mountAdmin, setAdminData } from "../../../test/adminKit";
import { Plantilla } from "./Plantilla";

const h = vi.hoisted(() => ({
  writes: {
    newPlayerId: vi.fn(() => "nuevo1"),
    savePlayer: vi.fn((id: string, data: Record<string, unknown>) => Promise.resolve(void [id, data])),
    deletePlayer: vi.fn((id: string) => Promise.resolve(void id)),
  },
}));
vi.mock("../data/useAdminData", async () => ({ useAdminData: (await import("../../../test/adminMocks")).currentAdminData }));
vi.mock("../../../context/AuthContext", async () => ({ useAuth: (await import("../../../test/adminMocks")).fakeAuth }));
vi.mock("../../../lib/clubApi", () => ({ apiError: (e: unknown) => String(e) }));
vi.mock("../club/useClubWrites", () => ({ useClubWrites: () => h.writes }));

const rowsList = () => screen.getByRole("list", { name: "Jugadores" });
const rowNames = () => within(rowsList()).getAllByRole("button").map((b) => b.querySelector("b")?.textContent);
const drawer = () => screen.getByRole("dialog", { name: /.+/ });

describe("Plantilla", () => {
  beforeEach(() => {
    localStorage.clear();
    Object.values(h.writes).forEach((f) => f.mockClear());
    setAdminData(adminFixture());
  });
  afterEach(() => vi.useRealTimers());

  it("lists the squad in a table with live search, position filter and count", async () => {
    const user = userEvent.setup();
    mountAdmin("/admin/plantilla", { plantilla: Plantilla });
    expect(await screen.findByRole("heading", { level: 1, name: "Plantilla" })).toBeInTheDocument();
    expect(screen.getByText("12 jugadores en la Temporada 1 · toca una fila para editarla. El dorsal es único por temporada.")).toBeInTheDocument();
    expect(rowNames()).toEqual(["EVANS", "ILLESCAS", "EGUZQUIZA", "ERIK", "ADRIÁN T.C.", "KEVIN", "FER", "HUBEROSKI", "ANDIA", "TELLO", "ALMACHI", "BRAWAN"]);
    const erik = within(rowsList()).getByRole("button", { name: "Editar a ERIK, dorsal 9" });
    expect(erik).toHaveTextContent("Delantero");
    expect(erik).toHaveTextContent("T1");
    expect(within(rowsList()).getByRole("button", { name: "Editar a BRAWAN, dorsal 33" })).toHaveTextContent("Lesionado");
    const search = screen.getByRole("searchbox", { name: "Buscar jugador" });
    await user.type(search, "adrian");
    expect(rowNames()).toEqual(["ADRIÁN T.C."]);
    expect(screen.getByText("1 de 12")).toBeInTheDocument();
    await user.clear(search);
    await user.type(search, "1");
    expect(rowNames()).toEqual(["EVANS"]);
    await user.clear(search);
    await user.click(screen.getByRole("button", { name: "POR" }));
    expect(rowNames()).toEqual(["EVANS", "FER"]);
    await user.type(search, "zz");
    expect(screen.getByText("Nadie con «zz»")).toBeInTheDocument();
  });

  it("«/» focuses the search", async () => {
    mountAdmin("/admin/plantilla", { plantilla: Plantilla });
    const search = await screen.findByRole("searchbox", { name: "Buscar jugador" });
    fireEvent.keyDown(document.body, { key: "/" });
    expect(search).toHaveFocus();
  });

  it("edits a player in the drawer with the live dorsal check, and saves behind an undo toast", async () => {
    vi.useFakeTimers({ shouldAdvanceTime: true });
    const user = userEvent.setup({ advanceTimers: vi.advanceTimersByTime });
    const router = mountAdmin("/admin/plantilla", { plantilla: Plantilla });
    await user.click(await screen.findByRole("button", { name: "Editar a ERIK, dorsal 9" }));
    await waitFor(() => expect(router.state.location.search).toMatchObject({ jugador: "erik" }));
    const d = drawer();
    expect(d).toHaveAccessibleName("ERIK");
    expect(within(d).getByText("Plantilla · Delantero · dorsal 9")).toBeInTheDocument();
    expect(within(d).getByText("✓ Sin cambios")).toBeInTheDocument();
    const save = within(d).getByRole("button", { name: "Guardar" });
    expect(save).toHaveAttribute("aria-disabled", "true");
    expect(within(d).getByRole("link", { name: /Ver su página/ })).toHaveAttribute("href", "/jugadores/erik");

    const dorsal = within(d).getByRole("textbox", { name: "Dorsal" });
    expect(within(d).getByText("Libre en la Temporada 1")).toBeInTheDocument();
    await user.clear(dorsal);
    await user.type(dorsal, "10");
    expect(within(d).getByText("El 10 ya lo lleva ADRIÁN T.C. en la Temporada 1.")).toBeInTheDocument();
    expect(within(d).getByText("● Cambios sin guardar")).toBeInTheDocument();
    await user.click(save);
    expect(within(d).getByRole("alert")).toHaveTextContent("El 10 ya lo lleva ADRIÁN T.C. en la Temporada 1.");
    await user.clear(dorsal);
    await user.type(dorsal, "99");
    expect(within(d).getByText("Libre en la Temporada 1")).toBeInTheDocument();
    await user.click(within(d).getByRole("button", { name: "Lesionado" }));
    await user.click(save);

    await waitFor(() => expect(screen.queryByRole("dialog")).toBeNull());
    expect(router.state.location.search).toEqual({});
    expect(screen.getByText("Guardado · ERIK lleva el 99.")).toBeInTheDocument();
    expect(within(rowsList()).getByRole("button", { name: "Editar a ERIK, dorsal 99" })).toHaveTextContent("Lesionado");
    expect(h.writes.savePlayer).not.toHaveBeenCalled();
    await act(async () => {
      vi.advanceTimersByTime(5300);
    });
    expect(h.writes.savePlayer).toHaveBeenCalledWith("erik", expect.objectContaining({ number: 99, injured: true, shirtName: "ERIK", seasons: ["t1"], seasonDetails: { t1: { shirtName: "ERIK", number: 99 } } }));
    expect(h.writes.savePlayer.mock.calls[0][1]).not.toHaveProperty("createdAt");
  });

  it("undoing a save puts the row back and writes nothing", async () => {
    vi.useFakeTimers({ shouldAdvanceTime: true });
    const user = userEvent.setup({ advanceTimers: vi.advanceTimersByTime });
    mountAdmin("/admin/plantilla?jugador=kevin", { plantilla: Plantilla });
    const d = await screen.findByRole("dialog", { name: "KEVIN" });
    const name = within(d).getByRole("textbox", { name: "Nombre en camiseta" });
    await user.clear(name);
    await user.type(name, "kev");
    expect(name).toHaveValue("KEV");
    await user.click(within(d).getByRole("button", { name: "Guardar" }));
    expect(await within(rowsList()).findByRole("button", { name: "Editar a KEV, dorsal 11" })).toBeInTheDocument();
    await user.click(screen.getByRole("button", { name: "Deshacer" }));
    expect(within(rowsList()).getByRole("button", { name: "Editar a KEVIN, dorsal 11" })).toBeInTheDocument();
    await act(async () => {
      vi.advanceTimersByTime(6000);
    });
    expect(h.writes.savePlayer).not.toHaveBeenCalled();
  });

  it("signs a player up from «Alta de jugador» (the same drawer, empty)", async () => {
    vi.useFakeTimers({ shouldAdvanceTime: true });
    const user = userEvent.setup({ advanceTimers: vi.advanceTimersByTime });
    const router = mountAdmin("/admin/plantilla", { plantilla: Plantilla });
    await user.click(await screen.findByRole("button", { name: "Alta de jugador" }));
    await waitFor(() => expect(router.state.location.search).toMatchObject({ nuevo: true }));
    const d = await screen.findByRole("dialog", { name: "Jugador nuevo" });
    expect(within(d).getByText("Plantilla · alta")).toBeInTheDocument();
    expect(within(d).getByRole("button", { name: "Temporada 1 · activa" })).toHaveAttribute("aria-pressed", "true");
    expect(within(d).getByRole("button", { name: "Temporada 0 · pre-Piti · archivada" })).toHaveAttribute("aria-pressed", "false");
    expect(within(d).queryByRole("button", { name: "Dar de baja" })).toBeNull();
    const alta = within(d).getByRole("button", { name: "Dar de alta" });
    await user.click(alta);
    expect(within(d).getByRole("alert")).toHaveTextContent("Falta el nombre.");
    await user.type(within(d).getByRole("textbox", { name: "Nombre" }), "Pablo");
    await user.type(within(d).getByRole("textbox", { name: "Nombre en camiseta" }), "pablo");
    expect(within(d).getByText("5/12")).toBeInTheDocument();
    await user.type(within(d).getByRole("textbox", { name: "Dorsal" }), "7");
    expect(screen.getByRole("dialog", { name: "PABLO" })).toBeInTheDocument();
    await user.click(alta);
    await waitFor(() => expect(screen.queryByRole("dialog")).toBeNull());
    expect(screen.getByText("Alta: PABLO con el 7.")).toBeInTheDocument();
    expect(within(rowsList()).getByRole("button", { name: "Editar a PABLO, dorsal 7" })).toBeInTheDocument();
    await act(async () => {
      vi.advanceTimersByTime(5300);
    });
    expect(h.writes.savePlayer).toHaveBeenCalledWith("nuevo1", expect.objectContaining({ firstName: "Pablo", shirtName: "PABLO", number: 7, naturalPosition: "MED", active: true, createdAt: expect.any(Date) }));
  });

  it("dar de baja asks first, can be undone (the doc is never deleted) and otherwise deletes", async () => {
    vi.useFakeTimers({ shouldAdvanceTime: true });
    const user = userEvent.setup({ advanceTimers: vi.advanceTimersByTime });
    mountAdmin("/admin/plantilla?jugador=erik", { plantilla: Plantilla });
    let d = await screen.findByRole("dialog", { name: "ERIK" });
    await user.click(within(d).getByRole("button", { name: "Dar de baja" }));
    let ask = screen.getByRole("alertdialog", { name: "¿Dar de baja a ERIK?" });
    expect(ask).toHaveTextContent("@erik9 se queda sin ficha (su cuenta sigue en el vestuario)");
    expect(ask).toHaveTextContent("El dorsal 9 queda libre · se puede deshacer unos segundos");
    await user.click(within(ask).getByRole("button", { name: "Cancelar" }));
    expect(screen.queryByRole("alertdialog")).toBeNull();
    await user.click(within(d).getByRole("button", { name: "Dar de baja" }));
    ask = screen.getByRole("alertdialog", { name: "¿Dar de baja a ERIK?" });
    await user.click(within(ask).getByRole("button", { name: "Dar de baja" }));
    await waitFor(() => expect(screen.queryByRole("dialog")).toBeNull());
    expect(screen.getByText("ERIK dado de baja · el 9 queda libre.")).toBeInTheDocument();
    expect(within(rowsList()).queryByRole("button", { name: /ERIK/ })).toBeNull();
    await user.click(screen.getByRole("button", { name: "Deshacer" }));
    expect(within(rowsList()).getByRole("button", { name: "Editar a ERIK, dorsal 9" })).toBeInTheDocument();
    await act(async () => {
      vi.advanceTimersByTime(6000);
    });
    expect(h.writes.deletePlayer).not.toHaveBeenCalled();

    await user.click(within(rowsList()).getByRole("button", { name: "Editar a ERIK, dorsal 9" }));
    d = await screen.findByRole("dialog", { name: "ERIK" });
    await user.click(within(d).getByRole("button", { name: "Dar de baja" }));
    await user.click(within(screen.getByRole("alertdialog")).getByRole("button", { name: "Dar de baja" }));
    await act(async () => {
      vi.advanceTimersByTime(5300);
    });
    expect(h.writes.deletePlayer).toHaveBeenCalledWith("erik");
  });

  it("asks before throwing edits away (Cancelar, Esc), and «Seguir editando» keeps them", async () => {
    const user = userEvent.setup();
    const router = mountAdmin("/admin/plantilla?jugador=tello", { plantilla: Plantilla });
    const d = await screen.findByRole("dialog", { name: "TELLO" });
    await user.type(within(d).getByRole("textbox", { name: "Apellidos" }), " Ruiz");
    await user.click(within(d).getByRole("button", { name: "Cancelar" }));
    const guard = await screen.findByRole("alertdialog", { name: "¿Salir sin guardar?" });
    expect(guard).toHaveTextContent("Hay cambios sin guardar en la ficha de TELLO");
    await user.click(within(guard).getByRole("button", { name: "Seguir editando" }));
    expect(screen.getByRole("dialog", { name: "TELLO" })).toBeInTheDocument();
    expect(within(d).getByRole("textbox", { name: "Apellidos" })).toHaveValue("Apellidos Ruiz");
    await user.keyboard("{Escape}");
    await user.click(within(await screen.findByRole("alertdialog")).getByRole("button", { name: "Descartar cambios" }));
    await waitFor(() => expect(screen.queryByRole("dialog")).toBeNull());
    expect(router.state.location.search).toEqual({});
    expect(h.writes.savePlayer).not.toHaveBeenCalled();
  });

  it("exports the plantilla as a CSV", async () => {
    const user = userEvent.setup();
    const created: Blob[] = [];
    const create = vi.fn((b: Blob) => {
      created.push(b);
      return "blob:plantilla";
    });
    Object.assign(URL, { createObjectURL: create, revokeObjectURL: vi.fn() });
    const click = vi.spyOn(HTMLAnchorElement.prototype, "click").mockImplementation(() => undefined);
    mountAdmin("/admin/plantilla", { plantilla: Plantilla });
    await user.click(await screen.findByRole("button", { name: /Exportar CSV/ }));
    expect(create).toHaveBeenCalledTimes(1);
    expect(click).toHaveBeenCalledTimes(1);
    const text = await created[0].text();
    expect(text).toContain("Dorsal;Nombre en camiseta;Nombre;Apellidos;Posición;Estado;Temporadas");
    expect(text).toContain("9;ERIK;Nombre;Apellidos;Delantero;Activo;T1;;;");
    expect(screen.getByText("Plantilla exportada · 12 jugadores en el CSV.")).toBeInTheDocument();
    click.mockRestore();
  });

  it("shows the loading and error states", async () => {
    setAdminData(adminFixture({ loading: true }));
    mountAdmin("/admin/plantilla", { plantilla: Plantilla });
    expect(await screen.findByRole("status", { name: "Cargando la plantilla…" })).toBeInTheDocument();
  });
});
