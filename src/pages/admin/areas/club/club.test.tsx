import { act, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";
import type { Standings } from "../../../../lib/standings";
import { adminFixture, mountAdmin, setAdminData } from "../../../../test/adminKit";
import { resetRoomDraftsForTests } from "./drafts";

vi.setConfig({ testTimeout: 20_000 });

// The office and its rooms in the real sala (frame, guard, sheets), with the club's reads and writes stubbed.
const h = vi.hoisted(() => ({
  standings: null as Standings | null,
  save: vi.fn((..._a: unknown[]) => Promise.resolve()),
  deleteSeason: vi.fn((..._a: unknown[]) => Promise.resolve({ data: { players: 4, matches: 22 } })),
  writes: {
    saveSeason: vi.fn((..._a: unknown[]) => Promise.resolve()),
    deleteSeason: vi.fn((..._a: unknown[]) => Promise.resolve()),
    createSeason: vi.fn((..._a: unknown[]) => Promise.resolve("new")),
    setArchived: vi.fn((..._a: unknown[]) => Promise.resolve()),
    publishContent: vi.fn((..._a: unknown[]) => Promise.resolve()),
  },
}));
vi.mock("../../data/useAdminData", async () => ({ useAdminData: (await import("../../../../test/adminMocks")).currentAdminData }));
vi.mock("../../../../context/AuthContext", async () => ({ useAuth: (await import("../../../../test/adminMocks")).fakeAuth }));
vi.mock("../../data/useCaja", () => ({ useCajaClaims: () => ({ data: [], loading: false, error: false }) }));
vi.mock("../../data/useClasificacion", () => ({ useStandings: () => ({ standings: h.standings, loading: false }), useClasificacionWrites: () => ({ save: h.save }) }));
vi.mock("../../../../lib/useStandings", () => ({ useStandings: () => ({ standings: h.standings, loading: false }), useAllStandings: () => [] }));
vi.mock("./inbox", () => ({
  isCaptainNotice: () => true,
  noticeTarget: () => "/admin",
  useCaptainInbox: () => ({ list: [], unread: 0, loading: false, error: false, reads: { seenAt: null, read: {}, unread: () => false, mark: async () => undefined, markAll: async () => undefined } }),
}));
vi.mock("../../club/contentDraftStore", () => {
  const state = { drafts: { club: {}, stories: {} }, loaded: true, rev: -1, by: "", byName: "", at: null, saving: false, conflict: false, error: "", update: () => undefined, flush: async () => undefined, reload: () => undefined, mine: async () => undefined };
  return { useContentDraftState: () => state, useContentDrafts: () => [state.drafts, () => undefined] };
});
vi.mock("../../club/useClubWrites", () => ({ useClubWrites: () => h.writes }));
vi.mock("../../../../lib/clubContent", async () => {
  const { DEFAULT_CONTENT } = await import("../../../../lib/clubContentDefaults");
  return { DEFAULT_CONTENT, useClubContent: () => DEFAULT_CONTENT };
});
vi.mock("../../club/clubLive", () => ({ useArchivedCounts: () => ({ t0: { matches: 22, players: 9 } }), useMvpTally: () => new Map() }));
vi.mock("../../../../lib/useRotaTurns", () => ({ useRota: () => ({ data: null, loading: false, error: false }), useMatchTurns: () => ({ turns: [], rota: null, pins: { frozen: false, turns: {} }, loading: false, error: false }) }));
vi.mock("../../../../components/jersey3d/useShirtStills", () => ({ useShirtStills: () => () => undefined }));
vi.mock("../../../vestuario/live", async (orig) => ({
  ...(await orig<typeof import("../../../vestuario/live")>()),
  usePolls: () => ({ data: [], loading: false, error: false }),
  useBoard: () => ({ data: [], loading: false, error: false }),
  useAbsences: () => ({ data: [], loading: false, error: false }),
  useOpenTrainings: () => ({ data: [], loading: false, error: false }),
  useSeasonRotaTurns: () => ({ data: [], loading: false, error: false }),
  useNotices: () => ({ data: [], loading: false, error: false }),
}));
vi.mock("../../../../lib/clubApi", async (orig) => ({ ...(await orig<typeof import("../../../../lib/clubApi")>()), apiError: (e: unknown) => (e instanceof Error ? e.message : String(e)), deleteSeason: h.deleteSeason }));

const none = () => <></>;
const ON = { temporadas: none, clasificacion: none, turnos: none, contenido: none };
const row = (team: string, pj: number, isUs = false) => ({ team, pj, g: pj, e: 0, p: 0, gf: pj, gc: 0, pts: 3 * pj, isUs });
const table = (): Standings => ({ id: "t1", competition: "Liga F7", jornada: 0, updatedAt: 1, updatedBy: "a1", rows: [row("Rayo Norte", 1), row("Manchester Piti", 1, true), row("Atlético Demo", 1)] });

describe("Club · la oficina y sus salas", () => {
  beforeEach(() => {
    localStorage.clear();
    resetRoomDraftsForTests();
    h.standings = table();
    h.save.mockReset();
    h.save.mockImplementation(() => Promise.resolve());
    h.deleteSeason.mockClear();
    Object.values(h.writes).forEach((f) => f.mockClear());
    setAdminData(adminFixture());
  });

  it("M-16: one door per room with what it holds, and the table behind the actas asks for itself (H-HOY-12)", async () => {
    mountAdmin("/admin/club", ON);
    const doors = await screen.findByRole("list", { name: "Las salas del club" });
    const links = within(doors).getAllByRole("link");
    expect(links).toHaveLength(8);
    expect(within(doors).getByRole("link", { name: /^Clasificación: 3 equipos · vamos 2\.º/ })).toHaveAccessibleName(/Por pegar la J1$/);
    expect(within(doors).getByRole("link", { name: /^La vitrina:/ })).toHaveAttribute("href", "/admin/club/temporadas");
    expect(screen.getByText(/Pide algo: la tabla de la J1/)).toBeInTheDocument();
  });

  it("B-CLUB-04: a refused save keeps the table and says why (the editor is never remounted under it)", async () => {
    const user = userEvent.setup();
    h.save.mockImplementation(() => Promise.reject(new Error("Missing or insufficient permissions.")));
    mountAdmin("/admin/club/clasificacion", ON);
    await user.click(await screen.findByRole("button", { name: "Subir a Atlético Demo" }));
    expect(screen.getByText("Sin guardar")).toBeInTheDocument();
    const saveBtn = screen.getAllByRole("button", { name: "Guardar la clasificación" })[0];
    await user.click(saveBtn);
    await waitFor(() => expect(h.save).toHaveBeenCalledTimes(1));
    expect(await screen.findByText(/^No se ha podido guardar la clasificación: Missing or insufficient permissions\. Tu tabla sigue aquí/)).toBeInTheDocument();
    const rows = within(screen.getByRole("list", { name: "La tabla de la liga" })).getAllByRole("listitem");
    expect(rows.map((r) => r.querySelector("b")?.textContent)).toEqual(["1.º Rayo Norte", "2.º Atlético Demo", "3.º Manchester Piti"]);
  });

  it("B-CLUB-04: another captain's save while you edit is said, never thrown away", async () => {
    const user = userEvent.setup();
    mountAdmin("/admin/club/clasificacion", ON);
    await user.click(await screen.findByRole("button", { name: "Subir a Atlético Demo" }));
    act(() => {
      h.standings = { ...table(), updatedAt: 99, updatedBy: "a2" };
      setAdminData(adminFixture());
    });
    expect(await screen.findByText("Otro capitán ha guardado antes.")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Guardar la mía encima" })).toBeInTheDocument();
    expect(within(screen.getByRole("list", { name: "La tabla de la liga" })).getAllByRole("listitem")[1]).toHaveTextContent("Atlético Demo");
  });

  it("B-CLUB-09: leaving with changes asks; the draft is still there when you come back", async () => {
    const user = userEvent.setup();
    mountAdmin("/admin/club/clasificacion", ON);
    await user.click(await screen.findByRole("button", { name: "Subir a Atlético Demo" }));
    await user.click(screen.getAllByRole("link", { name: "‹ La oficina" }).at(-1)!);
    const ask = await screen.findByRole("alertdialog", { name: "¿Salir sin guardar?" });
    expect(within(ask).getByRole("button", { name: "Guardar y salir" })).toBeInTheDocument();
    await user.click(within(ask).getByRole("button", { name: "Descartar cambios" }));
    const doors = await screen.findByRole("list", { name: "Las salas del club" });
    expect(within(doors).getByRole("link", { name: /^Clasificación:/ })).toHaveAccessibleName(/Por pegar la J1$/);
    await user.click(within(doors).getByRole("link", { name: /^Clasificación:/ }));
    expect(await screen.findByText(/Cambios sin guardar desde/)).toBeInTheDocument();
    expect(within(screen.getByRole("list", { name: "La tabla de la liga" })).getAllByRole("listitem")[1]).toHaveTextContent("Atlético Demo");
  });

  it("B-CLUB-01: «Eliminar» goes through the server (deleteSeason), never a bare delete, and says who comes back", async () => {
    const user = userEvent.setup();
    mountAdmin("/admin/club/temporadas", ON);
    await user.click(await screen.findByRole("button", { name: "Eliminar" }));
    const sheet = await screen.findByRole("alertdialog", { name: /¿Eliminar la Temporada 0 · pre-Piti para siempre\?/ });
    expect(sheet).toHaveTextContent("vuelven a la plantilla, en «Antiguos»");
    await user.click(within(sheet).getByRole("button", { name: "Eliminar la temporada" }));
    await waitFor(() => expect(h.deleteSeason).toHaveBeenCalledWith({ seasonId: "t0" }));
    expect(h.writes.deleteSeason).not.toHaveBeenCalled();
  });

  it("B-CLUB-06: /web/historias?jugador=<id> opens his story; his photo is the ficha's (no field here)", async () => {
    mountAdmin("/admin/club/web/historias?jugador=kevin", ON);
    expect(await screen.findByRole("textbox", { name: /^Su frase/ })).toBeInTheDocument();
    expect(screen.getByRole("list", { name: "Jugadores" }).querySelector('[aria-current="true"]')).toHaveTextContent("KEVIN");
    expect(screen.queryByRole("textbox", { name: /^Foto de/ })).toBeNull();
    expect(screen.getByRole("link", { name: "Abrir su ficha" })).toHaveAttribute("href", "/admin/plantilla/kevin");
  });

  it("Temporadas: the vitrina of the season in course and «Nueva temporada» as the primary action", async () => {
    mountAdmin("/admin/club/temporadas", ON);
    expect(await screen.findByRole("heading", { level: 1, name: "Temporadas" })).toBeInTheDocument();
    expect(screen.getByRole("list", { name: "La balda de la temporada" })).toBeInTheDocument();
    expect(screen.getAllByRole("button", { name: "Nueva temporada" }).length).toBeGreaterThan(0);
    expect(screen.getByRole("heading", { name: "La vitrina del club" })).toBeInTheDocument();
  });
});
