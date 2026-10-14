import { act, fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { createMemoryHistory, createRootRoute, createRoute, createRouter, Outlet, RouterProvider } from "@tanstack/react-router";
import { z } from "zod";
import { describe, expect, it, vi } from "vitest";
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

vi.mock("../../lib/clubData", async (orig) => ({ ...(await orig<typeof import("../../lib/clubData")>()), useClubData: () => ({ matches: [MATCH, SCORED], players: PLAYERS, loading: false, error: null }) }));
vi.mock("../../context/AuthContext", () => ({ useAuth: () => ({ user: null, profile: null }) }));
vi.mock("../../context/TeamContext", () => ({ useTeam: () => ({ member: false }) }));
vi.mock("../vestuario/live", () => ({ useMatchScorers: () => ({ data: [] }) }));
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
  const router = createRouter({ routeTree: root.addChildren([match, jugador]), history: createMemoryHistory({ initialEntries: [url] }) });
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
