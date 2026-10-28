// HOY Y PARTIDOS · the screens in the real sala (mountAdmin): Hoy, la temporada, Nuevo partido, Archivados and the
// stations Convocatoria, Datos and La mesa, with the fixture club and no Firestore (the shared listeners mocked).
import { act, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import * as api from "../../../../lib/clubApi";
import type { ClubMatch } from "../../../../lib/clubData";
import { adminFixture, fixtureAnswers, fixturePublished, mountAdmin, NOW, setAdminData } from "../../../../test/adminKit";
import type { ArchivedMatch } from "../../data/archivedMatches";
import { resetConvocatorias } from "../../data/useConvocatoria";
import { resetWhistledForTests } from "../../data/whistleStore";
import { ConvocatoriaScreen, HoyScreen, TemporadaScreen } from "./screens";
import { resetListUi } from "./listUi";

vi.mock("../../data/useAdminData", async () => ({ useAdminData: (await import("../../../../test/adminMocks")).currentAdminData }));
vi.mock("../../../../context/AuthContext", async () => ({ useAuth: (await import("../../../../test/adminMocks")).fakeAuth }));
vi.mock("../../../../lib/clubApi", () => ({
  apiError: (e: unknown) => (e instanceof Error ? e.message : String(e)),
  setConvocatoria: vi.fn((o: { notify: boolean }) => Promise.resolve({ data: { at: Date.now(), revision: 1, notice: o.notify ? "first" : null } })),
  saveMatchSheet: vi.fn(() => Promise.resolve({ data: { id: "x" } })),
  deleteMatch: vi.fn(() => Promise.resolve({ data: { ok: true } })),
  setMatchArchived: vi.fn(() => Promise.resolve({ data: { ok: true } })),
  remindNow: vi.fn(() => Promise.resolve({ data: { sent: 1, missing: 2 } })),
  setMatchScorers: vi.fn(() => Promise.resolve({ data: { ok: true } })),
  discardMatchDraft: vi.fn(() => Promise.resolve({ data: { ok: true } })),
}));
const answers = vi.hoisted(() => ({ m8: [] as unknown[] }));
vi.mock("../../convocar/live", () => ({ useMatchAnswers: (id: string | undefined) => ({ data: id === "m8" ? answers.m8 : [], loading: false }), useTeamAbsences: () => [] }));
vi.mock("../../convocar/reminders", () => ({ useReminders: () => ({ auto: true, loading: false, set: vi.fn(() => Promise.resolve()) }) }));
vi.mock("../../../../lib/useRotaTurns", () => ({ useMatchTurns: () => ({ turns: [], rota: null, pins: {}, loading: false, error: false }) }));
vi.mock("../../data/useCaja", () => ({ useCajaClaims: () => ({ data: [], loading: false, error: false }) }));
vi.mock("../../../vestuario/live", async (orig) => ({
  ...(await orig<typeof import("../../../vestuario/live")>()),
  useDoorRequests: () => ({ data: [], loading: false, error: false }),
  useOpenTrainings: () => ({ data: [], loading: false, error: false }),
  useMatchScorers: () => ({ data: [], loading: false, error: false }),
  useLiveDoc: <T,>(_p: string | null, _k: string, _m: unknown, empty: T) => ({ data: empty, loading: false, error: false }),
}));
vi.mock("../../partidos/live", () => ({ useMatchNote: () => ({ data: "", loading: false }), useMatchRsvp: () => ({ data: [], loading: false }), useMatchMvp: () => undefined }));
vi.mock("../../../../components/jersey3d/useShirtStills", () => ({ useShirtStills: () => () => undefined }));
vi.mock("../../../../lib/weather", () => ({ useMatchWeather: () => null }));
vi.mock("../../../../lib/clubContent", () => ({ useClubContent: () => ({ venues: [{ name: "CDM Palomeras", address: "Calle de la Arboleda, Madrid" }] }) }));

const setConv = vi.mocked(api.setConvocatoria);
const save = vi.mocked(api.saveMatchSheet);
const D = 86_400_000;
const WIDTH = window.innerWidth;
const SIX = ["evans", "illescas", "tello", "eguzquiza", "huberoski", "erik"];
const withJ8 = (j8: Partial<ClubMatch>): ClubMatch[] => fixturePublished.map((m) => (m.id === "m8" ? { ...m, ...j8 } : m));
const Real = HoyScreen;

beforeEach(() => {
  answers.m8 = fixtureAnswers;
  localStorage.clear();
  resetWhistledForTests();
  resetConvocatorias();
  resetListUi();
  vi.clearAllMocks();
});
afterEach(() => {
  vi.useRealTimers();
  Object.defineProperty(window, "innerWidth", { configurable: true, value: WIDTH });
});

describe("Hoy", () => {
  it("just played: the hero says the acta is missing a scorer, its carril, and Te toca one action per row", async () => {
    setAdminData(adminFixture());
    mountAdmin("/admin", { hoy: Real });
    const hero = await screen.findByRole("region", { name: "J2 · FUSION 7" });
    expect(within(hero).getByText("Recién pitado")).toBeInTheDocument();
    expect(within(hero).getByText(/Falta el goleador de 1 gol: sin él no se publica/)).toBeInTheDocument();
    expect(within(hero).getByRole("link", { name: /^4 de 6 · Acta: Falta 1 goleador · te toca$/ })).toHaveAttribute("href", "/admin/partidos/m7/acta");
    // the score is said whole, the letter too (B-HOY-10)
    expect(within(hero).getAllByText(/^Manchester Piti 3, FUSION 7 1 · /).length).toBeGreaterThan(0);
    expect(screen.getAllByRole("button", { name: "Completar el acta de la J2" }).length).toBeGreaterThan(0);
    const toca = screen.getByRole("region", { name: "Te toca" });
    expect(within(toca).getByRole("link", { name: "Revisar: @nuevo.socio pide la camiseta de KEVIN" })).toHaveAttribute("href", "/admin/plantilla/socios?ver=fichas");
  });

  it("the next match: who answered with their shirts (their answer in words, B-HOY-06), el siete and the way to the convocatoria", async () => {
    setAdminData(adminFixture({ now: NOW + 2 * D, published: withJ8({ starters: SIX, bench: ["kevin", "almachi"] }) }));
    mountAdmin("/admin", { hoy: Real });
    const hero = await screen.findByRole("region", { name: "J3 · MAD SKY" });
    expect(within(hero).getByText("El próximo partido")).toBeInTheDocument();
    const ans = within(hero).getByRole("list", { name: "Respuestas a la convocatoria" });
    expect(within(ans).getByRole("img", { name: "ALMACHI, en duda" })).toBeInTheDocument();
    expect(within(ans).getByRole("img", { name: "FER, sin responder" })).toBeInTheDocument();
    expect(within(hero).getByRole("list", { name: "El siete: 6 de 7" })).toHaveTextContent("Libre");
    expect(within(hero).getByRole("link", { name: "Mandar la convocatoria" })).toHaveAttribute("href", "/admin/partidos/m8/convocatoria");
    // the J2's acta (played, unpublished) is in Te toca
    expect(within(screen.getByRole("region", { name: "Te toca" })).getByText("Acta J2 · falta 1 goleador")).toBeInTheDocument();
  });

  it("B-HOY-11: a match that never reached la mesa: «¿Se jugó?» with its three ways, no score", async () => {
    const pend = fixturePublished.filter((m) => m.id !== "m7").concat({ id: "m5", seasonId: "t1", rival: "Pitutis", date: NOW - 20 * 3_600_000, status: "scheduled", home: true });
    setAdminData(adminFixture({ published: pend, now: NOW }));
    mountAdmin("/admin", { hoy: Real });
    const toca = await screen.findByRole("region", { name: "Te toca" });
    const row = within(toca).getByText(/Pitutis no llegó a la mesa/).closest("li")!;
    expect(row).not.toHaveTextContent(/0–0/);
    expect(within(row).getByRole("link", { name: "Aplazado" })).toHaveAttribute("href", "/admin/partidos/m5/datos?estado=aplazado");
    expect(within(row).getByRole("link", { name: "No se jugó" })).toHaveAttribute("href", "/admin/partidos/m5/datos?estado=cancelado");
  });
});

describe("Partidos · la temporada", () => {
  it("the table with the carril in every row; the filters and the search (J2, a rival)", async () => {
    setAdminData(adminFixture());
    const user = userEvent.setup();
    mountAdmin("/admin/partidos", { partidos: TemporadaScreen });
    const rows = await screen.findByRole("list", { name: /^Partidos de la Temporada 1/ });
    expect(within(rows).getAllByRole("listitem")).toHaveLength(3);
    expect(within(rows).getByRole("link", { name: /^J2, FUSION 7, .*Acta: Falta 1 goleador.*te toca$/ })).toHaveAttribute("href", "/admin/partidos/m7");
    await user.click(screen.getByRole("tab", { name: /^Jugados/ }));
    expect(within(rows).getAllByRole("listitem")).toHaveLength(2);
    await user.click(screen.getByRole("tab", { name: /^Todo/ }));
    await user.type(screen.getByRole("searchbox", { name: "Buscar partido" }), "j3");
    expect(within(rows).getAllByRole("listitem")).toHaveLength(1);
    expect(within(rows).getByRole("link")).toHaveAccessibleName(/MAD SKY/);
  });

  it("B-PAR-03: a cancelled draft is «Borrador cancelado» and out («Fuera»), never among the played", async () => {
    const data = adminFixture();
    const cancelled = { ...data.matches[0], id: "c1", rival: "Rayo", status: "cancelled" as const, published: false, draft: true, jornada: null, date: NOW + 3 * D, goalsFor: undefined, goalsAgainst: undefined, events: [] };
    setAdminData({ ...data, matches: [...data.matches, cancelled] });
    const user = userEvent.setup();
    mountAdmin("/admin/partidos", { partidos: TemporadaScreen });
    await user.click(await screen.findByRole("tab", { name: /^Fuera/ }));
    const rows = screen.getByRole("list", { name: /^Partidos de la Temporada 1/ });
    expect(within(rows).getByRole("link")).toHaveAccessibleName(/Rayo.*Borrador cancelado/);
    await user.click(screen.getByRole("tab", { name: /^Jugados/ }));
    expect(within(rows).queryByText("Rayo")).toBeNull();
  });

  it("`n` opens «Nuevo partido» when no field has the focus; typing an «n» in the search does not", async () => {
    setAdminData(adminFixture());
    const user = userEvent.setup();
    const router = mountAdmin("/admin/partidos", { partidos: TemporadaScreen });
    await user.type(await screen.findByRole("searchbox", { name: "Buscar partido" }), "n");
    expect(router.state.location.pathname).toBe("/admin/partidos");
    act(() => (document.activeElement as HTMLElement | null)?.blur());
    await user.keyboard("n");
    await waitFor(() => expect(router.state.location.pathname).toBe("/admin/partidos/nuevo"));
    expect(await screen.findByRole("dialog", { name: "Nuevo partido" })).toBeInTheDocument();
  });

  it("the old Convocatoria tab's address is the match's Convocatoria station", async () => {
    setAdminData(adminFixture());
    const router = mountAdmin("/admin/partidos/m8?tab=convocatoria", { convocar: ConvocatoriaScreen });
    await waitFor(() => expect(router.state.location.pathname).toBe("/admin/partidos/m8/convocatoria"));
    expect(screen.getByRole("navigation", { name: "Las estaciones del partido" }).querySelector('[aria-current="page"]')).toHaveAccessibleName(/^1 de 6 · Convocatoria/);
  });

  it("Nuevo partido: the rival is required, the return match is named; «Cancelar» does nothing while it is created (B-PAR-02); then its Datos", async () => {
    setAdminData(adminFixture());
    let finish: () => void = () => undefined;
    save.mockImplementationOnce(() => new Promise((r) => (finish = () => r({ data: { id: "x" } } as never))));
    const user = userEvent.setup();
    const router = mountAdmin("/admin/partidos/nuevo", { partidos: TemporadaScreen });
    const sheet = await screen.findByRole("dialog", { name: "Nuevo partido" });
    await user.click(within(sheet).getByRole("button", { name: "Crear" }));
    expect(within(sheet).getByRole("alert")).toHaveTextContent("Pon el rival");
    await user.type(within(sheet).getByRole("textbox", { name: /^Rival/ }), "Emirates");
    expect(within(sheet).getByText(/Es la vuelta: la ida fue la J1 \(4–1\)/)).toBeInTheDocument();
    await user.click(within(sheet).getByRole("button", { name: "Crear" }));
    expect(within(sheet).getByRole("button", { name: "Creando…" })).toBeInTheDocument();
    await user.click(within(sheet).getByRole("button", { name: "Cancelar" }));
    expect(screen.getByRole("dialog", { name: "Nuevo partido" })).toBeInTheDocument();
    await act(async () => finish());
    await waitFor(() => expect(router.state.location.pathname).toMatch(/^\/admin\/partidos\/[^/]+\/datos$/));
    expect(save).toHaveBeenCalledWith(expect.objectContaining({ draft: true, sheet: expect.objectContaining({ rival: "Emirates", competition: "Liga" }) }));
  });
});

describe("Archivados", () => {
  const archived = (o: Partial<ArchivedMatch>): ArchivedMatch => ({ id: "a1", seasonId: "t0", rival: "Viejo FC", date: Date.UTC(2025, 4, 10, 9, 0), status: "finished", goalsFor: 2, goalsAgainst: 2, published: true, draft: false, jornada: null, archived: true, ...o }) as ArchivedMatch;
  it("in read only; its season archived blocks «Reactivar» saying why; «Borrar definitivamente» asks first", async () => {
    setAdminData(adminFixture({ archivedMatches: [archived({})] }));
    const user = userEvent.setup();
    mountAdmin("/admin/partidos/archivados/a1", { partidos: TemporadaScreen });
    expect(await screen.findByRole("heading", { level: 2, name: "Manchester Piti 2–2 Viejo FC" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Reactivar" })).toHaveAttribute("aria-disabled", "true");
    expect(screen.getByText(/Reactiva primero «Temporada 0 · pre-Piti» desde Club › Temporadas/)).toBeInTheDocument();
    await user.click(screen.getByRole("button", { name: "Borrar definitivamente" }));
    const ask = screen.getByRole("alertdialog", { name: "¿Borrar definitivamente Viejo FC?" });
    await user.click(within(ask).getByRole("button", { name: "Borrar partido" }));
    await waitFor(() => expect(api.deleteMatch).toHaveBeenCalledExactlyOnceWith({ id: "a1" }));
  });

  it("one archived by hand in a live season is reactivated after asking, and opens in the calendar", async () => {
    setAdminData(adminFixture({ archivedMatches: [archived({ seasonId: "t1", individuallyArchived: true })] }));
    const user = userEvent.setup();
    const router = mountAdmin("/admin/partidos/archivados/a1", { partidos: TemporadaScreen });
    await user.click(await screen.findByRole("button", { name: "Reactivar" }));
    await user.click(within(screen.getByRole("dialog", { name: "¿Reactivar el partido contra Viejo FC?" })).getByRole("button", { name: "Reactivar partido" }));
    await waitFor(() => expect(api.setMatchArchived).toHaveBeenCalledWith({ id: "a1", archived: false }));
    expect(await screen.findByText(/Viejo FC · vuelve al calendario y a las estadísticas/)).toBeInTheDocument();
    // (it goes to the match; the fixture still has it archived, so the match sends it back here)
    await waitFor(() => expect(router.state.location.pathname).toMatch(/^\/admin\/partidos\/(archivados\/)?a1$/));
  });
});

describe("Convocatoria", () => {
  it("«Mandar la convocatoria» waits 5 s behind «Deshacer»; a change in those seconds goes with the notice (M-06, B-HOY-01)", async () => {
    vi.useFakeTimers({ shouldAdvanceTime: true });
    setAdminData(adminFixture({ published: withJ8({ starters: SIX, bench: ["kevin", "almachi"] }) }));
    const user = userEvent.setup({ advanceTimers: vi.advanceTimersByTime });
    mountAdmin("/admin/partidos/m8/convocatoria", { convocar: ConvocatoriaScreen });
    await screen.findByRole("heading", { level: 2, name: "Quién viene" });
    await user.click(screen.getAllByRole("button", { name: "Mandar la convocatoria" })[0]);
    expect(screen.getByText("El aviso sale en 5 s · Deshacer")).toBeInTheDocument();
    // ERIK to the banquillo while it waits
    await user.click(screen.getByRole("button", { name: /^ERIK, viene, en el siete: elegir$/ }));
    await user.click(within(screen.getByRole("group", { name: "Dónde va ERIK" })).getByRole("button", { name: "Al banquillo" }));
    await act(async () => {
      vi.advanceTimersByTime(5_100);
    });
    await waitFor(() => expect(setConv).toHaveBeenCalledWith(expect.objectContaining({ matchId: "m8", notify: true, starters: SIX.slice(0, 5) })));
  });

  it("B-HOY-03: a match only in the drafts cannot tell anybody: the action is off and says why", async () => {
    const data = adminFixture({ published: fixturePublished.filter((m) => m.id !== "m8") });
    const m8 = { ...adminFixture().matches.find((m) => m.id === "m8")!, starters: SIX, bench: ["kevin", "almachi"], draft: true, published: false, jornada: null };
    setAdminData({ ...data, matches: [...data.matches, m8] });
    const user = userEvent.setup();
    mountAdmin("/admin/partidos/m8/convocatoria", { convocar: ConvocatoriaScreen });
    await screen.findByRole("heading", { level: 2, name: "Quién viene" });
    const btn = screen.getAllByRole("button", { name: "Mandar la convocatoria" })[0];
    expect(btn).toHaveAttribute("aria-disabled", "true");
    await user.click(btn);
    expect(setConv).not.toHaveBeenCalled();
    expect(screen.getAllByText("Es un borrador: publícalo en el calendario (Datos) antes de avisar a nadie.").length).toBeGreaterThan(0);
  });

  it("M-07: once sent, «Recordar ahora a los N que faltan» calls remindNow", async () => {
    setAdminData(adminFixture({ published: withJ8({ starters: SIX, bench: ["kevin", "fer"], convocatoriaNotifiedAt: NOW - 3_600_000, convocatoriaAt: NOW - 3_600_000 }) }));
    const user = userEvent.setup();
    mountAdmin("/admin/partidos/m8/convocatoria", { convocar: ConvocatoriaScreen });
    await user.click(await screen.findByRole("button", { name: "Recordar ahora a los 1 que faltan" }));
    await waitFor(() => expect(api.remindNow).toHaveBeenCalledWith({ matchId: "m8" }));
    expect(await screen.findByText(/Recordado ahora a 1 convocado/)).toBeInTheDocument();
  });
});

describe("Datos", () => {
  it("B-ENC-01: a time typed before the date stays in its field, and the foot says why it cannot be saved yet", async () => {
    setAdminData(adminFixture());
    const user = userEvent.setup();
    mountAdmin("/admin/partidos/m8/datos", { partidos: TemporadaScreen });
    const date = await screen.findByLabelText("Fecha");
    await user.clear(date);
    const time = screen.getByLabelText("Hora (Madrid)");
    await user.clear(time);
    await user.type(time, "10:00");
    expect(time).toHaveValue("10:00");
    expect(screen.getAllByText("Falta la fecha: la hora 10:00 se queda guardada aquí hasta que la pongas").length).toBeGreaterThan(0);
  });

  it("?estado=aplazado from Hoy opens it marked «Aplazado» (unsaved) and the address drops it", async () => {
    setAdminData(adminFixture());
    const router = mountAdmin("/admin/partidos/m8/datos?estado=aplazado", { partidos: TemporadaScreen });
    expect(await screen.findByRole("radio", { name: "Aplazado" })).toHaveAttribute("aria-checked", "true");
    expect(screen.getByRole("textbox", { name: /^Motivo del aplazamiento/ })).toBeInTheDocument();
    await waitFor(() => expect(router.state.location.searchStr).toBe(""));
    expect(screen.getByText("● Cambios sin guardar")).toBeInTheDocument();
  });

  it("the unsaved edits survive going to another station and back", async () => {
    setAdminData(adminFixture());
    const user = userEvent.setup();
    mountAdmin("/admin/partidos/m8/datos", { partidos: TemporadaScreen });
    const rival = await screen.findByRole("combobox", { name: "Nombre del rival" });
    await user.clear(rival);
    await user.type(rival, "MAD SKY B");
    await user.click(screen.getByRole("link", { name: /^1 de 6 · Convocatoria/ }));
    await screen.findByRole("heading", { level: 2, name: "Quién viene" });
    await user.click(screen.getByRole("link", { name: /^2 de 6 · Datos/ }));
    expect(await screen.findByRole("combobox", { name: "Nombre del rival" })).toHaveValue("MAD SKY B");
  });
});

describe("Datos · a played match", () => {
  it("its Datos show its own fields, the draft's over the published (FUSION 7)", async () => {
    setAdminData(adminFixture());
    mountAdmin("/admin/partidos/m7/datos", { partidos: TemporadaScreen });
    expect(await screen.findByRole("combobox", { name: "Nombre del rival" })).toHaveValue("FUSION 7");
  });
});

describe("La mesa (En juego)", () => {
  it("before the match: when it opens and who keeps it; no score", async () => {
    setAdminData(adminFixture());
    mountAdmin("/admin/partidos/m8/en-juego", { partidos: TemporadaScreen });
    expect(await screen.findByRole("heading", { name: "La mesa se abre el día del partido" })).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "Elegir quién anota" })).toHaveAttribute("href", "/admin/partidos/m8/datos");
    expect(screen.queryByText(/PITI/)).toBeNull();
  });
});
