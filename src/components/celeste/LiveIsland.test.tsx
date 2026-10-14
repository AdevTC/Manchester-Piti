import { fireEvent, render, screen } from "@testing-library/react";
import type { ReactNode } from "react";
import { beforeEach, expect, it, vi } from "vitest";
import { readyClock, transitionClock } from "../../../functions/src/matchClock";
import type { ClubMatch } from "../../lib/clubData";
import type { PlayerDoc } from "../../lib/schemas";

const MIN = 60_000;
const DATE = Date.UTC(2026, 10, 8, 11);
const state: { matches: ClubMatch[]; players: PlayerDoc[]; now: number; path: string } = { matches: [], players: [], now: 0, path: "/" };

vi.mock("@tanstack/react-router", () => ({
  Link: ({ children, className, ...rest }: { children?: ReactNode; className?: string; "aria-label"?: string }) => (
    <a className={className} href="#" aria-label={rest["aria-label"]}>
      {children}
    </a>
  ),
  useRouterState: () => state.path,
}));
vi.mock("../../hooks/useClock", () => ({ useClock: () => state.now }));
vi.mock("../../lib/clubData", async (orig) => ({ ...(await orig<typeof import("../../lib/clubData")>()), useClubData: () => ({ matches: state.matches, players: state.players }) }));

const { LiveIsland } = await import("./LiveIsland");
const match: ClubMatch = { id: "j8", version: 2, status: "scheduled", rival: "MAD SKY", rivalInitials: "MSK", date: DATE, duration: 50, clock: readyClock() };

beforeEach(() => {
  state.matches = [match];
  state.players = [];
  state.path = "/";
});

it("no pill before the date, nor once the window for the whistle is over", () => {
  state.now = DATE - MIN;
  const { container, rerender } = render(<LiveIsland />);
  expect(container).toBeEmptyDOMElement();
  state.now = DATE + 50 * MIN + 2 * 60 * MIN;
  rerender(<LiveIsland />);
  expect(container).toBeEmptyDOMElement();
});

it("from the date until someone starts the clock: a quiet pill «Pendiente del pitido inicial» (not on its own page)", () => {
  state.now = DATE + 5 * MIN;
  const { container, rerender } = render(<LiveIsland />);
  expect(screen.getByRole("link", { name: /pendiente del pitido inicial/ })).toHaveTextContent("Pendiente del pitido inicial");
  expect(container.querySelector(".pt-dot")).toBeNull();
  state.path = "/matches/j8";
  rerender(<LiveIsland />);
  expect(container).toBeEmptyDOMElement();
});

it("two matches waiting at once: the earliest by date, whatever their order in the list", () => {
  const earlier: ClubMatch = { ...match, id: "j7", rival: "FUSION 7", rivalInitials: "FU7", date: DATE - 30 * MIN };
  state.matches = [match, earlier];
  state.now = DATE + 5 * MIN;
  const { rerender } = render(<LiveIsland />);
  expect(screen.getByRole("link")).toHaveTextContent("vs FU7");
  state.matches = [earlier, match];
  rerender(<LiveIsland />);
  expect(screen.getByRole("link")).toHaveTextContent("vs FU7");
});

it("the clock starts: the live pill with the score and the minute", () => {
  state.matches = [{ ...match, clock: transitionClock(match.clock, "start", DATE + 10 * MIN) }];
  state.now = DATE + 13 * MIN;
  render(<LiveIsland />);
  expect(screen.getByRole("button", { name: /En directo: Manchester Piti 0, MAD SKY 0, minuto 3/ })).toBeInTheDocument();
  expect(screen.queryByText("Pendiente del pitido inicial")).toBeNull();
});

it("the last event names the scorer by the match's own season (nameFor with match.seasonId: his shirt name that season)", () => {
  state.players = [{ id: "pepe", shirtName: "PEPE", firstName: "José", seasons: ["t1", "t2"], seasonDetails: { t2: { shirtName: "PEPITO" } } } as unknown as PlayerDoc];
  state.matches = [{ ...match, seasonId: "t2", clock: transitionClock(match.clock, "start", DATE + 10 * MIN), events: [{ id: "g1", type: "goal", minute: 2, playerId: "pepe" }] }];
  state.now = DATE + 13 * MIN;
  render(<LiveIsland />);
  fireEvent.click(screen.getByRole("button", { name: /En directo/ }));
  expect(screen.getByRole("region", { name: /En directo/ })).toHaveTextContent("PEPITO");
  expect(screen.getByRole("region", { name: /En directo/ })).not.toHaveTextContent("PEPE ·");
});
