import { render, screen, within } from "@testing-library/react";
import type { ReactNode } from "react";
import { beforeEach, expect, it, vi } from "vitest";
import type { ClubMatch } from "../../lib/clubData";
import type { MatchEvent } from "../../../functions/src/matchEngine";
import { readyClock, transitionClock } from "../../../functions/src/matchClock";
import { _resetSnapshotMetaForTesting, metaKeyOf, recordSnapshotMeta } from "../../lib/syncStatus";

// /partidos: the strip says «pendiente del acta» for a played match waiting for it, and the live row's
// score flips like the board's (a late old goal changes it without the flip). Data, season, clock and
// router are stubbed: no Firebase.

const MIN = 60_000;
const DAY = 86_400_000;
const T0 = Date.UTC(2026, 10, 8, 11);
const clock = vi.hoisted(() => ({ now: 0 }));
const data = vi.hoisted(() => ({ matches: [] as unknown[], players: [] as unknown[], error: null as Error | null }));

vi.mock("@tanstack/react-router", () => ({
  Link: ({ children, className, to, params, search, "aria-label": label }: { children?: ReactNode; className?: string; to?: string; params?: Record<string, string>; search?: { season?: string }; "aria-label"?: string }) => (
    <a className={className} aria-label={label} href={to === "/jugadores/$playerId" ? `/jugadores/${params?.playerId}${search?.season ? `?season=${search.season}` : ""}` : to === "/matches/$matchId" ? `/matches/${params?.matchId}` : "#"}>
      {children}
    </a>
  ),
  useNavigate: () => vi.fn(),
}));
vi.mock("../../lib/clubData", async (orig) => ({ ...(await orig<typeof import("../../lib/clubData")>()), useClubData: () => ({ matches: data.matches, players: data.players, loading: false, error: data.error }) }));
vi.mock("../../context/SeasonContext", () => ({ useSeason: () => ({ seasons: [{ id: "t1", name: "Temporada 1" }], selectedSeasonId: "all", loadingSeasons: false }) }));
vi.mock("../../hooks/useClock", () => ({ useClock: () => clock.now }));
vi.mock("../../components/ThemeToggle", () => ({ ThemeToggle: () => null }));
vi.mock("../../components/celeste/Avisos", () => ({ Avisos: () => null }));
vi.mock("../../components/celeste/WeatherChip", () => ({ WeatherChip: () => null }));
vi.mock("../../components/celeste/Chrome", () => ({ CelesteBackdrop: () => null, CelesteDock: () => null, CelesteFooter: () => null, CelesteHeader: () => null }));

const { PartidosPage } = await import("./PartidosPage");

const goal = (id: string, minute: number): MatchEvent => ({ id, type: "goal", minute, elapsedSeconds: minute * 60, playerId: "x" }) as MatchEvent;
const played: ClubMatch = { id: "m1", seasonId: "t1", rival: "LOS ROJOS", status: "finished", date: T0 - 14 * DAY, goalsFor: 2, goalsAgainst: 1 };

beforeEach(() => {
  clock.now = T0;
  data.players = [];
  data.error = null;
});

it("the data did not arrive: the error panel (h1, «Reintentar») instead of an empty calendar", () => {
  data.matches = [];
  data.error = new Error("unavailable");
  render(<PartidosPage />);
  const alert = screen.getByRole("alert");
  expect(within(alert).getByRole("heading", { level: 1, name: "El marcador no carga" })).toBeInTheDocument();
  expect(within(alert).getByRole("button", { name: "Reintentar" })).toBeInTheDocument();
  expect(screen.queryByText("Todo por estrenar")).toBeNull();
});

it("a played match waiting for its acta: «pendiente del acta» on the strip, never «por jugar»", () => {
  clock.now = T0 + 3 * DAY;
  data.matches = [played, { id: "m2", seasonId: "t1", version: 2, status: "scheduled", rival: "MAD SKY", date: T0, duration: 50, clock: readyClock() }, { id: "m3", seasonId: "t1", status: "scheduled", rival: "EL NUEVO", date: T0 + 7 * DAY }];
  render(<PartidosPage />);
  const tile = screen.getByRole("link", { name: "Jornada 2, MAD SKY: pendiente del acta" });
  expect(tile).toHaveClass("awaiting");
  expect(tile).toHaveTextContent("…");
  expect(screen.getByRole("link", { name: "Jornada 3, EL NUEVO: por jugar" })).toHaveClass("next");
});

it("the live row's score: a late old goal changes it without the flip, a fresh one flips it", () => {
  const live = (events: MatchEvent[]): ClubMatch => ({ id: "l", seasonId: "t1", version: 2, status: "scheduled", rival: "MAD SKY", date: T0, duration: 50, clock: transitionClock(readyClock(), "start", T0), events });
  const rowTile = () => document.querySelector<HTMLElement>(".pt-list .pt-row.live .sc .pt-flip")!;
  clock.now = T0 + 30 * MIN;
  data.matches = [played, live([goal("g1", 5)])];
  const { rerender } = render(<PartidosPage />);
  expect(rowTile()).toHaveTextContent("1");
  expect(rowTile()).toHaveClass("still");
  // an old goal arriving late (a stale cache syncing): the score moves, the tile does not flip
  clock.now = T0 + 30 * MIN + 5_000;
  data.matches = [played, live([goal("g1", 5), goal("g2", 12)])];
  rerender(<PartidosPage />);
  expect(rowTile()).toHaveTextContent("2");
  expect(rowTile()).toHaveClass("still");
  // a fresh one: it flips
  clock.now = T0 + 31 * MIN;
  data.matches = [played, live([goal("g1", 5), goal("g2", 12), goal("g3", 31)])];
  rerender(<PartidosPage />);
  expect(rowTile()).toHaveTextContent("3");
  expect(rowTile()).not.toHaveClass("still");
});

it("the season's goals: each scorer leads to his page, in that season", () => {
  data.players = [{ id: "x", shirtName: "EL NUEVE", seasons: ["t1"] }];
  data.matches = [{ ...played, events: [goal("g1", 5), goal("g2", 20)] }];
  render(<PartidosPage />);
  const card = screen.getByText("Goles de la temporada").closest(".pt-card") as HTMLElement;
  // one link to his page (his row), not two in a row: the headline («EL NUEVE lleva 2») is plain text
  const links = within(card).getAllByRole("link", { name: "EL NUEVE" });
  expect(links).toHaveLength(1);
  expect(links[0]).toHaveAttribute("href", "/jugadores/x?season=t1");
  expect(links[0].closest("li")).not.toBeNull();
  const h3 = within(card).getByRole("heading", { level: 3 });
  expect(h3).toHaveTextContent("EL NUEVE lleva 2");
  expect(within(h3).queryByRole("link")).toBeNull();
});

it("the board's next match: «Ver la previa» → its page; live, the board only follows it in directo", () => {
  const next: ClubMatch = { id: "m2", seasonId: "t1", version: 2, status: "scheduled", rival: "MAD SKY", date: T0, duration: 50, clock: readyClock() };
  clock.now = T0 - DAY;
  data.matches = [played, next];
  const { rerender } = render(<PartidosPage />);
  const board = () => document.querySelector<HTMLElement>(".pt-board")!;
  expect(within(board()).getByRole("link", { name: /Ver la previa/ })).toHaveAttribute("href", "/matches/m2");
  clock.now = T0 + 20 * MIN;
  data.matches = [played, { ...next, clock: transitionClock(readyClock(), "start", T0) }];
  rerender(<PartidosPage />);
  expect(within(board()).queryByRole("link", { name: /Ver la previa/ })).toBeNull();
  expect(within(board()).getByRole("link", { name: /Seguir en directo/ })).toHaveAttribute("href", "/matches/m2");
});

it("the live board shows the connection chip (the island, also on this page, is the one that says it out loud)", () => {
  const MATCHES = metaKeyOf(["matches"]);
  const liveMatch: ClubMatch = { id: "l", seasonId: "t1", version: 2, status: "scheduled", rival: "MAD SKY", date: T0, duration: 50, clock: transitionClock(readyClock(), "start", T0), events: [] };
  clock.now = T0 + 30 * MIN;
  data.matches = [played, liveMatch];
  _resetSnapshotMetaForTesting();
  recordSnapshotMeta(MATCHES, { fromCache: false, hasPendingWrites: false }, T0);
  const { rerender } = render(<PartidosPage />);
  const board = () => document.querySelector("article.pt-board.live") as HTMLElement;
  expect(board().querySelector(".mp-sync")).toBeNull();
  recordSnapshotMeta(MATCHES, { fromCache: true, hasPendingWrites: false }, T0 + 25 * MIN);
  rerender(<PartidosPage />);
  expect(within(board()).getByText("Sin conexión · marcador de hace 5 min")).toBeInTheDocument();
  expect(board().querySelector(".mp-sync-sr")).toBeNull();
  _resetSnapshotMetaForTesting();
});
