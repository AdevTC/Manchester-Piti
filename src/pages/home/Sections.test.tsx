import { render, screen, within } from "@testing-library/react";
import type { ReactNode } from "react";
import { expect, it, vi } from "vitest";
import { SeasonRow } from "./Sections";
import { seasonPulse } from "../../lib/home";
import { readyClock } from "../../../functions/src/matchClock";
import type { ClubMatch } from "../../lib/clubData";

vi.mock("@tanstack/react-router", () => ({ Link: ({ children, className }: { children?: ReactNode; className?: string }) => <a className={className}>{children}</a> }));

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
