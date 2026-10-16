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

it.each([[10, 8, 8, 7], [10, 10, 8, 7], [10, 8, 7, 7, 7]])("el podio respeta los puestos compartidos y no recorta un empate: %j", (...goals: number[]) => {
  const scorers = goals.map((goals, i) => ({id:`p${i+1}`, name:`Jugador ${i+1}`, num:String(i+1), stats:{goals,assists:0}})) as PlayerLine[];
  render(<RaceAndBirthdays scorers={scorers} birthdays={[]} />);
  const expected = goals.map(n => goals.filter(v => v > n).length + 1).filter(n => n <= 3);
  const shown = [...document.querySelectorAll('.hm-pod:not(.ghost) .st')];
  expect(shown.map(el => Number(el.childNodes[0].textContent)).sort()).toEqual(expected.sort());
  for (const el of shown) {
    const rank = Number(el.childNodes[0].textContent);
    expect(el.closest('.hm-pod')).toHaveClass(rank === 1 ? 'gold' : rank === 2 ? 'silver' : 'bronze');
  }
  if (goals[0] === goals[1]) expect(screen.getByRole('heading', {name:/Pichichi compartido/})).toBeInTheDocument();
});

it("sin goles no concede medallas y los asistentes empatados aparecen todos", () => {
  const assisters = ["PEPE", "LUIS"].map((name,i) => ({id:`p${i+1}`,name,num:String(i+1),stats:{goals:0,assists:2}})) as PlayerLine[];
  render(<RaceAndBirthdays scorers={assisters} assisters={assisters} birthdays={[]} />);
  expect(document.querySelectorAll('.hm-pod.gold,.hm-pod.silver,.hm-pod.bronze')).toHaveLength(0);
  expect(document.querySelector('.hm-lede')).toHaveTextContent('PEPE y LUIS comparten el liderato: 2 asistencias cada uno.');
});

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
      assisters={[line("p3", "ANA", 0, 4)]}
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

it("the last match's goals name a guest «Rafa (invitado)», never «Jugador»", () => {
  const withGuest: ClubMatch = {
    ...played,
    guests: [{ id: "g1", name: "Rafa" }],
    events: [
      { id: "a", type: "goal", minute: 10, playerId: "guest:g1", assistPlayerId: "p1" },
      { id: "b", type: "goal", minute: 20, playerId: "p2", assistPlayerId: "guest:g1" },
    ],
  };
  render(<SeasonRow pulse={seasonPulse([withGuest, next], "t1", NOW)} now={NOW} nameOf={(id) => (id.startsWith("guest:") ? "Jugador" : id.toUpperCase())} />);
  expect(document.body).toHaveTextContent("10′Rafa (invitado) · asistencia de P1");
  expect(document.body).toHaveTextContent("asistencia de Rafa (invitado)");
  expect(document.body).not.toHaveTextContent("Jugador");
});
