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
  expect(screen.getByText("Por confirmar")).toBeInTheDocument();
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
