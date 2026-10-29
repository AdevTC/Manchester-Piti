// The acta's stations in the real sala (the frame, the match's layout, the stations): Acta, Publicar, Después,
// Narración and Historial over the fixture club (test/adminKit), with the callables mocked.
import { act, cleanup, fireEvent, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import * as api from "../../../../lib/clubApi";
import type { ClubMatch } from "../../../../lib/clubData";
import { DEFAULT_ANALYSIS_PROFILE } from "../../../../../functions/src/narrated/types";
import { adminFixture, fixtureDrafts, fixturePublished, mountAdmin, setAdminData } from "../../../../test/adminKit";
import { draftKey } from "../../acta/localDraft";
import { fromMatch, setMinute, sig } from "../../acta/sheetModel";
import { resetWhistledForTests } from "../../data/whistleStore";
import { ActaScreen } from "./Acta";
import { resetSheetStoresForTests } from "./sheetStore";

vi.setConfig({ testTimeout: 20_000 });

const live = vi.hoisted(() => ({
  mvp: new Map<string, { id: string; counts: Record<string, number>; total: number; eligible?: number; open?: boolean }>(),
  notasError: null as { at: number; message: string } | null,
  audit: [] as { id: string; d: Record<string, unknown> }[],
  pushSent: [] as { id: string; d: Record<string, unknown> }[],
  turns: [] as unknown[],
  pins: { frozen: false, turns: {} } as { frozen: boolean; turns: Record<string, unknown>; done?: Record<string, number> },
}));
vi.mock("../../data/useAdminData", async () => ({ useAdminData: (await import("../../../../test/adminMocks")).currentAdminData }));
vi.mock("../../../../context/AuthContext", async () => ({ useAuth: (await import("../../../../test/adminMocks")).fakeAuth }));
vi.mock("../../../../lib/clubApi", () => ({
  apiError: (e: unknown) => (e instanceof Error ? e.message : String(e)),
  saveMatchSheet: vi.fn(() => Promise.resolve({ data: { id: "x" } })),
  discardMatchDraft: vi.fn(() => Promise.resolve({ data: { ok: true } })),
  setMvpVote: vi.fn(() => Promise.resolve({ data: { voteClosesAt: Date.UTC(2026, 10, 4, 18, 5) } })),
  recalcMatchNotas: vi.fn(() => Promise.resolve({ data: { players: 9, mean: 6.8 } })),
  setVideoMarks: vi.fn(() => Promise.resolve({ data: { ok: true, revision: 2, marks: {} } })),
  markTurnDone: vi.fn(() => Promise.resolve({ data: { done: true } })),
  deleteMatch: vi.fn(() => Promise.resolve({ data: { ok: true } })),
  setMatchArchived: vi.fn(() => Promise.resolve({ data: { ok: true } })),
}));
vi.mock("../../../../lib/matchPoster", () => ({ downloadMatchPoster: vi.fn(() => Promise.resolve()) }));
vi.mock("../../partidos/live", () => ({
  useMatchNote: () => ({ data: "Quedada 9:15 en el campo.", loading: false }),
  useMatchRsvp: () => ({ data: [], loading: false }),
  useMatchMvp: () => undefined,
}));
vi.mock("../../data/useCaja", () => ({ useCajaClaims: () => ({ data: [], loading: false, error: false }) }));
vi.mock("../../../../components/jersey3d/usePageKitStills", () => ({ usePageKitStills: () => () => undefined }));
vi.mock("../../../../lib/useStandings", () => ({ useStandings: () => ({ standings: null, loading: false }) }));
vi.mock("../../../../lib/useRotaTurns", () => ({ useMatchTurns: () => ({ turns: live.turns, rota: null, pins: live.pins, loading: false, error: false }) }));
vi.mock("../../../vestuario/live", async (orig) => {
  const real = await orig<typeof import("../../../vestuario/live")>();
  const empty = { data: [], loading: false, error: false };
  return {
    ...real,
    useMvpResults: () => live.mvp,
    useMatchPrivate: () => ({ data: { meetingNote: "", scorerUids: [], porraCount: null, notasError: live.notasError }, loading: false, error: false }),
    useMatchPredictions: () => empty,
    useCaja: () => ({ settings: { cuota: 0 }, movs: [], loading: false, error: false }),
    useMatchPushSent: <T,>(_id: string | undefined, _on: boolean, map: (id: string, d: Record<string, unknown>) => T) => ({ data: live.pushSent.map((x) => map(x.id, x.d)), loading: false, error: false }),
    useMatchAudit: <T,>(_id: string | undefined, _on: boolean, map: (id: string, d: Record<string, unknown>) => T) => ({ data: live.audit.map((x) => map(x.id, x.d)), loading: false, error: false }),
  };
});

const save = vi.mocked(api.saveMatchSheet);
const discard = vi.mocked(api.discardMatchDraft);
const mvpVote = vi.mocked(api.setMvpVote);
const recalc = vi.mocked(api.recalcMatchNotas);
const call = (i = 0) => {
  const a = save.mock.calls[i]?.[0];
  if (!a) throw new Error("saveMatchSheet no se llamó");
  return a;
};
const WIDTH = window.innerWidth;
const SEVEN = ["evans", "illescas", "tello", "eguzquiza", "huberoski", "erik", "adrian"];
const caption = () => screen.getAllByRole("status").find((s) => s.classList.contains("sc-status__live")) as HTMLElement;
const foot = () => document.querySelector(".sac-foot") as HTMLElement;
const open = (path = "/admin/partidos/m7/acta") => mountAdmin(path, { detalle: ActaScreen });
const withMatch = (id: string, over: Partial<ClubMatch>): ClubMatch[] => fixturePublished.map((m) => (m.id === id ? { ...m, ...over } : m));
/** The J1 (m6) published with its whole acta, its notas frozen and its MVP closed. */
const fullJ1 = (over: Partial<ClubMatch> = {}) =>
  withMatch("m6", {
    starters: SEVEN,
    bench: ["kevin", "almachi", "andia", "fer", "brawan"],
    notCalled: [],
    duration: 50,
    kit: "home",
    events: [
      { id: "a", type: "goal", minute: 5, playerId: "erik" },
      { id: "b", type: "goal", minute: 10, playerId: "erik" },
      { id: "c", type: "goal", minute: 20, playerId: "adrian" },
      { id: "d", type: "goal", minute: 30, playerId: "huberoski" },
      { id: "e", type: "opponent_goal", minute: 40 },
    ],
    notas: { model: "piti-media-v3", rival: 1, players: { erik: { nota: 8.6, minutes: 50, weight: 1, narrated: false }, adrian: { nota: 7.4, minutes: 50, weight: 1, narrated: false }, evans: { nota: 6.2, minutes: 50, weight: 1, narrated: false } } },
    ...over,
  });

beforeEach(() => {
  localStorage.clear();
  resetWhistledForTests();
  resetSheetStoresForTests();
  save.mockReset().mockResolvedValue({ data: { id: "x" } } as never);
  discard.mockClear();
  mvpVote.mockClear();
  recalc.mockClear();
  live.mvp = new Map();
  live.notasError = null;
  live.audit = [];
  live.pushSent = [];
  live.turns = [];
  live.pins = { frozen: false, turns: {} };
  vi.mocked(api.markTurnDone).mockReset().mockResolvedValue({ data: { done: true } } as never);
  setAdminData(adminFixture());
});
afterEach(() => {
  vi.useRealTimers();
  Object.defineProperty(window, "innerWidth", { configurable: true, value: WIDTH });
});

describe("Acta · lo apuntado", () => {
  it("opens with its own navigation, «La cuenta», «¿Cuadra?» with each fix and the foot", async () => {
    open();
    expect(await screen.findByRole("navigation", { name: "El acta" })).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "Lo apuntado" })).toHaveAttribute("aria-current", "page");
    expect(screen.getByRole("heading", { name: "Goles del Piti" })).toBeInTheDocument();
    expect(screen.getByRole("heading", { name: "Goles de FUSION 7" })).toBeInTheDocument();
    expect(screen.getByLabelText("Manchester Piti 3–1 FUSION 7")).toBeInTheDocument();
    expect(screen.getByLabelText("Con goleador: 2 de 3")).toHaveTextContent("2 de 3");
    const chk = screen.getByRole("complementary", { name: "¿Cuadra? y la cuenta" });
    const missing = within(chk).getByText("Falta el goleador del gol 3").closest("li") as HTMLElement;
    expect(missing).toHaveClass("is-mal");
    expect(within(missing).getByText("Falta")).toBeInTheDocument();
    expect(within(foot()).getByText("No cuadra: falta el goleador de 1 gol")).toBeInTheDocument();
    expect(within(foot()).getByRole("button", { name: "Ir a publicar" })).toBeInTheDocument();
    // the fix opens the picker on that goal's row
    await userEvent.setup().click(within(missing).getByRole("button", { name: "Elegir el goleador del gol 3" }));
    expect(screen.getByRole("group", { name: "¿Quién marcó?" })).toBeInTheDocument();
  });

  it("«¿Quién marcó?» in its row: the pitch at that minute first, then the pass; the minute makes it square", async () => {
    const user = userEvent.setup();
    open();
    const who = (await screen.findAllByRole("button", { name: "Elegir el goleador del gol 3" }))[0];
    const row = who.closest("li") as HTMLElement;
    expect(row).toHaveClass("is-falta");
    expect(within(row).getByText("Gol 3 · falta quién marcó")).toBeInTheDocument();
    await user.click(who);
    const pick = within(row).getByRole("group", { name: "¿Quién marcó?" });
    expect(within(pick).getByText("Gol 3 · paso 1 de 2")).toBeInTheDocument();
    const [field, bench] = Array.from(pick.querySelectorAll<HTMLElement>(".sac-pick__grid"));
    expect(within(field).getAllByRole("button").map((b) => b.querySelector("span")?.textContent)).toEqual(["EVANS", "ILLESCAS", "TELLO", "EGUZQUIZA", "HUBEROSKI", "ERIK", "ADRIÁN T.C."]);
    expect(within(bench).getAllByRole("button")).toHaveLength(5);
    await user.click(within(pick).getByRole("button", { name: "HUBEROSKI marcó el gol 3" }));
    const step2 = within(row).getByRole("group", { name: "¿Quién le dio el pase?" });
    expect(within(step2).queryByRole("button", { name: /HUBEROSKI/ })).toBeNull();
    await user.click(within(step2).getByRole("button", { name: "Pase de ERIK" }));
    expect(screen.queryByRole("group", { name: /¿Quién/ })).toBeNull();
    expect(caption()).toHaveTextContent("Gol 3: HUBEROSKI, pase de ERIK");
    expect(within(foot()).getByText("● Cambios sin guardar")).toBeInTheDocument();
    expect(within(foot()).getByText("No cuadra: falta el minuto del gol 3")).toBeInTheDocument();
    await user.type(screen.getByLabelText("Minuto del gol 3"), "46");
    expect(within(foot()).getByText("Cuadra · 3 goles, todos con goleador")).toBeInTheDocument();
  });

  it("typing a dorsal picks that player; Esc closes; «Lo completo luego»; «Quitar este gol» with «Deshacer»", async () => {
    const user = userEvent.setup();
    open();
    await user.click((await screen.findAllByRole("button", { name: "Elegir el goleador del gol 3" }))[0]);
    await user.keyboard("14");
    expect(screen.getByRole("group", { name: "¿Quién le dio el pase?" })).toBeInTheDocument();
    await user.keyboard("{Escape}");
    expect(screen.queryByRole("group", { name: /¿Quién/ })).toBeNull();
    // a new goal: autogol
    await user.click(screen.getByRole("button", { name: "Gol del Piti" }));
    await user.click(screen.getByRole("button", { name: "Autogol de FUSION 7" }));
    expect(screen.getByText("Gol 4 · cuenta para el Piti")).toBeInTheDocument();
    expect(screen.getByLabelText("Manchester Piti 4–1 FUSION 7")).toBeInTheDocument();
    await user.click(screen.getByRole("button", { name: "Cambiar goleador del gol 4" }));
    await user.click(screen.getByRole("button", { name: "Quitar este gol" }));
    expect(screen.getByLabelText("Manchester Piti 3–1 FUSION 7")).toBeInTheDocument();
    expect(caption()).toHaveTextContent("Gol 4 quitado");
    await user.click(within(caption()).getByRole("button", { name: "Deshacer" }));
    expect(screen.getByLabelText("Manchester Piti 4–1 FUSION 7")).toBeInTheDocument();
  });

  it("rival goals: a new one takes the focus on its minute; removing one offers «Deshacer»; none = «Portería a cero»", async () => {
    const user = userEvent.setup();
    open();
    await user.click(await screen.findByRole("button", { name: "Gol en contra" }));
    expect(screen.getByLabelText("Minuto del gol 2 de FUSION 7")).toHaveFocus();
    expect(screen.getByText("Falta el minuto · apúntalo para publicar")).toBeInTheDocument();
    await user.click(screen.getByRole("button", { name: "Quitar el gol 2 de FUSION 7" }));
    await user.click(screen.getByRole("button", { name: "Quitar el gol 1 de FUSION 7" }));
    expect(screen.getByText("Portería a cero.")).toBeInTheDocument();
    await user.click(within(caption()).getByRole("button", { name: "Deshacer" }));
    expect(screen.getByLabelText("Minuto del gol 1 de FUSION 7")).toHaveValue("18");
    // an own goal of ours
    await user.selectOptions(screen.getByLabelText("Quién marcó el gol 1 de FUSION 7"), "tello");
    expect(screen.getByText("Gol en propia de TELLO")).toBeInTheDocument();
  });

  it("cards and changes are written in place: errors in words, the change checks who is on the pitch, «Quitar» with «Deshacer»", async () => {
    const user = userEvent.setup();
    open();
    await user.click(await screen.findByRole("button", { name: "Añadir en Tarjetas" }));
    const ed = screen.getByRole("form", { name: "Añadir en Tarjetas" });
    await user.click(within(ed).getByRole("button", { name: "Guardar" }));
    expect(within(ed).getByRole("alert")).toHaveTextContent("Pon el minuto (de 0 a 50).");
    await user.type(within(ed).getByLabelText("Minuto (de 0 a 50)"), "22");
    await user.click(within(ed).getByRole("button", { name: "Guardar" }));
    expect(within(ed).getByRole("alert")).toHaveTextContent("Elige el jugador por su dorsal.");
    await user.selectOptions(within(ed).getByLabelText("Jugador"), "eguzquiza");
    await user.click(within(ed).getByRole("button", { name: "Guardar" }));
    expect(caption()).toHaveTextContent("Apuntado: Amarilla · EGUZQUIZA · 22′");
    const card = screen.getByRole("button", { name: /^Editar: .*EGUZQUIZA \(22′\)$/ });
    // a change: someone on the bench cannot «leave»
    await user.click(screen.getByRole("button", { name: "Cambio" }));
    const cam = screen.getByRole("form", { name: "Añadir en Cambios" });
    await user.type(within(cam).getByLabelText("Minuto (de 0 a 50)"), "30");
    await user.selectOptions(within(cam).getByLabelText("Sale del campo"), "kevin");
    await user.selectOptions(within(cam).getByLabelText("Entra al campo · del banquillo"), "almachi");
    await user.click(within(cam).getByRole("button", { name: "Guardar" }));
    expect(within(cam).getByRole("alert")).toHaveTextContent("En el minuto 30, KEVIN no está en el campo: elige quién sale.");
    await user.selectOptions(within(cam).getByLabelText("Sale del campo"), "tello");
    await user.click(within(cam).getByRole("button", { name: "Guardar" }));
    expect(screen.getByRole("button", { name: /^Corregir: .*ALMACHI.*\(30′\)$/ })).toBeInTheDocument();
    // TELLO plays 30 minutes now
    expect(screen.getByRole("listitem", { name: "TELLO: 30 minutos, del 0 al 30" })).toBeInTheDocument();
    await user.click(card);
    await user.click(within(screen.getByRole("form", { name: "Corregir la jugada" })).getByRole("button", { name: "Quitar" }));
    expect(screen.getByText("Sin tarjetas.")).toBeInTheDocument();
    await user.click(within(caption()).getByRole("button", { name: "Deshacer" }));
    expect(screen.queryByText("Sin tarjetas.")).toBeNull();
  });

  it("guests: added to the banquillo and in every picker; one in a play cannot leave", async () => {
    const user = userEvent.setup();
    open();
    await user.type(await screen.findByLabelText("Añadir invitado"), "Rafa");
    await user.click(screen.getByRole("button", { name: "Añadir" }));
    expect(caption()).toHaveTextContent("Rafa (invitado), en el banquillo · ya sale en los selectores");
    expect(screen.getByText("Invitado · En el banquillo")).toBeInTheDocument();
    await user.click(screen.getAllByRole("button", { name: "Elegir el goleador del gol 3" })[0]);
    await user.click(screen.getByRole("button", { name: "Rafa (invitado) marcó el gol 3" }));
    await user.click(screen.getByRole("button", { name: "Sin asistencia" }));
    await user.click(screen.getByRole("button", { name: "No se puede quitar a Rafa: sale en el acta" }));
    expect(await screen.findByText("No se puede quitar a Rafa: sale en el acta")).toBeInTheDocument();
  });

  it("«Guardar borrador» saves a draft and says so", async () => {
    const user = userEvent.setup();
    open();
    await user.type(await screen.findByLabelText("Minuto del gol 3"), "46");
    await user.click(within(foot()).getByRole("button", { name: "Guardar borrador" }));
    await waitFor(() => expect(save).toHaveBeenCalledTimes(1));
    expect(call()).toMatchObject({ id: "m7", draft: true });
    expect(call().sheet.events.at(-1)).toEqual({ id: "open-g0", type: "goal", minute: 46 });
    expect(await screen.findByText("Borrador guardado · solo lo ven los capitanes")).toBeInTheDocument();
    expect(screen.queryByText("● Cambios sin guardar")).toBeNull();
  });

  it("the edits survive moving between Acta, Publicar and Narración; leaving them asks, and «Descartar» forgets them", async () => {
    const user = userEvent.setup();
    const router = open();
    await user.type(await screen.findByLabelText("Minuto del gol 3"), "46");
    const carril = screen.getByRole("navigation", { name: "Las estaciones del partido" });
    await user.click(within(carril).getByRole("link", { name: /· Publicar/ }));
    await waitFor(() => expect(router.state.location.pathname).toBe("/admin/partidos/m7/publicar"));
    expect(screen.queryByRole("alertdialog")).toBeNull();
    expect(within(foot()).getByText("● Cambios sin guardar")).toBeInTheDocument();
    act(() => void router.navigate({ to: "/admin/partidos/$matchId/acta/narracion", params: { matchId: "m7" } }));
    await screen.findByRole("heading", { name: "Análisis narrado · J2" });
    expect(screen.queryByRole("alertdialog")).toBeNull();
    await user.click(screen.getByRole("link", { name: "Lo apuntado" }));
    expect(await screen.findByLabelText("Minuto del gol 3")).toHaveValue("46");
    // leaving by the capsule asks
    const places = screen.getByRole("navigation", { name: "Sala de control" });
    await user.click(within(places).getByRole("link", { name: /^Hoy/ }));
    const guard = await screen.findByRole("alertdialog", { name: "¿Salir sin guardar?" });
    expect(within(guard).getByText(/Hay cambios sin guardar en el acta de la J2/)).toBeInTheDocument();
    await user.click(within(guard).getByRole("button", { name: "Seguir editando" }));
    expect(router.state.location.pathname).toBe("/admin/partidos/m7/acta");
    await user.click(within(places).getByRole("link", { name: /^Hoy/ }));
    await user.click(await screen.findByRole("button", { name: "Descartar cambios" }));
    await waitFor(() => expect(router.state.location.pathname).toBe("/admin"));
    await waitFor(() => expect(localStorage.getItem(draftKey("acta", "m7"))).toBeNull());
    act(() => void router.navigate({ to: "/admin/partidos/$matchId/acta", params: { matchId: "m7" } }));
    expect(await screen.findByLabelText("Minuto del gol 3")).toHaveValue("");
  });

  it("mirrors unsaved edits on this device and offers them back", async () => {
    const data = adminFixture();
    const m7 = data.matches.find((m) => m.id === "m7")!;
    const base = fromMatch(m7, "Quedada 9:15 en el campo.");
    localStorage.setItem(draftKey("acta", "m7"), JSON.stringify({ at: Date.UTC(2026, 10, 2, 8, 30), base: sig(base), value: setMinute(base, "open-g0", "46") }));
    const user = userEvent.setup();
    open();
    expect(await screen.findByText("Hay cambios sin guardar en este dispositivo")).toBeInTheDocument();
    await user.click(screen.getByRole("button", { name: "Recuperar cambios sin guardar de las 09:30" }));
    expect(screen.getByLabelText("Minuto del gol 3")).toHaveValue("46");
    expect(within(foot()).getByText("● Cambios sin guardar")).toBeInTheDocument();
  });

  it("B-ACTA-02: removing a play with a narrated detail, «Deshacer» brings both back as they were", async () => {
    const published = withMatch("m6", {
      starters: SEVEN,
      bench: ["kevin"],
      notCalled: ["almachi", "andia", "fer", "brawan"],
      duration: 50,
      goalsFor: 1,
      goalsAgainst: 0,
      events: [{ id: "a", type: "goal", minute: 5, playerId: "erik" }],
      analysis: { version: 2, revision: 1, profile: DEFAULT_ANALYSIS_PROFILE, coverage: [], observations: [{ id: "o1", canonicalEventId: "a", kind: "goal", team: "us", actorId: "erik", order: 1, time: { from: 300, to: 300, precision: "exact" }, facts: { note: "Disparo cruzado" } }] } as never,
    });
    setAdminData(adminFixture({ published }));
    const user = userEvent.setup();
    open("/admin/partidos/m6/acta");
    await user.click(await screen.findByRole("button", { name: "Cambiar goleador del gol 1" }));
    await user.click(screen.getByRole("button", { name: "Quitar este gol" }));
    expect(caption()).toHaveTextContent("Gol 1 quitado · y su detalle narrado");
    await user.click(within(caption()).getByRole("button", { name: "Deshacer" }));
    await user.click(within(foot()).getByRole("button", { name: "Guardar borrador" }));
    // nothing changed: the play and its detail are back exactly
    expect(save).not.toHaveBeenCalled();
    expect(await screen.findByText("No hay cambios que guardar")).toBeInTheDocument();
  });
});

describe("Acta · el borrador y el choque (B-ACTA-01, M-44)", () => {
  it("a draft the published acta overtook says so, keeps the edits and saves over the published revision", async () => {
    const drafts = fixtureDrafts.map((d) => (d.id === "m7" ? { ...d, revision: 3 } : d));
    const published = withMatch("m7", { revision: 4 });
    const data = adminFixture({ published });
    // (the draft keeps its own revision, as convocatoria.ts did before the fix)
    setAdminData({ ...data, matches: data.matches.map((m) => (m.id === "m7" ? { ...m, revision: drafts.find((d) => d.id === "m7")!.revision } : m)) });
    const user = userEvent.setup();
    open();
    const bar = (await screen.findByText("Lo publicado ha cambiado desde que se guardó este borrador")).closest(".sac-bar") as HTMLElement;
    expect(bar).toHaveTextContent("Lo publicado ha cambiado desde que se guardó este borrador");
    await user.click(within(bar).getByRole("button", { name: "Recargar y conservar mis cambios" }));
    expect(screen.queryByText("Lo publicado ha cambiado desde que se guardó este borrador")).toBeNull();
    await user.click(within(foot()).getByRole("button", { name: "Guardar borrador" }));
    await waitFor(() => expect(save).toHaveBeenCalledTimes(1));
    expect(call().sheet.revision).toBe(4);
  });

  it("«Descartar borrador» calls discardMatchDraft and goes back to what is published", async () => {
    const user = userEvent.setup();
    open();
    const bar = (await screen.findByText("Borrador guardado")).closest(".sac-bar") as HTMLElement;
    await user.click(within(bar).getByRole("button", { name: "Descartar borrador" }));
    await waitFor(() => expect(discard).toHaveBeenCalledWith({ matchId: "m7" }));
    expect(caption()).toHaveTextContent("Borrador descartado · vuelve a lo publicado");
  });

  it("a save refused because the match changed shows the clash bar instead of a dead end", async () => {
    save.mockRejectedValueOnce(Object.assign(new Error("Otro administrador ha actualizado este partido. Recarga antes de guardar."), { code: "functions/aborted" }));
    const user = userEvent.setup();
    open();
    await user.type(await screen.findByLabelText("Minuto del gol 3"), "46");
    await user.click(within(foot()).getByRole("button", { name: "Guardar borrador" }));
    const bar = (await screen.findByText("Otro capitán ha cambiado este partido mientras editabas")).closest(".sac-bar") as HTMLElement;
    expect(bar).toHaveTextContent("Otro capitán ha cambiado este partido mientras editabas");
    expect(within(bar).getByRole("button", { name: "Recargar y conservar mis cambios" })).toBeInTheDocument();
  });
});

describe("Publicar", () => {
  it("«Antes de publicar» fixes in place; «Así lo verá la afición»; the confirmation says its consequences, then Después", async () => {
    const user = userEvent.setup();
    const router = open("/admin/partidos/m7/publicar");
    expect(await screen.findByText("Hay datos pendientes")).toBeInTheDocument();
    const pri = within(foot()).getByRole("button", { name: "Publicar el acta" });
    expect(pri).toHaveAttribute("aria-disabled", "true");
    await user.click(pri);
    expect(screen.queryByRole("dialog")).toBeNull();
    await user.selectOptions(screen.getByLabelText("¿Quién marcó el gol 3?"), "huberoski");
    await user.type(screen.getByLabelText("Minuto del gol 3"), "46");
    // (a scorer chosen here leaves his assist to confirm: it blocks until it is)
    expect(document.querySelector(".sac-pre")?.textContent).toContain("Hay datos pendientes");
    await user.selectOptions(screen.getByLabelText("Gol 3 de HUBEROSKI (46′)"), "none");
    await waitFor(() => expect(document.querySelector(".sac-pre")?.textContent).toContain("Lista para publicar"));
    const fan = screen.getByRole("region", { name: "Así lo verá la afición" });
    expect(within(fan).getByLabelText("Manchester Piti 3–1 FUSION 7 · ganado")).toBeInTheDocument();
    expect(within(within(fan).getByRole("list", { name: "Goles del Piti" })).getAllByRole("listitem").map((l) => l.textContent)).toEqual(["ADRIÁN T.C. 9′", "ADRIÁN T.C. 31′", "HUBEROSKI 46′"]);
    await user.click(within(foot()).getByRole("button", { name: "Publicar el acta" }));
    const confirm = await screen.findByRole("dialog", { name: "¿Publicar el acta de la J2?" });
    expect(confirm).toHaveTextContent("Se abre el MVP 48 h");
    expect(confirm).toHaveTextContent("Se congelan las notas");
    await user.click(within(confirm).getByRole("button", { name: "Publicar el acta" }));
    await waitFor(() => expect(save).toHaveBeenCalledTimes(1));
    expect(call()).toMatchObject({ id: "m7", draft: false });
    expect(call().sheet).toMatchObject({ status: "finished", goalsFor: 3, goalsAgainst: 1, meetingNote: "Quedada 9:15 en el campo." });
    await waitFor(() => expect(router.state.location.pathname).toBe("/admin/partidos/m7/despues"));
  });

  it("the crónica: the headline, «Preparar resumen» with «Deshacer», the photo's HTTPS check, the gallery", async () => {
    const user = userEvent.setup();
    open("/admin/partidos/m7/publicar");
    expect(await screen.findByText("El Piti gana 3–1 en casa ante FUSION 7")).toBeInTheDocument();
    await user.type(screen.getByLabelText("Crónica"), "Mi texto");
    await user.click(screen.getByRole("button", { name: "Preparar resumen con el acta" }));
    expect((screen.getByLabelText("Crónica") as HTMLTextAreaElement).value).toMatch(/^El Piti ganó 3–1 a FUSION 7/);
    await user.click(within(caption()).getByRole("button", { name: "Deshacer" }));
    expect(screen.getByLabelText("Crónica")).toHaveValue("Mi texto");
    await user.type(screen.getByLabelText("Foto del partido (HTTPS)"), "http://x/foto.jpg");
    expect(screen.getByText("No es HTTPS")).toHaveClass("is-bad");
    await user.type(screen.getByLabelText("Añadir foto a la galería (HTTPS)"), "https://x/1.jpg");
    await user.click(screen.getByRole("button", { name: "Añadir" }));
    expect(screen.getByText("Galería · 1 de 20")).toBeInTheDocument();
  });

  it("a published acta: «Guardar cambios», off without changes; a correction asks first and says what it changes", async () => {
    setAdminData(adminFixture({ published: fullJ1() }));
    const user = userEvent.setup();
    open("/admin/partidos/m6/publicar");
    const pri = await screen.findByRole("button", { name: "Guardar cambios" });
    expect(pri).toHaveAttribute("aria-disabled", "true");
    await user.type(screen.getByLabelText("Crónica"), "Gran partido");
    await user.click(pri);
    const confirm = await screen.findByRole("dialog", { name: "¿Corregir el acta de la J1?" });
    expect(confirm).toHaveTextContent("No sale ningún aviso nuevo del final");
    await user.click(within(confirm).getByRole("button", { name: "Guardar los cambios" }));
    await waitFor(() => expect(save).toHaveBeenCalledTimes(1));
    expect(await screen.findByText("Acta J1 corregida · web al día")).toBeInTheDocument();
  });
});

describe("Después", () => {
  it("B-PUB-01: the MVP says its real close and its turnout; «Cerrar ya» calls setMvpVote", async () => {
    const now = adminFixture().now;
    setAdminData(adminFixture({ published: fullJ1({ voteClosesAt: now + 5 * 3_600_000, actaPublishedAt: now - 43 * 3_600_000 }) }));
    live.mvp = new Map([["m6", { id: "m6", counts: {}, total: 6, eligible: 14, open: true }]]);
    const user = userEvent.setup();
    open("/admin/partidos/m6/despues");
    expect(await screen.findByText("6 de 14 han votado")).toBeInTheDocument();
    expect(screen.getByText(/^Cierra el .* · faltan 5 h$/)).toBeInTheDocument();
    expect(screen.queryByText(/48 h/)).toBeNull();
    await user.click(screen.getByRole("button", { name: "Cerrar ya" }));
    await waitFor(() => expect(mvpVote).toHaveBeenCalledWith({ matchId: "m6", action: "close" }));
  });

  it("the frozen notas with the system's traffic light; their failure says so and «Recalcular las notas» runs", async () => {
    setAdminData(adminFixture({ published: fullJ1() }));
    const user = userEvent.setup();
    open("/admin/partidos/m6/despues");
    const notas = await screen.findByRole("heading", { name: "Las notas" });
    const list = notas.closest("section") as HTMLElement;
    expect(within(list).getByRole("listitem", { name: "ERIK: 8,6, muy buena" })).toBeInTheDocument();
    expect(within(list).getByText("8,6")).toHaveClass("nb", "nb--s8");
    expect(within(list).queryByText("Las notas no se pudieron calcular al publicar")).toBeNull();
    live.notasError = { at: 1, message: "Falta la tabla" };
    act(() => setAdminData(adminFixture({ published: fullJ1({ notas: undefined }) })));
    expect(await screen.findByText("Las notas no se pudieron calcular al publicar")).toBeInTheDocument();
    await user.click(screen.getByRole("button", { name: "Recalcular las notas" }));
    await waitFor(() => expect(recalc).toHaveBeenCalledWith({ matchId: "m6" }));
  });

  it("the notices that went out, the cost and the table point to their places; the foot shares the cartel", async () => {
    setAdminData(adminFixture({ published: fullJ1() }));
    live.pushSent = [{ id: "p1", d: { title: "Final: Manchester Piti 4–1 Emirates", body: "", topic: "final", url: "/partidos/m6", tag: "", matchId: "m6", audience: "publico", kind: "auto", devices: 23, members: 14, by: null, at: 1_700_000_000_000 } }];
    open("/admin/partidos/m6/despues");
    expect(await screen.findByText("«Final: Manchester Piti 4–1 Emirates»")).toBeInTheDocument();
    expect(screen.getByText(/^A 23 móviles/)).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "Repartir el coste" })).toHaveAttribute("href", "/admin/caja/coste/m6");
    expect(screen.getByRole("link", { name: "Pegar la tabla" })).toHaveAttribute("href", "/admin/club/clasificacion");
    expect(within(foot()).getByText("Publicada · la web ya lo cuenta")).toBeInTheDocument();
    expect(within(foot()).getByRole("button", { name: "Compartir el cartel" })).toBeInTheDocument();
  });

  it.each([1280, 390])("archiving from Después at %ipx: the match head's «Gestionar» asks first, then Archivados", async (width) => {
    Object.defineProperty(window, "innerWidth", { configurable: true, value: width });
    setAdminData(adminFixture({ published: fullJ1() }));
    const archive = vi.mocked(api.setMatchArchived);
    archive.mockClear();
    const user = userEvent.setup();
    const router = open("/admin/partidos/m6/despues");
    await screen.findByRole("heading", { name: "El MVP" });
    await user.click(screen.getByRole("button", { name: "Gestionar el partido" }));
    await user.click(screen.getByRole("menuitem", { name: "Archivar…" }));
    const dialog = screen.getByRole("alertdialog", { name: /^¿Archivar el partido contra Emirates\?/ });
    expect(archive).not.toHaveBeenCalled();
    await user.click(within(dialog).getByRole("button", { name: "Archivar partido" }));
    await waitFor(() => expect(archive).toHaveBeenCalledExactlyOnceWith({ id: "m6", archived: true }));
    await waitFor(() => expect(router.state.location.pathname).toBe("/admin/partidos/archivados/m6"));
  });

  it("«Hecho» marks another's turn at once, with «Deshacer»; a failure offers «Reintentar»; the done ones say so", async () => {
    setAdminData(adminFixture({ published: fullJ1() }));
    const job = (id: string, name: string) => ({ id, name, icon: "shirt", awayOnly: false, order: [] });
    const turn = (j: ReturnType<typeof job>, playerId: string) => ({ job: j, playerId, computed: playerId, pinned: false, swappedFrom: null, skipped: [], frozen: true });
    live.turns = [turn(job("lavar", "Lavar la equipación"), "erik"), turn(job("agua", "El agua"), "kevin")];
    // (KEVIN's, marked by a captain while he has no account: p:<id>)
    live.pins = { frozen: true, turns: {}, done: { "p:kevin": 1 } };
    const mark = vi.mocked(api.markTurnDone);
    const user = userEvent.setup();
    open("/admin/partidos/m6/despues");
    const agua = (await screen.findByText("El agua")).closest("li") as HTMLElement;
    expect(within(agua).getByText("Hecho", { selector: ".sc-tag" })).toBeInTheDocument();
    await user.click(screen.getByRole("button", { name: "Marcar hecho: Lavar la equipación (ERIK)" }));
    expect(mark).toHaveBeenCalledWith({ turnId: "m6", done: true, playerId: "erik" });
    expect(await screen.findByText("Hecho: Lavar la equipación (ERIK)")).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: /^Marcar hecho: Lavar/ })).toBeNull();
    await user.click(within(caption()).getByRole("button", { name: "Deshacer" }));
    await waitFor(() => expect(mark).toHaveBeenLastCalledWith({ turnId: "m6", done: false, playerId: "erik" }));
    // a failure: back to «Hecho» to press, and «Reintentar»
    mark.mockRejectedValueOnce(new Error("sin red"));
    await user.click(await screen.findByRole("button", { name: "Marcar hecho: Lavar la equipación (ERIK)" }));
    expect(await screen.findByText(/No se ha podido marcar el turno: sin red/)).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Reintentar" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Marcar hecho: Lavar la equipación (ERIK)" })).toBeInTheDocument();
  });

  it("before the acta is published: what will be here, and the way to it", async () => {
    open("/admin/partidos/m7/despues");
    expect(await screen.findByRole("heading", { name: "El acta aún no está publicada" })).toBeInTheDocument();
  });
});

describe("Narración", () => {
  it("its own screen (B-ACTA-03): the real time said aloud and adjusted on request (A-PAR-02)", async () => {
    setAdminData(adminFixture({ published: fullJ1() }));
    const user = userEvent.setup();
    open("/admin/partidos/m6/acta/narracion");
    expect(await screen.findByRole("heading", { name: "Análisis narrado · J1" })).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "Análisis narrado" })).toHaveAttribute("aria-current", "page");
    await user.type(screen.getByLabelText("Duración real de juego (segundos, sin descanso)"), "3100");
    expect(screen.getByText(/^Ojo: la duración del partido es 50 min/)).toBeInTheDocument();
    await user.click(screen.getByRole("button", { name: "Ajustar la duración del partido" }));
    expect(screen.getByText(/^Y la duración del partido sigue en 52 min/)).toBeInTheDocument();
  });

  it("a pasted import is reviewed by itself and is still there after changing station", async () => {
    sessionStorage.clear();
    setAdminData(adminFixture({ published: fullJ1() }));
    open("/admin/partidos/m6/acta/narracion");
    const box = await screen.findByPlaceholderText("Pega aquí el análisis JSON generado en el chat");
    fireEvent.change(box, { target: { value: "{ no es json" } });
    // (no «Revisar importación» pressed: the review runs on its own)
    expect(await screen.findByText(/No se puede leer el archivo de acciones/)).toBeInTheDocument();
    cleanup();
    open("/admin/partidos/m6/acta/narracion");
    expect(await screen.findByPlaceholderText("Pega aquí el análisis JSON generado en el chat")).toHaveValue("{ no es json");
    sessionStorage.clear();
  });

  it("ACTA-16: the observations filter by kind and by state (Todas · Dudas · Anuladas)", async () => {
    const obs = (id: string, kind: "pass" | "shot", validity?: "pending" | "void") => ({ id, kind, team: "us" as const, actorId: "erik", order: Number(id.slice(1)), time: { from: 60, to: 60, precision: "exact" as const }, facts: {}, ...(validity ? { validity } : {}) });
    setAdminData(adminFixture({ published: fullJ1({ analysis: { version: 2, revision: 1, profile: DEFAULT_ANALYSIS_PROFILE, coverage: [], observations: [obs("o1", "pass"), obs("o2", "shot", "pending"), obs("o3", "pass", "void")] } as never }) }));
    const user = userEvent.setup();
    open("/admin/partidos/m6/acta/narracion");
    const rows = () => screen.getAllByRole("button", { name: "Editar detalle" }).length;
    await screen.findByRole("heading", { name: "3 observaciones del análisis" });
    expect(rows()).toBe(3);
    expect(screen.getByText("1 duda pendiente")).toBeInTheDocument();
    await user.click(screen.getByRole("button", { name: "Dudas" }));
    expect(rows()).toBe(1);
    await user.click(screen.getByRole("button", { name: "Todas" }));
    await user.selectOptions(screen.getByLabelText("Tipo"), "pass");
    expect(rows()).toBe(2);
  });

  it("keeps the open detail form and its unapplied fields when the frame crosses both breakpoints", async () => {
    Object.defineProperty(window, "innerWidth", { configurable: true, value: 1440 });
    let resizeFrame: ((width: number) => void) | undefined;
    vi.stubGlobal(
      "ResizeObserver",
      class implements ResizeObserver {
        private callback: ResizeObserverCallback;
        constructor(callback: ResizeObserverCallback) {
          this.callback = callback;
        }
        observe(target: Element) {
          if (target.matches(".vx.sc")) resizeFrame = (width) => this.callback([{ target, contentRect: { width } as DOMRectReadOnly, borderBoxSize: [], contentBoxSize: [], devicePixelContentBoxSize: [] }], this);
        }
        unobserve() {}
        disconnect() {}
      },
    );
    try {
      setAdminData(adminFixture({ published: fullJ1() }));
      const user = userEvent.setup();
      open("/admin/partidos/m6/acta/narracion");
      await user.click(await screen.findByRole("button", { name: "Añadir detalle" }));
      const form = screen.getByRole("group", { name: "Editar observación" });
      const author = within(form).getByRole("combobox", { name: "Autor del detalle" });
      const seconds = within(form).getByLabelText("Desde (segundos)", { exact: true });
      await user.selectOptions(author, "erik");
      await user.type(seconds, "240");
      expect(resizeFrame).toBeDefined();
      for (const width of [390, 1440]) {
        act(() => resizeFrame!(width));
        expect(screen.getByRole("group", { name: "Editar observación" })).toBe(form);
        expect(author).toHaveValue("erik");
        expect(seconds).toHaveValue(240);
        expect(save).not.toHaveBeenCalled();
      }
    } finally {
      vi.unstubAllGlobals();
    }
  });
});

describe("Historial", () => {
  it("lists matchAudit newest first in words, with who and «Ver esta versión»", async () => {
    live.audit = [
      { id: "x1", d: { matchId: "m7", updatedBy: "a1", at: 1_700_000_000_000, revision: 2 } },
      { id: "x2", d: { matchId: "m7", updatedBy: "a1", at: 1_700_000_500_000, draft: "discarded", draftRevision: 3 } },
    ];
    const user = userEvent.setup();
    open("/admin/partidos/m7/acta/historial");
    const rows = await screen.findAllByRole("button", { name: /^Ver esta versión:/ });
    expect(rows.map((b) => b.getAttribute("aria-label"))).toEqual(["Ver esta versión: Descartó el borrador", "Ver esta versión: Guardó el acta · revisión 2"]);
    await user.click(rows[1]);
    expect(screen.getByText(/^Revisión 2 · /)).toBeInTheDocument();
  });
});
