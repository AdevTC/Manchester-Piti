import { act, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { MatchEvent } from "../../../../functions/src/matchEngine";
import * as api from "../../../lib/clubApi";
import type { ClubMatch } from "../../../lib/clubData";
import { adminFixture, fixturePublished, mountAdmin, setAdminData } from "../../../test/adminKit";
import { resetWhistledForTests } from "../data/whistleStore";
import { EnJuego } from "./EnJuego";
import { Hoy } from "./Hoy";

vi.mock("../data/useAdminData", async () => ({ useAdminData: (await import("../../../test/adminMocks")).currentAdminData }));
vi.mock("../../../context/AuthContext", async () => ({ useAuth: (await import("../../../test/adminMocks")).fakeAuth }));
vi.mock("../../../lib/clubApi", () => ({
  apiError: (e: unknown) => String(e),
  setConvocatoria: vi.fn(() => Promise.resolve({ data: { at: 1, revision: 1, notice: "first" } })),
  liveEvent: vi.fn(() => Promise.resolve({ data: { events: 4 } })),
}));
const setConv = vi.mocked(api.setConvocatoria);
const live = vi.mocked(api.liveEvent);

const at = (d: number, h: number, m = 0) => Date.UTC(2026, 10, d, h - 1, m); // Madrid = UTC+1
const WIDTH = window.innerWidth;
const J8_EVENTS: MatchEvent[] = [
  { id: "live-1", type: "goal", minute: 12, playerId: "erik", assistPlayerId: "adrian" },
  { id: "live-2", type: "opponent_goal", minute: 24 },
  { id: "live-3", type: "yellow_card", minute: 27, playerId: "tello" },
];
const SEVEN = ["evans", "illescas", "tello", "eguzquiza", "huberoski", "erik", "adrian"];
/** The fixture's published matches with the J8 (m8) changed. */
const withJ8 = (j8: Partial<ClubMatch>): ClubMatch[] => fixturePublished.map((m) => (m.id === "m8" ? { ...m, ...j8 } : m));

beforeEach(() => {
  localStorage.clear();
  resetWhistledForTests();
  setConv.mockClear();
  live.mockClear();
});
afterEach(() => {
  vi.useRealTimers();
  Object.defineProperty(window, "innerWidth", { configurable: true, value: WIDTH });
});

describe("Hoy · Antes: the peg wall", () => {
  const sat = at(7, 22, 28);
  const j8 = withJ8({ starters: ["evans", "illescas", "tello", "eguzquiza", "huberoski", "erik"], bench: ["kevin", "almachi"] });

  it("the plaque, who comes, el siete with its free peg, the back rail; Por hacer beside", async () => {
    setAdminData(adminFixture({ now: sat, published: j8 }));
    mountAdmin("/admin", { hoy: Hoy });
    expect(await screen.findByRole("heading", { level: 1, name: "Hoy" })).toBeInTheDocument();
    expect(screen.getByText("Sábado 7 nov · mañana juega el Piti en el campo de MAD SKY")).toBeInTheDocument();
    const wall = screen.getByRole("region", { name: "El banquillo de la J3: el siete colgado" });
    expect(within(wall).getByText("J3 · MAD SKY")).toBeInTheDocument();
    expect(within(wall).getByText("13h 32m")).toBeInTheDocument();
    expect(wall.querySelector(".rs")).toHaveTextContent("Vienen 8Duda 2 ANDIA y ALMACHINo 1 BRAWANSin responder 1 FER");
    expect(within(wall).getByText(/El siete · 6 de 7/)).toBeInTheDocument();
    expect(within(wall).getByText("Falta 1 para el siete · ANDIA, ALMACHI en duda")).toHaveClass("warn");
    expect(within(wall).getByRole("button", { name: "Hueco libre en el siete" })).toHaveTextContent("Libre");
    expect(within(wall).getByRole("button", { name: "Colgar a KEVIN en el siete" })).toHaveTextContent("Banquillo");
    expect(within(wall).queryByRole("button", { name: "Colgar a BRAWAN en el siete" })).toBeNull();
    // gold at seven only: disabled (outline) with six
    expect(within(wall).getByRole("button", { name: "Convocar y avisar" })).toBeDisabled();
    const side = screen.getByRole("complementary", { name: /Por hacer/ });
    expect(within(side).getAllByRole("listitem").map((li) => li.querySelector("b")?.textContent)).toEqual([
      "Acta J2 · falta el goleador del gol 3",
      "2 fichas piden paso",
      "Historias de jugadores · por completar",
      "Historia del escudo · por completar",
    ]);
    // nothing scheduled after the J3 in the fixture: no «Después»
    expect(within(side).queryByText("Después")).toBeNull();
  });

  it("tap back → hangs in el siete (written at once, «Deshacer» puts it back); tap front → down to the banquillo; «Ya hay siete»", async () => {
    setAdminData(adminFixture({ now: sat, published: j8 }));
    const user = userEvent.setup();
    mountAdmin("/admin", { hoy: Hoy });
    await user.click(await screen.findByRole("button", { name: "Colgar a ADRIÁN T.C. en el siete" }));
    expect(setConv).toHaveBeenLastCalledWith({ matchId: "m8", starters: [...SEVEN.slice(0, 6), "adrian"], bench: ["kevin", "almachi"], notify: false });
    const caption = screen.getAllByRole("status").find((s) => s.classList.contains("adm-toasts"))!;
    expect(caption).toHaveTextContent("ADRIÁN T.C. al siete · la pizarra y el acta ya lo ven");
    expect(caption.querySelector(".lt .k")).toHaveTextContent("J3");
    expect(screen.getByRole("button", { name: "ADRIÁN T.C. en el siete: tocar para bajarlo al banquillo" })).toHaveClass("open");
    // «Deshacer» writes the previous lineup back
    await user.click(within(caption).getByRole("button", { name: "Deshacer" }));
    await waitFor(() => expect(setConv).toHaveBeenLastCalledWith({ matchId: "m8", starters: SEVEN.slice(0, 6), bench: ["kevin", "almachi"], notify: false }));
    expect(await screen.findByRole("button", { name: "Colgar a ADRIÁN T.C. en el siete" })).toBeInTheDocument();
    await user.click(screen.getByRole("button", { name: "Colgar a ADRIÁN T.C. en el siete" }));
    setConv.mockClear();
    // seven: «Ya hay siete»
    await user.click(screen.getByRole("button", { name: "Colgar a KEVIN en el siete" }));
    expect(caption).toHaveTextContent("Ya hay siete: baja uno al banquillo antes");
    expect(setConv).not.toHaveBeenCalled();
    await user.click(screen.getByRole("button", { name: "Colgar a ANDIA en el siete" }));
    await user.click(screen.getByRole("button", { name: "EVANS en el siete: tocar para bajarlo al banquillo" }));
    await waitFor(() => expect(setConv).toHaveBeenLastCalledWith({ matchId: "m8", starters: ["illescas", "tello", "eguzquiza", "huberoski", "erik", "adrian"], bench: ["kevin", "almachi", "evans"], notify: false }));
    expect(screen.getByRole("button", { name: "Colgar a EVANS en el siete" })).toHaveTextContent("Banquillo");
  });

  it("«Convocar y avisar» at seven: the caption with «Deshacer» first, the notice after its 5.2 s (Deshacer = no notice)", async () => {
    vi.useFakeTimers({ shouldAdvanceTime: true });
    setAdminData(adminFixture({ now: sat, published: withJ8({ starters: SEVEN, bench: ["kevin", "almachi"] }) }));
    const user = userEvent.setup({ advanceTimers: vi.advanceTimersByTime });
    mountAdmin("/admin", { hoy: Hoy });
    const btn = await screen.findByRole("button", { name: "Convocar y avisar" });
    expect(btn).toBeEnabled();
    expect(btn).toHaveClass("gold");
    await user.click(btn);
    expect(screen.getByText("Convocatoria J3 publicada · avisamos a los 9 convocados")).toBeInTheDocument();
    expect(screen.getByText("Convocatoria publicada")).toHaveClass("okk");
    await user.click(screen.getByRole("button", { name: "Deshacer" }));
    await act(async () => {
      vi.advanceTimersByTime(6000);
    });
    expect(setConv).not.toHaveBeenCalled();
    expect(screen.getByRole("button", { name: "Convocar y avisar" })).toBeEnabled();
    await user.click(screen.getByRole("button", { name: "Convocar y avisar" }));
    await act(async () => {
      vi.advanceTimersByTime(5300);
    });
    expect(setConv).toHaveBeenCalledWith({ matchId: "m8", starters: SEVEN, bench: ["kevin", "almachi"], notify: true });
  });

  it("phones: the plaque, the short rail, the chips and the gold button in one column", async () => {
    Object.defineProperty(window, "innerWidth", { configurable: true, value: 390 });
    setAdminData(adminFixture({ now: sat, published: j8 }));
    mountAdmin("/admin", { hoy: Hoy });
    const wall = await screen.findByRole("region", { name: "El siete de la J3" });
    expect(wall.querySelector(".mplq")).toHaveTextContent("J3 · MAD SKYdom 8 nov · 12:00 · fuera · 2ªFALTAN13h 32m");
    expect(within(wall).getByRole("button", { name: "EGUZQUIZA en el siete: tocar para bajarlo al banquillo" })).toHaveTextContent("EGUZQ.");
    expect(within(wall).getByRole("button", { name: "Convocar y avisar" })).toHaveClass("xl");
    expect(within(wall).getByRole("button", { name: "Abrir Convocar" })).toBeInTheDocument();
  });
});

describe("Hoy · En juego: the LED and the pads", () => {
  const sun = at(8, 12, 31);
  const j8 = withJ8({ starters: SEVEN, bench: ["kevin", "almachi"], events: J8_EVENTS });

  it("the live score, the log, GOL → ¿Quién marcó? → pase → liveEvent and the «GOOOL» flash", async () => {
    setAdminData(adminFixture({ now: sun, published: j8 }));
    const user = userEvent.setup();
    mountAdmin("/admin", { hoy: Hoy });
    const hero = await screen.findByRole("region", { name: "El marcador de la J3 en juego" });
    expect(within(hero).getByLabelText("PITI 1, MAD SKY 1")).toHaveTextContent("1-1");
    expect(hero).toHaveTextContent("EN JUEGO");
    expect(within(hero).getByRole("list", { name: "Lo que va pasando" }).textContent).toContain("Amarilla a TELLO");
    await user.click(within(hero).getByRole("button", { name: "GOL" }));
    const pick = screen.getByRole("dialog", { name: "¿Quién marcó?" });
    expect(pick).toHaveClass("lpk");
    expect(pick).toHaveTextContent("Banquillo");
    await user.click(within(pick).getByRole("button", { name: "Marcó ERIK" }));
    const pase = screen.getByRole("dialog", { name: "¿Quién le dio el pase?" });
    await user.click(within(pase).getByRole("button", { name: "Pase de ADRIÁN T.C." }));
    expect(live).toHaveBeenCalledWith({ action: "add", matchId: "m8", event: { type: "goal", minute: 32, playerId: "erik", assistPlayerId: "adrian" } });
    expect(await screen.findByText("GOOOL")).toBeInTheDocument();
    expect(screen.getByText("ERIK · 32′ · pase de ADRIÁN T.C.")).toBeInTheDocument();
    expect(screen.queryByRole("dialog")).toBeNull();
  });

  it("Gol rival goes at once (with «Deshacer» = undo the last live event); Tarjeta and Cambio ask first", async () => {
    setAdminData(adminFixture({ now: sun, published: j8 }));
    const user = userEvent.setup();
    mountAdmin("/admin", { hoy: Hoy });
    await user.click(await screen.findByRole("button", { name: "Gol rival" }));
    expect(live).toHaveBeenLastCalledWith({ action: "add", matchId: "m8", event: { type: "opponent_goal", minute: 32 } });
    await user.click(await screen.findByRole("button", { name: "Deshacer" }));
    expect(live).toHaveBeenLastCalledWith({ action: "undo", matchId: "m8" });
    await user.click(screen.getByRole("button", { name: "Tarjeta" }));
    await user.click(within(screen.getByRole("dialog", { name: "¿Qué tarjeta?" })).getByRole("button", { name: "Amarilla" }));
    await user.click(within(screen.getByRole("dialog", { name: "¿A quién?" })).getByRole("button", { name: "Amarilla a EVANS" }));
    expect(live).toHaveBeenLastCalledWith({ action: "add", matchId: "m8", event: { type: "yellow_card", minute: 32, playerId: "evans" } });
    expect(await screen.findByText("Amarilla a EVANS · 32′")).toBeInTheDocument();
    await user.click(screen.getByRole("button", { name: "Cambio" }));
    await user.click(within(screen.getByRole("dialog", { name: "¿Quién sale?" })).getByRole("button", { name: "Sale TELLO" }));
    await user.click(within(screen.getByRole("dialog", { name: "¿Quién entra?" })).getByRole("button", { name: "Entra KEVIN" }));
    expect(live).toHaveBeenLastCalledWith({ action: "add", matchId: "m8", event: { type: "substitution", minute: 32, playerId: "tello", inPlayerId: "kevin" } });
  });

  it("«Pitar el final» leaves «En juego» on this device (with «Deshacer»)", async () => {
    setAdminData(adminFixture({ now: sun, published: j8 }));
    const user = userEvent.setup();
    mountAdmin("/admin", { hoy: Hoy });
    await user.click(await screen.findByRole("button", { name: "Pitar el final y repasar el acta" }));
    expect(screen.getByText("Final pitado · 1–1 · repasa el acta y publícala")).toBeInTheDocument();
    expect(JSON.parse(localStorage.getItem("mp.admin.whistled.v1") ?? "{}")).toHaveProperty("m8");
    await user.click(screen.getByRole("button", { name: "Deshacer" }));
    expect(JSON.parse(localStorage.getItem("mp.admin.whistled.v1") ?? "{}")).not.toHaveProperty("m8");
  });

  it("phones: the LED and «Entrar en «En juego»» → the En juego view (pads + sheet picker)", async () => {
    Object.defineProperty(window, "innerWidth", { configurable: true, value: 390 });
    setAdminData(adminFixture({ now: sun, published: j8 }));
    const user = userEvent.setup();
    const router = mountAdmin("/admin", { hoy: Hoy, enjuego: EnJuego });
    await user.click(await screen.findByRole("button", { name: "Entrar en «En juego»" }));
    await waitFor(() => expect(router.state.location.pathname).toBe("/admin/en-juego/m8"));
    expect(await screen.findByText("EN JUEGO")).toHaveClass("tally");
    await user.click(screen.getByRole("button", { name: "GOL" }));
    const sheet = screen.getByRole("dialog", { name: "¿Quién marcó?" });
    expect(sheet).toHaveClass("sheet");
    await user.click(within(sheet).getByRole("button", { name: "Lo completo luego" }));
    expect(live).toHaveBeenLastCalledWith({ action: "add", matchId: "m8", event: { type: "goal", minute: 32 } });
  });
});

describe("Hoy · Después", () => {
  it("FINAL · SIN PUBLICAR, the whole log and «Apunta el resultado» → the acta", async () => {
    setAdminData(adminFixture({ now: at(8, 14), published: withJ8({ starters: SEVEN, bench: ["kevin"], events: [...J8_EVENTS, { id: "live-4", type: "goal", minute: 38, playerId: "adrian", assistPlayerId: "huberoski" }] }) }));
    const user = userEvent.setup();
    const router = mountAdmin("/admin", { hoy: Hoy });
    const hero = await screen.findByRole("region", { name: "El marcador de la J3: final" });
    expect(within(hero).getByText("FINAL · SIN PUBLICAR")).toHaveClass("gd");
    expect(hero).toHaveTextContent("Pitado el final");
    expect(within(hero).getByRole("img", { name: "Victoria" })).toHaveTextContent("V");
    expect(hero).toHaveTextContent("2–1 en el campo de MAD SKY");
    expect(within(hero).getByRole("list", { name: "Lo que pasó" }).children).toHaveLength(4);
    await user.click(within(hero).getByRole("button", { name: "Apunta el resultado" }));
    await waitFor(() => expect(router.state.location.pathname).toBe("/admin/partidos/m8"));
    expect(router.state.location.search).toMatchObject({ tab: "acta" });
  });

  it("published: FINAL + «Ver la vitrina»", async () => {
    setAdminData(adminFixture({ now: at(8, 14), published: withJ8({ status: "finished", goalsFor: 2, goalsAgainst: 1, starters: SEVEN, bench: [], events: J8_EVENTS }) }));
    const user = userEvent.setup();
    const router = mountAdmin("/admin", { hoy: Hoy });
    expect(await screen.findByText("Acta publicada · la web ya lo cuenta")).toBeInTheDocument();
    await user.click(screen.getByRole("button", { name: "Ver la vitrina" }));
    await waitFor(() => expect(router.state.location.pathname).toBe("/admin/partidos/m8"));
    expect(router.state.location.search).toMatchObject({ vitrina: true });
  });

  it("no match at all: the empty shirt and «Nuevo partido»; «N hechas» unfolds", async () => {
    setAdminData(adminFixture({ now: at(25, 10), published: [] }));
    const user = userEvent.setup();
    const router = mountAdmin("/admin", { hoy: Hoy });
    expect(await screen.findByText("Sin partidos a la vista")).toBeInTheDocument();
    expect(screen.getByText(/no hay partidos a la vista/)).toBeInTheDocument();
    const done = screen.getByRole("button", { name: /hecha/ });
    expect(done).toHaveAttribute("aria-expanded", "false");
    await user.click(done);
    expect(done).toHaveAttribute("aria-expanded", "true");
    expect(screen.getByText(/MVP J1 cerrado · ganó ERIK/)).toBeInTheDocument();
    await user.click(screen.getByRole("button", { name: "Nuevo partido" }));
    await waitFor(() => expect(router.state.location.pathname).toBe("/admin/partidos"));
    expect(router.state.location.search).toMatchObject({ nuevo: true });
  });
});
