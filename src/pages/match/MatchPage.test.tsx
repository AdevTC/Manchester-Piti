import { act, cleanup, fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { createMemoryHistory, createRootRoute, createRoute, createRouter, Outlet, RouterProvider } from "@tanstack/react-router";
import { z } from "zod";
import { afterEach, describe, expect, it, vi } from "vitest";
import type { ClubMatch } from "../../lib/clubData";
import { matchSearchSchema } from "../../lib/matchTabs";
import { _resetSnapshotMetaForTesting, metaKeyOf, recordSnapshotMeta } from "../../lib/syncStatus";

// The match page's tab lives in the URL: ?tab= opens it, a click writes it (a history entry, so back
// and forward step through the tabs) and an unknown tab falls back to the first. Real router (memory
// history); data, auth and the tabs' contents are stubbed: no Firebase.

const MATCH: ClubMatch = { id: "j1", seasonId: "t1", rival: "Rival", date: Date.UTC(2026, 8, 1, 10), duration: 50, status: "finished", goalsFor: 1, goalsAgainst: 0, events: [] };
// a 2–1 with our scorer, a guest scorer nobody has in the squad, and the rival's goal
const SCORED: ClubMatch = { ...MATCH, id: "j2", goalsFor: 2, goalsAgainst: 1, events: [
  { id: "g1", type: "goal", minute: 12, playerId: "p1" },
  { id: "g2", type: "goal", minute: 30, playerId: "invitado" },
  { id: "g3", type: "opponent_goal", minute: 40 },
] };
const PLAYERS = [{ id: "p1", shirtName: "PEPE", seasons: ["t1"], seasonDetails: { t1: { shirtName: "PEPITO" } } }];
// still to be played (the clock is stubbed at 10 Sep 2026)
const UPCOMING: ClubMatch = { id: "j3", seasonId: "t1", rival: "Otro", date: Date.UTC(2026, 8, 20, 10), duration: 50, status: "scheduled", events: [] };
// being played (kicked off ten minutes before the stubbed clock; a legacy match without a clock)
const LIVE: ClubMatch = { id: "j4", seasonId: "t1", rival: "Vivo", date: Date.UTC(2026, 8, 9, 23, 50), duration: 50, status: "scheduled", events: [] };
// who is looking (useViewer), the official scope docs (lineupOfficials/{season}__{match|temporada} → the
// board they name) and every doc path the page asked to read (useLiveDoc; null = no read)
// and the board docs themselves (lineups/{id} → its stored fields)
const who = vi.hoisted(() => ({ viewer: { member: false, admin: false, playerId: null as string | null }, docs: new Map<string, string>(), boards: new Map<string, Record<string, unknown>>(), reads: [] as string[] }));

// the club data: these three, unless a test makes the listener fail (error, and the cache emptied)
const club = vi.hoisted(() => ({ error: null as Error | null }));
vi.mock("../../lib/clubData", async (orig) => ({ ...(await orig<typeof import("../../lib/clubData")>()), useClubData: () => (club.error ? { matches: [], players: [], loading: false, error: club.error } : { matches: [MATCH, SCORED, UPCOMING, LIVE], players: PLAYERS, loading: false, error: null }) }));
vi.mock("../../hooks/useViewer", () => ({ useViewer: () => who.viewer }));
vi.mock("../../context/AuthContext", () => ({ useAuth: () => ({ user: null, profile: null }) }));
vi.mock("../../context/TeamContext", () => ({ useTeam: () => ({ member: false }) }));
vi.mock("../vestuario/live", () => ({
  useMatchScorers: () => ({ data: [] }),
  useLiveDoc: <T,>(path: string | null, _id: string, map: (d: Record<string, unknown> | undefined) => T, empty: T) => {
    if (!path) return { data: empty, loading: false, error: false };
    who.reads.push(path);
    const board = who.boards.get(path);
    if (board) return { data: map(board), loading: false, error: false };
    const id = who.docs.get(path);
    return { data: map(id ? { lineupId: id } : undefined), loading: false, error: false };
  },
}));
vi.mock("../../hooks/useMatchClock", () => ({ useMatchClock: () => Date.UTC(2026, 8, 10) }));
vi.mock("../../components/ThemeToggle", () => ({ ThemeToggle: () => null }));
vi.mock("../../components/celeste/WeatherChip", () => ({ WeatherChip: () => null }));
vi.mock("../../lib/matchPoster", () => ({ downloadMatchPoster: vi.fn() }));
vi.mock("./Banda", () => ({ Banda: () => null }));
vi.mock("../../components/celeste/TechnicalStats", () => ({ TechnicalStatsPanel: () => <p>pane:estadisticas</p> }));
vi.mock("./Tabs", () => ({
  CronicaTab: () => <p>pane:cronica</p>,
  DirectoTab: () => <p>pane:directo</p>,
  // (the pizarra's notes on the rival it was handed: members only, the board drawn for this match)
  PreviaTab: ({ plan }: { plan?: { players: { note?: string }[] } | null }) => <p data-plan={plan ? plan.players.map((p) => p.note ?? "").join("|") : "none"}>pane:previa</p>,
  CampoTab: () => <p>pane:campo</p>,
  PulsoTab: () => <p>pane:pulso</p>,
  VestuarioTab: () => <p>pane:vestuario</p>,
}));

const { MatchPage } = await import("./MatchPage");

function open(url: string) {
  const root = createRootRoute({ validateSearch: z.object({ season: z.string().optional().catch("all") }), component: Outlet });
  const match = createRoute({ getParentRoute: () => root, path: "/matches/$matchId", validateSearch: matchSearchSchema, component: MatchPage });
  const jugador = createRoute({ getParentRoute: () => root, path: "/jugadores/$playerId", component: () => null });
  const pizarra = createRoute({ getParentRoute: () => root, path: "/pizarra", validateSearch: z.object({ tablero: z.string().optional() }), component: () => null });
  const admin = createRoute({ getParentRoute: () => root, path: "/admin/partidos/$matchId", validateSearch: z.object({ tab: z.string().optional() }), component: () => null });
  const enJuego = createRoute({ getParentRoute: () => root, path: "/admin/en-juego/$matchId", component: () => null });
  const router = createRouter({ routeTree: root.addChildren([match, jugador, pizarra, admin, enJuego]), history: createMemoryHistory({ initialEntries: [url] }) });
  render(<RouterProvider router={router} />);
  return router;
}
const selected = () => screen.getAllByRole("tab").find((t) => t.getAttribute("aria-selected") === "true")?.textContent;

describe("MatchPage · the tab in the URL", () => {
  it("no tab: the first one (the crónica of a finished match)", async () => {
    open("/matches/j1");
    expect(await screen.findByText("pane:cronica")).toBeInTheDocument();
    expect(selected()).toBe("Crónica");
  });

  it("?tab=vestuario opens the Vestuario tab (the MVP push and the vestuario links)", async () => {
    open("/matches/j1?tab=vestuario");
    expect(await screen.findByText("pane:vestuario")).toBeInTheDocument();
    expect(selected()).toBe("Vestuario");
  });

  it("an unknown tab falls back to the crónica", async () => {
    open("/matches/j1?tab=nada");
    expect(await screen.findByText("pane:cronica")).toBeInTheDocument();
    expect(selected()).toBe("Crónica");
  });

  it("a click writes the tab, keeps the season, and back / forward step through the tabs", async () => {
    const router = open("/matches/j1?season=t1&tab=campo");
    expect(await screen.findByText("pane:campo")).toBeInTheDocument();

    fireEvent.click(screen.getByRole("tab", { name: "Estadísticas" }));
    expect(await screen.findByText("pane:estadisticas")).toBeInTheDocument();
    expect(router.state.location.search).toEqual({ season: "t1", tab: "estadisticas" });

    // the first tab is the clean URL
    fireEvent.click(screen.getByRole("tab", { name: "Crónica" }));
    expect(await screen.findByText("pane:cronica")).toBeInTheDocument();
    expect(router.state.location.search).toEqual({ season: "t1" });

    act(() => router.history.back());
    expect(await screen.findByText("pane:estadisticas")).toBeInTheDocument();
    act(() => router.history.back());
    expect(await screen.findByText("pane:campo")).toBeInTheDocument();
    expect(selected()).toBe("Campo");
    act(() => router.history.forward());
    await waitFor(() => expect(selected()).toBe("Estadísticas"));
  });

  it("clicking the tab already open adds no history entry", async () => {
    const router = open("/matches/j1?tab=pulso");
    expect(await screen.findByText("pane:pulso")).toBeInTheDocument();
    const before = router.history.length;
    fireEvent.click(screen.getByRole("tab", { name: "Pulso" }));
    expect(router.history.length).toBe(before);
  });
});

describe("MatchPage · shortcuts by role (Sala de control, pizarra)", () => {
  /** `docs`: scope doc id ("t1__j1", "t1__temporada") → the board it names. */
  const as = (v: Partial<typeof who.viewer>, docs: Record<string, string> = {}) => {
    who.viewer = { member: false, admin: false, playerId: null, ...v };
    who.docs = new Map(Object.entries(docs).map(([k, id]) => ["lineupOfficials/" + k, id]));
    who.reads = [];
  };
  const pizarraLink = () => screen.queryByRole("link", { name: /La pizarra de este partido/ });
  const adminLink = () => screen.queryByRole("link", { name: /Editar acta|Abrir en la Sala de control|Abrir En juego/ });

  it("a fan sees neither, and reads nothing (lineupOfficials are team-only)", async () => {
    as({}, { t1__j1: "b1", t1__temporada: "s1" });
    open("/matches/j1");
    expect(await screen.findByText("pane:cronica")).toBeInTheDocument();
    expect(pizarraLink()).toBeNull();
    expect(adminLink()).toBeNull();
    expect(who.reads).toEqual([]);
  });

  it("a member: the match's own official board, in its season (one tiny doc read); never the Sala de control", async () => {
    as({ member: true }, { t1__j1: "b1", t1__temporada: "s1" });
    open("/matches/j1");
    expect(await screen.findByText("pane:cronica")).toBeInTheDocument();
    expect(pizarraLink()).toHaveAttribute("href", "/pizarra?tablero=b1&season=t1");
    expect(adminLink()).toBeNull();
    expect(new Set(who.reads)).toEqual(new Set(["lineupOfficials/t1__j1"]));
  });

  it("a played match with only the season's official: no pizarra link (its plan wasn't this match's seven)", async () => {
    as({ member: true }, { t1__temporada: "s1" });
    open("/matches/j1");
    expect(await screen.findByText("pane:cronica")).toBeInTheDocument();
    expect(pizarraLink()).toBeNull();
    expect(who.reads).not.toContain("lineupOfficials/t1__temporada");
  });

  it("a match still to be played with only the season's official: that board", async () => {
    as({ member: true }, { t1__temporada: "s1" });
    open("/matches/j3");
    expect(await screen.findByText("pane:previa")).toBeInTheDocument();
    expect(pizarraLink()).toHaveAttribute("href", "/pizarra?tablero=s1&season=t1");
  });

  it("no official at all: no pizarra link", async () => {
    as({ member: true });
    open("/matches/j3");
    expect(await screen.findByText("pane:previa")).toBeInTheDocument();
    expect(pizarraLink()).toBeNull();
  });

  it("an admin edits the acta of a played match", async () => {
    as({ member: true, admin: true });
    open("/matches/j1");
    expect(await screen.findByRole("link", { name: /Editar acta/ })).toHaveAttribute("href", "/admin/partidos/j1?tab=acta");
    expect(screen.queryByRole("link", { name: /Abrir en la Sala de control/ })).toBeNull();
    expect(screen.queryByRole("link", { name: /Abrir En juego/ })).toBeNull();
  });

  it("while it is being played, an admin opens En juego (not the acta, not the workspace)", async () => {
    as({ member: true, admin: true });
    open("/matches/j4");
    expect(await screen.findByRole("link", { name: /Abrir En juego/ })).toHaveAttribute("href", "/admin/en-juego/j4");
    expect(screen.getAllByRole("link", { name: /Editar acta|Abrir en la Sala de control|Abrir En juego/ })).toHaveLength(1);
  });

  it("a member never sees En juego while it is being played", async () => {
    as({ member: true });
    open("/matches/j4");
    expect(await screen.findByRole("tab", { selected: true })).toBeInTheDocument();
    expect(adminLink()).toBeNull();
  });

  it("before the match, an admin opens it in the Sala de control (and a member its board)", async () => {
    as({ member: true, admin: true }, { t1__j3: "b3", t1__temporada: "s1" });
    open("/matches/j3");
    expect(await screen.findByRole("link", { name: /Abrir en la Sala de control/ })).toHaveAttribute("href", "/admin/partidos/j3");
    expect(screen.queryByRole("link", { name: /Editar acta/ })).toBeNull();
    expect(pizarraLink()).toHaveAttribute("href", "/pizarra?tablero=b3&season=t1");
  });
});

describe("MatchPage · the scorers lead to their pages", () => {
  it("our scorer is a link in the match's season; a guest and the rival stay text", async () => {
    open("/matches/j2");
    const goals = (await screen.findByText("12′")).closest(".fc-goals") as HTMLElement;
    const link = within(goals).getByRole("link", { name: "PEPITO" });
    expect(link).toHaveAttribute("href", "/jugadores/p1?season=t1");
    expect(link).toHaveClass("pl-link", "quiet");
    expect(within(goals).getAllByRole("link")).toHaveLength(1);
    expect(goals).toHaveTextContent("Jugador");
    expect(goals).toHaveTextContent("Rival");
  });
});

describe("MatchPage · an error is not «no encontrado»", () => {
  afterEach(() => {
    club.error = null;
  });

  it("the data did not arrive: the error panel with «Reintentar», never «Partido no encontrado»", async () => {
    club.error = new Error("permission-denied");
    open("/matches/j1");
    const alert = await screen.findByRole("alert");
    expect(within(alert).getByRole("heading", { level: 1, name: "El marcador no carga" })).toBeInTheDocument();
    expect(within(alert).getByRole("button", { name: "Reintentar" })).toBeInTheDocument();
    expect(screen.queryByText(/no encontrado/i)).toBeNull();
    expect(document.head.querySelector('meta[name="robots"]')?.getAttribute("content") ?? null).not.toBe("noindex");
  });

  it("the data arrived and the match is not in it: «Partido no encontrado», with the way to the partidos", async () => {
    open("/matches/nada");
    expect(await screen.findByRole("heading", { level: 1, name: "Partido no encontrado" })).toBeInTheDocument();
    expect(screen.queryByRole("alert")).toBeNull();
    expect(screen.getByRole("link", { name: "Ver los partidos" })).toHaveAttribute("href", "/partidos");
    expect(screen.getByRole("link", { name: "Ir al inicio" })).toHaveAttribute("href", "/");
    // (served with a 200 by the SPA shell: not for the index)
    expect(document.head.querySelector('meta[name="robots"]')).toHaveAttribute("content", "noindex");
  });

  it("a match that is there is indexable", async () => {
    open("/matches/j1");
    expect(await screen.findByText("pane:cronica")).toBeInTheDocument();
    expect(document.head.querySelector('meta[name="robots"]')?.getAttribute("content") ?? null).not.toBe("noindex");
  });

  it("«Volver» on a deep link is «Partidos», to the section", async () => {
    open("/matches/j1");
    expect(await screen.findByText("pane:cronica")).toBeInTheDocument();
    const back = document.querySelector("a.fc-back");
    expect(back).toHaveTextContent("Partidos");
    expect(back).toHaveAttribute("href", "/partidos");
  });
});

describe("MatchPage · the board says when the score may not be live", () => {
  const NOW = Date.UTC(2026, 8, 10);
  const MATCHES = metaKeyOf(["matches"]);
  let onLine: { mockRestore: () => void } | null = null;
  const board = () => document.querySelector("article.pt-board") as HTMLElement;
  afterEach(() => {
    onLine?.mockRestore();
    onLine = null;
    _resetSnapshotMetaForTesting();
  });

  it("live and in sync: no chip; offline: «Reconectando…», said once", async () => {
    recordSnapshotMeta(MATCHES, { fromCache: false, hasPendingWrites: false }, NOW - 5_000);
    open("/matches/j4");
    expect(await screen.findByText("pane:directo")).toBeInTheDocument();
    expect(board().querySelector(".mp-sync")).toBeNull();
    act(() => {
      onLine = vi.spyOn(navigator, "onLine", "get").mockReturnValue(false);
      window.dispatchEvent(new Event("offline"));
    });
    expect(within(board()).getByText("Reconectando…")).toBeInTheDocument();
    expect(board().querySelector(".mp-sync-sr")).toHaveTextContent("Sin conexión: reconectando.");
  });

  it("live, out of sync for over a minute: «Sin conexión · marcador de hace 2 min»", async () => {
    recordSnapshotMeta(MATCHES, { fromCache: false, hasPendingWrites: false }, NOW - 20 * 60_000);
    recordSnapshotMeta(MATCHES, { fromCache: true, hasPendingWrites: false }, NOW - 2 * 60_000 - 5_000);
    open("/matches/j4");
    expect(await within(await screen.findByRole("article")).findByText("Sin conexión · marcador de hace 2 min")).toBeInTheDocument();
  });

  it("a played match never shows it", async () => {
    recordSnapshotMeta(MATCHES, { fromCache: false, hasPendingWrites: false }, NOW - 20 * 60_000);
    recordSnapshotMeta(MATCHES, { fromCache: true, hasPendingWrites: false }, NOW - 5 * 60_000);
    open("/matches/j1");
    expect(await screen.findByText("pane:cronica")).toBeInTheDocument();
    expect(document.querySelector(".mp-sync")).toBeNull();
  });
});

// One «siete» (M6): the Campo reads the official board's seven only for members, only while the match is
// still to be played, and only with the Campo open — the match's own official first.
describe("MatchPage · the official seven on the Campo", () => {
  const as = (v: Partial<typeof who.viewer>, docs: Record<string, string> = {}) => {
    who.viewer = { member: false, admin: false, playerId: null, ...v };
    who.docs = new Map(Object.entries(docs).map(([k, id]) => ["lineupOfficials/" + k, id]));
    who.reads = [];
  };

  it("a member on the Campo of a match still to be played: its own official's board (not the season's)", async () => {
    as({ member: true }, { t1__j3: "b3", t1__temporada: "s1" });
    open("/matches/j3?tab=campo");
    expect(await screen.findByText("pane:campo")).toBeInTheDocument();
    expect(who.reads).toContain("lineups/b3");
    expect(who.reads).not.toContain("lineups/s1");
  });

  it("not on another tab, not for a fan, not once played", async () => {
    as({ member: true }, { t1__j3: "b3" });
    open("/matches/j3?tab=pulso");
    expect(await screen.findByText("pane:pulso")).toBeInTheDocument();
    expect(who.reads.some((p) => p.startsWith("lineups/"))).toBe(false);
    cleanup();
    as({}, { t1__j3: "b3" });
    open("/matches/j3?tab=campo");
    expect(await screen.findByText("pane:campo")).toBeInTheDocument();
    expect(who.reads).toEqual([]);
    cleanup();
    as({ member: true }, { t1__j1: "b1" });
    open("/matches/j1?tab=campo");
    expect(await screen.findByText("pane:campo")).toBeInTheDocument();
    expect(who.reads).not.toContain("lineups/b1");
  });
});

// «El rival» (idea 12): the previa gets the RivalPanel's notes of the board drawn for this very match — a
// member's read of its doc; a fan reads nothing and gets none; the season's board isn't about this rival.
describe("MatchPage · the rival's notes in the previa", () => {
  const as = (v: Partial<typeof who.viewer>, docs: Record<string, string> = {}, boards: Record<string, Record<string, unknown>> = {}) => {
    who.viewer = { member: false, admin: false, playerId: null, ...v };
    who.docs = new Map(Object.entries(docs).map(([k, id]) => ["lineupOfficials/" + k, id]));
    who.boards = new Map(Object.entries(boards).map(([k, d]) => ["lineups/" + k, d]));
    who.reads = [];
  };
  const rival = { formation: "2-3-1", players: [{ note: "Saca rápido" }, {}, {}, {}, {}, {}, { num: 9, note: "Presionar al 9" }] };
  const previa = async () => (await screen.findByText("pane:previa")).getAttribute("data-plan");
  afterEach(() => who.boards.clear());

  it("a member: the notes of the match's own official board", async () => {
    as({ member: true }, { t1__j3: "b3" }, { b3: { formation: "2-3-1", slots: [], matchId: "j3", rival } });
    open("/matches/j3");
    expect(await previa()).toBe("Saca rápido||||||Presionar al 9");
    expect(who.reads).toContain("lineups/b3");
  });

  it("a fan: no read of any board, no notes", async () => {
    as({}, { t1__j3: "b3" }, { b3: { formation: "2-3-1", slots: [], matchId: "j3", rival } });
    open("/matches/j3");
    expect(await previa()).toBe("none");
    expect(who.reads).toEqual([]);
  });

  it("a member with only the season's board: no notes (it wasn't drawn for this rival)", async () => {
    as({ member: true }, { t1__temporada: "s1" }, { s1: { formation: "2-3-1", slots: [], matchId: null, rival } });
    open("/matches/j3");
    expect(await previa()).toBe("none");
  });
});
