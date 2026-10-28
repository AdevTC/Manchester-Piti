import { act, fireEvent, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { serverTimestamp } from "firebase/firestore";
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
const list = () => screen.getByRole("navigation", { name: "La plantilla" });
const groups = () => [...list().querySelectorAll("section")].map((g) => `${g.getAttribute("aria-label")}: ${[...g.querySelectorAll(".li .tx b")].map((b) => b.textContent).join(", ")}`);
const ficha = (name: string) => screen.getByRole("region", { name: `Ficha de ${name}` });
const caption = () => screen.getAllByRole("status").find((s) => s.classList.contains("sc-status__live"))!;
const noLine = (id: string) => {
  const base = adminFixture();
  setAdminData({ ...base, players: base.players.map((p) => (p.id === id ? { ...p, naturalPosition: undefined } : p)) });
};

describe("Plantilla · ficha a ficha", () => {
  beforeEach(() => {
    localStorage.clear();
    Object.values(h.writes).forEach((f) => f.mockClear());
    setAdminData(adminFixture());
  });
  afterEach(() => {
    vi.useRealTimers();
    Object.defineProperty(window, "innerWidth", { configurable: true, value: WIDTH });
  });

  it("lists the season by line and opens the first ficha that lacks something (pinned in the URL); search and chips filter the list", async () => {
    const user = userEvent.setup();
    const router = mountAdmin("/admin/plantilla", { plantilla: Plantilla });
    expect(await screen.findByRole("heading", { level: 1, name: "Plantilla" })).toBeInTheDocument();
    expect(screen.getByText("Temporada 1 · 12 jugadores")).toBeInTheDocument();
    expect(groups()).toEqual(["Porteros: EVANS, FER", "Defensas: ILLESCAS, TELLO, BRAWAN", "Medios: EGUZQUIZA, HUBEROSKI, ANDIA, ALMACHI", "Delanteros: ERIK, ADRIÁN T.C., KEVIN"]);
    await waitFor(() => expect(router.state.location.pathname).toBe("/admin/plantilla/evans"));
    expect(ficha("EVANS")).toHaveTextContent("Ficha 1 de 12");
    expect(within(list()).getByRole("button", { name: "Abrir la ficha de EVANS" })).toHaveAttribute("aria-current", "true");
    expect(screen.getByRole("img", { name: "Fichas completas: 0 de 12" })).toBeInTheDocument();
    const chips = screen.getByRole("group", { name: "Qué falta" });
    expect(within(chips).getAllByRole("button").map((b) => b.textContent)).toEqual(["Sin foto12", "Faltan datos12", "Lesionados1", "Sin cuenta8", "Piden su ficha2"]);

    await user.click(within(chips).getByRole("button", { name: /Piden su ficha/ }));
    expect(groups()).toEqual(["Porteros: FER", "Delanteros: KEVIN"]);
    expect(screen.getByText("2 de 12 jugadores")).toBeInTheDocument();
    await user.click(within(chips).getByRole("button", { name: /Piden su ficha/ }));
    const search = screen.getByRole("searchbox", { name: "Buscar jugador" });
    await user.type(search, "adrian");
    expect(groups()).toEqual(["Delanteros: ADRIÁN T.C."]);
    await user.type(search, "zz");
    expect(screen.getByText("Nadie con «adrianzz».")).toBeInTheDocument();
  });

  it("«/» focuses the search", async () => {
    mountAdmin("/admin/plantilla", { plantilla: Plantilla });
    const search = await screen.findByRole("searchbox", { name: "Buscar jugador" });
    fireEvent.keyDown(document.body, { key: "/" });
    expect(search).toHaveFocus();
  });

  it("«Sin posición» goes first, and a line is one tap from the list (behind «Deshacer»)", async () => {
    noLine("kevin");
    vi.useFakeTimers({ shouldAdvanceTime: true });
    const user = userEvent.setup({ advanceTimers: vi.advanceTimersByTime });
    mountAdmin("/admin/plantilla?jugador=erik", { plantilla: Plantilla });
    await screen.findByRole("region", { name: "Ficha de ERIK" });
    expect(groups()[0]).toBe("Sin posición: KEVIN");
    await user.click(within(screen.getByRole("group", { name: "Colocar a KEVIN" })).getByRole("button", { name: "DEF" }));
    expect(caption()).toHaveTextContent("KEVIN pasa a la defensa");
    expect(caption().querySelector(".sc-status__tag")).toHaveTextContent("LÍNEA");
    expect(groups()[0]).toBe("Porteros: EVANS, FER");
    expect(groups()[1]).toBe("Defensas: ILLESCAS, KEVIN, TELLO, BRAWAN");
    await act(async () => {
      vi.advanceTimersByTime(5300);
    });
    expect(h.writes.savePlayer).toHaveBeenCalledWith("kevin", { naturalPosition: "DEF" });
  });

  it("a player's ficha: his positions and state are one tap, his account and story are there", async () => {
    vi.useFakeTimers({ shouldAdvanceTime: true });
    const user = userEvent.setup({ advanceTimers: vi.advanceTimersByTime });
    const router = mountAdmin("/admin/plantilla", { plantilla: Plantilla });
    await screen.findByRole("navigation", { name: "La plantilla" });
    await user.click(within(list()).getByRole("button", { name: "Abrir la ficha de ERIK" }));
    await waitFor(() => expect(router.state.location.pathname).toBe("/admin/plantilla/erik"));
    const f = ficha("ERIK");
    // known only by his line (DEL): the map has nothing marked yet
    expect(within(f).queryByRole("group", { name: "Línea de ERIK" })).toBeNull();
    expect(within(f).getByRole("group", { name: "Posiciones de ERIK" })).toBeInTheDocument();
    expect(within(f).getByRole("button", { name: "DC · Punta: sin marcar" })).toBeInTheDocument();
    expect(within(f).getByRole("img", { name: "Le falta la foto, el nacimiento, la altura y el peso" })).toBeInTheDocument();
    expect(f).toHaveTextContent("Cuenta vinculada · erik9 entra al vestuario con su ficha");
    expect(within(f).getByRole("link", { name: /Editar su historia/ })).toHaveAttribute("href", "/admin/contenido?seccion=historias");
    expect(within(f).getByRole("link", { name: /Ver su página/ })).toHaveAttribute("href", "/jugadores/erik");
    expect(within(f).getByText("Su dorsal · solo lo lleva él")).toBeInTheDocument();
    await user.click(within(within(f).getByRole("group", { name: "Estado de ERIK" })).getByRole("button", { name: /Lesionado/ }));
    expect(caption()).toHaveTextContent("ERIK, lesionado");
    const map = () => within(ficha("ERIK")).getByRole("group", { name: "Posiciones de ERIK" });
    await user.click(within(map()).getByRole("button", { name: /^MCD · Pivote/ }));
    expect(caption()).toHaveTextContent("Posiciones de ERIK: También MCD");
    await user.click(within(map()).getByRole("button", { name: /^MCD · Pivote/ }));
    expect(caption()).toHaveTextContent("Posiciones de ERIK: Pivote (MCD)");
    expect(caption().querySelector(".sc-status__tag")).toHaveTextContent("POSICIÓN");
    expect(within(map()).getByRole("button", { name: "MCD · Pivote: preferida" })).toBeInTheDocument();
    // the preferida's line moves him to the medios, and the list says his exact position
    expect(groups()[2]).toBe("Medios: EGUZQUIZA, ERIK, HUBEROSKI, ANDIA, ALMACHI");
    expect(within(list()).getByRole("button", { name: "Abrir la ficha de ERIK" })).toHaveTextContent("MCD · Lesionado · faltan 4 datos");
    await act(async () => {
      vi.advanceTimersByTime(5300);
    });
    expect(h.writes.savePlayer).toHaveBeenCalledWith("erik", { injured: true });
    // a hand edit clears the last review (it spoke of other positions)
    expect(h.writes.savePlayer).toHaveBeenCalledWith("erik", { positions: { main: null, also: ["MCD"] }, positionsReview: null });
    expect(h.writes.savePlayer).toHaveBeenLastCalledWith("erik", { positions: { main: "MCD", also: [] }, naturalPosition: "MED", positionsReview: null });
  });

  it("«Deshacer» on a position puts the map back and writes nothing", async () => {
    vi.useFakeTimers({ shouldAdvanceTime: true });
    const user = userEvent.setup({ advanceTimers: vi.advanceTimersByTime });
    mountAdmin("/admin/plantilla?jugador=tello", { plantilla: Plantilla });
    const f = await screen.findByRole("region", { name: "Ficha de TELLO" });
    await user.click(within(within(f).getByRole("group", { name: "Posiciones de TELLO" })).getByRole("button", { name: "LD · Lateral derecho: sin marcar" }));
    expect(within(f).getByRole("button", { name: "LD · Lateral derecho: también" })).toBeInTheDocument();
    await user.click(within(caption()).getByRole("button", { name: "Deshacer" }));
    expect(within(ficha("TELLO")).getByRole("button", { name: "LD · Lateral derecho: sin marcar" })).toBeInTheDocument();
    await act(async () => {
      vi.advanceTimersByTime(6000);
    });
    expect(h.writes.savePlayer).not.toHaveBeenCalled();
  });

  it("a claimed ficha points to Cuentas", async () => {
    mountAdmin("/admin/plantilla?jugador=kevin", { plantilla: Plantilla });
    const f = await screen.findByRole("region", { name: "Ficha de KEVIN" });
    expect(f).toHaveTextContent("Pide su ficha · nuevo.socio la ha pedido");
    expect(within(f).getByRole("link", { name: /Revisar en Cuentas/ })).toHaveAttribute("href", "/admin/fichas");
    expect(within(f).getByRole("link", { name: /Escribir su historia/ })).toBeInTheDocument();
  });

  it("saves itself: a valid field is written when you leave it (behind «Deshacer»), keeping his line", async () => {
    vi.useFakeTimers({ shouldAdvanceTime: true });
    const user = userEvent.setup({ advanceTimers: vi.advanceTimersByTime });
    mountAdmin("/admin/plantilla?jugador=erik", { plantilla: Plantilla });
    const f = await screen.findByRole("region", { name: "Ficha de ERIK" });
    await user.type(within(f).getByRole("textbox", { name: "Altura (cm)" }), "180");
    await user.tab();
    expect(caption()).toHaveTextContent("Ficha de ERIK guardada");
    expect(caption().querySelector(".sc-status__tag")).toHaveTextContent("FICHA");
    expect(within(ficha("ERIK")).getByRole("img", { name: "Le falta la foto, el nacimiento y el peso" })).toBeInTheDocument();
    await act(async () => {
      vi.advanceTimersByTime(5300);
    });
    expect(h.writes.savePlayer).toHaveBeenCalledWith("erik", expect.objectContaining({ height: 180, injured: false, shirtName: "ERIK", seasons: ["t1"] }));
    expect(h.writes.savePlayer.mock.calls[0][1]).not.toHaveProperty("createdAt");
    // his line is untouched, so it is not rewritten (an old exact word would survive for the migration)
    expect(h.writes.savePlayer.mock.calls[0][1]).not.toHaveProperty("naturalPosition");
  });

  it("«Deshacer» after an autosave puts the field back and writes nothing", async () => {
    vi.useFakeTimers({ shouldAdvanceTime: true });
    const user = userEvent.setup({ advanceTimers: vi.advanceTimersByTime });
    mountAdmin("/admin/plantilla?jugador=tello", { plantilla: Plantilla });
    const f = await screen.findByRole("region", { name: "Ficha de TELLO" });
    await user.type(within(f).getByRole("textbox", { name: "Peso (kg)" }), "75");
    await user.keyboard("{Enter}");
    expect(caption()).toHaveTextContent("Ficha de TELLO guardada");
    await user.click(within(caption()).getByRole("button", { name: "Deshacer" }));
    await waitFor(() => expect(within(ficha("TELLO")).getByRole("textbox", { name: "Peso (kg)" })).toHaveValue(""));
    await act(async () => {
      vi.advanceTimersByTime(6000);
    });
    expect(h.writes.savePlayer).not.toHaveBeenCalled();
  });

  it("«Deshacer» keeps the focus in the field being typed (its own save can't replace the caption)", async () => {
    vi.useFakeTimers({ shouldAdvanceTime: true });
    const user = userEvent.setup({ advanceTimers: vi.advanceTimersByTime });
    mountAdmin("/admin/plantilla?jugador=tello", { plantilla: Plantilla });
    const f = await screen.findByRole("region", { name: "Ficha de TELLO" });
    await user.type(within(f).getByRole("textbox", { name: "Peso (kg)" }), "75");
    await user.keyboard("{Enter}");
    const altura = within(f).getByRole("textbox", { name: "Altura (cm)" });
    await user.click(altura);
    await user.type(altura, "18");
    await user.click(within(caption()).getByRole("button", { name: "Deshacer" }));
    await waitFor(() => expect(within(ficha("TELLO")).getByRole("textbox", { name: "Peso (kg)" })).toHaveValue(""));
    await act(async () => {
      vi.advanceTimersByTime(6000);
    });
    // «Deshacer» puts the ficha back on what is written: the weight is undone and the half-typed height goes too
    expect(within(ficha("TELLO")).getByRole("textbox", { name: "Altura (cm)" })).toHaveValue("");
    expect(h.writes.savePlayer).not.toHaveBeenCalled();
  });

  it("«Dar de baja» with an invalid field left: no question, and the baja is not undone by a later save", async () => {
    vi.useFakeTimers({ shouldAdvanceTime: true });
    const user = userEvent.setup({ advanceTimers: vi.advanceTimersByTime });
    mountAdmin("/admin/plantilla?jugador=erik", { plantilla: Plantilla });
    const f = await screen.findByRole("region", { name: "Ficha de ERIK" });
    const dorsal = within(f).getByRole("textbox", { name: "Dorsal en la Temporada 1" });
    await user.clear(dorsal);
    await user.type(dorsal, "10");
    await user.click(within(f).getByRole("button", { name: "Dar de baja" }));
    await user.click(within(screen.getByRole("alertdialog", { name: "¿Dar de baja a ERIK?" })).getByRole("button", { name: "Dar de baja" }));
    expect(screen.queryByRole("alertdialog", { name: "¿Salir sin guardar?" })).toBeNull();
    await waitFor(() => expect(screen.queryByRole("region", { name: "Ficha de ERIK" })).toBeNull());
    await act(async () => {
      vi.advanceTimersByTime(5300);
    });
    expect(h.writes.savePlayer).toHaveBeenCalledTimes(1);
    expect(h.writes.savePlayer).toHaveBeenCalledWith("erik", { seasons: [] });
  });

  it("an invalid field is never written, and leaving with it asks first", async () => {
    const user = userEvent.setup();
    mountAdmin("/admin/plantilla?jugador=erik", { plantilla: Plantilla });
    const f = await screen.findByRole("region", { name: "Ficha de ERIK" });
    const dorsal = within(f).getByRole("textbox", { name: "Dorsal en la Temporada 1" });
    await user.clear(dorsal);
    await user.type(dorsal, "10");
    await user.tab();
    expect(within(f).getByText("El 10 ya lo lleva ADRIÁN T.C. en la Temporada 1")).toHaveClass("er");
    expect(f).toHaveTextContent("Sin guardar: revisa lo marcado");
    expect(screen.queryByText(/guardada/)).toBeNull();
    await user.click(within(list()).getByRole("button", { name: "Abrir la ficha de TELLO" }));
    const guard = await screen.findByRole("alertdialog", { name: "¿Salir sin guardar?" });
    expect(guard).toHaveTextContent("Hay cambios sin guardar en la ficha de ERIK");
    await user.click(within(guard).getByRole("button", { name: "Seguir editando" }));
    expect(ficha("ERIK")).toBeInTheDocument();
    expect(h.writes.savePlayer).not.toHaveBeenCalled();
  });

  it("walks the list: ↓ ↑, the arrows and «Siguiente sin completar»", async () => {
    const user = userEvent.setup();
    const router = mountAdmin("/admin/plantilla?jugador=evans", { plantilla: Plantilla });
    await screen.findByRole("region", { name: "Ficha de EVANS" });
    fireEvent.keyDown(document.body, { key: "ArrowDown" });
    await waitFor(() => expect(router.state.location.pathname).toBe("/admin/plantilla/fer"));
    fireEvent.keyDown(document.body, { key: "ArrowUp" });
    await waitFor(() => expect(router.state.location.pathname).toBe("/admin/plantilla/evans"));
    await user.click(within(ficha("EVANS")).getByRole("button", { name: "Jugador siguiente" }));
    await waitFor(() => expect(router.state.location.pathname).toBe("/admin/plantilla/fer"));
    await user.click(within(ficha("FER")).getByRole("button", { name: /Siguiente sin completar/ }));
    await waitFor(() => expect(router.state.location.pathname).toBe("/admin/plantilla/illescas"));
    // typing in a field: the arrows are the field's
    const f = ficha("ILLESCAS");
    within(f).getByRole("textbox", { name: "Altura (cm)" }).focus();
    fireEvent.keyDown(within(f).getByRole("textbox", { name: "Altura (cm)" }), { key: "ArrowDown" });
    expect(router.state.location.pathname).toBe("/admin/plantilla/illescas");
  });

  it("«Alta de jugador» takes the ficha's place: the shirt is stamped, free dorsales are a tap, and the new one opens", async () => {
    vi.useFakeTimers({ shouldAdvanceTime: true });
    const user = userEvent.setup({ advanceTimers: vi.advanceTimersByTime });
    const router = mountAdmin("/admin/plantilla?jugador=evans", { plantilla: Plantilla });
    await user.click(await screen.findByRole("button", { name: "Alta de jugador" }));
    await waitFor(() => expect(router.state.location.pathname).toBe("/admin/plantilla/alta"));
    const a = screen.getByRole("region", { name: "Alta de jugador" });
    const alta = within(a).getByRole("button", { name: "Dar de alta" });
    expect(alta).toBeDisabled();
    expect(within(a).getByRole("button", { name: "Temporada 1" })).toHaveAttribute("aria-pressed", "true");
    // his positions on the same map as the ficha, empty to start with (optional)
    expect(within(a).queryByRole("button", { name: "MED" })).toBeNull();
    const map = within(a).getByRole("group", { name: "Posiciones del jugador nuevo" });
    expect(within(map).getByRole("button", { name: "MCD · Pivote: sin marcar" })).toBeInTheDocument();
    await user.click(within(map).getByRole("button", { name: /^MCD · Pivote/ }));
    await user.click(within(map).getByRole("button", { name: /^MCD · Pivote/ }));
    expect(within(map).getByRole("button", { name: "MCD · Pivote: preferida" })).toBeInTheDocument();
    await user.type(within(a).getByRole("textbox", { name: /Nombre en la camiseta/ }), "pablo");
    expect(within(a).getByRole("heading", { level: 2 })).toHaveTextContent("PABLO");
    await user.type(within(a).getByRole("textbox", { name: "Dorsal en la Temporada 1" }), "9");
    expect(within(a).getByText("El 9 ya lo lleva ERIK en la Temporada 1")).toBeInTheDocument();
    expect(alta).toBeDisabled();
    await user.click(within(within(a).getByRole("group", { name: "Dorsales libres" })).getByRole("button", { name: "Dorsal 2" }));
    expect(within(a).getByRole("textbox", { name: "Dorsal en la Temporada 1" })).toHaveValue("2");
    await user.click(alta);
    await waitFor(() => expect(router.state.location.pathname).toBe("/admin/plantilla/nuevo1"));
    expect(caption()).toHaveTextContent("PABLO entra en la plantilla con el 2");
    expect(caption().querySelector(".sc-status__tag")).toHaveTextContent("ALTA");
    expect(screen.getByRole("region", { name: "Ficha de PABLO" })).toBeInTheDocument();
    expect(groups()[2]).toBe("Medios: PABLO, EGUZQUIZA, HUBEROSKI, ANDIA, ALMACHI");
    await act(async () => {
      vi.advanceTimersByTime(5300);
    });
    expect(h.writes.savePlayer).toHaveBeenCalledWith("nuevo1", expect.objectContaining({ shirtName: "PABLO", number: 2, naturalPosition: "MED", positions: { main: "MCD", also: [] }, seasons: ["t1"], active: true, createdAt: expect.any(Date) }));
  });

  it("an alta with the map left empty writes no position (he waits in «Sin posición»)", async () => {
    vi.useFakeTimers({ shouldAdvanceTime: true });
    const user = userEvent.setup({ advanceTimers: vi.advanceTimersByTime });
    mountAdmin("/admin/plantilla?nuevo=true&dorsal=2", { plantilla: Plantilla });
    const a = await screen.findByRole("region", { name: "Alta de jugador" });
    await user.type(within(a).getByRole("textbox", { name: /Nombre en la camiseta/ }), "pablo");
    await user.click(within(a).getByRole("button", { name: "Dar de alta" }));
    expect(groups()[0]).toBe("Sin posición: PABLO");
    await act(async () => {
      vi.advanceTimersByTime(5300);
    });
    const payload = h.writes.savePlayer.mock.calls[0][1];
    expect(payload).not.toHaveProperty("positions");
    expect(payload).not.toHaveProperty("naturalPosition");
  });

  it("«Dar de baja» asks first, takes him off the season (the doc stays) and can be undone", async () => {
    vi.useFakeTimers({ shouldAdvanceTime: true });
    const user = userEvent.setup({ advanceTimers: vi.advanceTimersByTime });
    mountAdmin("/admin/plantilla?jugador=erik", { plantilla: Plantilla });
    let f = await screen.findByRole("region", { name: "Ficha de ERIK" });
    await user.click(within(f).getByRole("button", { name: "Dar de baja" }));
    let ask = screen.getByRole("alertdialog", { name: "¿Dar de baja a ERIK?" });
    expect(ask).toHaveTextContent("Deja la plantilla de la Temporada 1");
    expect(ask).toHaveTextContent("Sus actas, goles y su carta se quedan");
    await user.click(within(ask).getByRole("button", { name: "Cancelar" }));
    await user.click(within(f).getByRole("button", { name: "Dar de baja" }));
    ask = screen.getByRole("alertdialog", { name: "¿Dar de baja a ERIK?" });
    await user.click(within(ask).getByRole("button", { name: "Dar de baja" }));
    expect(caption()).toHaveTextContent("ERIK de baja · sus actas y estadísticas se quedan");
    await waitFor(() => expect(within(list()).queryByRole("button", { name: "Abrir la ficha de ERIK" })).toBeNull());
    await user.click(within(caption()).getByRole("button", { name: "Deshacer" }));
    expect(within(list()).getByRole("button", { name: "Abrir la ficha de ERIK" })).toBeInTheDocument();
    await act(async () => {
      vi.advanceTimersByTime(6000);
    });
    expect(h.writes.savePlayer).not.toHaveBeenCalled();

    await user.click(within(list()).getByRole("button", { name: "Abrir la ficha de ERIK" }));
    f = await screen.findByRole("region", { name: "Ficha de ERIK" });
    await user.click(within(f).getByRole("button", { name: "Dar de baja" }));
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
    mountAdmin("/admin/plantilla?jugador=evans", { plantilla: Plantilla });
    expect(await screen.findByText("Temporada 1 · 11 jugadores")).toBeInTheDocument();
    expect(within(list()).queryByRole("button", { name: /KEVIN/ })).toBeNull();
    await user.type(screen.getByRole("searchbox", { name: "Buscar jugador" }), "kev");
    const kevin = within(list()).getByRole("button", { name: "Abrir la ficha de KEVIN (no está en la temporada)" });
    expect(kevin).toHaveTextContent("fuera de la T1");
    expect(groups()).toEqual(["Otras temporadas: KEVIN"]);
  });

  it("«Todos en cromos» shows the whole squad big; a cromo opens his ficha", async () => {
    const user = userEvent.setup();
    const router = mountAdmin("/admin/plantilla?jugador=evans", { plantilla: Plantilla });
    await user.click(await screen.findByRole("button", { name: /Todos en cromos/ }));
    await waitFor(() => expect(router.state.location.pathname).toBe("/admin/plantilla/cromos"));
    const grid = screen.getByRole("list", { name: "Todos en cromos" });
    expect(within(grid).getAllByRole("listitem")).toHaveLength(13);
    expect(within(grid).getByRole("button", { name: "Abrir la ficha de KEVIN" })).toHaveTextContent("Pide su ficha");
    expect(within(grid).getByRole("button", { name: /Alta de jugador/ })).toBeInTheDocument();
    await user.click(within(grid).getByRole("button", { name: "Abrir la ficha de TELLO" }));
    await waitFor(() => expect(router.state.location.pathname).toBe("/admin/plantilla/tello"));
    expect(ficha("TELLO")).toBeInTheDocument();
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
    mountAdmin("/admin/plantilla?jugador=evans", { plantilla: Plantilla });
    await user.click(await screen.findByRole("button", { name: "Exportar la plantilla (CSV)" }));
    expect(create).toHaveBeenCalledTimes(1);
    const text = await created[0].text();
    expect(text).toContain("Dorsal;Nombre en camiseta;Nombre;Apellidos;Posición;Preferida;También;Estado;Temporadas");
    expect(text).toContain("9;ERIK;Nombre;Apellidos;Delantero;;;Activo;T1;;;");
    expect(caption()).toHaveTextContent("Plantilla exportada · 12 jugadores en el CSV");
    click.mockRestore();
  });

  it("phones: the list is the screen; a player opens his ficha full screen and «volver» comes back", async () => {
    Object.defineProperty(window, "innerWidth", { configurable: true, value: 390 });
    const user = userEvent.setup();
    const router = mountAdmin("/admin/plantilla", { plantilla: Plantilla });
    await screen.findByRole("searchbox", { name: "Buscar jugador" });
    expect(router.state.location.pathname).toBe("/admin/plantilla");
    expect(screen.queryByRole("region", { name: /^Ficha de/ })).toBeNull();
    await user.click(within(list()).getByRole("button", { name: "Abrir la ficha de ADRIÁN T.C." }));
    const f = await screen.findByRole("region", { name: "Ficha de ADRIÁN T.C." });
    expect(screen.queryByRole("navigation", { name: "La plantilla" })).toBeNull();
    expect(within(f).getByRole("button", { name: /Siguiente sin completar/ })).toBeInTheDocument();
    await user.click(within(f).getByRole("button", { name: "Volver a la plantilla" }));
    await waitFor(() => expect(router.state.location.pathname).toBe("/admin/plantilla"));
    expect(list()).toBeInTheDocument();
  });

  it("phones: a ficha opened from the cromos goes back to the cromos", async () => {
    Object.defineProperty(window, "innerWidth", { configurable: true, value: 390 });
    const user = userEvent.setup();
    const router = mountAdmin("/admin/plantilla?vista=cromos", { plantilla: Plantilla });
    const grid = await screen.findByRole("list", { name: "Todos en cromos" });
    await user.click(within(grid).getByRole("button", { name: "Abrir la ficha de FER" }));
    const f = await screen.findByRole("region", { name: "Ficha de FER" });
    await user.click(within(f).getByRole("button", { name: "Volver a la plantilla" }));
    await waitFor(() => expect(router.state.location.pathname).toBe("/admin/plantilla/cromos"));
    expect(screen.getByRole("list", { name: "Todos en cromos" })).toBeInTheDocument();
  });

  it("shows the loading state", async () => {
    setAdminData(adminFixture({ loading: true }));
    mountAdmin("/admin/plantilla", { plantilla: Plantilla });
    expect(await screen.findByRole("status", { name: "Cargando la plantilla" })).toBeInTheDocument();
  });
});

describe("Plantilla · sanciones", () => {
  const estado = (name: string) => within(ficha(name)).getByRole("group", { name: `Estado de ${name}` });
  const row = (name: string) => within(list()).getByRole("button", { name: `Abrir la ficha de ${name}` });
  beforeEach(() => {
    localStorage.clear();
    Object.values(h.writes).forEach((f) => f.mockClear());
    setAdminData(adminFixture());
  });
  afterEach(() => {
    vi.useRealTimers();
  });

  it("«Sancionado» opens a small form: 2 matches and a reason, behind «Deshacer»; the ficha and the list say it", async () => {
    vi.useFakeTimers({ shouldAdvanceTime: true });
    const user = userEvent.setup({ advanceTimers: vi.advanceTimersByTime });
    mountAdmin("/admin/plantilla?jugador=erik", { plantilla: Plantilla });
    await screen.findByRole("region", { name: "Ficha de ERIK" });
    const san = within(estado("ERIK")).getByRole("button", { name: "Sancionado" });
    expect(san).toHaveAttribute("aria-pressed", "false");
    expect(within(estado("ERIK")).getByRole("button", { name: "Activo" })).toHaveAttribute("aria-pressed", "true");
    await user.click(san);
    const form = screen.getByRole("form", { name: "Sanción de ERIK" });
    const games = within(form).getByRole("spinbutton", { name: /Partidos de sanción/ });
    expect(games).toHaveFocus();
    expect(games).toHaveValue(1);
    await user.clear(games);
    await user.type(games, "2");
    await user.type(within(form).getByRole("textbox", { name: /Motivo/ }), "Federación");
    await user.click(within(form).getByRole("button", { name: "Sancionar" }));
    expect(caption()).toHaveTextContent("ERIK, sancionado 2 partidos · Federación");
    expect(caption().querySelector(".sc-status__tag")).toHaveTextContent("SANCIÓN");
    expect(screen.queryByRole("form", { name: "Sanción de ERIK" })).toBeNull();
    expect(ficha("ERIK")).toHaveTextContent("Sancionado · quedan 2 partidos · Federación");
    expect(within(estado("ERIK")).getByRole("button", { name: "Sancionado" })).toHaveAttribute("aria-pressed", "true");
    expect(within(estado("ERIK")).getByRole("button", { name: "Activo" })).toHaveAttribute("aria-pressed", "false");
    expect(row("ERIK")).toHaveTextContent("Sancionado");
    await act(async () => {
      vi.advanceTimersByTime(5300);
    });
    expect(h.writes.savePlayer).toHaveBeenCalledWith("erik", { sanction: { games: 2, from: adminFixture().now, untilMatchId: null, reason: "Federación", by: "a1" } });
  });

  it("«hasta la J…» picks a match of the calendar; «Deshacer» writes nothing; a bad count is never written", async () => {
    vi.useFakeTimers({ shouldAdvanceTime: true });
    const user = userEvent.setup({ advanceTimers: vi.advanceTimersByTime });
    mountAdmin("/admin/plantilla?jugador=erik", { plantilla: Plantilla });
    await screen.findByRole("region", { name: "Ficha de ERIK" });
    await user.click(within(estado("ERIK")).getByRole("button", { name: "Sancionado" }));
    let form = screen.getByRole("form", { name: "Sanción de ERIK" });
    const games = within(form).getByRole("spinbutton", { name: /Partidos de sanción/ });
    await user.clear(games);
    await user.type(games, "11");
    await user.click(within(form).getByRole("button", { name: "Sancionar" }));
    expect(within(form).getByRole("alert")).toHaveTextContent("Entre 1 y 10 partidos.");
    expect(games).toHaveAttribute("aria-invalid", "true");
    await user.click(within(form).getByRole("button", { name: "Hasta la jornada" }));
    const until = within(form).getByRole("combobox", { name: "Hasta la jornada (incluida)" });
    expect(within(until).getAllByRole("option").map((o) => o.textContent)).toEqual([expect.stringMatching(/^J3 · MAD SKY · /)]);
    await user.click(within(form).getByRole("button", { name: "Sancionar" }));
    expect(caption()).toHaveTextContent("ERIK, sancionado hasta la J3");
    expect(ficha("ERIK")).toHaveTextContent("Sancionado · queda 1 partido (hasta la J3)");
    await user.click(within(caption()).getByRole("button", { name: "Deshacer" }));
    expect(ficha("ERIK")).not.toHaveTextContent("Sancionado ·");
    await act(async () => {
      vi.advanceTimersByTime(6000);
    });
    expect(h.writes.savePlayer).not.toHaveBeenCalled();
    // «Cancelar» closes the form
    await user.click(within(estado("ERIK")).getByRole("button", { name: "Sancionado" }));
    form = screen.getByRole("form", { name: "Sanción de ERIK" });
    await user.click(within(form).getByRole("button", { name: "Cancelar" }));
    expect(screen.queryByRole("form", { name: "Sanción de ERIK" })).toBeNull();
  });

  it("a sanction set by hand: what is left, and «Levantar la sanción» (with undo) clears it and the acta's red", async () => {
    const base = adminFixture();
    setAdminData({ ...base, players: base.players.map((p) => (p.id === "kevin" ? { ...p, sanction: { games: 3, from: base.now - 1000, reason: "Roja en Copa", by: "a2" } } : p)) });
    vi.useFakeTimers({ shouldAdvanceTime: true });
    const user = userEvent.setup({ advanceTimers: vi.advanceTimersByTime });
    mountAdmin("/admin/plantilla?jugador=kevin", { plantilla: Plantilla });
    const f = await screen.findByRole("region", { name: "Ficha de KEVIN" });
    expect(f).toHaveTextContent("Sancionado · quedan 3 partidos · Roja en Copa");
    expect(row("KEVIN")).toHaveTextContent("Sancionado");
    expect(row("ERIK")).not.toHaveTextContent("Sancionado");
    await user.click(within(f).getByRole("button", { name: "Levantar la sanción" }));
    expect(caption()).toHaveTextContent("KEVIN, sanción levantada · vuelve a estar disponible");
    expect(ficha("KEVIN")).not.toHaveTextContent("Sancionado ·");
    expect(row("KEVIN")).not.toHaveTextContent("Sancionado");
    await act(async () => {
      vi.advanceTimersByTime(5300);
    });
    expect(h.writes.savePlayer).toHaveBeenCalledWith("kevin", { sanction: null, sanctionClearedAt: base.now });
  });

  it("a red card in the last acta shows as a sanction too; «Activo» lifts it", async () => {
    const base = adminFixture();
    const red = { id: "rc", type: "red_card" as const, minute: 40, playerId: "tello" };
    setAdminData({ ...base, matches: base.matches.map((m) => (m.id === "m7" ? { ...m, events: [...(m.events ?? []), red] } : m)) });
    vi.useFakeTimers({ shouldAdvanceTime: true });
    const user = userEvent.setup({ advanceTimers: vi.advanceTimersByTime });
    mountAdmin("/admin/plantilla?jugador=tello", { plantilla: Plantilla });
    const f = await screen.findByRole("region", { name: "Ficha de TELLO" });
    expect(f).toHaveTextContent("Sancionado · queda 1 partido · por expulsión");
    expect(row("TELLO")).toHaveTextContent("Sancionado");
    await user.click(within(estado("TELLO")).getByRole("button", { name: "Activo" }));
    expect(caption()).toHaveTextContent("TELLO, sanción levantada");
    expect(ficha("TELLO")).not.toHaveTextContent("Sancionado ·");
    await act(async () => {
      vi.advanceTimersByTime(5300);
    });
    expect(h.writes.savePlayer).toHaveBeenCalledWith("tello", { sanction: null, sanctionClearedAt: base.now });
  });
});

describe("Plantilla · propuestas de posición", () => {
  const banner = () => within(ficha("ERIK")).getByRole("group", { name: "Propuesta de ERIK" });
  const map = () => within(ficha("ERIK")).getByRole("group", { name: "Posiciones de ERIK" });
  beforeEach(() => {
    localStorage.clear();
    Object.values(h.writes).forEach((f) => f.mockClear());
    const base = adminFixture();
    setAdminData({ ...base, players: base.players.map((p) => (p.id === "erik" ? { ...p, positions: { main: "DC", also: [] }, positionsProposal: { main: "MCD", also: ["MC"], at: 1 } } : p)) });
  });
  afterEach(() => {
    vi.useRealTimers();
  });

  it("the ficha shows what he proposes on a map compared with his positions; «Propuestas» isolates who proposed", async () => {
    const user = userEvent.setup();
    mountAdmin("/admin/plantilla?jugador=erik", { plantilla: Plantilla });
    await screen.findByRole("region", { name: "Ficha de ERIK" });
    expect(banner()).toHaveTextContent("ERIK propone: Pivote (MCD) · también MC");
    expect(banner()).toHaveTextContent("Ahora: Punta (DC)");
    // while it waits, the map is his proposal (the editor comes back with «Ajustar» or once it is decided)
    expect(within(ficha("ERIK")).queryByRole("group", { name: "Posiciones de ERIK" })).toBeNull();
    expect(within(banner()).getByRole("img", { name: /^Lo que propone ERIK\. Preferida: Pivote \(MCD\)\. También: Mediocentro \(MC\)\. Añadidas: .*Quitadas: Punta \(DC\)/ })).toBeInTheDocument();
    expect(within(banner()).getAllByRole("button").map((b) => b.textContent)).toEqual(["Aprobar", "Ajustar", "Rechazar"]);
    // the list says his exact preferida
    expect(within(list()).getByRole("button", { name: "Abrir la ficha de ERIK" })).toHaveTextContent("DC · faltan 4");
    const chips = screen.getByRole("group", { name: "Qué falta" });
    expect(within(chips).getAllByRole("button")[0]).toHaveTextContent("Propuestas1");
    await user.click(within(chips).getByRole("button", { name: /Propuestas/ }));
    expect(groups()).toEqual(["Delanteros: ERIK"]);
  });

  it("«Aprobar» writes his proposal as his positions, signed (behind «Deshacer»)", async () => {
    vi.useFakeTimers({ shouldAdvanceTime: true });
    const user = userEvent.setup({ advanceTimers: vi.advanceTimersByTime });
    mountAdmin("/admin/plantilla?jugador=erik", { plantilla: Plantilla });
    await screen.findByRole("region", { name: "Ficha de ERIK" });
    await user.click(within(banner()).getByRole("button", { name: "Aprobar" }));
    expect(caption()).toHaveTextContent("ERIK: propuesta aprobada · Pivote (MCD) · también MC");
    expect(caption().querySelector(".sc-status__tag")).toHaveTextContent("PROPUESTA");
    expect(within(ficha("ERIK")).queryByRole("group", { name: "Propuesta de ERIK" })).toBeNull();
    expect(within(map()).getByRole("button", { name: "MCD · Pivote: preferida" })).toBeInTheDocument();
    // undone: the proposal is back, nothing written
    await user.click(within(caption()).getByRole("button", { name: "Deshacer" }));
    expect(banner()).toHaveTextContent("Ahora: Punta (DC)");
    await user.click(within(banner()).getByRole("button", { name: "Aprobar" }));
    await act(async () => {
      vi.advanceTimersByTime(5300);
    });
    expect(h.writes.savePlayer).toHaveBeenCalledTimes(1);
    expect(h.writes.savePlayer).toHaveBeenCalledWith("erik", {
      positions: { main: "MCD", also: ["MC"] },
      naturalPosition: "MED",
      positionsProposal: null,
      positionsReview: { status: "aprobada", at: serverTimestamp(), by: "a1" },
    });
  });

  it("«Rechazar» closes the proposal and leaves his positions as they were", async () => {
    vi.useFakeTimers({ shouldAdvanceTime: true });
    const user = userEvent.setup({ advanceTimers: vi.advanceTimersByTime });
    mountAdmin("/admin/plantilla?jugador=erik", { plantilla: Plantilla });
    await screen.findByRole("region", { name: "Ficha de ERIK" });
    await user.click(within(banner()).getByRole("button", { name: "Rechazar" }));
    expect(caption()).toHaveTextContent("ERIK: propuesta rechazada · siguen las de antes");
    expect(within(ficha("ERIK")).queryByRole("group", { name: "Propuesta de ERIK" })).toBeNull();
    expect(within(map()).getByRole("button", { name: "DC · Punta: preferida" })).toBeInTheDocument();
    await act(async () => {
      vi.advanceTimersByTime(5300);
    });
    expect(h.writes.savePlayer).toHaveBeenCalledWith("erik", { positionsProposal: null, positionsReview: { status: "rechazada", at: serverTimestamp(), by: "a1" } });
  });

  it("«Rechazar» with no positions before: no «siguen las de antes»", async () => {
    const base = adminFixture();
    setAdminData({ ...base, players: base.players.map((p) => (p.id === "erik" ? { ...p, naturalPosition: undefined, positions: undefined, positionsProposal: { main: "MCD", also: [], at: 1 } } : p)) });
    const user = userEvent.setup();
    mountAdmin("/admin/plantilla?jugador=erik", { plantilla: Plantilla });
    await screen.findByRole("region", { name: "Ficha de ERIK" });
    await user.click(within(banner()).getByRole("button", { name: "Rechazar" }));
    expect(caption()).toHaveTextContent("ERIK: propuesta rechazada");
    expect(caption()).not.toHaveTextContent("siguen las de antes");
  });

  it("«Ajustar» follows the live proposal: if he sends another meanwhile, the banner shows the new one (nothing written)", async () => {
    const user = userEvent.setup();
    mountAdmin("/admin/plantilla?jugador=erik", { plantilla: Plantilla });
    await screen.findByRole("region", { name: "Ficha de ERIK" });
    await user.click(within(banner()).getByRole("button", { name: "Ajustar" }));
    expect(banner()).toHaveTextContent("Ajustando la propuesta de ERIK");
    // he sends v2 while the captain adjusts v1 (the snapshot arrives)
    const base = adminFixture();
    act(() => setAdminData({ ...base, players: base.players.map((p) => (p.id === "erik" ? { ...p, positions: { main: "DC", also: [] }, positionsProposal: { main: "MCO", also: ["EI"], at: 2 } } : p)) }));
    expect(banner()).not.toHaveTextContent("Ajustando");
    expect(banner()).toHaveTextContent("ERIK propone: Mediapunta (MCO) · también EI");
    expect(within(banner()).getAllByRole("button").map((b) => b.textContent)).toEqual(["Aprobar", "Ajustar", "Rechazar"]);
    expect(within(ficha("ERIK")).queryByRole("group", { name: "Posiciones de ERIK" })).toBeNull();
    expect(h.writes.savePlayer).not.toHaveBeenCalled();
  });

  it("«Ajustar» drops too when he withdraws and sends the same again (a new date)", async () => {
    const user = userEvent.setup();
    mountAdmin("/admin/plantilla?jugador=erik", { plantilla: Plantilla });
    await screen.findByRole("region", { name: "Ficha de ERIK" });
    await user.click(within(banner()).getByRole("button", { name: "Ajustar" }));
    const base = adminFixture();
    act(() => setAdminData({ ...base, players: base.players.map((p) => (p.id === "erik" ? { ...p, positions: { main: "DC", also: [] }, positionsProposal: { main: "MCD", also: ["MC"], at: 3 } } : p)) }));
    expect(banner()).not.toHaveTextContent("Ajustando");
    expect(within(banner()).getByRole("button", { name: "Aprobar" })).toBeInTheDocument();
  });

  it("keyboard: the focus follows the review — to the map after «Ajustar» or a decision, to «Ajustar» after «Cancelar»", async () => {
    vi.useFakeTimers({ shouldAdvanceTime: true });
    const user = userEvent.setup({ advanceTimers: vi.advanceTimersByTime });
    mountAdmin("/admin/plantilla?jugador=erik", { plantilla: Plantilla });
    await screen.findByRole("region", { name: "Ficha de ERIK" });
    await user.click(within(banner()).getByRole("button", { name: "Ajustar" }));
    await waitFor(() => expect(within(map()).getByRole("button", { name: "MCD · Pivote: preferida, añadida" })).toHaveFocus());
    await user.click(within(banner()).getByRole("button", { name: "Cancelar" }));
    await waitFor(() => expect(within(banner()).getByRole("button", { name: "Ajustar" })).toHaveFocus());
    await user.click(within(banner()).getByRole("button", { name: "Rechazar" }));
    await waitFor(() => expect(within(map()).getByRole("button", { name: "DC · Punta: preferida" })).toHaveFocus());
    await user.click(within(caption()).getByRole("button", { name: "Deshacer" }));
    await user.click(within(banner()).getByRole("button", { name: "Aprobar" }));
    await waitFor(() => expect(within(map()).getByRole("button", { name: "MCD · Pivote: preferida" })).toHaveFocus());
    expect(document.body).not.toHaveFocus();
  });

  it("«Ajustar» puts his proposal in the editor (compared with his positions); the next tap saves it as adjusted", async () => {
    vi.useFakeTimers({ shouldAdvanceTime: true });
    const user = userEvent.setup({ advanceTimers: vi.advanceTimersByTime });
    mountAdmin("/admin/plantilla?jugador=erik", { plantilla: Plantilla });
    await screen.findByRole("region", { name: "Ficha de ERIK" });
    await user.click(within(banner()).getByRole("button", { name: "Ajustar" }));
    expect(banner()).toHaveTextContent("Ajustando la propuesta de ERIK");
    expect(within(map()).getByRole("button", { name: "MCD · Pivote: preferida, añadida" })).toBeInTheDocument();
    expect(within(map()).getByRole("button", { name: "DC · Punta: sin marcar, quitada" })).toBeInTheDocument();
    // «Cancelar» goes back to the proposal as it came
    await user.click(within(banner()).getByRole("button", { name: "Cancelar" }));
    expect(within(banner()).getByRole("button", { name: "Aprobar" })).toBeInTheDocument();
    expect(within(ficha("ERIK")).queryByRole("group", { name: "Posiciones de ERIK" })).toBeNull();
    expect(h.writes.savePlayer).not.toHaveBeenCalled();

    await user.click(within(banner()).getByRole("button", { name: "Ajustar" }));
    await user.click(within(map()).getByRole("button", { name: /^MC · Mediocentro/ }));
    expect(caption()).toHaveTextContent("ERIK: propuesta ajustada · Mediocentro (MC) · también MCD");
    expect(within(ficha("ERIK")).queryByRole("group", { name: "Propuesta de ERIK" })).toBeNull();
    expect(within(map()).getByRole("button", { name: "MC · Mediocentro: preferida" })).toBeInTheDocument();
    await act(async () => {
      vi.advanceTimersByTime(5300);
    });
    expect(h.writes.savePlayer).toHaveBeenCalledWith("erik", {
      positions: { main: "MC", also: ["MCD"] },
      naturalPosition: "MED",
      positionsProposal: null,
      positionsReview: { status: "ajustada", at: serverTimestamp(), by: "a1" },
    });
  });
});
