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

const WIDTH = window.innerWidth;
// (by selector: under a modal sheet the wall is inert, out of the accessibility tree)
const wall = () => document.querySelector<HTMLElement>('.wall[aria-label="La percha del vestuario"]')!;
const pegNames = () => [...wall().querySelectorAll(".peg .nm")].map((n) => n.textContent);
const rails = () => [...wall().querySelectorAll(".rail2")].map((r) => r.querySelectorAll(".peg").length);
const caption = () => screen.getAllByRole("status").find((s) => s.classList.contains("adm-toasts"))!;

describe("Plantilla · la percha", () => {
  beforeEach(() => {
    localStorage.clear();
    Object.values(h.writes).forEach((f) => f.mockClear());
    setAdminData(adminFixture());
  });
  afterEach(() => {
    vi.useRealTimers();
    Object.defineProperty(window, "innerWidth", { configurable: true, value: WIDTH });
  });

  it("hangs the season's shirts by dorsal, seven per rail, with «Alta de jugador» last; search and position filter", async () => {
    const user = userEvent.setup();
    mountAdmin("/admin/plantilla", { plantilla: Plantilla });
    expect(await screen.findByRole("heading", { level: 1, name: "Plantilla" })).toBeInTheDocument();
    expect(screen.getByText("12 camisetas en la percha · toca una para abrir su ficha")).toBeInTheDocument();
    expect(pegNames()).toEqual(["EVANS", "ILLESCAS", "EGUZQUIZA", "ERIK", "ADRIÁN T.C.", "KEVIN", "FER", "HUBEROSKI", "ANDIA", "TELLO", "ALMACHI", "BRAWAN", "Alta de jugador"]);
    expect(rails()).toEqual([7, 6]);
    const brawan = screen.getByRole("button", { name: "Abrir la ficha de BRAWAN" });
    expect(brawan.querySelector(".rv")).toHaveTextContent("DEF · lesionado");
    expect(brawan.querySelector(".rv")).toHaveClass("duda");
    expect(screen.getByRole("button", { name: "Dar de alta a un jugador" })).toHaveTextContent("percha libre");
    const search = screen.getByRole("searchbox", { name: "Buscar jugador" });
    await user.type(search, "adrian");
    expect(pegNames()).toEqual(["ADRIÁN T.C."]);
    expect(screen.getByText("1 camiseta en la percha · toca una para abrir su ficha")).toBeInTheDocument();
    await user.clear(search);
    await user.type(search, "1");
    expect(pegNames()).toEqual(["EVANS"]);
    await user.clear(search);
    await user.click(screen.getByRole("button", { name: "POR" }));
    expect(pegNames()).toEqual(["EVANS", "FER", "Alta de jugador"]);
    await user.type(search, "zz");
    expect(screen.getByText("Ninguna camiseta con «zz».")).toBeInTheDocument();
  });

  it("«/» focuses the search", async () => {
    mountAdmin("/admin/plantilla", { plantilla: Plantilla });
    const search = await screen.findByRole("searchbox", { name: "Buscar jugador" });
    fireEvent.keyDown(document.body, { key: "/" });
    expect(search).toHaveFocus();
  });

  it("opens his cajón beside the wall (five per rail): the cromo, the live dorsal check; Guardar waits behind «Deshacer» and keeps it open", async () => {
    vi.useFakeTimers({ shouldAdvanceTime: true });
    const user = userEvent.setup({ advanceTimers: vi.advanceTimersByTime });
    const router = mountAdmin("/admin/plantilla", { plantilla: Plantilla });
    await user.click(await screen.findByRole("button", { name: "Abrir la ficha de ERIK" }));
    await waitFor(() => expect(router.state.location.search).toMatchObject({ jugador: "erik" }));
    const d = screen.getByRole("dialog", { name: "Ficha de ERIK" });
    expect(rails()).toEqual([5, 5, 3]);
    expect(screen.getByRole("button", { name: "Abrir la ficha de ERIK" })).toHaveClass("sel");
    expect(within(d).getByRole("group", { name: /^Cromo de ERIK: media .+, DEL$/ }).querySelector(".st")).toHaveTextContent(/GOL.*ASI.*PJ.*MVP/);
    expect(within(d).getByText("Su dorsal · solo lo lleva él")).toBeInTheDocument();
    const save = within(d).getByRole("button", { name: "Guardar" });
    expect(save).toBeDisabled();
    expect(within(d).getByRole("link", { name: /Ver su página/ })).toHaveAttribute("href", "/jugadores/erik");
    const dorsal = within(d).getByRole("textbox", { name: "Dorsal en la Temporada 1" });
    await user.clear(dorsal);
    await user.type(dorsal, "10");
    expect(within(d).getByText("El 10 ya lo lleva ADRIÁN T.C. en la Temporada 1")).toHaveClass("er");
    expect(within(d).getByText("· ● Cambios sin guardar", { exact: false })).toBeInTheDocument();
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
    expect(screen.getByRole("button", { name: "Abrir la ficha de ERIK" }).querySelector(".rv")).toHaveTextContent("DEL · lesionado");
    expect(h.writes.savePlayer).not.toHaveBeenCalled();
    await act(async () => {
      vi.advanceTimersByTime(5300);
    });
    expect(h.writes.savePlayer).toHaveBeenCalledWith("erik", expect.objectContaining({ number: 99, injured: true, shirtName: "ERIK", seasons: ["t1"], seasonDetails: { t1: { shirtName: "ERIK", number: 99 } } }));
    expect(h.writes.savePlayer.mock.calls[0][1]).not.toHaveProperty("createdAt");
  });

  it("«Deshacer» after Guardar closes the cajón as it was and writes nothing", async () => {
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

  it("«Alta de jugador»: the empty shirt is stamped as you type, and the new one hangs on the wall", async () => {
    vi.useFakeTimers({ shouldAdvanceTime: true });
    const user = userEvent.setup({ advanceTimers: vi.advanceTimersByTime });
    const router = mountAdmin("/admin/plantilla", { plantilla: Plantilla });
    await user.click(await screen.findByRole("button", { name: "Dar de alta a un jugador" }));
    await waitFor(() => expect(router.state.location.search).toMatchObject({ nuevo: true }));
    const d = await screen.findByRole("dialog", { name: "Alta de jugador" });
    const cromo = d.querySelector(".cromo.new") as HTMLElement;
    expect(cromo).toHaveTextContent("Percha nueva");
    expect(cromo.querySelector(".sh")).toHaveClass("empty");
    expect(cromo.querySelector(".nm")).toHaveTextContent("NOMBRE");
    expect(within(d).getByRole("button", { name: "Temporada 1" })).toHaveAttribute("aria-pressed", "true");
    expect(within(d).getByRole("button", { name: "Temporada 0 · pre-Piti" })).toHaveAttribute("aria-pressed", "false");
    expect(within(d).queryByRole("button", { name: "Dar de baja" })).toBeNull();
    const alta = within(d).getByRole("button", { name: "Dar de alta" });
    expect(alta).toBeDisabled();
    await user.type(within(d).getByRole("textbox", { name: /Nombre en la camiseta/ }), "pablo");
    expect(within(d).getByText("Nombre en la camiseta · 5/12")).toBeInTheDocument();
    expect(cromo.querySelector(".nm")).toHaveTextContent("PABLO");
    const dorsal = within(d).getByRole("textbox", { name: "Dorsal en la Temporada 1" });
    await user.type(dorsal, "9");
    expect(within(d).getByText("El 9 ya lo lleva ERIK en la Temporada 1")).toBeInTheDocument();
    expect(alta).toBeDisabled();
    await user.clear(dorsal);
    await user.type(dorsal, "7");
    expect(cromo.querySelector(".sh")).not.toHaveClass("empty");
    expect(cromo.querySelector(".sh b")).toHaveTextContent("7");
    await user.click(alta);
    await waitFor(() => expect(screen.queryByRole("dialog")).toBeNull());
    expect(caption()).toHaveTextContent("PABLO cuelga su camiseta, el 7");
    expect(caption().querySelector(".lt .k")).toHaveTextContent("ALTA");
    expect(screen.getByRole("button", { name: "Abrir la ficha de PABLO" })).toHaveClass("open");
    await act(async () => {
      vi.advanceTimersByTime(5300);
    });
    expect(h.writes.savePlayer).toHaveBeenCalledWith("nuevo1", expect.objectContaining({ shirtName: "PABLO", number: 7, naturalPosition: "MED", seasons: ["t1"], active: true, createdAt: expect.any(Date) }));
  });

  it("«Dar de baja» asks first, takes his shirt off the season's percha (the doc stays) and can be undone", async () => {
    vi.useFakeTimers({ shouldAdvanceTime: true });
    const user = userEvent.setup({ advanceTimers: vi.advanceTimersByTime });
    mountAdmin("/admin/plantilla?jugador=erik", { plantilla: Plantilla });
    let d = await screen.findByRole("dialog", { name: "Ficha de ERIK" });
    await user.click(within(d).getByRole("button", { name: "Dar de baja" }));
    let ask = screen.getByRole("alertdialog", { name: "¿Dar de baja a ERIK?" });
    expect(ask).toHaveTextContent("Su camiseta deja la percha de la Temporada 1");
    expect(ask).toHaveTextContent("Sus actas, goles y su carta se quedan");
    expect(ask).toHaveTextContent("Se puede volver a dar de alta");
    await user.click(within(ask).getByRole("button", { name: "Cancelar" }));
    expect(screen.queryByRole("alertdialog")).toBeNull();
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

  it("while searching, players of other seasons hang dimmed (that is how one comes back)", async () => {
    const base = adminFixture();
    setAdminData({ ...base, players: base.players.map((p) => (p.id === "kevin" ? { ...p, seasons: ["t0"] } : p)) });
    const user = userEvent.setup();
    mountAdmin("/admin/plantilla", { plantilla: Plantilla });
    expect(await screen.findByText("11 camisetas en la percha · toca una para abrir su ficha")).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: /KEVIN/ })).toBeNull();
    await user.type(screen.getByRole("searchbox", { name: "Buscar jugador" }), "kev");
    const kevin = screen.getByRole("button", { name: "Abrir la ficha de KEVIN (no está en la Temporada 1)" });
    expect(kevin.querySelector(".sh")).toHaveClass("dim");
    expect(kevin.querySelector(".rv")).toHaveTextContent("fuera de la T1");
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
    expect(click).toHaveBeenCalledTimes(1);
    const text = await created[0].text();
    expect(text).toContain("Dorsal;Nombre en camiseta;Nombre;Apellidos;Posición;Estado;Temporadas");
    expect(text).toContain("9;ERIK;Nombre;Apellidos;Delantero;Activo;T1;;;");
    expect(caption()).toHaveTextContent("Plantilla exportada · 12 jugadores en el CSV");
    click.mockRestore();
  });

  it("phones: search, the position filter and three per rail; the cajón is a sheet", async () => {
    Object.defineProperty(window, "innerWidth", { configurable: true, value: 390 });
    const user = userEvent.setup();
    mountAdmin("/admin/plantilla", { plantilla: Plantilla });
    await screen.findByRole("searchbox", { name: "Buscar jugador" });
    expect(rails()).toEqual([3, 3, 3, 3, 1]);
    await user.click(screen.getByRole("button", { name: "Abrir la ficha de ADRIÁN T.C." }));
    const d = await screen.findByRole("dialog", { name: "Ficha de ADRIÁN T.C." });
    expect(d).toHaveClass("ovl");
    expect(d).toHaveAttribute("aria-modal", "true");
    expect(rails()).toEqual([3, 3, 3, 3, 1]);
  });

  it("shows the loading state", async () => {
    setAdminData(adminFixture({ loading: true }));
    mountAdmin("/admin/plantilla", { plantilla: Plantilla });
    expect(await screen.findByRole("status", { name: "Cargando la plantilla" })).toBeInTheDocument();
  });
});
