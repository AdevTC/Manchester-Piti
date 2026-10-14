import { render, screen, within } from "@testing-library/react";
import type { ReactNode } from "react";
import { beforeEach, expect, it, vi } from "vitest";
import type { ClubMatch } from "../../lib/clubData";

// The vestuario's porra and MVP blocks lead to the match page's Vestuario tab (?tab=vestuario).
vi.mock("@tanstack/react-router", () => ({
  Link: ({ children, to, params, search, className }: { children?: ReactNode; to: string; params?: { matchId?: string; playerId?: string }; search?: { tab?: string; season?: string }; className?: string }) => (
    <a className={className} href={to.replace("$matchId", params?.matchId ?? "").replace("$playerId", params?.playerId ?? "") + (search?.tab ? `?tab=${search.tab}` : search?.season ? `?season=${search.season}` : "")}>{children}</a>
  ),
}));
// the MVP tally's sync state (useMvpResultsSync) and my own vote
const live = vi.hoisted(() => ({ confirmed: true, stale: false, myVote: undefined as string | undefined }));
vi.mock("./live", () => ({
  useMvpResultsSync: () => ({ confirmed: live.confirmed, stale: live.stale }),
  useMvpReveal: (closed: boolean) => closed && live.confirmed,
  useMvpVoters: () => ({ data: [] }),
  useMyMvpVote: () => ({ data: live.myVote }),
  useMyPrediction: () => ({ data: undefined }),
  useTrainingVotes: () => ({ data: [] }),
}));
vi.mock("./writes", () => ({ useMe: () => null, deleteBoardMessage: vi.fn(), postBoardMessage: vi.fn(), predictScore: vi.fn(), voteMvp: vi.fn(), voteTraining: vi.fn() }));
const SQUAD = ["erik", "pablo", "raul", "adri"].map((id) => ({ id, shirtName: id.toUpperCase() }));
vi.mock("../../lib/clubData", async (orig) => ({ ...(await orig<typeof import("../../lib/clubData")>()), useClubData: () => ({ matches: [], players: SQUAD, loading: false, error: null }) }));

const { MvpBlock, Porra } = await import("./TeamBlocks");

const NOW = Date.UTC(2026, 8, 1);
const match = (extra: Partial<ClubMatch>): ClubMatch => ({ id: "j8", seasonId: "t1", rival: "Rival", date: NOW, duration: 50, status: "finished", goalsFor: 2, goalsAgainst: 1, events: [], ...extra });
const name = (id: string) => id.toUpperCase();
const OPEN = match({ voteClosesAt: NOW + 12 * 3_600_000 + 20 * 60_000 });
const CLOSED = match({ voteClosesAt: NOW - 1 });

beforeEach(() => {
  live.confirmed = true;
  live.stale = false;
  live.myVote = undefined;
});

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

it("while the vote is open: the race of the top 3 with their votes and when it closes", () => {
  live.myVote = "pablo";
  const { container } = render(<MvpBlock match={OPEN} result={{ id: "j8", counts: { erik: 4, pablo: 2, raul: 1, adri: 0 }, total: 7 }} uid="u1" admin={false} member now={NOW} playerName={name} />);
  expect(screen.getByRole("heading", { name: "La carrera del MVP" })).toBeInTheDocument();
  expect(screen.getByText(/Cierra en 12 h/)).toBeInTheDocument();
  const race = screen.getByRole("list", { name: "La carrera del MVP" });
  const rows = within(race).getAllByRole("listitem");
  expect(rows.map((r) => r.textContent)).toEqual(["1.ºERIK4 votos", "2.ºPABLO · tu voto2 votos", "3.ºRAUL1 voto"]);
  // names lead to each player's page, in the match's season
  expect(within(rows[0]).getByRole("link", { name: "ERIK" })).toHaveAttribute("href", "/jugadores/erik?season=t1");
  // no podium (nor a winner) while it runs
  expect(container.querySelector(".vx-podium")).toBeNull();
  expect(screen.getByText("ERIK va primero en la carrera del MVP.")).toHaveAttribute("aria-live", "polite");
});

it("a tie shares its place, also for screen readers", () => {
  render(<MvpBlock match={OPEN} result={{ id: "j8", counts: { erik: 3, pablo: 3, raul: 1 }, total: 7 }} uid="u1" admin={false} member now={NOW} playerName={name} />);
  const rows = within(screen.getByRole("list", { name: "La carrera del MVP" })).getAllByRole("listitem");
  expect(rows.map((r) => r.textContent)).toEqual(["1.ºempatado, ERIK3 votos", "1.ºempatado, PABLO3 votos", "3.ºRAUL1 voto"]);
  expect(screen.getByText("ERIK y PABLO van empatados en cabeza en la carrera del MVP.")).toBeInTheDocument();
});

it("once closed: the podium with its winner, revealed only once the server confirmed the tally", () => {
  const result = { id: "j8", counts: { erik: 4, pablo: 2, raul: 1 }, total: 7 };
  const { container, rerender } = render(<MvpBlock match={CLOSED} result={result} uid="u1" admin={false} member now={NOW} playerName={name} />);
  expect(screen.getByRole("heading", { name: "El MVP" })).toBeInTheDocument();
  expect(screen.getByText(/votación cerrada/)).toBeInTheDocument();
  expect(screen.queryByRole("list", { name: "La carrera del MVP" })).toBeNull();
  const podium = container.querySelector(".vx-podium") as HTMLElement;
  expect(podium).toHaveClass("reveal");
  expect([...podium.querySelectorAll(".vx-pod .nm")].map((n) => n.textContent)).toEqual(["PABLO", "ERIK", "RAUL"]);
  expect(podium.querySelector(".vx-pod.first .nm")?.textContent).toBe("ERIK");
  expect(screen.getByText("MVP: ERIK.")).toHaveAttribute("aria-live", "polite");
  expect(screen.queryByRole("radio")).toBeNull();

  // a tally from the cache never celebrates
  live.confirmed = false;
  rerender(<MvpBlock match={{ ...CLOSED, id: "j9" }} result={{ ...result, id: "j9" }} uid="u1" admin={false} member now={NOW} playerName={name} />);
  expect(container.querySelector(".vx-podium")).not.toHaveClass("reveal");
});

it("a closed tie is a shared MVP: both on the top step", () => {
  const { container } = render(<MvpBlock match={CLOSED} result={{ id: "j8", counts: { erik: 3, pablo: 3 }, total: 6 }} uid="u1" admin={false} member now={NOW} playerName={name} />);
  expect(screen.getByRole("heading", { name: "MVP compartido" })).toBeInTheDocument();
  expect([...container.querySelectorAll(".vx-pod.first .nm")].map((n) => n.textContent).sort()).toEqual(["ERIK", "PABLO"]);
  expect(container.querySelectorAll(".vx-pod .vt")[0].textContent).toContain("empate");
  expect(screen.getByText("MVP compartido: ERIK y PABLO.")).toBeInTheDocument();
});

it("offline: the race says it may be missing votes", () => {
  live.stale = true;
  render(<MvpBlock match={OPEN} result={{ id: "j8", counts: { erik: 1 }, total: 1 }} uid="u1" admin={false} member now={NOW} playerName={name} />);
  expect(screen.getByText("Sin conexión: puede faltar algún voto en el recuento.")).toBeInTheDocument();
});
