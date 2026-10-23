import { render, screen, within } from "@testing-library/react";
import type { ReactNode } from "react";
import { afterEach, expect, it, vi } from "vitest";
import { analysePlayer } from "../../lib/clubAnalytics";
import { nameFor, type ClubMatch } from "../../lib/clubData";

// /stats «La carrera del Pichichi»: the names on the board lead to each player's page, in the season on
// the board. The animated rows are a picture (aria-hidden), so their links stay out of the tab order;
// the leaders above and «Más jornadas en cabeza» are the reachable ones. Router and data stubbed.

vi.mock("@tanstack/react-router", () => ({
  Link: ({ children, className, to, params, search, tabIndex }: { children?: ReactNode; className?: string; to?: string; params?: Record<string, string>; search?: { season?: string }; tabIndex?: number }) => (
    <a className={className} tabIndex={tabIndex} href={to === "/jugadores/$playerId" ? `/jugadores/${params?.playerId}${search?.season ? `?season=${search.season}` : ""}` : "#"}>
      {children}
    </a>
  ),
}));
const squad = vi.hoisted(() => [
  { id: "erik", shirtName: "ERIK" },
  { id: "pablo", shirtName: "PABLO" },
]);
vi.mock("../../lib/clubData", async (orig) => ({ ...(await orig<typeof import("../../lib/clubData")>()), useClubData: () => ({ matches: [], players: squad, loading: false, error: null }) }));

const { RaceBoard } = await import("./Race");
afterEach(() => vi.unstubAllGlobals());

const game = (id: string, day: number, scorer: string): ClubMatch => ({ id, seasonId: "t1", rival: "R", date: Date.UTC(2026, 8, day), duration: 50, status: "finished", goalsFor: 1, goalsAgainst: 0, events: [{ id: `g${id}`, type: "goal", minute: 10, playerId: scorer }] });
const games = [game("j1", 6, "erik"), game("j2", 13, "erik")];

it("the leader and the rows are links to his page in the season; only the reachable ones take focus", () => {
  vi.stubGlobal("matchMedia", () => ({ matches: true })); // reduced motion: the board shows the standing, no replay
  const rows = squad.map((p) => analysePlayer(p, games));
  render(<RaceBoard rows={rows} nameOf={(p) => nameFor(p)} jornada={new Map([["j1", 1], ["j2", 2]])} seasonId="t1" />);
  const leader = screen.getByText(/^En cabeza/).closest("span") as HTMLElement;
  expect(within(leader).getByRole("link", { name: "ERIK" })).toHaveAttribute("href", "/jugadores/erik?season=t1");
  const most = screen.getByText(/^Más jornadas en cabeza/) as HTMLElement;
  expect(within(most).getByRole("link", { name: "ERIK" })).toHaveAttribute("href", "/jugadores/erik?season=t1");
  const board = document.querySelector(".st-rrows") as HTMLElement;
  const row = board.querySelector<HTMLAnchorElement>("a.pl-link")!;
  expect(row).toHaveAttribute("href", "/jugadores/erik?season=t1");
  expect(row).toHaveAttribute("tabindex", "-1");
});

it("«all seasons» on the board: the links carry no season", () => {
  vi.stubGlobal("matchMedia", () => ({ matches: true }));
  const rows = squad.map((p) => analysePlayer(p, games));
  render(<RaceBoard rows={rows} nameOf={(p) => nameFor(p)} jornada={new Map([["j1", 1], ["j2", 2]])} seasonId="all" />);
  for (const a of document.querySelectorAll("a.pl-link")) expect(a).toHaveAttribute("href", "/jugadores/erik");
});

it("shows everyone tied for most jornadas in the lead", () => {
  vi.stubGlobal("matchMedia", () => ({ matches: true }));
  const tied = { ...game("j1", 6, "erik"), goalsFor: 2, events: [{ id: "a", type: "goal" as const, minute: 10, playerId: "erik" }, { id: "b", type: "goal" as const, minute: 20, playerId: "pablo" }] };
  render(<RaceBoard rows={squad.map(p => analysePlayer(p, [tied]))} nameOf={nameFor} jornada={new Map([["j1", 1]])} seasonId="t1" />);
  const most = screen.getByText(/^Más jornadas en cabeza/);
  expect(within(most).getAllByRole("link").map(a => a.textContent)).toEqual(["ERIK", "PABLO"]);
  expect(most).toHaveTextContent("1 · compartido");
});

it("rows that arrive after the first render open the board on the last jornada", () => {
  vi.stubGlobal("matchMedia", () => ({ matches: true }));
  const jornada = new Map([["j1", 1], ["j2", 2]]);
  const { rerender } = render(<RaceBoard rows={[]} nameOf={(p) => nameFor(p)} jornada={jornada} seasonId="t1" />);
  rerender(<RaceBoard rows={squad.map((p) => analysePlayer(p, games))} nameOf={(p) => nameFor(p)} jornada={jornada} seasonId="t1" />);
  expect(screen.getByRole("button", { name: "J2, R" })).toHaveAttribute("aria-pressed", "true");
});
