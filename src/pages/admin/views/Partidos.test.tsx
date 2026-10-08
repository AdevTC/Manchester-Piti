import { act, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import * as api from "../../../lib/clubApi";
import { adminFixture, mountAdmin, setAdminData } from "../../../test/adminKit";
import { draftKey } from "../acta/localDraft";
import { fromMatch, setMinute, sig } from "../acta/sheetModel";
import { Partidos } from "./Partidos";

vi.mock("../data/useAdminData", async () => ({ useAdminData: (await import("../../../test/adminMocks")).currentAdminData }));
vi.mock("../../../context/AuthContext", async () => ({ useAuth: (await import("../../../test/adminMocks")).fakeAuth }));
vi.mock("../../../lib/clubApi", () => ({
  apiError: (e: unknown) => (e instanceof Error ? e.message : String(e)),
  saveMatchSheet: vi.fn(() => Promise.resolve({ data: { id: "x" } })),
}));
vi.mock("../../../lib/matchPoster", () => ({ downloadMatchPoster: vi.fn(() => Promise.resolve()) }));
vi.mock("../partidos/live", () => ({
  useMatchNote: () => ({ data: "Quedada 9:15 en el campo.", loading: false }),
  useMatchRsvp: () => ({ data: [], loading: false }),
  useMatchMvp: () => undefined,
}));
const save = vi.mocked(api.saveMatchSheet);
/** The first saveMatchSheet payload. */
const call = () => {
  const a = save.mock.calls[0]?.[0];
  if (!a) throw new Error("saveMatchSheet no se llamó");
  return a;
};

const acta = () => mountAdmin("/admin/partidos/m7?tab=acta", { partidos: Partidos });

describe("Partidos y actas", () => {
  beforeEach(() => {
    localStorage.clear();
    save.mockClear();
    setAdminData(adminFixture());
  });
  afterEach(() => vi.useRealTimers());

  it("lists the matches by group, filters and searches", async () => {
    const user = userEvent.setup();
    mountAdmin("/admin/partidos", { partidos: Partidos });
    expect(await screen.findByRole("heading", { level: 1, name: "Partidos y actas" })).toBeInTheDocument();
    expect(screen.getByText("3 jornadas · 2 por hacer · toca un partido para abrirlo")).toBeInTheDocument();
    const hacer = screen.getByRole("group", { name: "Por hacer" });
    expect(within(hacer).getAllByRole("button").map((b) => b.getAttribute("aria-label"))).toEqual(["Jornada 2, FUSION 7, Borrador · falta 1 goleador, 3–1", "Jornada 3, MAD SKY, Próximo · 3 sin convocar"]);
    const filters = screen.getByRole("group", { name: "Filtrar partidos" });
    await user.click(within(filters).getByRole("button", { name: /Publicados/ }));
    expect(screen.queryByRole("group", { name: "Por hacer" })).toBeNull();
    expect(within(screen.getByRole("group", { name: "Publicados" })).getByText("Emirates")).toBeInTheDocument();
    await user.click(within(filters).getByRole("button", { name: /Todo/ }));
    await user.type(screen.getByRole("searchbox", { name: "Buscar partido" }), "j3");
    expect(screen.getAllByRole("button", { name: /^Jornada/ }).map((b) => b.textContent)).toEqual([expect.stringContaining("MAD SKY")]);
    await user.clear(screen.getByRole("searchbox", { name: "Buscar partido" }));
    await user.type(screen.getByRole("searchbox", { name: "Buscar partido" }), "zzz");
    expect(screen.getByText("Ningún partido")).toBeInTheDocument();
    expect(screen.getByText("Nada con «zzz». Busca por rival o por jornada (J8).")).toBeInTheDocument();
  });

  it("opens a match in the URL and switches tabs there", async () => {
    const user = userEvent.setup();
    const router = mountAdmin("/admin/partidos", { partidos: Partidos });
    await user.click(await screen.findByRole("button", { name: /^Jornada 2, FUSION 7/ }));
    await waitFor(() => expect(router.state.location.pathname).toBe("/admin/partidos/m7"));
    const tabs = screen.getByRole("tablist", { name: "El partido" });
    expect(within(tabs).getByRole("tab", { name: /Acta/ })).toHaveAttribute("aria-selected", "true");
    expect(screen.getByRole("heading", { level: 2 })).toHaveTextContent("Piti 3–1 FUSION 7");
    expect(screen.getByText("J2 · Liga · dom 1 nov · en casa")).toBeInTheDocument();
    expect(screen.getByText("✓ Guardado dom 1 nov, 13:04 · hora de Madrid")).toBeInTheDocument();
    await user.click(within(tabs).getByRole("tab", { name: /Encuentro/ }));
    await waitFor(() => expect(router.state.location.search).toMatchObject({ tab: "encuentro" }));
    expect(screen.getByLabelText("Rival")).toHaveValue("FUSION 7");
    expect(screen.getByLabelText("Nota interna para el equipo")).toHaveValue("Quedada 9:15 en el campo.");
    // arrows move between tabs
    await user.keyboard("{ArrowRight}");
    await waitFor(() => expect(router.state.location.search).toMatchObject({ tab: "convocatoria" }));
    expect(screen.getByRole("heading", { name: "El siete y los nuestros" })).toBeInTheDocument();
  });

  it("«¿Quién marcó?»: scorer, then assist, fills the row; the minute makes it square", async () => {
    const user = userEvent.setup();
    acta();
    expect(await screen.findByText("No cuadra todavía")).toBeInTheDocument();
    expect(screen.getByText("Para publicar: falta el goleador del gol 3.")).toBeInTheDocument();
    await user.click(screen.getByRole("button", { name: "Elegir quién marcó el gol 3" }));
    const pick = screen.getByRole("dialog", { name: "Gol 3 · ¿Quién marcó?" });
    expect(within(pick).getByText("Paso 1 de 2 · goleador")).toBeInTheDocument();
    // titulares first, suplentes marked
    const opts = within(pick).getAllByRole("button", { name: /lo marcó/ });
    expect(opts.map((o) => o.querySelector("small")?.textContent)).toEqual(["EVANS", "ILLESCAS", "EGUZQUIZA", "ERIK", "ADRIÁN T.C.", "HUBEROSKI", "TELLO", "KEVIN", "FER", "ANDIA", "ALMACHI", "BRAWAN"]);
    expect(opts[7].querySelector("em")).toHaveTextContent("suplente");
    await user.click(within(pick).getByRole("button", { name: "Gol 3: lo marcó HUBEROSKI, dorsal 14" }));
    const step2 = screen.getByRole("dialog", { name: "Gol 3 de HUBEROSKI · ¿Quién dio el pase?" });
    expect(within(step2).queryByRole("button", { name: /HUBEROSKI/ })).toBeNull();
    await user.click(within(step2).getByRole("button", { name: "Asistencia de ERIK, dorsal 9" }));
    expect(screen.queryByRole("dialog")).toBeNull();
    const row = screen.getByRole("button", { name: "Cambiar goleador y asistencia del gol 3" }).closest("li")!;
    expect(row).toHaveTextContent("HUBEROSKI");
    expect(row).toHaveTextContent("Gol 3 · asiste ERIK");
    expect(screen.getByText("● Cambios sin guardar")).toBeInTheDocument();
    expect(screen.getByText("Para publicar: falta el minuto del gol 3.")).toBeInTheDocument();
    await user.type(screen.getByLabelText("Minuto del gol 3"), "46");
    expect(screen.getByText("Cuadra · lista para publicar")).toBeInTheDocument();
    expect(screen.getByRole("tab", { name: /Acta/ }).querySelector("i")).toHaveTextContent("✓");
  });

  it("adding a goal opens the picker; autogol, Esc and «Lo completo luego» close it", async () => {
    const user = userEvent.setup();
    acta();
    await user.click(await screen.findByRole("button", { name: "Añadir un gol del Piti" }));
    expect(screen.getByLabelText("Goles del Piti")).toHaveTextContent("4");
    const pick = screen.getByRole("dialog", { name: "Gol 4 · ¿Quién marcó?" });
    await user.click(within(pick).getByRole("button", { name: "Gol 4: autogol de FUSION 7" }));
    expect(screen.queryByRole("dialog")).toBeNull();
    expect(screen.getByText("Autogol de FUSION 7")).toBeInTheDocument();
    expect(screen.getByText("Gol 4 · cuenta para el Piti")).toBeInTheDocument();
    // Esc closes it and gives the focus back to its row
    const elegir = screen.getByRole("button", { name: "Elegir quién marcó el gol 3" });
    await user.click(elegir);
    expect(screen.getByRole("dialog", { name: /Gol 3/ })).toBeInTheDocument();
    await user.keyboard("{Escape}");
    expect(screen.queryByRole("dialog")).toBeNull();
    expect(elegir).toHaveFocus();
    await user.click(elegir);
    await user.click(screen.getByRole("button", { name: "Lo completo luego" }));
    expect(screen.queryByRole("dialog")).toBeNull();
  });

  it("typing a dorsal in the picker picks that player", async () => {
    const user = userEvent.setup();
    acta();
    await user.click(await screen.findByRole("button", { name: "Elegir quién marcó el gol 3" }));
    await user.keyboard("14");
    expect(screen.getByRole("dialog", { name: "Gol 3 de HUBEROSKI · ¿Quién dio el pase?" })).toBeInTheDocument();
  });

  it("removing a named goal asks first; an empty one goes at once", async () => {
    const user = userEvent.setup();
    acta();
    // the last goal (3) has no scorer: it just goes
    await user.click(await screen.findByRole("button", { name: "Quitar el último gol del Piti" }));
    expect(screen.getByLabelText("Goles del Piti")).toHaveTextContent("2");
    await user.click(screen.getByRole("button", { name: "Quitar el último gol del Piti" }));
    const ask = screen.getByRole("alertdialog", { name: /¿Quitar el gol 2 de ADRIÁN T.C. \(31′\)\?/ });
    await user.click(within(ask).getByRole("button", { name: "Cancelar" }));
    expect(screen.getByLabelText("Goles del Piti")).toHaveTextContent("2");
    await user.click(screen.getByRole("button", { name: "Quitar el último gol del Piti" }));
    await user.click(screen.getByRole("button", { name: "Quitar el gol" }));
    expect(screen.getByLabelText("Goles del Piti")).toHaveTextContent("1");
  });

  it("publishing waits until it squares, then the modal sends the acta", async () => {
    const user = userEvent.setup();
    acta();
    const footerPublish = await screen.findByRole("button", { name: "Publicar acta" });
    expect(footerPublish).toHaveAttribute("aria-disabled", "true");
    await user.click(footerPublish);
    expect(screen.queryByRole("dialog")).toBeNull();
    expect(screen.getByText("Para publicar: falta el goleador del gol 3.")).toHaveClass("hl");
    await user.type(screen.getByLabelText("Minuto del gol 3"), "46");
    await user.click(screen.getByRole("button", { name: "Elegir quién marcó el gol 3" }));
    await user.click(screen.getByRole("button", { name: "Gol 3: lo marcó HUBEROSKI, dorsal 14" }));
    await user.click(screen.getByRole("button", { name: "Gol 3 sin asistencia" }));
    await user.click(screen.getByRole("button", { name: "Publicar acta" }));
    const modal = screen.getByRole("dialog", { name: "¿Publicar el acta?" });
    expect(within(modal).getByText("3–1")).toBeInTheDocument();
    expect(within(modal).getAllByText(/′/).map((x) => x.textContent)).toEqual(["ADRIÁN T.C. 9′ (HUBEROSKI)", "ADRIÁN T.C. 31′ (ERIK)", "HUBEROSKI 46′"]);
    expect(within(modal).getByText("La votación del MVP se abre ahora y cierra en 48 h (mié 4 nov, 10:00)")).toBeInTheDocument();
    await user.click(within(modal).getByRole("button", { name: "Publicar acta" }));
    await waitFor(() => expect(screen.queryByRole("dialog", { name: "¿Publicar el acta?" })).toBeNull());
    expect(save).toHaveBeenCalledTimes(1);
    const arg = call();
    expect(arg.id).toBe("m7");
    expect(arg.draft).toBe(false);
    expect(arg.sheet).toMatchObject({ seasonId: "t1", rival: "FUSION 7", status: "finished", goalsFor: 3, goalsAgainst: 1, starters: expect.arrayContaining(["adrian"]), meetingNote: "Quedada 9:15 en el campo." });
    expect(arg.sheet.events).toEqual([
      { id: "g1", type: "goal", minute: 9, playerId: "adrian", assistPlayerId: "huberoski" },
      { id: "g2", type: "goal", minute: 31, playerId: "adrian", assistPlayerId: "erik" },
      { id: "r1", type: "opponent_goal", minute: 18 },
      { id: "open-g0", type: "goal", minute: 46, playerId: "huberoski" },
    ]);
    expect(await screen.findByText("Acta J2 publicada · web al día · MVP abierto 48 h.")).toBeInTheDocument();
  });

  it("«Guardar borrador» saves a draft and says so", async () => {
    const user = userEvent.setup();
    acta();
    await user.type(await screen.findByLabelText("Minuto del gol 3"), "46");
    await user.click(screen.getByRole("button", { name: /Guardar borrador/ }));
    await waitFor(() => expect(save).toHaveBeenCalledTimes(1));
    expect(call()).toMatchObject({ id: "m7", draft: true });
    expect(call().sheet.events.at(-1)).toEqual({ id: "open-g0", type: "goal", minute: 46 });
    expect(await screen.findByText("Borrador guardado · solo lo ven los capitanes.")).toBeInTheDocument();
    expect(screen.queryByText("● Cambios sin guardar")).toBeNull();
  });

  it("leaving a dirty acta asks: Seguir editando keeps it; Descartar leaves", async () => {
    const user = userEvent.setup();
    const router = acta();
    await user.type(await screen.findByLabelText("Minuto del gol 3"), "46");
    await user.click(screen.getByRole("button", { name: /^Jornada 1, Emirates/ }));
    const guard = await screen.findByRole("alertdialog", { name: "¿Salir sin guardar?" });
    expect(within(guard).getByText(/Hay cambios sin guardar en el acta de la J2/)).toBeInTheDocument();
    expect(within(guard).getByRole("button", { name: "Guardar borrador y salir" })).toBeInTheDocument();
    await user.click(within(guard).getByRole("button", { name: "Seguir editando" }));
    expect(router.state.location.pathname).toBe("/admin/partidos/m7");
    expect(screen.getByLabelText("Minuto del gol 3")).toHaveValue("46");
    // switching tabs is not leaving
    await user.click(screen.getByRole("tab", { name: /Publicar/ }));
    expect(screen.queryByRole("alertdialog")).toBeNull();
    await user.click(screen.getByRole("button", { name: /^Jornada 1, Emirates/ }));
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
    // every edit is mirrored
    await user.clear(screen.getByLabelText("Minuto del gol 3"));
    await user.type(screen.getByLabelText("Minuto del gol 3"), "47");
    const stored = JSON.parse(localStorage.getItem(draftKey("acta", "m7")) ?? "{}") as { value: { events: { id: string; minute?: number }[] } };
    expect(stored.value.events.find((e) => e.id === "open-g0")?.minute).toBe(47);
  });

  it("the convocatoria keeps seven titulares at most", async () => {
    const user = userEvent.setup();
    mountAdmin("/admin/partidos/m7?tab=convocatoria", { partidos: Partidos });
    expect(await screen.findByText("7 de 7 titulares")).toBeInTheDocument();
    const kevin = screen.getByRole("group", { name: "Convocatoria de KEVIN" });
    await user.click(within(kevin).getByRole("button", { name: "Titular" }));
    expect(screen.getByText("Ya hay siete titulares: pasa uno a suplente antes de subir a KEVIN.")).toBeInTheDocument();
    expect(within(kevin).getByRole("button", { name: "Titular" })).toHaveAttribute("aria-pressed", "false");
    await user.click(within(screen.getByRole("group", { name: "Convocatoria de ERIK" })).getByRole("button", { name: "Suplente" }));
    await user.click(within(kevin).getByRole("button", { name: "Titular" }));
    expect(within(kevin).getByRole("button", { name: "Titular" })).toHaveAttribute("aria-pressed", "true");
    expect(screen.getByText("7 de 7 titulares")).toBeInTheDocument();
  });

  it("«Nuevo partido» needs the rival, warns of the return match, creates a draft and opens it", async () => {
    const user = userEvent.setup();
    const router = mountAdmin("/admin/partidos", { partidos: Partidos });
    await user.click(await screen.findByRole("button", { name: "Nuevo partido" }));
    const modal = await screen.findByRole("dialog", { name: "Nuevo partido" });
    expect(within(modal).getByLabelText("Rival")).toHaveFocus();
    expect(within(modal).getByLabelText("Fecha")).toHaveValue("2026-11-15");
    expect(within(modal).getByLabelText("Hora (Madrid)")).toHaveValue("12:00");
    await user.click(within(modal).getByRole("button", { name: "Crear partido" }));
    expect(within(modal).getByText("Falta el rival")).toBeInTheDocument();
    expect(save).not.toHaveBeenCalled();
    await user.type(within(modal).getByLabelText("Rival"), "emirates");
    expect(within(modal).getByText("Ya jugasteis contra Emirates en la J1 · será la vuelta")).toBeInTheDocument();
    await user.clear(within(modal).getByLabelText("Rival"));
    await user.type(within(modal).getByLabelText("Rival"), "Laureles CF");
    expect(within(modal).getByText(/Iniciales: /)).toBeInTheDocument();
    await user.click(within(modal).getByRole("button", { name: "Visitante" }));
    await user.click(within(modal).getByRole("button", { name: "Crear partido" }));
    await waitFor(() => expect(save).toHaveBeenCalledTimes(1));
    const arg = call();
    expect(arg.draft).toBe(true);
    expect(arg.sheet).toMatchObject({ seasonId: "t1", rival: "Laureles CF", home: false, competition: "Liga", status: "scheduled", date: Date.UTC(2026, 10, 15, 11, 0) });
    await waitFor(() => expect(router.state.location.pathname).toBe(`/admin/partidos/${arg.id}`));
    expect(router.state.location.search).toMatchObject({ tab: "encuentro" });
    expect(await screen.findByText("J4 · Laureles CF creado · dom 15 nov, 12:00.")).toBeInTheDocument();
  });

  it("N opens «Nuevo partido» when no field is focused", async () => {
    const user = userEvent.setup();
    mountAdmin("/admin/partidos", { partidos: Partidos });
    await screen.findByRole("heading", { level: 1, name: "Partidos y actas" });
    await user.type(screen.getByRole("searchbox", { name: "Buscar partido" }), "n");
    expect(screen.queryByRole("dialog", { name: "Nuevo partido" })).toBeNull();
    await act(async () => {
      (document.activeElement as HTMLElement | null)?.blur();
    });
    await user.keyboard("n");
    expect(await screen.findByRole("dialog", { name: "Nuevo partido" })).toBeInTheDocument();
  });

  it("on a phone: the list alone, then the match full screen with ← and the picker as a bottom sheet", async () => {
    const width = window.innerWidth;
    Object.defineProperty(window, "innerWidth", { configurable: true, value: 390 });
    try {
      const user = userEvent.setup();
      const router = mountAdmin("/admin/partidos", { partidos: Partidos });
      await screen.findByRole("heading", { level: 1, name: "Partidos y actas" });
      expect(screen.queryByRole("tablist")).toBeNull();
      await user.click(screen.getByRole("button", { name: /^Jornada 2, FUSION 7/ }));
      await waitFor(() => expect(router.state.location.pathname).toBe("/admin/partidos/m7"));
      expect(document.querySelector(".vpa")).toHaveClass("det");
      await user.click(screen.getByRole("button", { name: "Elegir quién marcó el gol 3" }));
      const sheet = screen.getByRole("dialog", { name: "Gol 3 · ¿Quién marcó?" });
      expect(sheet).toHaveClass("pks");
      expect(sheet).toHaveAttribute("aria-modal", "true");
      expect(within(sheet).getByText("Acta · J2 · 3–1")).toBeInTheDocument();
      await user.click(within(sheet).getByRole("button", { name: "Lo completo luego" }));
      await user.click(screen.getByRole("button", { name: "Volver a la lista de partidos" }));
      await waitFor(() => expect(router.state.location.pathname).toBe("/admin/partidos"));
    } finally {
      Object.defineProperty(window, "innerWidth", { configurable: true, value: width });
    }
  });

  it("a published match opens as its summary with «Corregir el acta»", async () => {
    const user = userEvent.setup();
    const router = mountAdmin("/admin/partidos/m6", { partidos: Partidos });
    expect(await screen.findByText("Acta publicada")).toBeInTheDocument();
    expect(screen.getByRole("heading", { level: 2 })).toHaveTextContent("Piti 4–1 Emirates");
    await user.click(screen.getByRole("button", { name: "Corregir el acta" }));
    await waitFor(() => expect(router.state.location.search).toMatchObject({ tab: "acta" }));
    expect(screen.getByRole("tablist", { name: "El partido" })).toBeInTheDocument();
  });
});
