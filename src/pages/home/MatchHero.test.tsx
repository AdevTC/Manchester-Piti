import { render, screen } from "@testing-library/react";
import type { ReactNode } from "react";
import { expect, it, vi } from "vitest";
import { MatchHero } from "./MatchHero";
import { seasonPulse } from "../../lib/home";
import { readyClock, transitionClock } from "../../../functions/src/matchClock";
import type { ClubMatch } from "../../lib/clubData";

vi.mock("@tanstack/react-router", () => ({
  Link: ({ children, className, to, params }: { children?: ReactNode; className?: string; to?: string; params?: Record<string, string> }) => (
    <a className={className} href={(to ?? "#").replace(/\$(\w+)/g, (_, k: string) => params?.[k] ?? "")}>
      {children}
    </a>
  ),
}));

const MIN = 60_000;
const DATE = Date.UTC(2026, 10, 8, 11);
const match: ClubMatch = { id: "j8", seasonId: "t1", version: 2, status: "scheduled", rival: "MAD SKY", date: DATE, duration: 50, clock: readyClock() };
const story = { kick: "Temporada 1 · J8", head: "Domingo, 12:00: MAD SKY.", em: "" };
const hero = (m: ClubMatch, now: number) => <MatchHero story={story} pulse={seasonPulse([m], "t1", now)} now={now} moment={null} />;

it("the countdown runs until the date; then «Pendiente del pitido inicial», never a frozen 00:00", () => {
  const { rerender } = render(hero(match, DATE - 90 * MIN));
  expect(screen.getByRole("timer")).toHaveAccessibleName(/Faltan 0 días, 1 horas y 30 minutos/);
  expect(screen.queryByText("Pendiente del pitido inicial")).toBeNull();

  rerender(hero(match, DATE + 5 * MIN));
  expect(screen.queryByRole("timer")).toBeNull();
  expect(screen.getByText("Pendiente del pitido inicial")).toBeInTheDocument();
});

it("once the clock starts it is live (no pending text), and after the window it is no longer the next match", () => {
  const started = { ...match, clock: transitionClock(match.clock, "start", DATE + 20 * MIN) };
  const { rerender } = render(hero(started, DATE + 21 * MIN));
  expect(screen.queryByText("Pendiente del pitido inicial")).toBeNull();
  expect(screen.getByRole("status", { name: "Marcador: 0 a 0" })).toBeInTheDocument();

  rerender(hero(match, DATE + 50 * MIN + 2 * 60 * MIN));
  expect(screen.queryByText("Pendiente del pitido inicial")).toBeNull();
  expect(screen.getByRole("heading", { level: 1 })).toHaveTextContent("Pendiente del acta");
  expect(screen.queryByRole("timer")).toBeNull();
});

it("a recent victory never headlines the next match or its countdown", () => {
  const last: ClubMatch = { ...match, id: "last", status: "finished", date: DATE - MIN, rival: "Rival anterior", goalsFor: 2, goalsAgainst: 1 };
  const next = { ...match, date: DATE + 24 * 60 * MIN };
  render(<MatchHero story={{ kick: "J7", head: "¡Victoria! 2–1 ante Rival anterior.", em: "Último gol de Mario." }} pulse={seasonPulse([last, next], "t1", DATE)} now={DATE} moment={null} />);
  expect(screen.getByRole("heading", { level: 1 })).toHaveTextContent("Próximo partido");
  expect(screen.getByRole("timer")).toBeInTheDocument();
  expect(screen.getByText("MAD SKY")).toBeInTheDocument();
  expect(screen.queryByText(/Victoria|Rival anterior|Último gol/)).toBeNull();
});

it("a live match takes priority over both the next fixture and the last result", () => {
  const live = { ...match, clock: transitionClock(match.clock, "start", DATE) };
  const next = { ...match, id: "next", rival: "Próximo rival", date: DATE + 24 * 60 * MIN };
  render(<MatchHero story={story} pulse={seasonPulse([next, live], "t1", DATE + MIN)} now={DATE + MIN} moment={null} />);
  expect(screen.getByRole("heading", { level: 1 })).toHaveTextContent("Partido en directo");
  expect(screen.queryByRole("timer")).toBeNull();
  expect(screen.queryByText("Próximo rival")).toBeNull();
  expect(screen.getByRole("link", { name: /Seguir en directo/ })).toHaveAttribute("href", "/matches/j8");
});

it("without another fixture the confirmed score is clearly the last result, with no pretend countdown", () => {
  render(hero({ ...match, status: "finished", goalsFor: 2, goalsAgainst: 1 }, DATE + MIN));
  expect(screen.getByText("Último resultado")).toBeInTheDocument();
  expect(screen.getByRole("status", { name: "Resultado: 2 a 1" })).toBeInTheDocument();
  expect(screen.queryByRole("timer")).toBeNull();
  expect(screen.getByRole("link", { name: /Ver crónica y acta/ })).toHaveAttribute("href", "/matches/j8");
});

it("an empty season offers the calendar without inventing a fixture or score", () => {
  render(<MatchHero story={story} pulse={seasonPulse([], "t1", DATE)} now={DATE} moment={null} />);
  expect(screen.getByRole("heading", { level: 1 })).toHaveTextContent("Próximo partido por confirmar");
  expect(screen.queryByRole("timer")).toBeNull();
  expect(screen.queryByRole("status")).toBeNull();
  expect(screen.queryByText("vs")).toBeNull();
  expect(screen.getByRole("link", { name: "Ver el calendario" })).toHaveAttribute("href", "/partidos");
});

it("the next match, not live yet: «Ver la previa» → its page (no tab: it opens on the previa); live: only «Seguir en directo»", () => {
  const { rerender } = render(hero(match, DATE - 90 * MIN));
  expect(screen.getByRole("link", { name: /Ver la previa/ })).toHaveAttribute("href", "/matches/j8");
  // the date has come, nobody has started the clock: still the previa
  rerender(hero(match, DATE + 5 * MIN));
  expect(screen.getByRole("link", { name: /Ver la previa/ })).toHaveAttribute("href", "/matches/j8");
  const started = { ...match, clock: transitionClock(match.clock, "start", DATE + 20 * MIN) };
  rerender(hero(started, DATE + 21 * MIN));
  expect(screen.queryByRole("link", { name: /Ver la previa/ })).toBeNull();
  expect(screen.getByRole("link", { name: /Seguir en directo/ })).toHaveAttribute("href", "/matches/j8");
});
