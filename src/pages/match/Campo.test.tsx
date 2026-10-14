import { render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, expect, it, vi } from "vitest";
import { CampoTab } from "./Tabs";
import type { ClubMatch } from "../../lib/clubData";

vi.mock("../../context/SeasonContext", () => ({ useSeason: () => ({ seasons: [] }) }));
vi.mock("@tanstack/react-router", () => ({ Link: ({ children }: { children: React.ReactNode }) => <span>{children}</span> }));
afterEach(() => vi.useRealTimers());

it("replaces the player immediately, puts the outgoing player's stats on the bench and permits inspecting them", async () => {
  const start = Date.now() - 25 * 60_000;
  const players = ["a", "b", "h"].map((id, i) => ({ id, firstName: id, number: i + 1 }));
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
