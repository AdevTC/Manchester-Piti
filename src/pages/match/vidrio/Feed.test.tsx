import { fireEvent, render, screen, within } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import type { ClubMatch, MatchEvent } from "../../../lib/clubData";

vi.mock("../../../context/SeasonContext", () => ({ useSeason: () => ({ seasons: [{ id: "t1", name: "Temporada 1", captainPlayerId: "jordi" }] }) }));
const { Feed } = await import("./Feed");
const { Campo } = await import("./Campo");

const ev = (id: string, type: MatchEvent["type"], min: number, more: Partial<MatchEvent> = {}): MatchEvent => ({ id, type, elapsedSeconds: min * 60 - 20, period: 1, ...more });
const corners = Array.from({ length: 8 }, (_, i) => ev(`c${i}`, "corner", 1 + i));
const match: ClubMatch = {
  id: "j1",
  seasonId: "t1",
  status: "scheduled",
  rival: "Orduña fc",
  date: 0,
  duration: 50,
  starters: ["evans", "fer", "illescas", "jordi", "adrian", "eguzquiza", "alcides"],
  events: [...corners, ev("g1", "goal", 12, { playerId: "alcides", assistPlayerId: "adrian" }), ev("g2", "opponent_goal", 14), ev("y1", "yellow_card", 16, { playerId: "eguzquiza" })],
};
const nameOf = (id: string) => id.charAt(0).toUpperCase() + id.slice(1);

describe("Feed: the play-by-play on two sides", () => {
  it("ours on the left with a gold minute for our goal, theirs on the right; eight and «Ver todo el partido»", () => {
    render(<Feed match={match} nameOf={nameOf} live />);
    const feed = screen.getByRole("list", { name: /las del Piti a la izquierda/ });
    const rows = within(feed).getAllByRole("listitem");
    expect(rows).toHaveLength(8);
    expect(rows[0]).toHaveClass("mp-frow--us");
    expect(rows[1]).toHaveClass("mp-frow--them");
    expect(within(rows[1]).getByText(/Orduña/)).toBeInTheDocument();
    expect(rows[2].querySelector(".mp-frow__min")).toHaveClass("is-gold");
    expect(screen.getByText("3 jugadas más")).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "Ver todo el partido" }));
    const all = screen.getByRole("region", { name: "Todo el partido" });
    expect(within(all).getAllByRole("listitem")).toHaveLength(11);
    fireEvent.click(within(all).getByRole("button", { name: "Goles" }));
    expect(within(all).getAllByRole("listitem")).toHaveLength(2);
  });
});

describe("Campo: the seven on the pitch now", () => {
  it("the change walks in with its mark; the captain wears the armband", () => {
    const live = { ...match, events: [...match.events!, ev("s1", "substitution", 20, { playerId: "illescas", inPlayerId: "erik" })] };
    render(<Campo match={live} players={[]} nameOf={nameOf} live started />);
    const seven = screen.getByRole("list", { name: "Los siete" });
    expect(within(seven).getByText("ERIK")).toBeInTheDocument();
    expect(within(seven).queryByText("ILLESCAS")).toBeNull();
    expect(screen.getByRole("img", { name: "Entró en el 20" })).toBeInTheDocument();
    expect(screen.getByText(", capitán")).toBeInTheDocument();
    expect(screen.getByText("Con Erik")).toBeInTheDocument();
  });
});
