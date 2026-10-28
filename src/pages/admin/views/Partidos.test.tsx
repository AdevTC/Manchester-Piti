import { act, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { MatchEvent } from "../../../../functions/src/matchEngine";
import * as api from "../../../lib/clubApi";
import type { ClubMatch } from "../../../lib/clubData";
import { adminFixture, fixturePublished, mountAdmin, setAdminData } from "../../../test/adminKit";
import { draftKey } from "../acta/localDraft";
import { fromMatch, setMinute, sig } from "../acta/sheetModel";
import { resetWhistledForTests } from "../data/whistleStore";
import { Partidos } from "./Partidos";

// Heavy suite: the whole match workspace driven by userEvent (~1.7 s per test alone); under load it crossed 5 s.
vi.setConfig({ testTimeout: 15_000 });

vi.mock("../data/useAdminData", async () => ({ useAdminData: (await import("../../../test/adminMocks")).currentAdminData }));
vi.mock("../../../context/AuthContext", async () => ({ useAuth: (await import("../../../test/adminMocks")).fakeAuth }));
vi.mock("../../../lib/clubApi", () => ({
  apiError: (e: unknown) => (e instanceof Error ? e.message : String(e)),
  saveMatchSheet: vi.fn(() => Promise.resolve({ data: { id: "x" } })),
  deleteMatch: vi.fn(() => Promise.resolve({ data: { ok: true } })),
  setMatchArchived: vi.fn(() => Promise.resolve({ data: { ok: true } })),
}));
vi.mock("../../../lib/matchPoster", () => ({ downloadMatchPoster: vi.fn(() => Promise.resolve()) }));
vi.mock("../partidos/live", () => ({
  useMatchNote: () => ({ data: "Quedada 9:15 en el campo.", loading: false }),
  useMatchRsvp: () => ({ data: [], loading: false }),
  useMatchMvp: () => undefined,
}));
const save = vi.mocked(api.saveMatchSheet);
const del = vi.mocked(api.deleteMatch);
const archive = vi.mocked(api.setMatchArchived);
/** The first saveMatchSheet payload. */
const call = () => {
  const a = save.mock.calls[0]?.[0];
  if (!a) throw new Error("saveMatchSheet no se llamó");
  return a;
};
const WIDTH = window.innerWidth;
const SEVEN = ["evans", "illescas", "tello", "eguzquiza", "huberoski", "erik", "adrian"];
/** The fixture's published matches with one of them changed. */
const withMatch = (id: string, over: Partial<ClubMatch>): ClubMatch[] => fixturePublished.map((m) => (m.id === id ? { ...m, ...over } : m));
/** The J3 (m8) with a clean convocatoria: six titulares, two on the bench, BRAWAN not called. */
const cleanJ3 = () => withMatch("m8", { bench: ["kevin", "almachi"] });
const goal = (id: string, minute: number, playerId: string): MatchEvent => ({ id, type: "goal", minute, playerId });
/** The J1 (m6) published with its whole acta. */
const fullJ1 = () =>
  withMatch("m6", {
    starters: SEVEN,
    bench: ["kevin", "almachi", "andia", "fer", "brawan"],
    notCalled: [],
    duration: 50,
    events: [goal("a", 5, "erik"), goal("b", 10, "erik"), goal("c", 20, "adrian"), goal("d", 30, "huberoski"), { id: "e", type: "opponent_goal", minute: 40 }],
  });
const caption = () => screen.getAllByRole("status").find((s) => s.classList.contains("sc-status__live")) as HTMLElement;
const acta = () => mountAdmin("/admin/partidos/m7?tab=acta", { partidos: Partidos });
/** The workspace footer (state + reason + buttons). */
const footer = () => document.querySelector(".df") as HTMLElement;

beforeEach(() => {
  localStorage.clear();
  resetWhistledForTests();
  save.mockClear();
  del.mockReset().mockResolvedValue({ data: { ok: true } });
  archive.mockReset().mockResolvedValue({ data: { ok: true } });
  setAdminData(adminFixture());
});
afterEach(() => {
  vi.useRealTimers();
  Object.defineProperty(window, "innerWidth", { configurable: true, value: WIDTH });
});

describe("Partidos · the list", () => {
  it("groups Por hacer / Por jugar / Publicados with only the exceptions; filters and searches", async () => {
    const user = userEvent.setup();
    mountAdmin("/admin/partidos", { partidos: Partidos });
    expect(await screen.findByRole("heading", { level: 1, name: "Partidos" })).toBeInTheDocument();
    expect(screen.getByText("3 jornadas · 1 por hacer · por hacer primero")).toBeInTheDocument();
    const rows = (name: RegExp) => within(screen.getByRole("group", { name })).getAllByRole("button").map((b) => b.getAttribute("aria-label"));
    expect(rows(/^Por hacer/)).toEqual(["J2, FUSION 7, Falta 1 goleador, Victoria 3–1"]);
    expect(rows(/^Por jugar/)).toEqual(["J3, MAD SKY, Convocatoria 6 de 7, 12:00"]);
    expect(rows(/^Publicados/)).toEqual(["J1, Emirates, en casa, Victoria 4–1"]);
    // the exception in amber, the G/E/P mark on the score
    const j2 = screen.getByRole("button", { name: /^J2, FUSION 7/ });
    expect(within(j2).getByText("Falta 1 goleador")).toHaveClass("am");
    expect(within(j2).getByRole("img", { name: "Victoria" })).toHaveTextContent("G");
    // the desktop opens the first match to do
    expect(j2).toHaveAttribute("aria-current", "true");
    const filters = screen.getByRole("group", { name: "Filtrar partidos" });
    await user.click(within(filters).getByRole("button", { name: "Publicados" }));
    expect(screen.queryByRole("group", { name: /^Por hacer/ })).toBeNull();
    expect(within(filters).getByRole("button", { name: "Publicados" })).toHaveAttribute("aria-pressed", "true");
    await user.click(within(filters).getByRole("button", { name: "Todo" }));
    await user.type(screen.getByRole("searchbox", { name: "Buscar partido" }), "j3");
    expect(screen.getAllByRole("button", { name: /^J\d/ }).map((b) => b.getAttribute("aria-label"))).toEqual(["J3, MAD SKY, Convocatoria 6 de 7, 12:00"]);
    await user.clear(screen.getByRole("searchbox", { name: "Buscar partido" }));
    await user.type(screen.getByRole("searchbox", { name: "Buscar partido" }), "zzz");
    expect(screen.getByText("Ningún partido con «zzz».")).toBeInTheDocument();
  });

  it("«Nuevo partido»: the rival is required, the return match is named with the first leg, it creates a draft and opens it", async () => {
    const user = userEvent.setup();
    const router = mountAdmin("/admin/partidos", { partidos: Partidos });
    await user.click(await screen.findByRole("button", { name: "Archivados" }));
    await user.click(screen.getAllByRole("button", { name: "Nuevo partido" })[0]);
    const modal = await screen.findByRole("dialog", { name: "Nuevo partido" });
    expect(modal).toHaveClass("md");
    expect(within(modal).getByLabelText("Rival")).toHaveFocus();
    expect(within(modal).getByLabelText("Fecha")).toHaveValue("2026-11-15");
    expect(within(modal).getByLabelText("Hora (Madrid)")).toHaveValue("12:00");
    await user.click(within(modal).getByRole("button", { name: "Crear y abrir" }));
    expect(within(modal).getByText("Pon el rival")).toBeInTheDocument();
    expect(save).not.toHaveBeenCalled();
    await user.type(within(modal).getByLabelText("Rival"), "emirates");
    expect(within(modal).getByText("Es la vuelta: la ida fue la J1 (4–1)")).toBeInTheDocument();
    await user.clear(within(modal).getByLabelText("Rival"));
    await user.type(within(modal).getByLabelText("Rival"), "Laureles CF");
    expect(within(modal).getByText(/^Iniciales: \w+ · el campo y el resto, en Encuentro\.$/)).toBeInTheDocument();
    await user.click(within(modal).getByRole("button", { name: "Visitante" }));
    await user.click(within(modal).getByRole("button", { name: "Crear y abrir" }));
    await waitFor(() => expect(save).toHaveBeenCalledTimes(1));
    const arg = call();
    expect(arg.draft).toBe(true);
    expect(arg.sheet).toMatchObject({ seasonId: "t1", rival: "Laureles CF", home: false, kit: "away", competition: "Liga", status: "scheduled", date: Date.UTC(2026, 10, 15, 11, 0) });
    // (r12: the new match opens on its Datos station)
    await waitFor(() => expect(router.state.location.pathname).toBe(`/admin/partidos/${arg.id}/datos`));
    // (a draft: no jornada until it is published)
    expect(await screen.findByText("Borrador · Laureles CF creado · completa el campo cuando lo sepas")).toBeInTheDocument();
    // «Deshacer» deletes it again
    await user.click(within(caption()).getByRole("button", { name: "Deshacer" }));
    await waitFor(() => expect(del).toHaveBeenCalledWith({ id: arg.id }));
    await waitFor(() => expect(router.state.location.pathname).toBe("/admin/partidos"));
  });

  it("N opens «Nuevo partido» when no field is focused", async () => {
    const user = userEvent.setup();
    mountAdmin("/admin/partidos", { partidos: Partidos });
    await screen.findByRole("heading", { level: 1, name: "Partidos" });
    await user.type(screen.getByRole("searchbox", { name: "Buscar partido" }), "n");
    expect(screen.queryByRole("dialog", { name: "Nuevo partido" })).toBeNull();
    await act(async () => {
      (document.activeElement as HTMLElement | null)?.blur();
    });
    await user.keyboard("n");
    expect(await screen.findByRole("dialog", { name: "Nuevo partido" })).toBeInTheDocument();
  });
});

describe("Partidos · a match to play, a published one", () => {
  it("the old Convocatoria tab's address is the match's Convocatoria station: Convocar for this match", async () => {
    setAdminData(adminFixture({ published: cleanJ3() }));
    const router = mountAdmin("/admin/partidos/m8?tab=convocatoria");
    await waitFor(() => expect(router.state.location.pathname).toBe("/admin/partidos/m8/convocatoria"));
    expect(screen.getByRole("navigation", { name: "Las estaciones del partido" }).querySelector('[aria-current="page"]')).toHaveAccessibleName(/^1 de 6 · Convocatoria/);
  });

  it("a draft-only match to play: «Sin publicar» + «Publicar en el calendario» (gold)", async () => {
    const data = adminFixture({ published: fixturePublished.filter((m) => m.id !== "m8") });
    const m8 = { ...cleanJ3().find((m) => m.id === "m8")!, draft: true, published: false, jornada: 3 };
    setAdminData({ ...data, matches: [...data.matches, m8] });
    const user = userEvent.setup();
    mountAdmin("/admin/partidos/m8/datos", { partidos: Partidos });
    await screen.findByRole("heading", { level: 2 });
    expect(within(footer()).getByText("Sin publicar · aún no sale en el calendario")).toHaveClass("warn");
    await user.click(within(footer()).getByRole("button", { name: "Publicar en el calendario" }));
    await waitFor(() => expect(save).toHaveBeenCalledTimes(1));
    expect(call()).toMatchObject({ id: "m8", draft: false });
    expect(await screen.findByText("J3 · MAD SKY publicado · ya sale en el calendario")).toBeInTheDocument();
  });

});

describe("Partidos · archiving and irreversible deletion", () => {
  const archiveFixture = (seasonId = "t1", draftOnly = false) => {
    const data = adminFixture({ published: fullJ1() });
    const m = { ...data.matches.find((x) => x.id === "m6")!, seasonId, archived: true as const, individuallyArchived: true, jornada: null, draft: draftOnly, published: !draftOnly };
    return { ...data, matches: data.matches.filter((x) => x.id !== m.id), archivedMatches: [m] };
  };

  it("archives a finished match, keeps it in a separate read-only list and restores it", async () => {
    const user = userEvent.setup();
    const data = adminFixture({ published: fullJ1() });
    setAdminData(data);
    const router = mountAdmin("/admin/partidos/m6?tab=encuentro", { partidos: Partidos });
    await user.click(await screen.findByRole("button", { name: "Archivar partido" }));
    const dialog = screen.getByRole("dialog", { name: "¿Archivar el partido contra Emirates?" });
    expect(dialog).toHaveTextContent("Conserva el acta, los eventos, las porras y los votos");
    archive.mockImplementationOnce(async () => { setAdminData(archiveFixture()); return { data: { ok: true } }; });
    await user.click(within(dialog).getByRole("button", { name: "Archivar partido" }));
    await waitFor(() => expect(router.state.location.pathname).toBe("/admin/partidos/archivados/m6"));
    expect(archive).toHaveBeenCalledExactlyOnceWith({ id: "m6", archived: true });
    const pane = await screen.findByRole("region", { name: "Partido archivado" });
    expect(pane).toHaveTextContent("Acta archivada · solo lectura");
    expect(within(pane).getByRole("region", { name: "Eventos del acta archivada" })).toHaveTextContent("ERIK");
    expect(within(pane).queryByRole("textbox")).toBeNull();
    expect(screen.queryByRole("button", { name: "Guardar cambios" })).toBeNull();
    expect(screen.getByRole("button", { name: "Archivados · 1" })).toHaveAttribute("aria-pressed", "true");
    await user.click(within(pane).getByRole("button", { name: "Reactivar partido" }));
    archive.mockImplementationOnce(async () => { setAdminData(data); return { data: { ok: true } }; });
    await user.click(within(screen.getByRole("dialog", { name: "¿Reactivar el partido contra Emirates?" })).getByRole("button", { name: "Reactivar partido" }));
    await waitFor(() => expect(archive).toHaveBeenLastCalledWith({ id: "m6", archived: false }));
    expect(await screen.findByRole("button", { name: /^J1, Emirates/ })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Activos" })).toHaveAttribute("aria-pressed", "true");
  });

  it("cancellation and backend errors preserve unsaved edits; deletion succeeds only after the server responds", async () => {
    const user = userEvent.setup();
    const router = mountAdmin("/admin/partidos/m8?tab=encuentro", { partidos: Partidos });
    const venue = await screen.findByLabelText("Nombre del campo");
    await user.type(venue, "Mi campo pendiente");
    await user.click(screen.getByRole("button", { name: "Borrar partido" }));
    let dialog = screen.getByRole("alertdialog");
    expect(dialog).toHaveTextContent("Los cambios sin guardar");
    await user.click(within(dialog).getByRole("button", { name: "Cancelar" }));
    expect(del).not.toHaveBeenCalled();
    expect(venue).toHaveValue("Mi campo pendiente");
    del.mockRejectedValueOnce(new Error("No se pudo completar; inténtalo de nuevo."));
    await user.click(screen.getByRole("button", { name: "Borrar partido" }));
    dialog = screen.getByRole("alertdialog");
    await user.click(within(dialog).getByRole("button", { name: "Borrar partido" }));
    expect(await within(dialog).findByRole("alert")).toHaveTextContent("No se pudo completar");
    expect(router.state.location.pathname).toBe("/admin/partidos/m8/datos");
    await user.click(within(dialog).getByRole("button", { name: "Cancelar" }));
    expect(venue).toHaveValue("Mi campo pendiente");
    let complete!: (value: { data: { ok: boolean } }) => void;
    del.mockImplementationOnce(() => new Promise((resolve) => { complete = resolve; }));
    await user.click(screen.getByRole("button", { name: "Borrar partido" }));
    dialog = screen.getByRole("alertdialog");
    await user.click(within(dialog).getByRole("button", { name: "Borrar partido" }));
    expect(within(dialog).getByRole("button", { name: "Un momento…" })).toHaveAttribute("aria-disabled", "true");
    await user.click(within(dialog).getByRole("button", { name: "Cancelar" }));
    expect(dialog).toBeInTheDocument();
    expect(router.state.location.pathname).toBe("/admin/partidos/m8/datos");
    await act(async () => complete({ data: { ok: true } }));
    await waitFor(() => expect(router.state.location.pathname).toBe("/admin/partidos"));
    expect(screen.queryByRole("alertdialog")).toBeNull();
    expect(caption()).toHaveTextContent("eliminado definitivamente");
    expect(within(caption()).queryByRole("button", { name: "Deshacer" })).toBeNull();
  });

  it("archived season prevents restoring its match, but allows permanent deletion of a played match", async () => {
    const data = archiveFixture("t0");
    setAdminData({ ...data, players: [], archivedPlayers: data.players });
    const user = userEvent.setup();
    const router = mountAdmin("/admin/partidos/m6", { partidos: Partidos });
    const restore = await screen.findByRole("button", { name: "Reactivar partido" });
    expect(restore).toBeDisabled();
    expect(screen.getByRole("region", { name: "Eventos del acta archivada" })).toHaveTextContent("ERIK");
    expect(screen.getByText(/Reactiva primero Temporada 0/)).toBeInTheDocument();
    await user.click(restore);
    expect(archive).not.toHaveBeenCalled();
    await user.click(screen.getByRole("button", { name: "Borrar partido" }));
    const dialog = screen.getByRole("alertdialog");
    expect(dialog).toHaveTextContent("25 de octubre de 2026");
    await user.click(within(dialog).getByRole("button", { name: "Borrar partido" }));
    await waitFor(() => expect(router.state.location.pathname).toBe("/admin/partidos"));
    expect(del).toHaveBeenCalledExactlyOnceWith({ id: "m6" });
  });

  it("mobile archive list searches and opens unpublished drafts without enabling editing", async () => {
    Object.defineProperty(window, "innerWidth", { configurable: true, value: 390 });
    setAdminData(archiveFixture("t1", true));
    const user = userEvent.setup();
    mountAdmin("/admin/partidos", { partidos: Partidos });
    await user.click(await screen.findByRole("button", { name: "Archivados · 1" }));
    expect(screen.queryByRole("region", { name: "Partido archivado" })).toBeNull();
    const search = screen.getByRole("searchbox", { name: "Buscar partido archivado" });
    await user.type(search, "Inexistente");
    expect(screen.getByText(/Ningún partido archivado con/)).toBeInTheDocument();
    await user.clear(search);
    const row = screen.getByRole("button", { name: /^Archivado, Manchester Piti · Emirates/ });
    expect(row).toHaveTextContent("Borrador");
    await user.click(row);
    const pane = await screen.findByRole("region", { name: "Partido archivado" });
    expect(within(pane).queryByRole("textbox")).toBeNull();
    await user.click(within(pane).getByRole("button", { name: "Reactivar partido" }));
    const modal = screen.getByRole("dialog");
    expect(modal).toHaveTextContent("Se recupera como borrador");
    await user.click(within(modal).getByRole("button", { name: "Cancelar" }));
    await user.click(screen.getByRole("button", { name: "Volver a la lista" }));
    expect(await screen.findByRole("button", { name: "Archivados · 1" })).toHaveAttribute("aria-pressed", "true");
  });

});
