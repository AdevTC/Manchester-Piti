import { render, screen, within } from "@testing-library/react";
import type { ReactNode } from "react";
import { expect, it, vi } from "vitest";
import type { ClubMatch } from "../../lib/clubData";

// /jugadores/$id «Sus cambios»: whoever he came on or went off for leads to that player's page, in the
// season being looked at; someone no longer in the squad stays text. Router, data, season and the heavy
// pieces (charts, cromo, 3D stills) are stubbed: no Firebase, no WebGL.

vi.mock("@tanstack/react-router", () => ({
  Link: ({ children, className, to, params, search }: { children?: ReactNode; className?: string; to?: string; params?: Record<string, string>; search?: { season?: string } }) => (
    <a className={className} href={to === "/jugadores/$playerId" ? `/jugadores/${params?.playerId}${search?.season ? `?season=${search.season}` : ""}` : (to ?? "#")}>
      {children}
    </a>
  ),
  getRouteApi: () => ({ useParams: () => ({ playerId: "erik" }) }),
}));

type Row = NonNullable<ClubMatch["ledger"]>[string];
const row = (minutes: number, exchanges: Row["exchanges"], extra: Partial<Row> = {}): Row => ({ minutes, started: true, benched: false, notCalled: false, played: true, subIn: 0, subOut: 0, dismissed: false, stints: [], exchanges, goals: 0, assists: 0, yellowCards: 0, redCards: 0, doubleYellows: 0, penaltyCommitted: 0, penaltyReceived: 0, penaltySaved: 0, penaltyMissed: 0, goalPenalty: 0, goalFreekick: 0, ownGoals: 0, woodwork: 0, ...extra });
const data = vi.hoisted(() => ({ matches: [] as unknown[], players: [] as unknown[] }));
data.matches = [
  {
    id: "j1",
    seasonId: "t1",
    rival: "MAD SKY",
    date: Date.UTC(2026, 8, 6),
    duration: 50,
    status: "finished",
    goalsFor: 1,
    goalsAgainst: 0,
    events: [],
    ledger: {
      erik: row(30, [{ minute: 30, with: "pablo", direction: "out" }, { minute: 40, with: "ex", direction: "in" }]),
      pablo: row(20, [{ minute: 30, with: "erik", direction: "in" }], { started: false, subIn: 1 }),
    },
  },
];
data.players = [
  { id: "erik", shirtName: "ERIK", seasons: ["t1"], number: 7 },
  { id: "pablo", shirtName: "PABLO", seasons: ["t1"], seasonDetails: { t1: { shirtName: "PABLITO" } } },
];

vi.mock("../../lib/clubData", async (orig) => ({ ...(await orig<typeof import("../../lib/clubData")>()), useClubData: () => ({ ...data, loading: false, error: null }) }));
vi.mock("../../context/SeasonContext", () => ({ useSeason: () => ({ seasons: [{ id: "t1", name: "Temporada 1" }], selectedSeasonId: "t1", loadingSeasons: false }) }));
vi.mock("../../lib/useSetSeason", () => ({ ALL_SEASONS_LABEL: "Todo el historial", useSetSeason: () => vi.fn() }));
vi.mock("../vestuario/live", () => ({ useMvpResults: () => new Map() }));
vi.mock("../../hooks/useClock", () => ({ useClock: () => Date.UTC(2026, 8, 20) }));
vi.mock("../../hooks/useTheme", () => ({ useTheme: () => ({ theme: "dark" }) }));
vi.mock("../../components/jersey3d/useShirtStills", () => ({ useShirtStills: () => () => undefined }));
vi.mock("../../components/ThemeToggle", () => ({ ThemeToggle: () => null }));
vi.mock("../../components/NewBadge", () => ({ NewBadge: () => null }));
vi.mock("../../components/celeste/TechnicalStats", () => ({ TechnicalStatsPanel: () => null }));
vi.mock("../../components/celeste/Chrome", () => ({ CelesteBackdrop: () => null, CelesteDock: () => null, CelesteFooter: () => null, CelesteHeader: () => null }));
vi.mock("../stats/Charts", () => ({ Constellation: () => null, GoalClock: () => null, Radar: () => null }));
vi.mock("./Cromo", () => ({ Cromo: () => null }));
vi.mock("./SusPosiciones", () => ({ SusPosiciones: () => null }));

const { JugadorPage } = await import("./JugadorPage");

it("«Sus cambios»: the teammate is a link to his page in the season; one no longer in the squad is text", () => {
  render(<JugadorPage />);
  const subs = screen.getByRole("heading", { name: "Sus cambios" }).closest("section") as HTMLElement;
  const out = within(subs).getByText(/^Salió por/).closest("li") as HTMLElement;
  expect(within(out).getByRole("link", { name: "PABLITO" })).toHaveAttribute("href", "/jugadores/pablo?season=t1");
  const back = within(subs).getByText(/^Entró por/).closest("li") as HTMLElement;
  expect(back).toHaveTextContent("Entró por un compañero");
  expect(within(back).queryByRole("link")).toBeNull();
});
