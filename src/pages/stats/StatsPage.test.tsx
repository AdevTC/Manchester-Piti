import { fireEvent, render, screen, within } from "@testing-library/react";
import type { ReactNode } from "react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import type { ClubMatch } from "../../lib/clubData";
import { statsSearchSchema } from "../../router";
import type { ExploreSectionId, StatsView } from "../../lib/interimScreens";

// Números (today's /stats page on the /numeros screens): the «Posiciones» tab (after «Minutos», its own
// address, /numeros/campo/puestos) and the Resumen constellation placed by exact position. Data, season and
// router are stubbed: no Firebase. The stubbed address is the screen of the stubbed search's old view.

const search = vi.hoisted(() => ({ value: {} as Record<string, unknown> }));
const navigate = vi.hoisted(() => vi.fn());
const data = vi.hoisted(() => ({ matches: [] as unknown[], players: [] as unknown[] }));

vi.mock("@tanstack/react-router", async (orig) => {
  const { statsViewPath } = await import("../../lib/interimScreens");
  type Location = { pathname: string };
  const location = (): Location => ({
    pathname: statsViewPath((search.value.view ?? "summary") as StatsView, search.value.section as ExploreSectionId | undefined),
  });
  return {
    ...(await orig<typeof import("@tanstack/react-router")>()),
    Link: ({ children, className, "aria-label": label }: { children?: ReactNode; className?: string; "aria-label"?: string }) => (
      <a className={className} aria-label={label} href="#">
        {children}
      </a>
    ),
    useSearch: () => search.value,
    useLocation: (options?: { select?: (l: Location) => unknown }) => (options?.select ? options.select(location()) : location()),
    useNavigate: () => navigate,
  };
});
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

  it("clicking «Posiciones» navigates to its screen, /numeros/campo/puestos", () => {
    search.value = { view: "summary" };
    render(<StatsPage />);
    fireEvent.click(within(screen.getByRole("navigation", { name: "Secciones de estadísticas" })).getByRole("button", { name: "Posiciones" }));
    const call = navigate.mock.lastCall?.[0] as { to: string; search: (prev: Record<string, unknown>) => Record<string, unknown> };
    expect(call.to).toBe("/numeros/campo/puestos");
    expect(call.search({ season: "t1", view: "summary" })).toStrictEqual({ season: "t1" });
  });

  it("?a=&b= are Comparar's pair: strings (a numeric id too), anything else dropped", () => {
    expect(statsSearchSchema.parse({ view: "compare", a: "lat", b: "dc" })).toMatchObject({ view: "compare", a: "lat", b: "dc" });
    expect(statsSearchSchema.parse({ a: 123 }).a).toBe("123");
    expect(statsSearchSchema.parse({ a: { x: 1 }, b: ["dc"] })).toMatchObject({ a: undefined, b: undefined });
  });

  it("the Resumen constellation places each star by the position he played", () => {
    search.value = { view: "summary" };
    render(<StatsPage />);
    const star = screen.getByRole("button", { name: /^LATERAL: 1 goles/ });
    expect(star.style.left).toBe("86%"); // LD, not his preferida DFC (50)
  });
});

describe("StatsPage · Análisis del juego", () => {
  it("goals-only acts retain the catalogue and explain what the graphical summary needs", () => {
    search.value = { view: "game" };
    render(<StatsPage />);
    expect(screen.getByRole("heading", { name: "El análisis empieza con las jugadas" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Catálogo de estadísticas" })).toBeInTheDocument();
    expect(screen.queryByRole("region", { name: "Estadísticas detalladas" })).toBeNull();
    expect(screen.queryByRole("region", { name: "La temporada, ahora" })).not.toBeInTheDocument();
    expect(screen.queryByRole("list", { name: "Líderes del período" })).not.toBeInTheDocument();
  });

  it("with a narrated action: the panel, its names linked", () => {
    search.value = { view: "game" };
    const [first] = data.matches as ClubMatch[];
    first.events = [...(first.events ?? []), { id: "a1", type: "pass", outcome: "complete", playerId: "dc", receiverId: "lat", minute: 4 }];
    render(<StatsPage />);
    const panel = screen.getByRole("region", { name: "Estadísticas detalladas" });
    expect(within(panel).getByRole("heading", { name: "La red de pases" })).toBeInTheDocument();
    expect(screen.getByRole("table", { name: /^Estadísticas por jugador/ })).toBeInTheDocument();
    expect(within(screen.getByRole("table", { name: /^Conexiones dirigidas/ })).getAllByRole("link").map((a) => a.textContent)).toEqual(["PUNTA", "LATERAL"]);
  });
});

describe("StatsPage · shareable scopes", () => {
  it("keeps an explicit unknown match empty instead of displaying all matches", () => {
    search.value = { view: "game", analysis: "catalog", matches: ["removed"] };
    render(<StatsPage/>);
    expect(screen.getByText("0 partidos en la selección")).toBeInTheDocument();
    expect(screen.getByRole("list", { name: "Estadísticas del catálogo" })).toBeInTheDocument();
    expect(screen.queryByRole("region", { name: "Carrera del Pichichi" })).not.toBeInTheDocument();
  });
  it("projects selected players while retaining the full match for passing recipients", () => {
    search.value = { view: "game", players: ["dc"] };
    render(<StatsPage/>);
    const table = screen.getByRole("table", { name: /^Estadísticas por jugador/ });
    expect(within(table).getByRole("rowheader", { name: "PUNTA" })).toBeInTheDocument();
    expect(within(table).queryByRole("rowheader", { name: "LATERAL" })).not.toBeInTheDocument();
    expect(screen.getByText("1 partido en la selección")).toBeInTheDocument();
  });
  it("writes plural seasons with season=all and clears the previous match subset", () => {
    search.value = { view: "game", matches: ["j1"] };
    render(<StatsPage/>);
    fireEvent.click(screen.getByLabelText("Temporada 1"));
    const call = navigate.mock.lastCall?.[0] as { search: (previous: Record<string, unknown>) => Record<string, unknown> };
    expect(call.search({ season: "saved", matches: ["j1"], view: "game" })).toMatchObject({ season: "all", seasons: ["t1"], matches: undefined, view: "game" });
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
