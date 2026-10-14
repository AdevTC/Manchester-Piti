import { render, screen } from "@testing-library/react";
import type { ReactNode } from "react";
import { expect, it, vi } from "vitest";
import type { ClubMatch } from "../../lib/clubData";

// The vestuario's porra and MVP blocks lead to the match page's Vestuario tab (?tab=vestuario).
vi.mock("@tanstack/react-router", () => ({
  Link: ({ children, to, params, search }: { children?: ReactNode; to: string; params?: { matchId?: string }; search?: { tab?: string } }) => (
    <a href={to.replace("$matchId", params?.matchId ?? "") + (search?.tab ? `?tab=${search.tab}` : "")}>{children}</a>
  ),
}));
vi.mock("./live", () => ({
  useMvpVoters: () => ({ data: [] }),
  useMyMvpVote: () => ({ data: undefined }),
  useMyPrediction: () => ({ data: undefined }),
  useTrainingVotes: () => ({ data: [] }),
}));
vi.mock("./writes", () => ({ useMe: () => null, deleteBoardMessage: vi.fn(), postBoardMessage: vi.fn(), predictScore: vi.fn(), voteMvp: vi.fn(), voteTraining: vi.fn() }));

const { MvpBlock, Porra } = await import("./TeamBlocks");

const NOW = Date.UTC(2026, 8, 1);
const match = (extra: Partial<ClubMatch>): ClubMatch => ({ id: "j8", seasonId: "t1", rival: "Rival", date: NOW, duration: 50, status: "finished", goalsFor: 2, goalsAgainst: 1, events: [], ...extra });

it("the porra links to the next match's Vestuario tab", () => {
  render(<Porra next={match({ id: "j9", status: "scheduled", date: NOW + 86_400_000 })} uid="u1" rows={[]} now={NOW} />);
  expect(screen.getByRole("link", { name: "La porra, en la ficha del partido" })).toHaveAttribute("href", "/matches/j9?tab=vestuario");
});

it("the MVP links to its match's Vestuario tab", () => {
  render(<MvpBlock match={match({ voteClosesAt: NOW + 3_600_000 })} result={undefined} uid="u1" admin={false} member now={NOW} playerName={(id) => id} />);
  expect(screen.getByRole("link", { name: "El MVP, en la ficha del partido" })).toHaveAttribute("href", "/matches/j8?tab=vestuario");
});

it("no match, no link", () => {
  render(<MvpBlock match={undefined} result={undefined} uid="u1" admin={false} member now={NOW} playerName={(id) => id} />);
  expect(screen.queryByRole("link")).toBeNull();
});
