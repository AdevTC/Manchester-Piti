import { render, screen, within } from "@testing-library/react";
import type { ReactNode } from "react";
import { expect, it, vi } from "vitest";
import { RaceAndBirthdays } from "./Sections";
import type { PlayerLine } from "../../lib/home";

vi.mock("@tanstack/react-router", () => ({
  Link: ({ children, className, to, params, search }: { children?: ReactNode; className?: string; to?: string; params?: Record<string, string>; search?: { season?: string } }) => (
    <a className={className} href={to === "/jugadores/$playerId" ? `/jugadores/${params?.playerId}${search?.season ? `?season=${search.season}` : ""}` : undefined}>
      {children}
    </a>
  ),
}));
const squad = vi.hoisted(() => ["p1", "p2", "p3"].map((id) => ({ id, seasons: ["t1"] })));
vi.mock("../../lib/clubData", async (orig) => ({ ...(await orig<typeof import("../../lib/clubData")>()), useClubData: () => ({ matches: [], players: squad, loading: false, error: null }) }));


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
