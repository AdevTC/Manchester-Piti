import { fireEvent, render, screen, within } from "@testing-library/react";
import type { ReactNode } from "react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import type { ClubMatch } from "../../lib/clubData";
import { statsSearchSchema } from "../../router";

// /stats: the «Posiciones» tab (after «Minutos», deep-linkable as ?view=positions) and the Resumen
// constellation placed by exact position. Data, season and router are stubbed: no Firebase.

const search = vi.hoisted(() => ({ value: {} as Record<string, unknown> }));
const navigate = vi.hoisted(() => vi.fn());
const data = vi.hoisted(() => ({ matches: [] as unknown[], players: [] as unknown[] }));

vi.mock("@tanstack/react-router", async (orig) => ({
  ...(await orig<typeof import("@tanstack/react-router")>()),
  Link: ({ children, className, "aria-label": label }: { children?: ReactNode; className?: string; "aria-label"?: string }) => (
    <a className={className} aria-label={label} href="#">
      {children}
    </a>
  ),
  getRouteApi: () => ({ useSearch: () => search.value }),
  useNavigate: () => navigate,
}));
vi.mock("../../lib/clubData", async (orig) => ({ ...(await orig<typeof import("../../lib/clubData")>()), useClubData: () => ({ ...data, loading: false, error: null }) }));
vi.mock("../../context/SeasonContext", () => ({ useSeason: () => ({ seasons: [{ id: "t1", name: "Temporada 1" }], selectedSeasonId: "all", loadingSeasons: false }) }));
vi.mock("../vestuario/live", () => ({ useMvpResults: () => new Map() }));
// (the season now reads the captains' table; these tests are about the tabs below it)
vi.mock("../../lib/useStandings", () => ({ useStandings: () => ({ standings: null, loading: false }) }));
vi.mock("../../components/ThemeToggle", () => ({ ThemeToggle: () => null }));
vi.mock("./Race", () => ({ RaceBoard: () => <section aria-label="Carrera del Pichichi" />, Ticker: () => null }));

const { StatsPage } = await import("./StatsPage");

type Row = NonNullable<ClubMatch["ledger"]>[string];
const row = (minutes: number, extra: Partial<Row> = {}): Row => ({ minutes, started: true, benched: false, notCalled: false, played: minutes > 0, subIn: 0, subOut: 0, dismissed: false, stints: [], exchanges: [], goals: 0, assists: 0, yellowCards: 0, redCards: 0, doubleYellows: 0, penaltyCommitted: 0, penaltyReceived: 0, penaltySaved: 0, penaltyMissed: 0, goalPenalty: 0, goalFreekick: 0, ownGoals: 0, woodwork: 0, ...extra });
const goal = (minute: number, playerId: string, assistPlayerId: string) => ({ id: `g${minute}`, type: "goal" as const, minute, playerId, assistPlayerId });

beforeEach(() => {
  data.matches = [
    {
      id: "j1",
      seasonId: "t1",
      rival: "Rival",
      date: Date.UTC(2026, 8, 1),
      duration: 50,
      status: "finished",
      goalsFor: 1,
      goalsAgainst: 0,
      system: "2-3-1",
      events: [goal(10, "lat", "dc")],
      // the scorer is a centre-back on his ficha but played right-back: the star follows the acta
      ledger: { lat: row(50, { goals: 1, positionsPlayed: { LD: 50 } }), dc: row(50, { assists: 1, positionsPlayed: { DC: 50 } }) },
    },
  ];
  data.players = [
    { id: "lat", shirtName: "LATERAL", firstName: "Luis", seasons: ["t1"], positions: { main: "DFC", also: [] } },
    { id: "dc", shirtName: "PUNTA", firstName: "Pepe", seasons: ["t1"], positions: { main: "DC", also: [] } },
  ];
});

describe("StatsPage · Posiciones", () => {
  it("?view=positions is a valid view", () => {
    expect(statsSearchSchema.parse({ view: "positions" }).view).toBe("positions");
  });

  it("the «Posiciones» tab sits after «Minutos» and shows «Por posición» and «Por sistema»", () => {
    search.value = { view: "positions" };
    render(<StatsPage />);
    const tabs = within(screen.getByRole("navigation", { name: "Secciones de estadísticas" })).getAllByRole("button");
    const labels = tabs.map((t) => t.textContent);
    expect(labels.indexOf("Posiciones")).toBe(labels.indexOf("Minutos") + 1);
    expect(tabs[labels.indexOf("Posiciones")]).toHaveAttribute("aria-pressed", "true");
    expect(screen.getByRole("region", { name: "¿De quién es cada puesto?" })).toBeInTheDocument();
    expect(screen.getByRole("region", { name: "El récord de cada sistema" })).toHaveTextContent("2-3-1 · Clásico");
  });

  it("clicking «Posiciones» navigates to view=positions", () => {
    search.value = { view: "summary" };
    render(<StatsPage />);
    fireEvent.click(within(screen.getByRole("navigation", { name: "Secciones de estadísticas" })).getByRole("button", { name: "Posiciones" }));
    const call = navigate.mock.lastCall?.[0] as { search: (prev: Record<string, unknown>) => Record<string, unknown> };
    expect(call.search({ season: "t1" })).toStrictEqual({ season: "t1", view: "positions" });
  });

  it("an old ?tab=compare link still opens Comparar (read as view=compare, never written back)", () => {
    expect(statsSearchSchema.parse({ tab: "compare" })).toStrictEqual({ view: "compare" });
    expect(statsSearchSchema.parse({ tab: "compare", view: "minutes" })).toStrictEqual({ view: "minutes" });
    expect(statsSearchSchema.parse({ tab: "general" })).not.toHaveProperty("view");
    search.value = statsSearchSchema.parse({ tab: "compare" });
    render(<StatsPage />);
    const nav = within(screen.getByRole("navigation", { name: "Secciones de estadísticas" }));
    expect(nav.getByRole("button", { name: "Comparar" })).toHaveAttribute("aria-pressed", "true");
  });

  it("?a=&b= are Comparar's pair: strings (a numeric id too), anything else dropped", () => {
    expect(statsSearchSchema.parse({ view: "compare", a: "lat", b: "dc" })).toMatchObject({ view: "compare", a: "lat", b: "dc" });
    expect(statsSearchSchema.parse({ a: 123 }).a).toBe("123");
    expect(statsSearchSchema.parse({ a: { x: 1 }, b: ["dc"] })).toMatchObject({ a: undefined, b: undefined });
  });

  it("Comparar reads the pair from the URL and writes each pick back, replacing the entry", () => {
    navigate.mockClear();
    search.value = statsSearchSchema.parse({ view: "compare", a: "dc", b: "lat" });
    render(<StatsPage />);
    const left = screen.getByRole("combobox", { name: "Primer jugador" }) as HTMLSelectElement;
    const right = screen.getByRole("combobox", { name: "Segundo jugador" }) as HTMLSelectElement;
    expect([left.value, right.value]).toEqual(["dc", "lat"]);
    fireEvent.click(screen.getByRole("button", { name: "Intercambiar jugadores" }));
    const call = navigate.mock.lastCall?.[0] as { replace?: boolean; search: (prev: Record<string, unknown>) => Record<string, unknown> };
    expect(call.replace).toBe(true);
    expect(call.search({ season: "t1", view: "compare", a: "dc", b: "lat" })).toStrictEqual({ season: "t1", view: "compare", a: "lat", b: "dc" });
  });

  it("leaving Comparar drops its pair from the URL; clicking Comparar keeps it", () => {
    search.value = statsSearchSchema.parse({ view: "compare", a: "dc", b: "lat" });
    render(<StatsPage />);
    const nav = within(screen.getByRole("navigation", { name: "Secciones de estadísticas" }));
    fireEvent.click(nav.getByRole("button", { name: "Minutos" }));
    let call = navigate.mock.lastCall?.[0] as { search: (prev: Record<string, unknown>) => Record<string, unknown> };
    expect(call.search({ season: "t1", view: "compare", a: "dc", b: "lat" })).toStrictEqual({ season: "t1", view: "minutes" });
    fireEvent.click(nav.getByRole("button", { name: "Comparar" }));
    call = navigate.mock.lastCall?.[0] as { search: (prev: Record<string, unknown>) => Record<string, unknown> };
    expect(call.search({ season: "t1", view: "compare", a: "dc", b: "lat" })).toStrictEqual({ season: "t1", view: "compare", a: "dc", b: "lat" });
  });

  it("the Resumen constellation places each star by the position he played", () => {
    search.value = { view: "summary" };
    render(<StatsPage />);
    const star = screen.getByRole("button", { name: /^LATERAL: 1 goles/ });
    expect(star.style.left).toBe("86%"); // LD, not his preferida DFC (50)
  });
});

describe("StatsPage · Análisis del juego", () => {
  it("no acta of the period narrates its plays (goals only): a short line, not a panel of zeros", () => {
    search.value = { view: "game" };
    render(<StatsPage />);
    expect(screen.getByText(/Ningún partido de este período tiene sus jugadas narradas/)).toBeInTheDocument();
    expect(screen.queryByRole("region", { name: "Estadísticas detalladas" })).toBeNull();
  });

  it("with a narrated action: the panel, its names linked", () => {
    search.value = { view: "game" };
    const [first] = data.matches as ClubMatch[];
    first.events = [...(first.events ?? []), { id: "a1", type: "pass", outcome: "complete", playerId: "dc", receiverId: "lat", minute: 4 }];
    render(<StatsPage />);
    const panel = screen.getByRole("region", { name: "Estadísticas detalladas" });
    expect(within(panel).getByRole("heading", { name: "El Piti y el rival" })).toBeInTheDocument();
    expect(within(screen.getByRole("table", { name: /^Conexiones dirigidas/ })).getAllByRole("link").map((a) => a.textContent)).toEqual(["PUNTA", "LATERAL"]);
  });
});

describe("StatsPage · navigation before the board", () => {
  it("puts navigation before the race in document order, and skips the race in focused views", () => {
    search.value = { view: "summary" };
    const { rerender } = render(<StatsPage />);
    const nav = screen.getByRole("navigation", { name: "Secciones de estadísticas" });
    const race = screen.getByRole("region", { name: "Carrera del Pichichi" });
    expect(nav.compareDocumentPosition(race) & Node.DOCUMENT_POSITION_FOLLOWING).not.toBe(0);
    search.value = { view: "minutes" };
    rerender(<StatsPage />);
    expect(screen.queryByRole("region", { name: "Carrera del Pichichi" })).not.toBeInTheDocument();
  });
  it("credits every tied leader in the header", () => {
    const [match] = data.matches as ClubMatch[];
    match.events = [...(match.events ?? []), goal(20, "dc", "lat")];
    match.goalsFor = 2;
    match.ledger = { lat: row(50, { goals: 1, assists: 1 }), dc: row(50, { goals: 1, assists: 1 }) };
    search.value = { view: "summary" };
    render(<StatsPage />);
    const leaders = screen.getByRole("list", { name: "Líderes del período" });
    const pichichi = within(leaders).getByText("Pichichi").closest("li")!;
    expect(within(pichichi).getAllByRole("link").map(a => a.textContent)).toEqual(["LATERAL", "PUNTA"]);
    expect(pichichi).toHaveTextContent("Liderato compartido");
  });
});
