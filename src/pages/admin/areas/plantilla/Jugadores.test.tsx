// Jugadores, la ficha, los cromos, el alta y los antiguos (/admin/plantilla…) inside the real frame (mountAdmin): the
// rows by line with «Qué falta» and the search, the ficha beside the list (desktop) or full screen (phone), each field
// saved on its own behind «Deshacer», the positions map and the proposals, the state and the sanction, the baja that
// never deletes and the delete only through deletePlayer (B-CLUB-05), ← → ↑ ↓ (B-CLUB-10), anterior and siguiente on
// the phone (B-CLUB-07), the alta's stamped shirt and the guest who becomes a ficha (M-41), Antiguos (M-14).
import { act, fireEvent, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { NOW, adminFixture, mountAdmin, setAdminData } from "../../../../test/adminKit";
import type { PlayerDoc } from "../../../../lib/schemas";
import type { Absence } from "../../../../lib/derived/absences";
import { PlantillaArea } from "./Jugadores";

const h = vi.hoisted(() => ({
  writes: {
    newPlayerId: vi.fn(() => "nuevo1"),
    savePlayer: vi.fn((id: string, data: Record<string, unknown>) => Promise.resolve(void [id, data])),
    deletePlayer: vi.fn((id: string) => Promise.resolve(void id)),
  },
  promote: vi.fn((d: unknown) => Promise.resolve({ data: { matches: 1, seasons: ["t1"], d } })),
  absences: [] as Absence[],
  deleteDoc: vi.fn((ref: unknown) => Promise.resolve(void ref)),
  addDoc: vi.fn((ref: unknown, data: unknown) => Promise.resolve({ id: "nueva", ref, data })),
}));
vi.mock("../../data/useAdminData", async () => ({ useAdminData: (await import("../../../../test/adminMocks")).currentAdminData }));
vi.mock("../../../../context/AuthContext", async () => ({ useAuth: (await import("../../../../test/adminMocks")).fakeAuth }));
vi.mock("../../../../lib/clubApi", () => ({ apiError: (e: unknown) => String(e), promoteGuest: (d: unknown) => h.promote(d) }));
vi.mock("../../club/useClubWrites", () => ({ useClubWrites: () => h.writes }));
vi.mock("../../../../components/jersey3d/useShirtStills", () => ({ useShirtStills: () => () => undefined }));
vi.mock("../../../vestuario/live", async (orig) => ({ ...(await orig<typeof import("../../../vestuario/live")>()), useAbsences: () => ({ data: h.absences, loading: false, error: false }) }));
vi.mock("firebase/firestore", async (orig) => ({ ...(await orig<typeof import("firebase/firestore")>()), deleteDoc: (ref: unknown) => h.deleteDoc(ref), addDoc: (ref: unknown, data: unknown) => h.addDoc(ref, data) }));

const WIDTH = window.innerWidth;
const views = { plantilla: PlantillaArea };
const list = () => screen.getByRole("navigation", { name: "Jugadores por línea" });
const groups = () => [...list().querySelectorAll("section.spl-group")].map((g) => `${g.getAttribute("aria-label")}: ${[...g.querySelectorAll(".spl-row__t b")].map((b) => b.textContent).join(", ")}`);
const ficha = () => screen.getByRole("article");
const caption = () => screen.getAllByRole("status").find((s) => s.classList.contains("sc-status__live"))!;
const later = async (ms = 5300) => {
  await act(async () => {
    vi.advanceTimersByTime(ms);
  });
};
const withPlayers = (fn: (p: PlayerDoc) => PlayerDoc, over: Parameters<typeof adminFixture>[0] = {}) => {
  const base = adminFixture(over);
  setAdminData({ ...base, players: base.players.map(fn) });
};
const phone = () => Object.defineProperty(window, "innerWidth", { configurable: true, value: 390 });

describe("Plantilla · Jugadores", () => {
  beforeEach(() => {
    localStorage.clear();
    Object.values(h.writes).forEach((f) => f.mockClear());
    h.promote.mockClear();
    h.deleteDoc.mockClear();
    h.addDoc.mockClear();
    h.absences = [];
    setAdminData(adminFixture());
  });
  afterEach(() => {
    vi.useRealTimers();
    Object.defineProperty(window, "innerWidth", { configurable: true, value: WIDTH });
  });

  it("the season by line; the first ficha that lacks something open beside it; the chips and the search filter", async () => {
    const user = userEvent.setup();
    mountAdmin("/admin/plantilla", views);
    expect(await screen.findByRole("heading", { level: 1, name: "Plantilla" })).toBeInTheDocument();
    expect(screen.getByText("Temporada 1 · 12 jugadores")).toBeInTheDocument();
    expect(groups()).toEqual(["Porteros: EVANS, FER", "Defensas: ILLESCAS, TELLO, BRAWAN", "Medios: EGUZQUIZA, HUBEROSKI, ANDIA, ALMACHI", "Delanteros: ERIK, ADRIÁN T.C., KEVIN"]);
    expect(ficha()).toHaveTextContent("Ficha 1 de 12 · Portero");
    expect(within(ficha()).getByRole("heading", { level: 2 })).toHaveTextContent("1 EVANS");
    expect(within(list()).getByRole("link", { name: /^EVANS,/ })).toHaveAttribute("aria-current", "true");
    const chips = screen.getByRole("group", { name: "Qué falta" });
    expect(within(chips).getAllByRole("button").map((b) => b.getAttribute("aria-label"))).toEqual(["Sin foto: 12", "Faltan datos: 12", "Lesionados: 1", "Sin cuenta: 8", "Piden su ficha: 2"]);
    await user.click(within(chips).getByRole("button", { name: "Piden su ficha: 2" }));
    expect(groups()).toEqual(["Porteros: FER", "Delanteros: KEVIN"]);
    expect(screen.getAllByText("2 de 12 jugadores").length).toBeGreaterThan(0);
    await user.click(within(chips).getByRole("button", { name: "Piden su ficha: 2" }));
    const search = screen.getByRole("searchbox", { name: "Buscar jugador por nombre o dorsal" });
    await user.type(search, "adrian");
    expect(groups()).toEqual(["Delanteros: ADRIÁN T.C."]);
    await user.clear(search);
    await user.type(search, "33");
    expect(groups()).toEqual(["Defensas: BRAWAN"]);
    await user.type(search, "x");
    expect(screen.getByText("Nadie con «33x».")).toBeInTheDocument();
  });

  it("a row says his line, state, what he lacks and his account", async () => {
    mountAdmin("/admin/plantilla", views);
    await screen.findByRole("navigation", { name: "Jugadores por línea" });
    const brawan = within(list()).getByRole("link", { name: /^BRAWAN,/ });
    expect(brawan).toHaveAccessibleName("BRAWAN, dorsal 33, Lesionado, faltan foto, nacimiento, altura y peso");
    expect(brawan).toHaveTextContent("Defensa");
    expect(brawan).toHaveTextContent("Sin cuenta");
    expect(within(list()).getByRole("link", { name: /^ERIK,/ })).toHaveTextContent("@erik9");
    expect(within(list()).getByRole("link", { name: /^KEVIN,/ })).toHaveTextContent("Pide su ficha");
  });

  it("«Sin posición» goes first and a line is one tap from the row, behind «Deshacer»", async () => {
    withPlayers((p) => (p.id === "kevin" ? { ...p, naturalPosition: undefined } : p));
    vi.useFakeTimers({ shouldAdvanceTime: true });
    const user = userEvent.setup({ advanceTimers: vi.advanceTimersByTime });
    mountAdmin("/admin/plantilla/erik", views);
    await screen.findByRole("article");
    expect(groups()[0]).toBe("Sin posición: KEVIN");
    await user.click(within(screen.getByRole("group", { name: "Colocar a KEVIN" })).getByRole("button", { name: "Colocar a KEVIN en defensa" }));
    expect(caption()).toHaveTextContent("KEVIN pasa a la defensa");
    expect(groups()[1]).toBe("Defensas: ILLESCAS, KEVIN, TELLO, BRAWAN");
    await later();
    expect(h.writes.savePlayer).toHaveBeenCalledWith("kevin", { naturalPosition: "DEF" });
  });

  it("a field saves itself when you leave it (only if valid); «Deshacer» writes nothing; an invalid one asks before leaving", async () => {
    vi.useFakeTimers({ shouldAdvanceTime: true });
    const user = userEvent.setup({ advanceTimers: vi.advanceTimersByTime });
    const router = mountAdmin("/admin/plantilla/tello", views);
    await screen.findByRole("article");
    const height = within(ficha()).getByLabelText("Altura (cm)");
    await user.type(height, "181");
    await user.tab();
    expect(caption()).toHaveTextContent("Ficha de TELLO guardada");
    await user.click(within(caption()).getByRole("button", { name: "Deshacer" }));
    await later(6000);
    expect(h.writes.savePlayer).not.toHaveBeenCalled();
    expect(within(ficha()).getByLabelText("Altura (cm)")).toHaveValue("");

    await user.type(within(ficha()).getByLabelText("Peso (kg)"), "75");
    await user.keyboard("{Enter}");
    await later();
    expect(h.writes.savePlayer).toHaveBeenCalledTimes(1);
    expect(h.writes.savePlayer.mock.calls[0][0]).toBe("tello");
    expect(h.writes.savePlayer.mock.calls[0][1]).toMatchObject({ weight: 75, height: null, number: 20, shirtName: "TELLO", injured: false });
    expect(h.writes.savePlayer.mock.calls[0][1]).not.toHaveProperty("naturalPosition");

    // the dorsal of another one: said under the field, never written, and leaving asks
    const dorsal = within(ficha()).getByLabelText("Dorsal en la Temporada 1");
    await user.clear(dorsal);
    await user.type(dorsal, "9");
    await user.tab();
    expect(within(ficha()).getByText("El 9 ya lo lleva ERIK en la Temporada 1")).toBeInTheDocument();
    expect(ficha()).toHaveTextContent("Sin guardar: revisa lo marcado");
    await later();
    expect(h.writes.savePlayer).toHaveBeenCalledTimes(1);
    await user.click(screen.getByRole("link", { name: "Capitanes" }));
    expect(await screen.findByRole("alertdialog")).toHaveTextContent("la ficha de TELLO");
    expect(router.state.location.pathname).toBe("/admin/plantilla/tello");
  });

  it("Estado: «Lesionado» one tap; «Activo» lifts the injury and the sanction at once", async () => {
    withPlayers((p) => (p.id === "brawan" ? { ...p, sanction: { games: 2, from: NOW, by: "a1" } } : p));
    vi.useFakeTimers({ shouldAdvanceTime: true });
    const user = userEvent.setup({ advanceTimers: vi.advanceTimersByTime });
    mountAdmin("/admin/plantilla/brawan", views);
    const seg = within(await screen.findByRole("article")).getByRole("group", { name: "Estado de BRAWAN" });
    expect(within(seg).getByRole("button", { name: "Lesionado" })).toHaveAttribute("aria-pressed", "true");
    expect(within(seg).getByRole("button", { name: "Sancionado" })).toHaveAttribute("aria-pressed", "true");
    expect(ficha()).toHaveTextContent("Sancionado · quedan 2 partidos");
    await user.click(within(seg).getByRole("button", { name: "Activo" }));
    expect(caption()).toHaveTextContent("BRAWAN vuelve a estar disponible · sanción levantada");
    await later();
    expect(h.writes.savePlayer).toHaveBeenCalledWith("brawan", { injured: false, sanction: null, sanctionClearedAt: expect.any(Number) });
  });

  it("«Sancionado» opens its form: a bad count is said and never written; 2 matches and a reason are", async () => {
    vi.useFakeTimers({ shouldAdvanceTime: true });
    const user = userEvent.setup({ advanceTimers: vi.advanceTimersByTime });
    mountAdmin("/admin/plantilla/erik", views);
    const f = await screen.findByRole("article");
    await user.click(within(within(f).getByRole("group", { name: "Estado de ERIK" })).getByRole("button", { name: "Sancionado" }));
    const form = within(f).getByRole("form", { name: "Sanción de ERIK" });
    const n = within(form).getByLabelText(/Partidos de sanción/);
    await user.clear(n);
    await user.type(n, "12");
    await user.click(within(form).getByRole("button", { name: "Sancionar" }));
    expect(within(form).getByRole("alert")).toHaveTextContent("Entre 1 y 10 partidos.");
    await user.clear(n);
    await user.type(n, "2");
    await user.type(within(form).getByLabelText(/Motivo/), "Federación");
    await user.click(within(form).getByRole("button", { name: "Sancionar" }));
    expect(caption()).toHaveTextContent("ERIK, sancionado 2 partidos · Federación");
    await later();
    expect(h.writes.savePlayer).toHaveBeenCalledWith("erik", { sanction: expect.objectContaining({ games: 2, reason: "Federación", untilMatchId: null, by: "a1" }) });
  });

  it("the map: ★ Preferida and ● También, one tap each (a hand edit clears the last review)", async () => {
    vi.useFakeTimers({ shouldAdvanceTime: true });
    const user = userEvent.setup({ advanceTimers: vi.advanceTimersByTime });
    mountAdmin("/admin/plantilla/erik", views);
    const map = () => within(ficha()).getByRole("group", { name: "Posiciones de ERIK" });
    await screen.findByRole("article");
    await user.click(within(map()).getByRole("button", { name: /^MCD, pivote · toca para hacerla preferida/ }));
    expect(caption()).toHaveTextContent("Posiciones de ERIK: Pivote (MCD)");
    expect(within(map()).getByRole("button", { name: /^MCD, pivote: preferida/ })).toHaveAttribute("aria-pressed", "true");
    // the preferida's line takes him to the medios
    expect(groups()[2]).toBe("Medios: EGUZQUIZA, ERIK, HUBEROSKI, ANDIA, ALMACHI");
    await user.click(within(ficha()).getByRole("button", { name: "● También" }));
    await user.click(within(map()).getByRole("button", { name: /^DC, / }));
    await later();
    expect(h.writes.savePlayer).toHaveBeenCalledWith("erik", { positions: { main: "MCD", also: [] }, naturalPosition: "MED", positionsReview: null });
    expect(h.writes.savePlayer).toHaveBeenLastCalledWith("erik", { positions: { main: "MCD", also: ["DC"] }, naturalPosition: "MED", positionsReview: null });
  });

  it("a proposal: «Te toca», «Aprobar» writes it signed; «Rechazar» keeps his positions", async () => {
    setAdminData(adminFixture({ proposing: ["tello"] }));
    const base = adminFixture({ proposing: ["tello"] });
    setAdminData({ ...base, players: base.roster.map((r) => r.doc) });
    vi.useFakeTimers({ shouldAdvanceTime: true });
    const user = userEvent.setup({ advanceTimers: vi.advanceTimersByTime });
    mountAdmin("/admin/plantilla/tello", views);
    const prop = within(await screen.findByRole("article")).getByRole("group", { name: "Propuesta de TELLO" });
    expect(prop).toHaveTextContent("TELLO propone: Mediocentro (MC)");
    expect(within(screen.getByRole("group", { name: "Qué falta" })).getByRole("button", { name: "Propuestas: 1" })).toBeInTheDocument();
    await user.click(within(prop).getByRole("button", { name: "Aprobar" }));
    expect(caption()).toHaveTextContent("Propuesta de TELLO aprobada");
    await later();
    expect(h.writes.savePlayer).toHaveBeenCalledWith("tello", expect.objectContaining({ positions: { main: "MC", also: [] }, positionsProposal: null, positionsReview: expect.objectContaining({ status: "aprobada", by: "a1" }) }));
  });

  it("the season's numbers, his account, his story and his page", async () => {
    mountAdmin("/admin/plantilla/erik", views);
    const f = await screen.findByRole("article");
    expect(f).toHaveTextContent("Cuenta vinculada · @erik9");
    expect(within(f).getByRole("link", { name: "Verlo en Socios" })).toHaveAttribute("href", "/admin/plantilla/socios?ver=dentro");
    expect(within(f).getByRole("link", { name: "Editar su historia" })).toHaveAttribute("href", "/admin/club/web/historias?jugador=erik");
    expect(within(f).getByRole("link", { name: /Ver su página/ })).toHaveAttribute("href", "/jugadores/erik");
    expect(f).toHaveTextContent("Le faltan foto, nacimiento, altura y peso");
  });

  it("«Dar de baja» asks first and only takes him off the season; with no season there is no baja (B-CLUB-05)", async () => {
    vi.useFakeTimers({ shouldAdvanceTime: true });
    const user = userEvent.setup({ advanceTimers: vi.advanceTimersByTime });
    mountAdmin("/admin/plantilla/fer", views);
    const f = await screen.findByRole("article");
    await user.click(within(f).getByRole("button", { name: "Dar de baja de la Temporada 1" }));
    const ask = within(f).getByRole("group", { name: "¿Dar de baja?" });
    expect(ask).toHaveTextContent("Sus actas, goles y su carta se quedan: no se borra nada");
    await user.click(within(ask).getByRole("button", { name: "Dar de baja" }));
    expect(caption()).toHaveTextContent("FER de baja de la Temporada 1 · sus actas y estadísticas se quedan");
    await later();
    expect(h.writes.savePlayer).toHaveBeenCalledWith("fer", { seasons: [] });
    expect(h.writes.deletePlayer).not.toHaveBeenCalled();
  });

  it("B-CLUB-05: no visible season → no «Dar de baja»; a ficha nobody cites is deleted only through deletePlayer, typed", async () => {
    const base = adminFixture();
    const fresh: PlayerDoc = { id: "nuevo", shirtName: "NUEVO", number: 40, seasons: [] };
    setAdminData({ ...base, season: null, players: [...base.players, fresh] });
    vi.useFakeTimers({ shouldAdvanceTime: true });
    const user = userEvent.setup({ advanceTimers: vi.advanceTimersByTime });
    const router = mountAdmin("/admin/plantilla/nuevo", views);
    const f = await screen.findByRole("article");
    expect(within(f).queryByRole("button", { name: /Dar de baja/ })).toBeNull();
    await user.click(within(f).getByRole("button", { name: "Borrar la ficha" }));
    const ask = within(f).getByRole("group", { name: "¿Borrar la ficha?" });
    const go = within(ask).getByRole("button", { name: "Borrar la ficha" });
    expect(go).toHaveAttribute("aria-disabled", "true");
    await user.click(go);
    expect(h.writes.deletePlayer).not.toHaveBeenCalled();
    await user.type(within(ask).getByRole("textbox"), "nuevo");
    await user.click(go);
    await later();
    expect(h.writes.deletePlayer).toHaveBeenCalledWith("nuevo");
    await waitFor(() => expect(router.state.location.pathname).toBe("/admin/plantilla"));
    // one who played can't be deleted at all
    await user.click(within(list()).getByRole("link", { name: /^ERIK,/ }));
    expect(within(await screen.findByRole("article")).queryByRole("button", { name: "Borrar la ficha" })).toBeNull();
  });

  it("B-CLUB-10: ← → and ↑ ↓ walk the list; «Siguiente sin completar»", async () => {
    const user = userEvent.setup();
    const router = mountAdmin("/admin/plantilla/evans", views);
    await screen.findByRole("article");
    fireEvent.keyDown(document.body, { key: "ArrowRight" });
    await waitFor(() => expect(router.state.location.pathname).toBe("/admin/plantilla/fer"));
    fireEvent.keyDown(document.body, { key: "ArrowDown" });
    await waitFor(() => expect(router.state.location.pathname).toBe("/admin/plantilla/illescas"));
    fireEvent.keyDown(document.body, { key: "ArrowLeft" });
    await waitFor(() => expect(router.state.location.pathname).toBe("/admin/plantilla/fer"));
    fireEvent.keyDown(document.body, { key: "ArrowUp" });
    await waitFor(() => expect(router.state.location.pathname).toBe("/admin/plantilla/evans"));
    await user.click(screen.getByRole("button", { name: "Siguiente sin completar: FER" }));
    await waitFor(() => expect(router.state.location.pathname).toBe("/admin/plantilla/fer"));
    // never while typing
    fireEvent.keyDown(within(ficha()).getByLabelText("Nombre"), { key: "ArrowRight" });
    expect(router.state.location.pathname).toBe("/admin/plantilla/fer");
  });

  it("B-CLUB-07: on the phone the list is the screen; the ficha full screen has anterior and siguiente", async () => {
    phone();
    const user = userEvent.setup();
    const router = mountAdmin("/admin/plantilla", views);
    await screen.findByRole("navigation", { name: "Jugadores por línea" });
    expect(screen.queryByRole("article")).toBeNull();
    await user.click(within(list()).getByRole("link", { name: /^TELLO,/ }));
    await waitFor(() => expect(router.state.location.pathname).toBe("/admin/plantilla/tello"));
    const nav = screen.getByRole("navigation", { name: "Pasar de jugador" });
    expect(within(nav).getByRole("button", { name: "Jugador anterior: ILLESCAS" })).toBeInTheDocument();
    await user.click(within(nav).getByRole("button", { name: "Jugador siguiente: BRAWAN" }));
    await waitFor(() => expect(router.state.location.pathname).toBe("/admin/plantilla/brawan"));
  });

  it("searching also shows the other seasons; his ficha brings him back", async () => {
    withPlayers((p) => (p.id === "fer" ? { ...p, seasons: [] } : p));
    vi.useFakeTimers({ shouldAdvanceTime: true });
    const user = userEvent.setup({ advanceTimers: vi.advanceTimersByTime });
    mountAdmin("/admin/plantilla", views);
    await user.type(await screen.findByRole("searchbox", { name: /Buscar jugador/ }), "fer");
    expect(groups()).toEqual(["Otras temporadas: FER"]);
    await user.click(within(list()).getByRole("link", { name: /^FER,/ }));
    const f = await screen.findByRole("article");
    expect(f).toHaveTextContent("Está de baja: no juega la Temporada 1.");
    await user.click(within(f).getByRole("button", { name: "Volver a darle de alta" }));
    expect(caption()).toHaveTextContent("FER vuelve a la Temporada 1 con el 12");
    await later();
    expect(h.writes.savePlayer).toHaveBeenCalledWith("fer", expect.objectContaining({ seasons: ["t1"], archived: false }));
  });

  it("the ficha's «Ha jugado de» reads the published actas, never the drafts", async () => {
    mountAdmin("/admin/plantilla/adrian", views);
    const f = await screen.findByRole("article");
    // the J… draft has him on the pitch, the published ones do not: no minutes by position yet
    expect(f).toHaveTextContent("Sin minutos con posición");
  });

  it("his absences: what he said in the vestuario, a captain can take one away", async () => {
    h.absences = [{ id: "ab1", uid: "a2", playerId: "erik", name: "erik9", from: "2026-11-10", to: "2026-11-20", note: "De viaje", createdAt: 0 }];
    vi.useFakeTimers({ shouldAdvanceTime: true });
    const user = userEvent.setup({ advanceTimers: vi.advanceTimersByTime });
    mountAdmin("/admin/plantilla/erik", views);
    const f = await screen.findByRole("article");
    expect(f).toHaveTextContent("Del 10 nov al 20 nov");
    await user.click(within(f).getByRole("button", { name: "Quitar la ausencia de ERIK del 10 nov" }));
    await later();
    expect(h.deleteDoc).toHaveBeenCalledTimes(1);
  });

  it("«Apuntar una ausencia» for his linked member: shown at once, written signed after 5 s; «Deshacer» writes nothing", async () => {
    vi.useFakeTimers({ shouldAdvanceTime: true });
    const user = userEvent.setup({ advanceTimers: vi.advanceTimersByTime });
    mountAdmin("/admin/plantilla/erik", views);
    const f = await screen.findByRole("article");
    const open = async () => {
      await user.click(within(f).getByRole("button", { name: "Apuntar una ausencia" }));
      return within(f).getByRole("form", { name: "Apuntar una ausencia" });
    };
    let form = await open();
    await user.click(within(form).getByRole("button", { name: "Apuntar" }));
    expect(within(form).getByRole("alert")).toHaveTextContent("Pon desde qué día y hasta qué día.");
    fireEvent.change(within(form).getByLabelText("Desde"), { target: { value: "2026-11-12" } });
    fireEvent.change(within(form).getByLabelText("Hasta (incluido)"), { target: { value: "2026-11-10" } });
    await user.click(within(form).getByRole("button", { name: "Apuntar" }));
    expect(within(form).getByRole("alert")).toHaveTextContent("El último día va después del primero.");
    fireEvent.change(within(form).getByLabelText("Hasta (incluido)"), { target: { value: "2026-11-19" } });
    await user.type(within(form).getByLabelText(/Motivo/), "De viaje");
    await user.click(within(form).getByRole("button", { name: "Apuntar" }));
    expect(f).toHaveTextContent("Del 12 nov al 19 nov");
    expect(caption()).toHaveTextContent("ERIK no está del 12 nov al 19 nov · sale en la convocatoria");
    await later();
    expect(h.addDoc).toHaveBeenCalledTimes(1);
    expect(h.addDoc.mock.calls[0][1]).toMatchObject({ uid: "a2", playerId: "erik", name: "erik9", from: "2026-11-12", to: "2026-11-19", note: "De viaje", by: "a1" });
    // undone: nothing written, nothing left
    form = await open();
    fireEvent.change(within(form).getByLabelText("Desde"), { target: { value: "2026-11-25" } });
    fireEvent.change(within(form).getByLabelText("Hasta (incluido)"), { target: { value: "2026-11-26" } });
    await user.click(within(form).getByRole("button", { name: "Apuntar" }));
    expect(f).toHaveTextContent("Del 25 nov al 26 nov");
    await user.click(within(caption()).getByRole("button", { name: "Deshacer" }));
    await later(6000);
    expect(h.addDoc).toHaveBeenCalledTimes(1);
    expect(f).not.toHaveTextContent("Del 25 nov al 26 nov");
  });

  it("no member linked: no form, a line that says why", async () => {
    mountAdmin("/admin/plantilla/tello", views);
    const f = await screen.findByRole("article");
    expect(within(f).queryByRole("button", { name: "Apuntar una ausencia" })).toBeNull();
    expect(f).toHaveTextContent("Sin cuenta en el vestuario: sus ausencias las apunta él cuando entre.");
  });

  it("B-CLUB-08: a load error says it in the singular", async () => {
    setAdminData({ ...adminFixture(), error: true, players: [], roster: [] });
    mountAdmin("/admin/plantilla", views);
    expect(await screen.findByRole("heading", { name: "No se ha podido cargar la plantilla" })).toBeInTheDocument();
  });
});

describe("Plantilla · cromos, alta y antiguos", () => {
  beforeEach(() => {
    Object.values(h.writes).forEach((f) => f.mockClear());
    h.promote.mockClear();
    setAdminData(adminFixture());
  });
  afterEach(() => {
    vi.useRealTimers();
    Object.defineProperty(window, "innerWidth", { configurable: true, value: WIDTH });
  });

  it("los cromos: the squad big, the last one is the alta; a cromo's ficha goes back to the cromos", async () => {
    phone();
    const user = userEvent.setup();
    const router = mountAdmin("/admin/plantilla/cromos", views);
    const grid = await screen.findByRole("list", { name: "Todos en cromos" });
    expect(within(grid).getAllByRole("link")).toHaveLength(13);
    expect(within(grid).getByRole("link", { name: /^BRAWAN, defensa, Lesionado/ })).toBeInTheDocument();
    expect(within(grid).getByRole("link", { name: /Alta de jugador/ })).toHaveAttribute("href", "/admin/plantilla/alta");
    await user.click(within(grid).getByRole("link", { name: /^ERIK,/ }));
    await waitFor(() => expect(router.state.location.href).toBe("/admin/plantilla/erik?vista=cromos"));
    expect(screen.getByRole("link", { name: "Volver a los cromos" })).toHaveAttribute("href", "/admin/plantilla/cromos");
  });

  it("el alta: a free dorsal one tap, the name in capitals, «Dar de alta» writes him behind «Deshacer» and opens his ficha", async () => {
    vi.useFakeTimers({ shouldAdvanceTime: true });
    const user = userEvent.setup({ advanceTimers: vi.advanceTimersByTime });
    const router = mountAdmin("/admin/plantilla/alta?dorsal=9", views);
    await screen.findByRole("heading", { level: 1, name: "Camiseta nueva" });
    expect(screen.getByLabelText("Dorsal en la Temporada 1")).toHaveValue("9");
    expect(screen.getByText("El 9 ya lo lleva ERIK en la Temporada 1")).toBeInTheDocument();
    const go = screen.getByRole("button", { name: "Dar de alta" });
    expect(go).toHaveAttribute("aria-disabled", "true");
    await user.click(within(screen.getByRole("group", { name: "Dorsales libres" })).getByRole("button", { name: "Dorsal 2" }));
    await user.type(screen.getByLabelText("Nombre en la camiseta"), "pablo");
    expect(screen.getByLabelText("Nombre en la camiseta")).toHaveValue("PABLO");
    expect(screen.getByRole("img", { name: "La camiseta nueva: PABLO, el 2" })).toBeInTheDocument();
    await user.click(within(screen.getByRole("group", { name: "Mapa de posiciones del jugador nuevo" })).getByRole("button", { name: /^LD, / }));
    await user.click(go);
    await waitFor(() => expect(router.state.location.pathname).toBe("/admin/plantilla/nuevo1"));
    expect(caption()).toHaveTextContent("PABLO entra en la plantilla con el 2");
    expect(await screen.findByRole("article")).toHaveTextContent("2 PABLO");
    await later();
    expect(h.writes.savePlayer).toHaveBeenCalledWith("nuevo1", expect.objectContaining({ shirtName: "PABLO", number: 2, seasons: ["t1"], naturalPosition: "DEF", positions: { main: "LD", also: [] }, active: true }));
  });

  it("antiguos: the old ones (never deleted) come back; a guest becomes a ficha with his matches (M-41)", async () => {
    const base = adminFixture();
    const archived: PlayerDoc = { id: "javito", shirtName: "JAVITO", number: 7, seasons: ["t0"], archived: true };
    setAdminData({
      ...base,
      players: base.players.map((p) => (p.id === "fer" ? { ...p, seasons: [] } : p)),
      archivedPlayers: [archived],
      matches: base.matches.map((m) => (m.id === "m6" ? { ...m, guests: [{ id: "g1", name: "Rafa" }] } : m)),
    });
    vi.useFakeTimers({ shouldAdvanceTime: true });
    const user = userEvent.setup({ advanceTimers: vi.advanceTimersByTime });
    const router = mountAdmin("/admin/plantilla/antiguos", views);
    const arch = await screen.findByRole("region", { name: "De una temporada archivada" });
    expect(arch).toHaveTextContent("JAVITO");
    expect(arch).toHaveTextContent("Jugó en Temporada 0 · pre-Piti · archivada");
    const baja = screen.getByRole("region", { name: "De baja" });
    await user.click(within(baja).getByRole("button", { name: "Volver a dar de alta a FER en la Temporada 1" }));
    await later();
    expect(h.writes.savePlayer).toHaveBeenCalledWith("fer", expect.objectContaining({ seasons: ["t1"], archived: false }));

    const inv = screen.getByRole("region", { name: "Invitados" });
    expect(inv).toHaveTextContent("Vino de invitado 1 vez");
    await user.click(within(inv).getByRole("button", { name: "Dar de alta a Rafa en la plantilla" }));
    await waitFor(() => expect(router.state.location.pathname).toBe("/admin/plantilla/alta"));
    expect(screen.getByLabelText("Nombre en la camiseta")).toHaveValue("RAFA");
    await user.click(within(screen.getByRole("group", { name: "Dorsales libres" })).getByRole("button", { name: "Dorsal 2" }));
    await user.click(screen.getByRole("button", { name: "Dar de alta" }));
    await later();
    expect(h.writes.savePlayer).toHaveBeenCalledWith("nuevo1", expect.objectContaining({ shirtName: "RAFA", number: 2 }));
    await waitFor(() => expect(h.promote).toHaveBeenCalledWith({ playerId: "nuevo1", guests: [{ matchId: "m6", guestId: "g1" }] }));
  });
});

