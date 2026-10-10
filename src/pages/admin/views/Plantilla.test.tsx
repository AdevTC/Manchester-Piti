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
// (the photos of the 3D kit need WebGL: the drawn shirt stands in)
vi.mock("../../../components/jersey3d/useShirtStills", () => ({ useShirtStills: () => () => undefined }));

const WIDTH = window.innerWidth;
// (by selector: under a modal sheet the tablón is inert, out of the accessibility tree)
const board = () => document.querySelector<HTMLElement>('.tbn[aria-label="El tablón de la plantilla"]')!;
const groups = () => [...board().querySelectorAll("tbody")].map((g) => `${g.querySelector(".gh th")?.firstChild?.textContent}: ${[...g.querySelectorAll("tr.tr .nmb b")].map((b) => b.textContent).join(", ")}`);
const rowOf = (name: string) => screen.getByRole("button", { name: `Abrir la ficha de ${name}` }).closest("tr")!;
const caption = () => screen.getAllByRole("status").find((s) => s.classList.contains("adm-toasts"))!;

describe("Plantilla · el tablón", () => {
  beforeEach(() => {
    localStorage.clear();
    Object.values(h.writes).forEach((f) => f.mockClear());
    setAdminData(adminFixture());
  });
  afterEach(() => {
    vi.useRealTimers();
    Object.defineProperty(window, "innerWidth", { configurable: true, value: WIDTH });
  });

  it("groups the season by line, with the collection, the gap chips, his account and slots; search and chips filter", async () => {
    const user = userEvent.setup();
    mountAdmin("/admin/plantilla", { plantilla: Plantilla });
    expect(await screen.findByRole("heading", { level: 1, name: "Plantilla" })).toBeInTheDocument();
    expect(screen.getByText("Temporada 1 · 12 jugadores")).toBeInTheDocument();
    expect(groups()).toEqual(["Porteros: EVANS, FER", "Defensas: ILLESCAS, TELLO, BRAWAN", "Medios: EGUZQUIZA, HUBEROSKI, ANDIA, ALMACHI", "Delanteros: ERIK, ADRIÁN T.C., KEVIN"]);
    expect(screen.getByRole("img", { name: "Fichas completas: 0 de 12" })).toBeInTheDocument();
    const chips = screen.getByRole("group", { name: "Qué falta" });
    expect(within(chips).getAllByRole("button").map((b) => b.textContent)).toEqual(["Sin foto12", "Faltan datos12", "Lesionados1", "Sin cuenta8", "Piden su ficha2"]);
    expect(within(rowOf("ERIK")).getByRole("img", { name: "Cuenta vinculada" })).toBeInTheDocument();
    expect(within(rowOf("KEVIN")).getByRole("img", { name: "Pide su ficha" })).toBeInTheDocument();
    expect(within(rowOf("EVANS")).getByRole("img", { name: "Le falta la foto, el nacimiento, la altura y el peso" })).toBeInTheDocument();
    expect(within(rowOf("BRAWAN")).getByRole("switch", { name: "BRAWAN lesionado" })).toHaveAttribute("aria-checked", "true");

    await user.click(within(chips).getByRole("button", { name: /Piden su ficha/ }));
    expect(groups()).toEqual(["Porteros: FER", "Delanteros: KEVIN"]);
    expect(screen.getByText("2 de 12 jugadores")).toBeInTheDocument();
    await user.click(within(chips).getByRole("button", { name: /Piden su ficha/ }));
    const search = screen.getByRole("searchbox", { name: "Buscar jugador" });
    await user.type(search, "adrian");
    expect(groups()).toEqual(["Delanteros: ADRIÁN T.C."]);
    await user.clear(search);
    await user.type(search, "1");
    expect(groups()).toEqual(["Porteros: EVANS"]);
    await user.type(search, "zz");
    expect(screen.getByText("Nadie con «1zz».")).toBeInTheDocument();
  });

  it("«/» focuses the search", async () => {
    mountAdmin("/admin/plantilla", { plantilla: Plantilla });
    const search = await screen.findByRole("searchbox", { name: "Buscar jugador" });
    fireEvent.keyDown(document.body, { key: "/" });
    expect(search).toHaveFocus();
  });

  it("with no ficha open, the side shows the lines, the injured and the free dorsals (one starts an alta wearing it)", async () => {
    const user = userEvent.setup();
    const router = mountAdmin("/admin/plantilla", { plantilla: Plantilla });
    const side = await screen.findByRole("complementary", { name: "Estado del equipo" });
    expect(within(side).getByRole("region", { name: "La siguiente ficha" })).toHaveTextContent("1EVANS");
    expect(within(side).getByRole("region", { name: "La siguiente ficha" })).toHaveTextContent("Le falta la foto, el nacimiento, la altura y el peso");
    expect(within(side).getByRole("button", { name: "Completar la ficha de EVANS" })).toBeInTheDocument();
    expect(within(side).getByRole("list", { name: "Por líneas" })).toHaveTextContent(/2POR.*3DEF.*4MED.*3DEL/);
    expect(within(side).getByRole("button", { name: "Abrir la ficha de BRAWAN (lesionado)" })).toBeInTheDocument();
    expect(within(side).getByRole("button", { name: "Alta con el 2" })).toBeInTheDocument();
    expect(within(side).queryByRole("button", { name: "Alta con el 9" })).toBeNull();
    await user.click(within(side).getByRole("button", { name: "Alta con el 2" }));
    await waitFor(() => expect(router.state.location.search).toMatchObject({ nuevo: true, dorsal: 2 }));
    const d = await screen.findByRole("dialog", { name: "Alta de jugador" });
    expect(within(d).getByRole("textbox", { name: "Dorsal en la Temporada 1" })).toHaveValue("2");
    expect(screen.queryByRole("complementary", { name: "Estado del equipo" })).toBeNull();
  });

  it("opens his ficha beside the tablón: the cromo, what it lacks, his account; Guardar waits behind «Deshacer» and keeps it open", async () => {
    vi.useFakeTimers({ shouldAdvanceTime: true });
    const user = userEvent.setup({ advanceTimers: vi.advanceTimersByTime });
    const router = mountAdmin("/admin/plantilla", { plantilla: Plantilla });
    await user.click(await screen.findByRole("button", { name: "Abrir la ficha de ERIK" }));
    await waitFor(() => expect(router.state.location.search).toMatchObject({ jugador: "erik" }));
    const d = screen.getByRole("dialog", { name: "Ficha de ERIK" });
    expect(rowOf("ERIK")).toHaveAttribute("aria-current", "true");
    expect(within(d).getByRole("group", { name: /^Cromo de ERIK: media .+, DEL$/ }).querySelector(".st")).toHaveTextContent(/GOL.*ASI.*PJ.*MVP/);
    expect(within(d).getByRole("group", { name: "Le falta la foto, el nacimiento, la altura y el peso" })).toBeInTheDocument();
    expect(within(d).getByRole("region", { name: "Cuenta y web" })).toHaveTextContent("Cuenta vinculada · erik9 entra al vestuario con su ficha");
    expect(within(d).getByRole("link", { name: "Editarla" })).toHaveAttribute("href", "/admin/contenido?seccion=historias");
    expect(within(d).getByText("Su dorsal · solo lo lleva él")).toBeInTheDocument();
    const save = within(d).getByRole("button", { name: "Guardar" });
    expect(save).toBeDisabled();
    expect(within(d).getByRole("link", { name: /Ver su página/ })).toHaveAttribute("href", "/jugadores/erik");
    const dorsal = within(d).getByRole("textbox", { name: "Dorsal en la Temporada 1" });
    await user.clear(dorsal);
    await user.type(dorsal, "10");
    expect(within(d).getByText("El 10 ya lo lleva ADRIÁN T.C. en la Temporada 1")).toHaveClass("er");
    expect(save).toBeDisabled();
    await user.clear(dorsal);
    await user.type(dorsal, "99");
    expect(within(d).getByText("Libre en la Temporada 1")).toHaveClass("ok");
    await user.click(within(d).getByRole("button", { name: "Lesionado" }));
    await user.click(save);

    expect(caption()).toHaveTextContent("Ficha de ERIK guardada");
    expect(caption().querySelector(".lt .k")).toHaveTextContent("FICHA");
    const again = screen.getByRole("dialog", { name: "Ficha de ERIK" });
    expect(within(again).getByRole("textbox", { name: "Dorsal en la Temporada 1" })).toHaveValue("99");
    expect(within(again).queryByText(/Cambios sin guardar/)).toBeNull();
    expect(within(rowOf("ERIK")).getByRole("switch", { name: "ERIK lesionado" })).toHaveAttribute("aria-checked", "true");
    expect(h.writes.savePlayer).not.toHaveBeenCalled();
    await act(async () => {
      vi.advanceTimersByTime(5300);
    });
    expect(h.writes.savePlayer).toHaveBeenCalledWith("erik", expect.objectContaining({ number: 99, injured: true, shirtName: "ERIK", seasons: ["t1"], seasonDetails: { t1: { shirtName: "ERIK", number: 99 } } }));
    expect(h.writes.savePlayer.mock.calls[0][1]).not.toHaveProperty("createdAt");
  });

  it("a claimed ficha points to Fichas", async () => {
    mountAdmin("/admin/plantilla?jugador=kevin", { plantilla: Plantilla });
    const d = await screen.findByRole("dialog", { name: "Ficha de KEVIN" });
    expect(within(d).getByRole("region", { name: "Cuenta y web" })).toHaveTextContent("Pide su ficha · nuevo.socio la ha pedido");
    expect(within(d).getByRole("link", { name: "Revisar en Fichas" })).toHaveAttribute("href", "/admin/fichas");
    expect(within(d).getByRole("link", { name: "Escribirla" })).toBeInTheDocument();
  });

  it("sets a line in place: the row moves to its group, the write waits behind «Deshacer»", async () => {
    vi.useFakeTimers({ shouldAdvanceTime: true });
    const user = userEvent.setup({ advanceTimers: vi.advanceTimersByTime });
    mountAdmin("/admin/plantilla", { plantilla: Plantilla });
    await user.click(within(await screen.findByRole("group", { name: "Línea de KEVIN" })).getByRole("button", { name: "MED" }));
    expect(caption()).toHaveTextContent("KEVIN pasa al medio");
    expect(caption().querySelector(".lt .k")).toHaveTextContent("LÍNEA");
    expect(groups()).toEqual(["Porteros: EVANS, FER", "Defensas: ILLESCAS, TELLO, BRAWAN", "Medios: EGUZQUIZA, KEVIN, HUBEROSKI, ANDIA, ALMACHI", "Delanteros: ERIK, ADRIÁN T.C."]);
    await act(async () => {
      vi.advanceTimersByTime(5300);
    });
    expect(h.writes.savePlayer).toHaveBeenCalledWith("kevin", { naturalPosition: "MED" });
  });

  it("selects several for the batch bar (line, estado) and «Deshacer» puts them back", async () => {
    vi.useFakeTimers({ shouldAdvanceTime: true });
    const user = userEvent.setup({ advanceTimers: vi.advanceTimersByTime });
    mountAdmin("/admin/plantilla", { plantilla: Plantilla });
    await user.click(await screen.findByRole("checkbox", { name: "Seleccionar a EVANS" }));
    await user.click(screen.getByRole("checkbox", { name: "Seleccionar a FER" }));
    const bar = screen.getByRole("toolbar", { name: "Cambiar a los seleccionados" });
    expect(bar).toHaveTextContent("2 seleccionados");
    await user.click(within(bar).getByRole("button", { name: "DEF" }));
    expect(screen.queryByRole("toolbar")).toBeNull();
    expect(caption()).toHaveTextContent("2 jugadores pasan a la defensa");
    expect(groups()[0]).toBe("Defensas: EVANS, ILLESCAS, FER, TELLO, BRAWAN");
    await user.click(within(caption()).getByRole("button", { name: "Deshacer" }));
    expect(groups()[0]).toBe("Porteros: EVANS, FER");
    await act(async () => {
      vi.advanceTimersByTime(6000);
    });
    expect(h.writes.savePlayer).not.toHaveBeenCalled();

    await user.click(screen.getByRole("checkbox", { name: "Seleccionar a todos" }));
    expect(screen.getByRole("toolbar")).toHaveTextContent("12 seleccionados");
    await user.click(within(screen.getByRole("toolbar")).getByRole("button", { name: "Quitar selección" }));
    expect(screen.queryByRole("toolbar")).toBeNull();
  });

  it("marks one injured from his row (and back)", async () => {
    vi.useFakeTimers({ shouldAdvanceTime: true });
    const user = userEvent.setup({ advanceTimers: vi.advanceTimersByTime });
    mountAdmin("/admin/plantilla", { plantilla: Plantilla });
    await user.click(await screen.findByRole("switch", { name: "TELLO lesionado" }));
    expect(caption()).toHaveTextContent("TELLO, lesionado");
    expect(screen.getByRole("switch", { name: "TELLO lesionado" })).toHaveAttribute("aria-checked", "true");
    await user.click(screen.getByRole("switch", { name: "BRAWAN lesionado" }));
    expect(caption()).toHaveTextContent("BRAWAN vuelve a estar disponible");
    await act(async () => {
      vi.advanceTimersByTime(5300);
    });
    expect(h.writes.savePlayer).toHaveBeenCalledWith("tello", { injured: true });
    expect(h.writes.savePlayer).toHaveBeenCalledWith("brawan", { injured: false });
  });

  it("«Deshacer» after Guardar closes the ficha as it was and writes nothing", async () => {
    vi.useFakeTimers({ shouldAdvanceTime: true });
    const user = userEvent.setup({ advanceTimers: vi.advanceTimersByTime });
    mountAdmin("/admin/plantilla?jugador=kevin", { plantilla: Plantilla });
    const d = await screen.findByRole("dialog", { name: "Ficha de KEVIN" });
    const name = within(d).getByRole("textbox", { name: "Nombre en la camiseta · 5/12" });
    await user.clear(name);
    await user.type(name, "k");
    expect(within(d).getByText("Mínimo 2 letras")).toHaveClass("er");
    await user.type(name, "ev");
    expect(name).toHaveValue("KEV");
    await user.click(within(d).getByRole("button", { name: "Guardar" }));
    expect(await screen.findByRole("button", { name: "Abrir la ficha de KEV" })).toBeInTheDocument();
    await user.click(within(caption()).getByRole("button", { name: "Deshacer" }));
    await waitFor(() => expect(screen.queryByRole("dialog")).toBeNull());
    expect(screen.getByRole("button", { name: "Abrir la ficha de KEVIN" })).toBeInTheDocument();
    await act(async () => {
      vi.advanceTimersByTime(6000);
    });
    expect(h.writes.savePlayer).not.toHaveBeenCalled();
  });

  it("«Alta de jugador»: the empty shirt is stamped as you type, and the new one joins the tablón", async () => {
    vi.useFakeTimers({ shouldAdvanceTime: true });
    const user = userEvent.setup({ advanceTimers: vi.advanceTimersByTime });
    const router = mountAdmin("/admin/plantilla", { plantilla: Plantilla });
    await user.click(await screen.findByRole("button", { name: "Alta de jugador" }));
    await waitFor(() => expect(router.state.location.search).toMatchObject({ nuevo: true }));
    const d = await screen.findByRole("dialog", { name: "Alta de jugador" });
    const cromo = d.querySelector(".cromo.new") as HTMLElement;
    expect(cromo).toHaveTextContent("Percha nueva");
    expect(cromo.querySelector(".sh")).toHaveClass("empty");
    expect(within(d).getByRole("button", { name: "Temporada 1" })).toHaveAttribute("aria-pressed", "true");
    expect(within(d).queryByRole("button", { name: "Dar de baja" })).toBeNull();
    const alta = within(d).getByRole("button", { name: "Dar de alta" });
    expect(alta).toBeDisabled();
    await user.type(within(d).getByRole("textbox", { name: /Nombre en la camiseta/ }), "pablo");
    expect(cromo.querySelector(".nm")).toHaveTextContent("PABLO");
    const dorsal = within(d).getByRole("textbox", { name: "Dorsal en la Temporada 1" });
    await user.type(dorsal, "9");
    expect(within(d).getByText("El 9 ya lo lleva ERIK en la Temporada 1")).toBeInTheDocument();
    await user.clear(dorsal);
    await user.type(dorsal, "7");
    await user.click(alta);
    await waitFor(() => expect(screen.queryByRole("dialog")).toBeNull());
    expect(caption()).toHaveTextContent("PABLO entra en la plantilla con el 7");
    expect(caption().querySelector(".lt .k")).toHaveTextContent("ALTA");
    expect(rowOf("PABLO")).toHaveClass("fresh");
    expect(groups()[2]).toBe("Medios: PABLO, EGUZQUIZA, HUBEROSKI, ANDIA, ALMACHI");
    await act(async () => {
      vi.advanceTimersByTime(5300);
    });
    expect(h.writes.savePlayer).toHaveBeenCalledWith("nuevo1", expect.objectContaining({ shirtName: "PABLO", number: 7, naturalPosition: "MED", seasons: ["t1"], active: true, createdAt: expect.any(Date) }));
  });

  it("«Dar de baja» asks first, takes him off the season (the doc stays) and can be undone", async () => {
    vi.useFakeTimers({ shouldAdvanceTime: true });
    const user = userEvent.setup({ advanceTimers: vi.advanceTimersByTime });
    mountAdmin("/admin/plantilla?jugador=erik", { plantilla: Plantilla });
    let d = await screen.findByRole("dialog", { name: "Ficha de ERIK" });
    await user.click(within(d).getByRole("button", { name: "Dar de baja" }));
    let ask = screen.getByRole("alertdialog", { name: "¿Dar de baja a ERIK?" });
    expect(ask).toHaveTextContent("Sus actas, goles y su carta se quedan");
    await user.click(within(ask).getByRole("button", { name: "Cancelar" }));
    await user.click(within(d).getByRole("button", { name: "Dar de baja" }));
    ask = screen.getByRole("alertdialog", { name: "¿Dar de baja a ERIK?" });
    await user.click(within(ask).getByRole("button", { name: "Dar de baja" }));
    await waitFor(() => expect(screen.queryByRole("dialog")).toBeNull());
    expect(caption()).toHaveTextContent("ERIK de baja · sus actas y estadísticas se quedan");
    expect(screen.queryByRole("button", { name: "Abrir la ficha de ERIK" })).toBeNull();
    await user.click(within(caption()).getByRole("button", { name: "Deshacer" }));
    expect(screen.getByRole("button", { name: "Abrir la ficha de ERIK" })).toBeInTheDocument();
    await act(async () => {
      vi.advanceTimersByTime(6000);
    });
    expect(h.writes.savePlayer).not.toHaveBeenCalled();

    await user.click(screen.getByRole("button", { name: "Abrir la ficha de ERIK" }));
    d = await screen.findByRole("dialog", { name: "Ficha de ERIK" });
    await user.click(within(d).getByRole("button", { name: "Dar de baja" }));
    await user.click(within(screen.getByRole("alertdialog")).getByRole("button", { name: "Dar de baja" }));
    await act(async () => {
      vi.advanceTimersByTime(5300);
    });
    expect(h.writes.savePlayer).toHaveBeenCalledWith("erik", { seasons: [] });
    expect(h.writes.deletePlayer).not.toHaveBeenCalled();
  });

  it("while searching, players of other seasons show dimmed at the end (that is how one comes back)", async () => {
    const base = adminFixture();
    setAdminData({ ...base, players: base.players.map((p) => (p.id === "kevin" ? { ...p, seasons: ["t0"] } : p)) });
    const user = userEvent.setup();
    mountAdmin("/admin/plantilla", { plantilla: Plantilla });
    expect(await screen.findByText("Temporada 1 · 11 jugadores")).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: /KEVIN/ })).toBeNull();
    await user.type(screen.getByRole("searchbox", { name: "Buscar jugador" }), "kev");
    const kevin = screen.getByRole("button", { name: "Abrir la ficha de KEVIN (no está en la temporada)" });
    expect(kevin.closest("tr")).toHaveClass("other");
    expect(kevin).toHaveTextContent("fuera de la T1");
    expect(groups()).toEqual(["Otras temporadas: KEVIN"]);
  });

  it("asks before throwing edits away (Cerrar, Esc), and «Seguir editando» keeps them", async () => {
    const user = userEvent.setup();
    const router = mountAdmin("/admin/plantilla?jugador=tello", { plantilla: Plantilla });
    const d = await screen.findByRole("dialog", { name: "Ficha de TELLO" });
    await user.click(within(d).getByRole("button", { name: "Más datos" }));
    await user.type(within(d).getByRole("textbox", { name: "Apellidos" }), " Ruiz");
    await user.click(within(d.querySelector(".ft") as HTMLElement).getByRole("button", { name: "Cerrar" }));
    const guard = await screen.findByRole("alertdialog", { name: "¿Salir sin guardar?" });
    expect(guard).toHaveTextContent("Hay cambios sin guardar en la ficha de TELLO");
    await user.click(within(guard).getByRole("button", { name: "Seguir editando" }));
    expect(within(d).getByRole("textbox", { name: "Apellidos" })).toHaveValue("Apellidos Ruiz");
    await user.keyboard("{Escape}");
    await user.click(within(await screen.findByRole("alertdialog")).getByRole("button", { name: "Descartar cambios" }));
    await waitFor(() => expect(screen.queryByRole("dialog")).toBeNull());
    expect(router.state.location.search).toEqual({});
    expect(h.writes.savePlayer).not.toHaveBeenCalled();
  });

  it("«Más datos»: a bad photo link folded away is said above the buttons", async () => {
    const user = userEvent.setup();
    mountAdmin("/admin/plantilla?jugador=tello", { plantilla: Plantilla });
    const d = await screen.findByRole("dialog", { name: "Ficha de TELLO" });
    await user.click(within(d).getByRole("button", { name: "Más datos" }));
    await user.type(within(d).getByRole("textbox", { name: "Foto · enlace https://" }), "http://x.com/a.jpg");
    expect(within(d).getByText("Tiene que empezar por https://")).toHaveClass("er");
    await user.click(within(d).getByRole("button", { name: "Más datos" }));
    expect(within(d).getByRole("alert")).toHaveTextContent("Revisa «Más datos»: la foto tiene que ser un enlace https://");
    expect(within(d).getByRole("button", { name: "Guardar" })).toBeDisabled();
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
    await user.click(await screen.findByRole("button", { name: "Exportar la plantilla (CSV)" }));
    expect(create).toHaveBeenCalledTimes(1);
    const text = await created[0].text();
    expect(text).toContain("Dorsal;Nombre en camiseta;Nombre;Apellidos;Posición;Estado;Temporadas");
    expect(text).toContain("9;ERIK;Nombre;Apellidos;Delantero;Activo;T1;;;");
    expect(caption()).toHaveTextContent("Plantilla exportada · 12 jugadores en el CSV");
    click.mockRestore();
  });

  it("phones: the rows fold (no batch, no side), the ficha is a sheet", async () => {
    Object.defineProperty(window, "innerWidth", { configurable: true, value: 390 });
    const user = userEvent.setup();
    mountAdmin("/admin/plantilla", { plantilla: Plantilla });
    await screen.findByRole("searchbox", { name: "Buscar jugador" });
    expect(screen.queryByRole("complementary", { name: "Estado del equipo" })).toBeNull();
    expect(screen.getByRole("button", { name: "Alta de jugador" })).toBeInTheDocument();
    await user.click(screen.getByRole("button", { name: "Abrir la ficha de ADRIÁN T.C." }));
    const d = await screen.findByRole("dialog", { name: "Ficha de ADRIÁN T.C." });
    expect(d).toHaveClass("ovl");
    expect(d).toHaveAttribute("aria-modal", "true");
  });

  it("shows the loading state", async () => {
    setAdminData(adminFixture({ loading: true }));
    mountAdmin("/admin/plantilla", { plantilla: Plantilla });
    expect(await screen.findByRole("status", { name: "Cargando la plantilla" })).toBeInTheDocument();
  });
});
