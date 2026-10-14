import { render, screen } from "@testing-library/react";
import type { ReactNode } from "react";
import { beforeEach, expect, it, vi } from "vitest";
import type { ClubMatch } from "../../lib/clubData";
import type { MatchEvent } from "../../../functions/src/matchEngine";
import { readyClock, transitionClock } from "../../../functions/src/matchClock";

// /partidos: the strip says «pendiente del acta» for a played match waiting for it, and the live row's
// score flips like the board's (a late old goal changes it without the flip). Data, season, clock and
// router are stubbed: no Firebase.

const MIN = 60_000;
const DAY = 86_400_000;
const T0 = Date.UTC(2026, 10, 8, 11);
const clock = vi.hoisted(() => ({ now: 0 }));
const data = vi.hoisted(() => ({ matches: [] as unknown[] }));

vi.mock("@tanstack/react-router", () => ({
  Link: ({ children, className, "aria-label": label }: { children?: ReactNode; className?: string; "aria-label"?: string }) => (
    <a className={className} aria-label={label} href="#">
      {children}
    </a>
  ),
  useNavigate: () => vi.fn(),
}));
vi.mock("../../lib/clubData", async (orig) => ({ ...(await orig<typeof import("../../lib/clubData")>()), useClubData: () => ({ matches: data.matches, players: [], loading: false, error: null }) }));
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
