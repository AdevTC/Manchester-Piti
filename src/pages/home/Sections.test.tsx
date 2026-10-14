import { render, screen, within } from "@testing-library/react";
import type { ReactNode } from "react";
import { expect, it, vi } from "vitest";
import { RaceAndBirthdays, SeasonRow } from "./Sections";
import { seasonPulse, type PlayerLine } from "../../lib/home";
import { readyClock } from "../../../functions/src/matchClock";
import type { ClubMatch } from "../../lib/clubData";

vi.mock("@tanstack/react-router", () => ({
  Link: ({ children, className, to, params, search }: { children?: ReactNode; className?: string; to?: string; params?: Record<string, string>; search?: { season?: string } }) => (
    <a className={className} href={to === "/jugadores/$playerId" ? `/jugadores/${params?.playerId}${search?.season ? `?season=${search.season}` : ""}` : undefined}>
      {children}
    </a>
  ),
}));
const squad = vi.hoisted(() => ["p1", "p2", "p3"].map((id) => ({ id, seasons: ["t1"] })));
vi.mock("../../lib/clubData", async (orig) => ({ ...(await orig<typeof import("../../lib/clubData")>()), useClubData: () => ({ matches: [], players: squad, loading: false, error: null }) }));

const DAY = 86_400_000;
const NOW = Date.UTC(2026, 10, 12, 12);
const played: ClubMatch = { id: "m1", seasonId: "t1", rival: "LOS ROJOS", status: "finished", date: NOW - 9 * DAY, goalsFor: 2, goalsAgainst: 1 };
const acta: ClubMatch = { id: "m2", seasonId: "t1", version: 2, status: "scheduled", rival: "MAD SKY", date: NOW - 3 * DAY, duration: 50, clock: readyClock() };
const next: ClubMatch = { id: "m3", seasonId: "t1", status: "scheduled", rival: "EL NUEVO", date: NOW + 4 * DAY };
const row = (ms: ClubMatch[]) => <SeasonRow pulse={seasonPulse(ms, "t1", NOW)} now={NOW} nameOf={(id) => id} />;

it("a played match waiting for its acta is not in «Lo que viene»: it takes the last match's place, «Pendiente del acta»", () => {
  render(row([played, acta, next]));
  const comes = screen.getByRole("heading", { name: "Lo que viene" }).parentElement!;
  expect(within(comes).queryByText("vs MAD SKY")).toBeNull();
  expect(within(comes).getByText("vs EL NUEVO")).toBeInTheDocument();
  expect(screen.getByRole("heading", { level: 2, name: "Pendiente del acta ante MAD SKY" })).toBeInTheDocument();
  expect(screen.queryByText("LOS ROJOS")).toBeNull();
});

it("without one waiting, the last result as before", () => {
  render(row([played, next]));
  expect(screen.getByRole("heading", { level: 2, name: "Victoria" })).toBeInTheDocument();
  expect(screen.getByText("LOS ROJOS")).toBeInTheDocument();
});

it("the plantilla's podium, the top assister and the birthdays lead to each player's page, in the season", () => {
  const line = (id: string, name: string, goals: number, assists = 0) => ({ id, name, num: id.slice(1), stats: { goals, assists } }) as unknown as PlayerLine;
  render(
    <RaceAndBirthdays
      seasonId="t1"
      scorers={[line("p1", "PEPE", 5), line("p2", "LUIS", 3)]}
      assister={line("p3", "ANA", 0, 4)}
      birthdays={[{ id: "p2", name: "LUIS", num: "2", label: "3 de mayo", days: 4 }, { id: "fuera", name: "EX JUGADOR", num: "9", label: "9 de mayo", days: 10 }]}
    />,
  );
  const podium = document.querySelector(".hm-race") as HTMLElement;
  expect(within(podium).getByRole("link", { name: "PEPE" })).toHaveAttribute("href", "/jugadores/p1?season=t1");
  expect(within(podium).getByRole("link", { name: "LUIS" })).toHaveAttribute("href", "/jugadores/p2?season=t1");
  expect(within(podium).getByText("Por decidir").closest("a")).toBeNull();
  expect(screen.getByRole("link", { name: "ANA" })).toHaveAttribute("href", "/jugadores/p3?season=t1");
  expect(document.querySelector(".hm-lede")).toHaveTextContent("ANA es quien más goles regala: 4 asistencias.");
  const bdays = document.querySelector(".hm-bdays") as HTMLElement;
  expect(within(bdays).getByRole("link", { name: "LUIS" })).toHaveAttribute("href", "/jugadores/p2?season=t1");
  // (someone no longer in the squad: his name, not a link)
  expect(within(bdays).getByText("EX JUGADOR").closest("a")).toBeNull();
});
