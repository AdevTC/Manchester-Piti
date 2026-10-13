import { render, screen, within } from "@testing-library/react";
import type { ReactNode } from "react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import type { ClubMatch } from "../../lib/clubData";
import { statsSearchSchema } from "../../router";

// /stats: the «Posiciones» tab (after «Minutos», deep-linkable as ?view=positions) and the Resumen
// constellation placed by exact position. Data, season and router are stubbed: no Firebase.

const search = vi.hoisted(() => ({ value: {} as Record<string, unknown> }));
const data = vi.hoisted(() => ({ matches: [] as unknown[], players: [] as unknown[] }));

vi.mock("@tanstack/react-router", async (orig) => ({
  ...(await orig<typeof import("@tanstack/react-router")>()),
  Link: ({ children, className, "aria-label": label }: { children?: ReactNode; className?: string; "aria-label"?: string }) => (
    <a className={className} aria-label={label} href="#">
      {children}
    </a>
  ),
  getRouteApi: () => ({ useSearch: () => search.value }),
  useNavigate: () => vi.fn(),
}));
vi.mock("../../lib/clubData", async (orig) => ({ ...(await orig<typeof import("../../lib/clubData")>()), useClubData: () => ({ ...data, loading: false, error: null }) }));
vi.mock("../../context/SeasonContext", () => ({ useSeason: () => ({ seasons: [{ id: "t1", name: "Temporada 1" }], selectedSeasonId: "all", loadingSeasons: false }) }));
vi.mock("../vestuario/live", () => ({ useMvpResults: () => new Map() }));
vi.mock("../../components/ThemeToggle", () => ({ ThemeToggle: () => null }));
vi.mock("./Race", () => ({ RaceBoard: () => null, Ticker: () => null }));

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

  it("the Resumen constellation places each star by the position he played", () => {
    search.value = { view: "summary" };
    render(<StatsPage />);
    const star = screen.getByRole("button", { name: /^LATERAL: 1 goles/ });
    expect(star.style.left).toBe("86%"); // LD, not his preferida DFC (50)
  });
});
