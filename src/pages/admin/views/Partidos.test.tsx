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

vi.mock("../data/useAdminData", async () => ({ useAdminData: (await import("../../../test/adminMocks")).currentAdminData }));
vi.mock("../../../context/AuthContext", async () => ({ useAuth: (await import("../../../test/adminMocks")).fakeAuth }));
vi.mock("../../../lib/clubApi", () => ({
  apiError: (e: unknown) => (e instanceof Error ? e.message : String(e)),
  saveMatchSheet: vi.fn(() => Promise.resolve({ data: { id: "x" } })),
  deleteMatch: vi.fn(() => Promise.resolve({ data: { ok: true } })),
}));
vi.mock("../../../lib/matchPoster", () => ({ downloadMatchPoster: vi.fn(() => Promise.resolve()) }));
vi.mock("../partidos/live", () => ({
  useMatchNote: () => ({ data: "Quedada 9:15 en el campo.", loading: false }),
  useMatchRsvp: () => ({ data: [], loading: false }),
  useMatchMvp: () => undefined,
}));
const save = vi.mocked(api.saveMatchSheet);
const del = vi.mocked(api.deleteMatch);
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
const caption = () => screen.getAllByRole("status").find((s) => s.classList.contains("adm-toasts")) as HTMLElement;
const acta = () => mountAdmin("/admin/partidos/m7?tab=acta", { partidos: Partidos });
/** The workspace footer (state + reason + buttons). */
const footer = () => document.querySelector(".df") as HTMLElement;

beforeEach(() => {
  localStorage.clear();
  resetWhistledForTests();
  save.mockClear();
  del.mockClear();
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
    // the exception in amber, the V/E/D mark on the score
    const j2 = screen.getByRole("button", { name: /^J2, FUSION 7/ });
    expect(within(j2).getByText("Falta 1 goleador")).toHaveClass("am");
    expect(within(j2).getByRole("img", { name: "Victoria" })).toHaveTextContent("V");
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
    await user.click(await screen.findByRole("button", { name: "Nuevo partido" }));
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
    await waitFor(() => expect(router.state.location.pathname).toBe(`/admin/partidos/${arg.id}`));
    expect(router.state.location.search).toMatchObject({ tab: "encuentro" });
    expect(await screen.findByText("J4 · Laureles CF creada · completa el campo cuando lo sepas")).toBeInTheDocument();
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

describe("Partidos · the workspace", () => {
  it("the header merged with the tabs (in the URL), the kicker, the score with its mark, the footer", async () => {
    const user = userEvent.setup();
    const router = mountAdmin("/admin/partidos", { partidos: Partidos });
    await user.click(await screen.findByRole("button", { name: /^J2, FUSION 7/ }));
    await waitFor(() => expect(router.state.location.pathname).toBe("/admin/partidos/m7"));
    const tabs = screen.getByRole("tablist", { name: "Partido" });
    expect(within(tabs).getByRole("tab", { name: /Acta/ })).toHaveAttribute("aria-selected", "true");
    expect(within(tabs).getByRole("tab", { name: /^Acta\W+pendiente$/ })).toBeInTheDocument();
    expect(within(tabs).getByRole("tab", { name: /^Encuentro\W+hecho$/ })).toBeInTheDocument();
    expect(screen.getByRole("heading", { level: 2 })).toHaveTextContent("PITI 3–1 FUSION 7 V");
    expect(screen.getByText("J2 · Liga · dom 1 nov · 10:00 · en casa")).toBeInTheDocument();
    expect(within(footer()).getByText("No cuadra: falta el goleador de 1 gol")).toHaveClass("warn");
    expect(within(footer()).getByText("Guardado dom 1 nov, 13:04 · hora de Madrid")).toBeInTheDocument();
    await user.click(within(tabs).getByRole("tab", { name: /Encuentro/ }));
    await waitFor(() => expect(router.state.location.search).toMatchObject({ tab: "encuentro" }));
    expect(screen.getByLabelText("Rival")).toHaveValue("FUSION 7");
    expect(screen.getByLabelText("Nota interna para el equipo")).toHaveValue("Quedada 9:15 en el campo.");
    // arrows move between tabs
    await user.keyboard("{ArrowRight}");
    await waitFor(() => expect(router.state.location.search).toMatchObject({ tab: "convocatoria" }));
    expect(screen.getByText(/Una sola convocatoria\./)).toBeInTheDocument();
  });

  it("«¿Quién marcó?» opens under its row: scorer (on the pitch first, then the banquillo), then the pass; the minute makes it square", async () => {
    const user = userEvent.setup();
    acta();
    const row = (await screen.findByText("¿Quién marcó?")).closest(".gr") as HTMLElement;
    expect(row).toHaveClass("miss");
    expect(within(row).getByText("Gol 3 · falta quién marcó")).toBeInTheDocument();
    await user.click(screen.getByRole("button", { name: "Elegir quién marcó el gol 3" }));
    const pick = screen.getByRole("dialog", { name: "¿Quién marcó?" });
    expect(pick).toHaveClass("picker");
    // in place, right after its row
    expect(row.nextElementSibling).toBe(pick);
    expect(within(pick).getByText("Gol 3 · paso 1 de 2")).toBeInTheDocument();
    const [field, bench] = Array.from(pick.querySelectorAll<HTMLElement>(".pg"));
    expect(within(field).getAllByRole("button").map((b) => b.querySelector("small")?.textContent)).toEqual(["EVANS", "ILLESCAS", "TELLO", "EGUZQUIZA", "HUBEROSKI", "ERIK", "ADRIÁN T.C."]);
    expect(within(bench).getAllByRole("button").map((b) => b.querySelector("small")?.textContent)).toEqual(["KEVIN", "ALMACHI", "ANDIA", "FER", "BRAWAN"]);
    expect(within(bench).getAllByRole("button")[0]).toHaveClass("bench");
    await user.click(within(pick).getByRole("button", { name: "HUBEROSKI marcó el gol 3" }));
    const step2 = screen.getByRole("dialog", { name: "¿Quién le dio el pase?" });
    expect(within(step2).getByText("Gol de HUBEROSKI · paso 2 de 2")).toBeInTheDocument();
    expect(within(step2).queryByRole("button", { name: /HUBEROSKI/ })).toBeNull();
    await user.click(within(step2).getByRole("button", { name: "Pase de ERIK" }));
    expect(screen.queryByRole("dialog")).toBeNull();
    expect(caption()).toHaveTextContent("Gol 3: HUBEROSKI, pase de ERIK");
    const done = screen.getByRole("button", { name: "Cambiar goleador del gol 3" }).closest(".gr") as HTMLElement;
    expect(done).toHaveTextContent("HUBEROSKI");
    expect(done).toHaveTextContent("Gol 3 · pase de ERIK");
    expect(within(footer()).getByText("● Cambios sin guardar")).toBeInTheDocument();
    expect(within(footer()).getByText("No cuadra: falta el minuto del gol 3")).toBeInTheDocument();
    await user.type(screen.getByLabelText("Minuto del gol 3"), "46");
    expect(within(footer()).getByText("Cuadra · 3 goles, todos con goleador")).toHaveClass("okk");
    expect(screen.getByRole("tab", { name: /^Acta\W+hecho$/ })).toBeInTheDocument();
    // La cuenta
    expect(screen.getByRole("group", { name: "Con goleador: 3 de 3" })).toBeInTheDocument();
    expect(screen.getByRole("group", { name: "Con pase (opcional): 3 de 3" })).toBeInTheDocument();
  });

  it("«+ Gol del Piti» opens the picker on the new row; autogol, Esc, «Lo completo luego» and «Quitar este gol» (with Deshacer)", async () => {
    const user = userEvent.setup();
    acta();
    await user.click(await screen.findByRole("button", { name: "Gol del Piti" }));
    const pick = screen.getByRole("dialog", { name: "¿Quién marcó?" });
    expect(within(pick).getByText("Gol 4 · paso 1 de 2")).toBeInTheDocument();
    await user.click(within(pick).getByRole("button", { name: "Autogol de FUSION 7" }));
    expect(screen.queryByRole("dialog")).toBeNull();
    expect(screen.getByText("Autogol de FUSION 7")).toBeInTheDocument();
    expect(screen.getByText("Gol 4 · cuenta para el Piti")).toBeInTheDocument();
    expect(screen.getByRole("heading", { level: 2 })).toHaveTextContent("PITI 4–1 FUSION 7");
    // Esc closes it and gives the focus back to its row
    await user.click(screen.getByRole("button", { name: "Elegir quién marcó el gol 3" }));
    expect(screen.getByRole("dialog", { name: "¿Quién marcó?" })).toBeInTheDocument();
    await user.keyboard("{Escape}");
    expect(screen.queryByRole("dialog")).toBeNull();
    expect(screen.getByText("¿Quién marcó?").closest("button")).toHaveFocus();
    await user.click(screen.getByRole("button", { name: "Elegir quién marcó el gol 3" }));
    await user.click(screen.getByRole("button", { name: "Lo completo luego" }));
    expect(screen.queryByRole("dialog")).toBeNull();
    // «Quitar este gol» removes it; «Deshacer» puts it back
    await user.click(screen.getByRole("button", { name: "Elegir quién marcó el gol 3" }));
    await user.click(screen.getByRole("button", { name: "Quitar este gol" }));
    expect(screen.queryByText("¿Quién marcó?")).toBeNull();
    expect(screen.getByRole("heading", { level: 2 })).toHaveTextContent("PITI 3–1 FUSION 7");
    expect(caption()).toHaveTextContent("Gol 3 quitado");
    await user.click(within(caption()).getByRole("button", { name: "Deshacer" }));
    expect(screen.getByText("¿Quién marcó?")).toBeInTheDocument();
  });

  it("typing a dorsal in the picker picks that player", async () => {
    const user = userEvent.setup();
    acta();
    await user.click(await screen.findByRole("button", { name: "Elegir quién marcó el gol 3" }));
    await user.keyboard("14");
    expect(screen.getByRole("dialog", { name: "¿Quién le dio el pase?" })).toBeInTheDocument();
  });

  it("rival goals: a new one asks its minute; removing one offers «Deshacer»; none = «Portería a cero»", async () => {
    const user = userEvent.setup();
    acta();
    await user.click(await screen.findByRole("button", { name: "Gol en contra" }));
    expect(screen.getByLabelText("Minuto del gol 2 de FUSION 7")).toHaveFocus();
    expect(screen.getByText("Falta el minuto · apúntalo para publicar")).toBeInTheDocument();
    await user.click(screen.getByRole("button", { name: "Quitar el gol 2 de FUSION 7" }));
    await user.click(screen.getByRole("button", { name: "Quitar el gol 1 de FUSION 7" }));
    expect(screen.getByText("Portería a cero.")).toBeInTheDocument();
    expect(caption()).toHaveTextContent("Gol de FUSION 7 quitado");
    await user.click(within(caption()).getByRole("button", { name: "Deshacer" }));
    expect(screen.getByLabelText("Minuto del gol 1 de FUSION 7")).toHaveValue("18");
  });

  it("«Lo demás»: Tarjetas · Cambios · Penaltis · Otros; «+» adds by dorsal, a row edits, «Quitar» has «Deshacer»", async () => {
    const user = userEvent.setup();
    acta();
    await screen.findByRole("heading", { name: "Lo demás" });
    for (const t of ["Sin tarjetas", "Sin cambios", "Sin penaltis", "Palos, paradas…"]) expect(screen.getByText(t)).toBeInTheDocument();
    await user.click(screen.getByRole("button", { name: "Añadir en Tarjetas" }));
    const panel = screen.getByRole("dialog", { name: "Añadir en Tarjetas" });
    expect(within(panel).getByLabelText("Minuto")).toHaveFocus();
    await user.click(within(panel).getByRole("button", { name: "Añadir" }));
    expect(within(panel).getByRole("alert")).toHaveTextContent("Pon el minuto (de 0 a 50).");
    await user.type(within(panel).getByLabelText("Minuto"), "22");
    await user.click(within(panel).getByRole("button", { name: "Añadir" }));
    expect(within(panel).getByRole("alert")).toHaveTextContent("Elige el jugador por su dorsal.");
    await user.click(within(panel).getByRole("button", { name: "Elegir a EGUZQUIZA, dorsal 8" }));
    await user.click(within(panel).getByRole("button", { name: "Añadir" }));
    expect(screen.queryByRole("dialog")).toBeNull();
    expect(screen.getByText("Amarilla a EGUZQUIZA")).toBeInTheDocument();
    expect(caption()).toHaveTextContent("Apuntado: Amarilla · EGUZQUIZA · 22′");
    // edit it into a red card
    await user.click(screen.getByRole("button", { name: "Editar: Amarilla a EGUZQUIZA (22′)" }));
    const edit = screen.getByRole("dialog", { name: "Editar · Tarjetas" });
    await user.click(within(edit).getByRole("button", { name: "Roja directa" }));
    await user.click(within(edit).getByRole("button", { name: "Guardar" }));
    expect(screen.getByText("Roja directa a EGUZQUIZA")).toBeInTheDocument();
    // a change: who leaves, who comes on
    await user.click(screen.getByRole("button", { name: "Añadir en Cambios" }));
    const cam = screen.getByRole("dialog", { name: "Añadir en Cambios" });
    await user.type(within(cam).getByLabelText("Minuto"), "30");
    await user.click(within(cam).getByRole("button", { name: "Sale TELLO, dorsal 20" }));
    await user.click(within(cam).getByRole("button", { name: "Entra KEVIN, dorsal 11" }));
    await user.click(within(cam).getByRole("button", { name: "Añadir" }));
    expect(screen.getByText("Entra KEVIN")).toBeInTheDocument();
    // remove the card, then take it back
    await user.click(screen.getByRole("button", { name: "Editar: Roja directa a EGUZQUIZA (22′)" }));
    await user.click(within(screen.getByRole("dialog", { name: "Editar · Tarjetas" })).getByRole("button", { name: "Quitar" }));
    expect(screen.getByText("Sin tarjetas")).toBeInTheDocument();
    await user.click(within(caption()).getByRole("button", { name: "Deshacer" }));
    expect(screen.getByText("Roja directa a EGUZQUIZA")).toBeInTheDocument();
  });

  it("«Publicar acta» while it doesn't square: outlined, the reason shakes and a lower third says why", async () => {
    const user = userEvent.setup();
    acta();
    const pub = await screen.findByRole("button", { name: "Publicar acta" });
    expect(pub).toHaveAttribute("aria-disabled", "true");
    expect(pub).toHaveClass("off");
    await user.click(pub);
    expect(save).not.toHaveBeenCalled();
    expect(footer().querySelector(".st")).toHaveClass("shake");
    expect(caption()).toHaveTextContent("Para publicar falta el goleador de 1 gol");
    expect(caption().querySelector(".k")).toHaveTextContent("!");
  });

  it("publishing a squared acta sends it and opens the publish peak (the vitrina)", async () => {
    const user = userEvent.setup();
    const router = acta();
    await user.type(await screen.findByLabelText("Minuto del gol 3"), "46");
    await user.click(screen.getByRole("button", { name: "Elegir quién marcó el gol 3" }));
    await user.click(screen.getByRole("button", { name: "HUBEROSKI marcó el gol 3" }));
    await user.click(screen.getByRole("button", { name: "Sin asistencia" }));
    await user.click(screen.getByRole("button", { name: "Publicar acta" }));
    await waitFor(() => expect(save).toHaveBeenCalledTimes(1));
    const arg = call();
    expect(arg).toMatchObject({ id: "m7", draft: false });
    expect(arg.sheet).toMatchObject({ seasonId: "t1", rival: "FUSION 7", status: "finished", goalsFor: 3, goalsAgainst: 1, meetingNote: "Quedada 9:15 en el campo." });
    expect(arg.sheet.events).toEqual([
      { id: "g1", type: "goal", minute: 9, playerId: "adrian", assistPlayerId: "huberoski" },
      { id: "g2", type: "goal", minute: 31, playerId: "adrian", assistPlayerId: "erik" },
      { id: "r1", type: "opponent_goal", minute: 18 },
      { id: "open-g0", type: "goal", minute: 46, playerId: "huberoski" },
    ]);
    await waitFor(() => expect(router.state.location.search).toMatchObject({ vitrina: true }));
    const peak = await screen.findByRole("region", { name: "Acta publicada" });
    expect(within(peak).getByText("Final del partido · J2 · el acta sale a la web")).toBeInTheDocument();
    expect(within(peak).getByRole("img", { name: "Final: PITI 3, FUSION 7 1" })).toBeInTheDocument();
    expect(within(peak).getByRole("status")).toHaveTextContent("Acta publicada · la web ya lo cuenta");
    const shelf = within(peak).getByRole("group", { name: "La vitrina de la Temporada 1" });
    expect(shelf).toHaveTextContent("Vitrina T1");
    expect(within(shelf).getAllByRole("img").map((x) => x.getAttribute("aria-label"))).toEqual(["J1 victoria", "J2 victoria"]);
    expect(within(shelf).getByRole("img", { name: "J2 victoria" })).toHaveClass("nw");
    expect(within(peak).getByRole("button", { name: "Compartir el cartel" })).toHaveClass("gold");
    expect(within(peak).getByText("MVP abierto · 48 h")).toBeInTheDocument();
    expect(within(peak).getByRole("link", { name: "Ver el partido en la web" })).toHaveAttribute("href", "/matches/m7");
  });

  it("«Guardar borrador» saves a draft and says so", async () => {
    const user = userEvent.setup();
    acta();
    await user.type(await screen.findByLabelText("Minuto del gol 3"), "46");
    await user.click(screen.getByRole("button", { name: "Guardar borrador" }));
    await waitFor(() => expect(save).toHaveBeenCalledTimes(1));
    expect(call()).toMatchObject({ id: "m7", draft: true });
    expect(call().sheet.events.at(-1)).toEqual({ id: "open-g0", type: "goal", minute: 46 });
    expect(await screen.findByText("Borrador guardado · solo lo ven los capitanes")).toBeInTheDocument();
    expect(screen.queryByText("● Cambios sin guardar")).toBeNull();
  });

  it("leaving a dirty acta asks: Seguir editando keeps it; Descartar leaves", async () => {
    const user = userEvent.setup();
    const router = acta();
    await user.type(await screen.findByLabelText("Minuto del gol 3"), "46");
    await user.click(screen.getByRole("button", { name: /^J1, Emirates/ }));
    const guard = await screen.findByRole("alertdialog", { name: "¿Salir sin guardar?" });
    expect(within(guard).getByText(/Hay cambios sin guardar en el acta de la J2/)).toBeInTheDocument();
    expect(within(guard).getByRole("button", { name: "Guardar borrador y salir" })).toBeInTheDocument();
    await user.click(within(guard).getByRole("button", { name: "Seguir editando" }));
    expect(router.state.location.pathname).toBe("/admin/partidos/m7");
    expect(screen.getByLabelText("Minuto del gol 3")).toHaveValue("46");
    // switching tabs is not leaving
    await user.click(screen.getByRole("tab", { name: /Publicar/ }));
    expect(screen.queryByRole("alertdialog")).toBeNull();
    await user.click(screen.getByRole("button", { name: /^J1, Emirates/ }));
    await user.click(await screen.findByRole("button", { name: "Descartar cambios" }));
    await waitFor(() => expect(router.state.location.pathname).toBe("/admin/partidos/m6"));
    expect(localStorage.getItem(draftKey("acta", "m7"))).toBeNull();
  });

  it("mirrors unsaved edits on this device and offers them back", async () => {
    const data = adminFixture();
    const m7 = data.matches.find((m) => m.id === "m7")!;
    const base = fromMatch(m7, "Quedada 9:15 en el campo.");
    localStorage.setItem(draftKey("acta", "m7"), JSON.stringify({ at: Date.UTC(2026, 10, 2, 8, 30), base: sig(base), value: setMinute(base, "open-g0", "46") }));
    const user = userEvent.setup();
    acta();
    await user.click(await screen.findByRole("button", { name: "Recuperar cambios sin guardar de 09:30" }));
    expect(screen.getByLabelText("Minuto del gol 3")).toHaveValue("46");
    expect(screen.getByText("● Cambios sin guardar")).toBeInTheDocument();
    await user.clear(screen.getByLabelText("Minuto del gol 3"));
    await user.type(screen.getByLabelText("Minuto del gol 3"), "47");
    const stored = JSON.parse(localStorage.getItem(draftKey("acta", "m7")) ?? "{}") as { value: { events: { id: string; minute?: number }[] } };
    expect(stored.value.events.find((e) => e.id === "open-g0")?.minute).toBe(47);
  });

  it("Publicar: the crónica card (headline from the acta) + «Preparar resumen», the photo's HTTPS check, the minutes and the MVP status", async () => {
    const user = userEvent.setup();
    mountAdmin("/admin/partidos/m7?tab=publicar", { partidos: Partidos });
    expect(await screen.findByText("CRÓNICA · J2 · 1 NOV")).toBeInTheDocument();
    expect(screen.getByText("El Piti gana 3–1 en casa ante FUSION 7")).toBeInTheDocument();
    expect(screen.getByLabelText("Crónica")).toHaveValue("");
    await user.click(screen.getByRole("button", { name: "Preparar resumen con el acta" }));
    expect((screen.getByLabelText("Crónica") as HTMLTextAreaElement).value).not.toBe("");
    await user.type(screen.getByLabelText("Foto del partido (HTTPS)"), "http://x/foto.jpg");
    expect(screen.getByText("No es HTTPS")).toHaveClass("bad");
    expect(screen.getByText("MVP: se abre solo al publicar")).toBeInTheDocument();
    expect(within(screen.getByRole("list", { name: "Minutos" })).getAllByRole("listitem")).toHaveLength(12);
  });
});

describe("Partidos · a match to play, a published one", () => {
  it("to play: the acta waits for the match; Encuentro in three groups; «Borrar partido» hides it behind «Deshacer»", async () => {
    setAdminData(adminFixture({ published: cleanJ3() }));
    const user = userEvent.setup();
    const router = mountAdmin("/admin/partidos/m8", { partidos: Partidos });
    expect(await screen.findByRole("heading", { level: 2 })).toHaveTextContent("PITI – MAD SKY");
    expect(screen.getByRole("tab", { name: /Encuentro/ })).toHaveAttribute("aria-selected", "true");
    expect(screen.getByRole("tab", { name: /^Convocatoria\W+pendiente$/ })).toBeInTheDocument();
    expect(within(footer()).getByText("Por jugar · dom 8 nov 12:00")).toHaveClass("neu");
    expect(within(footer()).getByRole("button", { name: "Guardar" })).toHaveAttribute("aria-disabled", "true");
    for (const g of ["Rival y fecha", "Campo", "Detalles"]) expect(screen.getByRole("region", { name: g })).toBeInTheDocument();
    expect(screen.getByLabelText("Hora (Madrid)")).toHaveValue("12:00");
    expect(within(screen.getByRole("group", { name: "Condición" })).getByRole("button", { name: "Visitante" })).toHaveAttribute("aria-pressed", "true");
    // name · address in the one venue
    await user.type(screen.getByLabelText("Nombre del campo"), "Campo de MAD SKY");
    await user.type(screen.getByLabelText("Dirección"), "Calle Mayor 1");
    expect(screen.getByLabelText("Nombre del campo")).toHaveValue("Campo de MAD SKY");
    // the crest's HTTPS check
    await user.type(screen.getByLabelText("Escudo del rival (HTTPS, opcional)"), "https://x/escudo.png");
    expect(screen.getByText("Se ve bien")).toHaveClass("okk");
    await user.click(within(footer()).getByRole("button", { name: "Guardar" }));
    await waitFor(() => expect(save).toHaveBeenCalledTimes(1));
    expect(call()).toMatchObject({ id: "m8", draft: false, sheet: { venue: "Campo de MAD SKY · Calle Mayor 1", rivalLogoUrl: "https://x/escudo.png" } });
    expect(await screen.findByText("J3 guardado · el calendario ya lo tiene")).toBeInTheDocument();
    // the acta waits for the match
    await user.click(screen.getByRole("tab", { name: /Acta/ }));
    expect(screen.getByRole("heading", { name: "El acta se escribe en el partido" })).toBeInTheDocument();
    // «Borrar partido»: the red modal, then gone at once, deleted after the «Deshacer» window
    await user.click(screen.getByRole("tab", { name: /Encuentro/ }));
    await user.click(screen.getByRole("button", { name: "Borrar partido" }));
    const modal = screen.getByRole("alertdialog", { name: "¿Borrar la J3 · MAD SKY?" });
    expect(modal).toHaveClass("dz");
    expect(within(modal).getByText("Durante unos segundos se puede deshacer")).toBeInTheDocument();
    await user.click(within(modal).getByRole("button", { name: "Borrar partido" }));
    await waitFor(() => expect(router.state.location.pathname).toBe("/admin/partidos"));
    expect(screen.queryByRole("button", { name: /^J3, MAD SKY/ })).toBeNull();
    expect(caption()).toHaveTextContent("J3 borrada del calendario");
    expect(del).not.toHaveBeenCalled();
    await user.click(within(caption()).getByRole("button", { name: "Deshacer" }));
    await waitFor(() => expect(router.state.location.pathname).toBe("/admin/partidos/m8"));
    expect(screen.getByRole("button", { name: /^J3, MAD SKY/ })).toBeInTheDocument();
    expect(del).not.toHaveBeenCalled();
  });

  it("the Convocatoria tab only reads: el siete in shirts (a free peg), the banquillo, «Cambiarla en Convocar»", async () => {
    setAdminData(adminFixture({ published: cleanJ3() }));
    const user = userEvent.setup();
    const router = mountAdmin("/admin/partidos/m8?tab=convocatoria", { partidos: Partidos });
    const seven = await screen.findByRole("group", { name: "El siete · 6 de 7" });
    expect(seven.querySelectorAll(".peg")).toHaveLength(7);
    expect(within(seven).getByText("Libre")).toBeInTheDocument();
    expect(screen.getByText(/^Banquillo/)).toHaveTextContent("Banquillo 11 KEVIN21 ALMACHI");
    expect(screen.queryByRole("button", { name: "Siete" })).toBeNull();
    await user.click(screen.getByRole("button", { name: "Cambiarla en Convocar" }));
    await waitFor(() => expect(router.state.location.pathname).toBe("/admin/convocar"));
    expect(router.state.location.search).toMatchObject({ j: "m8" });
  });

  it("a draft-only match to play: «Sin publicar» + «Publicar en el calendario» (gold)", async () => {
    const data = adminFixture({ published: fixturePublished.filter((m) => m.id !== "m8") });
    const m8 = { ...cleanJ3().find((m) => m.id === "m8")!, draft: true, published: false, jornada: 3 };
    setAdminData({ ...data, matches: [...data.matches, m8] });
    const user = userEvent.setup();
    mountAdmin("/admin/partidos/m8", { partidos: Partidos });
    await screen.findByRole("heading", { level: 2 });
    expect(within(footer()).getByText("Sin publicar · aún no sale en el calendario")).toHaveClass("warn");
    await user.click(within(footer()).getByRole("button", { name: "Publicar en el calendario" }));
    await waitFor(() => expect(save).toHaveBeenCalledTimes(1));
    expect(call()).toMatchObject({ id: "m8", draft: false });
    expect(await screen.findByText("J3 · MAD SKY publicado · ya sale en el calendario")).toBeInTheDocument();
  });

  it("published: «Publicada · la web ya lo cuenta», «Guardar cambios», no delete; ?vitrina shows the peak and «Corregir el acta» goes back", async () => {
    setAdminData(adminFixture({ published: fullJ1() }));
    const user = userEvent.setup();
    const router = mountAdmin("/admin/partidos/m6", { partidos: Partidos });
    await screen.findByRole("heading", { level: 2 });
    expect(within(footer()).getByText("Publicada · la web ya lo cuenta")).toHaveClass("okk");
    expect(within(footer()).getByRole("button", { name: "Guardar cambios" })).toHaveAttribute("aria-disabled", "true");
    expect(screen.getByRole("tab", { name: /^Publicar\W+hecho$/ })).toBeInTheDocument();
    await user.click(screen.getByRole("tab", { name: /Encuentro/ }));
    expect(screen.getByText("Un partido jugado no se borra")).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Borrar partido" })).toBeNull();
    act(() => void router.navigate({ to: "/admin/partidos/$matchId", params: { matchId: "m6" }, search: { vitrina: true } }));
    const peak = await screen.findByRole("region", { name: "Acta publicada" });
    expect(within(peak).getByText("MVP cerrado")).toBeInTheDocument();
    await user.click(within(peak).getByRole("button", { name: "Corregir el acta" }));
    await waitFor(() => expect(router.state.location.search).toMatchObject({ tab: "acta" }));
    expect(screen.queryByRole("region", { name: "Acta publicada" })).toBeNull();
  });

  it("on a phone: the list alone, then the match full screen with ← and the picker as a bottom sheet", async () => {
    Object.defineProperty(window, "innerWidth", { configurable: true, value: 390 });
    const user = userEvent.setup();
    const router = mountAdmin("/admin/partidos", { partidos: Partidos });
    expect(await screen.findByRole("button", { name: /^J2, FUSION 7/ })).not.toHaveAttribute("aria-current");
    await user.click(screen.getByRole("button", { name: /^J2, FUSION 7/ }));
    await waitFor(() => expect(router.state.location.pathname).toBe("/admin/partidos/m7"));
    expect(screen.queryByRole("navigation", { name: "Sala de control" })).toBeNull();
    expect(screen.getByRole("tab", { name: /Convoc\./ })).toBeInTheDocument();
    await user.click(screen.getByRole("button", { name: "Elegir quién marcó el gol 3" }));
    const sheet = screen.getByRole("dialog", { name: "¿Quién marcó?" });
    expect(sheet).toHaveClass("sheet");
    expect(sheet).toHaveAttribute("aria-modal", "true");
    await user.click(within(sheet).getByRole("button", { name: "Lo completo luego" }));
    await user.click(screen.getByRole("button", { name: "Volver a la lista" }));
    await waitFor(() => expect(router.state.location.pathname).toBe("/admin/partidos"));
    expect(screen.getByRole("navigation", { name: "Sala de control" })).toBeInTheDocument();
  });
});
