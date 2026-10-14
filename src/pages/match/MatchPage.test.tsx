import { act, fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { createMemoryHistory, createRootRoute, createRoute, createRouter, Outlet, RouterProvider } from "@tanstack/react-router";
import { z } from "zod";
import { afterEach, describe, expect, it, vi } from "vitest";
import type { ClubMatch } from "../../lib/clubData";
import { matchSearchSchema } from "../../lib/matchTabs";

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
// who is looking (useViewer), the official scope docs (lineupOfficials/{season}__{match|temporada} → the
// board they name) and every doc path the page asked to read (useLiveDoc; null = no read)
const who = vi.hoisted(() => ({ viewer: { member: false, admin: false, playerId: null as string | null }, docs: new Map<string, string>(), reads: [] as string[] }));

// the club data: these three, unless a test makes the listener fail (error, and the cache emptied)
const club = vi.hoisted(() => ({ error: null as Error | null }));
vi.mock("../../lib/clubData", async (orig) => ({ ...(await orig<typeof import("../../lib/clubData")>()), useClubData: () => (club.error ? { matches: [], players: [], loading: false, error: club.error } : { matches: [MATCH, SCORED, UPCOMING], players: PLAYERS, loading: false, error: null }) }));
vi.mock("../../hooks/useViewer", () => ({ useViewer: () => who.viewer }));
vi.mock("../../context/AuthContext", () => ({ useAuth: () => ({ user: null, profile: null }) }));
vi.mock("../../context/TeamContext", () => ({ useTeam: () => ({ member: false }) }));
vi.mock("../vestuario/live", () => ({
  useMatchScorers: () => ({ data: [] }),
  useLiveDoc: <T,>(path: string | null, _id: string, map: (d: { lineupId?: unknown } | undefined) => T, empty: T) => {
    if (!path) return { data: empty, loading: false, error: false };
    who.reads.push(path);
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
  PreviaTab: () => <p>pane:previa</p>,
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
  const router = createRouter({ routeTree: root.addChildren([match, jugador, pizarra, admin]), history: createMemoryHistory({ initialEntries: [url] }) });
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
  const adminLink = () => screen.queryByRole("link", { name: /Editar acta|Abrir en la Sala de control/ });

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
  });

  it("the data arrived and the match is not in it: «Partido no encontrado», with the way to the partidos", async () => {
    open("/matches/nada");
    expect(await screen.findByRole("heading", { level: 1, name: "Partido no encontrado" })).toBeInTheDocument();
    expect(screen.queryByRole("alert")).toBeNull();
    expect(screen.getByRole("link", { name: "Ver los partidos" })).toHaveAttribute("href", "/partidos");
    expect(screen.getByRole("link", { name: "Ir al inicio" })).toHaveAttribute("href", "/");
  });

  it("«Volver» on a deep link is «Partidos», to the section", async () => {
    open("/matches/j1");
    expect(await screen.findByText("pane:cronica")).toBeInTheDocument();
    const back = document.querySelector("a.fc-back");
    expect(back).toHaveTextContent("Partidos");
    expect(back).toHaveAttribute("href", "/partidos");
  });
});
