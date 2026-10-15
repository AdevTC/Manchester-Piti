import { render, screen, within } from "@testing-library/react";
import type { ReactNode } from "react";
import { beforeEach, expect, it, vi } from "vitest";
import type { ClubMatch } from "../../lib/clubData";
import type { MvpResult } from "../../lib/vestuario";

// The match page's Vestuario tab, MVP block: the live race (top 3, votes, «Cierra en 12 h») while the
// vote is open, the winner once it closes; fans get one line. Only counts are ever shown.
const NOW = Date.UTC(2026, 8, 10, 12);
const state = vi.hoisted(() => ({ member: true, confirmed: true, stale: false, result: undefined as MvpResult | undefined, now: 0, boundaries: [] as unknown[] }));
vi.mock("@tanstack/react-router", () => ({
  Link: ({ children, to, params, search, className }: { children?: ReactNode; to: string; params?: Record<string, string>; search?: { season?: string }; className?: string }) => (
    <a className={className} href={to.replace("$playerId", params?.playerId ?? "").replace("$matchId", params?.matchId ?? "") + (search?.season ? `?season=${search.season}` : "")}>{children}</a>
  ),
}));
vi.mock("../../context/SeasonContext", () => ({ useSeason: () => ({ seasons: [] }) }));
vi.mock("../../context/TeamContext", () => ({ useTeam: () => ({ member: state.member }) }));
vi.mock("../../context/AuthContext", () => ({ useAuth: () => ({ user: { uid: "u1" } }) }));
// the server's clock: the test moves it, and sees the boundaries the tab asks it to tick at
vi.mock("../../hooks/useClock", () => ({
  useClock: (_step: number, boundaries: unknown[] = []) => {
    state.boundaries = boundaries;
    return state.now;
  },
}));
vi.mock("../../hooks/useDocumentTheme", () => ({ useDocumentTheme: () => "dark" }));
vi.mock("../../components/jersey3d/useShirtStills", () => ({ useShirtStills: () => () => undefined }));
vi.mock("../../components/jersey3d/Jersey3D", () => ({ Jersey3D: () => null }));
vi.mock("../vestuario/live", () => ({
  useAvailability: () => ({ data: [] }),
  useMatchPredictions: () => ({ data: [] }),
  useMeetingNote: () => ({ data: "" }),
  useMvpResults: () => new Map(state.result ? [[state.result.id, state.result]] : []),
  useMvpResultsSync: () => ({ confirmed: state.confirmed, stale: state.stale }),
  useMvpReveal: (o: { open: boolean; winner: boolean }) => !o.open && o.winner && state.confirmed,
  useMyMvpVote: () => ({ data: "" }),
  useMyPrediction: () => ({ data: null }),
  useAbsences: () => ({ data: [] }),
}));
vi.mock("../vestuario/writes", () => ({ useMe: () => (state.member ? { uid: "u1", displayName: "YO", shirtName: "YO", number: "" } : null), predictScore: vi.fn(), setAvailability: vi.fn(), voteMvp: vi.fn() }));
const SQUAD = ["erik", "pablo", "raul", "adri"].map((id) => ({ id, shirtName: id.toUpperCase(), seasons: ["t1"], seasonDetails: { t1: { shirtName: `${id.toUpperCase()}7` } } }));
vi.mock("../../lib/clubData", async (orig) => ({ ...(await orig<typeof import("../../lib/clubData")>()), useClubData: () => ({ matches: [], players: SQUAD, loading: false, error: null }) }));

const { VestuarioTab } = await import("./Tabs");

const played = { minutes: 50, played: true };
const match = (voteClosesAt: number): ClubMatch =>
  ({ id: "j5", seasonId: "t1", rival: "Rival", date: NOW - 86_400_000, duration: 50, status: "finished", goalsFor: 2, goalsAgainst: 1, events: [], voteClosesAt, ledger: { erik: played, pablo: played, raul: played, adri: played } }) as unknown as ClubMatch;
const OPEN = match(NOW + 12 * 3_600_000 + 5 * 60_000);
const CLOSED = match(NOW - 60_000);
const show = (m: ClubMatch) => render(<VestuarioTab match={m} players={SQUAD} phase="finished" />);

beforeEach(() => {
  state.member = true;
  state.confirmed = true;
  state.stale = false;
  state.result = { id: "j5", counts: { erik: 4, pablo: 2, raul: 1, adri: 0 }, total: 7 };
  state.now = NOW;
});

it("open: «La carrera del MVP» with the top 3, their votes and the countdown on the server's clock", () => {
  const { container } = show(OPEN);
  expect(screen.getByText("La carrera del MVP · Cierra en 12 h")).toBeInTheDocument();
  expect(screen.getByRole("heading", { name: "ERIK7" })).toBeInTheDocument();
  const rows = within(screen.getByRole("list", { name: "La carrera del MVP" })).getAllByRole("listitem");
  expect(rows.map((r) => r.textContent)).toEqual(["1.º ERIK74 votos", "2.º PABLO72 votos", "3.º RAUL71 voto"]);
  // the names: the match's season, a link to each player's page
  expect(within(rows[1]).getByRole("link", { name: "PABLO7" })).toHaveAttribute("href", "/jugadores/pablo?season=t1");
  // still voting (every player who played), and no winner yet
  expect(screen.getByRole("group", { name: "Tu voto" })).toBeInTheDocument();
  expect(container.querySelector(".fc-mvp")).not.toHaveClass("won");
  expect(screen.getByText("ERIK7 va primero en la carrera del MVP.")).toHaveAttribute("aria-live", "polite");
});

it("closed: the winner reveal (only once the server confirmed it) and the podium, no more voting", () => {
  const { container, unmount } = show(CLOSED);
  expect(screen.getByText("MVP · votación cerrada")).toBeInTheDocument();
  expect(screen.getByRole("heading", { name: "ERIK7" })).toBeInTheDocument();
  expect(screen.getByText("4 de 7 votos.")).toBeInTheDocument();
  expect(screen.getByRole("list", { name: "El podio del MVP" })).toBeInTheDocument();
  expect(screen.queryByRole("group", { name: "Tu voto" })).toBeNull();
  expect(container.querySelector(".fc-mvp")).toHaveClass("won");
  unmount();

  state.confirmed = false;
  const again = show(CLOSED);
  expect(again.container.querySelector(".fc-mvp")).not.toHaveClass("won");
});

it("a closed tie is shared", () => {
  state.result = { id: "j5", counts: { erik: 3, pablo: 3 }, total: 6 };
  show(CLOSED);
  expect(screen.getByText("MVP compartido · votación cerrada")).toBeInTheDocument();
  expect(screen.getByRole("heading", { name: "ERIK7 y PABLO7" })).toBeInTheDocument();
  expect(screen.getByText("3 de 6 votos · lo comparten.")).toBeInTheDocument();
});

it("fans get one line: who leads while open, who won once closed", () => {
  state.member = false;
  const open = show(OPEN);
  expect(open.container.querySelector(".fc-note")?.textContent).toBe("La carrera del MVP: ERIK7 va primero con 4 votos. Cierra en 12 h.");
  open.unmount();
  state.result = { id: "j5", counts: { erik: 3, pablo: 3, raul: 1 }, total: 7 };
  const closed = show(CLOSED);
  expect(closed.container.querySelector(".fc-note")?.textContent).toBe("MVP compartido: ERIK7 y PABLO7 con 3 de 7 votos.");
});

it("offline, the race warns it may be missing votes; fans get no line from an out-of-date tally", () => {
  state.stale = true;
  const { unmount } = show(OPEN);
  expect(screen.getByText("Sin conexión: puede faltar algún voto en el recuento.")).toBeInTheDocument();
  unmount();
  state.member = false;
  const fan = show(CLOSED);
  expect(fan.container.querySelector(".fc-note")).toBeNull();
});

it("fans read «voto» for a single vote", () => {
  state.member = false;
  state.result = { id: "j5", counts: { erik: 1 }, total: 1 };
  const { container } = show(CLOSED);
  expect(container.querySelector(".fc-note")?.textContent).toBe("MVP: ERIK7 con 1 de 1 voto.");
});

it("the clock ticks at the close: the race turns into the winner right then", () => {
  const { container, rerender } = show(OPEN);
  expect(state.boundaries).toEqual([OPEN.voteClosesAt]);
  expect(screen.getByText("La carrera del MVP · Cierra en 12 h")).toBeInTheDocument();
  state.now = OPEN.voteClosesAt! - 60_000;
  rerender(<VestuarioTab match={OPEN} players={SQUAD} phase="finished" />);
  expect(screen.getByText("La carrera del MVP · Cierra en 1 min")).toBeInTheDocument();
  state.now = OPEN.voteClosesAt!; // the boundary tick
  rerender(<VestuarioTab match={OPEN} players={SQUAD} phase="finished" />);
  expect(screen.getByText("MVP · votación cerrada")).toBeInTheDocument();
  expect(screen.queryByRole("list", { name: "La carrera del MVP" })).toBeNull();
  expect(screen.getByRole("list", { name: "El podio del MVP" })).toBeInTheDocument();
  expect(container.querySelector(".fc-mvp")).toHaveClass("won");
  expect(screen.getByText("MVP: ERIK7.")).toHaveAttribute("aria-live", "polite");
});
