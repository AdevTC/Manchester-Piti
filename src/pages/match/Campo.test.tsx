import { render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, expect, it, vi } from "vitest";
import { CampoTab, CronicaTab, DirectoTab } from "./Tabs";
import type { ClubMatch } from "../../lib/clubData";

const squad = vi.hoisted(() => ["a", "b", "h"].map((id, i) => ({ id, firstName: id, number: i + 1 })));
vi.mock("../../context/SeasonContext", () => ({ useSeason: () => ({ seasons: [] }) }));
// (the player links: the href the router would build, /jugadores/<id>?season=<season>)
vi.mock("@tanstack/react-router", () => ({
  Link: ({ children, to, params, search, className }: { children: React.ReactNode; to: string; params?: Record<string, string>; search?: { season?: string }; className?: string }) => (
    <a className={className} href={to.replace("$playerId", params?.playerId ?? "").replace("$matchId", params?.matchId ?? "") + (search?.season ? `?season=${search.season}` : "")}>
      {children}
    </a>
  ),
}));
vi.mock("../../lib/clubData", async (orig) => ({ ...(await orig<typeof import("../../lib/clubData")>()), useClubData: () => ({ matches: [], players: squad, loading: false, error: null }) }));
afterEach(() => vi.useRealTimers());

it("replaces the player immediately, puts the outgoing player's stats on the bench and permits inspecting them", async () => {
  const start = Date.now() - 25 * 60_000;
  const players = squad;
  const match: ClubMatch = { id: "m", date: start, duration: 60, status: "scheduled", starters: ["a", "b"], bench: ["h"], events: [
    { id: "g1", type: "goal", minute: 5, playerId: "a", assistPlayerId: "b" },
    { id: "g2", type: "goal", minute: 8, playerId: "a", assistPlayerId: "b" },
    { id: "y", type: "yellow_card", minute: 10, playerId: "a" },
    { id: "s", type: "substitution", minute: 20, playerId: "a", inPlayerId: "h" },
  ] };
  const { container, rerender } = render(<CampoTab match={match} players={players} nameOf={(id) => id.toUpperCase()} live />);
  const pitch = container.querySelector(".fc-pitch") as HTMLElement;
  expect(within(pitch).getByRole("button", { name: /^H, dorsal/ })).toBeInTheDocument();
  expect(within(pitch).queryByRole("button", { name: /^A, dorsal/ })).toBeNull();
  const bench = container.querySelector(".fc-bench") as HTMLElement;
  expect(within(bench).getByRole("img", { name: "2 goles" })).toBeInTheDocument();
  expect(within(bench).getByRole("img", { name: "1 amarilla" })).toBeInTheDocument();
  expect(within(bench).getByText(/20′/)).toBeInTheDocument();
  expect(within(pitch).getByRole("img", { name: "2 asistencias" })).toBeInTheDocument();
  await userEvent.setup().click(within(bench).getByRole("button"));
  expect(container.querySelector(".fc-pinfo")).toHaveTextContent("1 · A");
  rerender(<CampoTab match={{ ...match, events: [...match.events!, { id: "red", type: "red_card", minute: 24, playerId: "h" }] }} players={players} nameOf={(id) => id.toUpperCase()} live />);
  expect(within(pitch).queryByRole("button", { name: /^H, dorsal/ })).toBeNull();
  expect(screen.getByText(/Expulsado · 4′ · entró 20′/)).toBeInTheDocument();
});

it("the player card and the minutes chart name each one as a link to his page, in the match's season", async () => {
  const start = Date.now() - 3 * 3_600_000;
  const match: ClubMatch = { id: "m", seasonId: "t1", date: start, duration: 50, status: "finished", goalsFor: 1, goalsAgainst: 0, starters: ["a", "b"], bench: ["h"], events: [{ id: "g1", type: "goal", minute: 5, playerId: "a" }],
    ledger: { a: { minutes: 50, played: true, started: true, benched: false, notCalled: false, subIn: 0, subOut: 0, dismissed: false, stints: [[0, 50]], exchanges: [], goals: 1, assists: 0, yellowCards: 0, redCards: 0, doubleYellows: 0, penaltyCommitted: 0, penaltyReceived: 0, penaltySaved: 0, penaltyMissed: 0, goalPenalty: 0, goalFreekick: 0, ownGoals: 0, woodwork: 0 } } } as unknown as ClubMatch;
  const { container } = render(<CampoTab match={match} players={squad} nameOf={(id) => id.toUpperCase()} live={false} />);
  const card = container.querySelector(".fc-pinfo") as HTMLElement;
  expect(within(card).getByRole("link", { name: "A" })).toHaveAttribute("href", "/jugadores/a?season=t1");
  const chart = container.querySelector(".fc-stints") as HTMLElement;
  expect(within(chart).getByRole("link", { name: "A" })).toHaveAttribute("href", "/jugadores/a?season=t1");
  // (the pitch and the bench stay buttons that pick the card: no link inside a button)
  expect(container.querySelector(".fc-pitch a, .fc-bench a")).toBeNull();
});

it("the crónica links every one of ours it names, once per chapter; an unknown id stays text", () => {
  const match: ClubMatch = { id: "m", seasonId: "t1", rival: "MAD SKY", date: Date.now() - 86_400_000, duration: 50, status: "finished", goalsFor: 2, goalsAgainst: 0, version: 2, events: [
    { id: "g1", type: "goal", minute: 5, playerId: "a", assistPlayerId: "b" },
    { id: "s1", type: "substitution", minute: 20, playerId: "b", inPlayerId: "h" },
    { id: "g2", type: "goal", minute: 30, playerId: "zz" },
  ] };
  const { container } = render(<CronicaTab match={match} matches={[match]} players={squad} nameOf={(id) => id.toUpperCase()} />);
  const [goal, sub, other] = [...container.querySelectorAll<HTMLElement>(".fc-ch")];
  expect(within(goal).getByRole("link", { name: "A" })).toHaveAttribute("href", "/jugadores/a?season=t1");
  expect(within(goal).getByRole("link", { name: "B" })).toHaveAttribute("href", "/jugadores/b?season=t1");
  expect(goal.querySelector("p")).toHaveTextContent("A marca, con asistencia de B. 1–0.");
  // «Entra H» (title) · «Sale B.» (sentence): each linked where it is said
  expect(within(sub.querySelector("h3")!).getByRole("link", { name: "H" })).toHaveAttribute("href", "/jugadores/h?season=t1");
  expect(within(sub.querySelector("p")!).getByRole("link", { name: "B" })).toBeInTheDocument();
  expect(within(other).queryByRole("link")).toBeNull();
  expect(other.querySelector("p")).toHaveTextContent("ZZ marca. 2–0.");
});

it("two of ours with the same name in one change: «Entra» links who comes on, «Sale» who goes off", () => {
  const match: ClubMatch = { id: "m", seasonId: "t1", rival: "R", date: Date.now() - 86_400_000, duration: 50, status: "finished", goalsFor: 1, goalsAgainst: 0, version: 2, events: [
    { id: "g1", type: "goal", minute: 5, playerId: "a" },
    { id: "s1", type: "substitution", minute: 20, playerId: "b", inPlayerId: "h" },
  ] };
  const { container } = render(<CronicaTab match={match} matches={[match]} players={squad} nameOf={(id) => (id === "a" ? "A" : "PEPE")} />);
  const sub = container.querySelectorAll<HTMLElement>(".fc-ch")[1];
  expect(within(sub.querySelector("h3")!).getByRole("link", { name: "PEPE" })).toHaveAttribute("href", "/jugadores/h?season=t1");
  expect(within(sub.querySelector("p")!).getByRole("link", { name: "PEPE" })).toHaveAttribute("href", "/jugadores/b?season=t1");
});

it("the Directo feed reads a live-stamped goal in football's minute (0:07 → 1′); a typed minute as typed", () => {
  const match: ClubMatch = { id: "m", date: Date.now(), duration: 50, status: "scheduled", events: [
    { id: "g1", type: "goal", minute: 0, elapsedSeconds: 7, playerId: "a" },
    { id: "g2", type: "opponent_goal", minute: 19 },
  ] };
  const { container } = render(<DirectoTab match={match} nameOf={(id) => id.toUpperCase()} />);
  const rows = [...container.querySelectorAll(".fc-feed li b")].map((b) => b.textContent);
  expect(rows).toEqual(["19′", "1′"]);
});
