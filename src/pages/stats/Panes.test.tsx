import { cleanup, render, screen } from "@testing-library/react";
import type { ReactNode } from "react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { analysePlayer } from "../../lib/clubAnalytics";
import { playerName, type ClubMatch } from "../../lib/clubData";
import { Comparar, Jugadores } from "./Panes";

// /stats › Jugadores and Comparar print the minutes as every other page does: whole, with «′»
// (derived/minutes) — the ledgers keep two decimals from secondsPlayed.

vi.mock("@tanstack/react-router", () => ({
  Link: ({ children, className }: { children?: ReactNode; className?: string }) => <a className={className}>{children}</a>,
}));
afterEach(cleanup);

type Row = NonNullable<ClubMatch["ledger"]>[string];
const row = (seconds: number): Row => ({ minutes: Math.round((seconds / 60) * 100) / 100, secondsPlayed: seconds, started: true, benched: false, notCalled: false, played: true, subIn: 0, subOut: 0, dismissed: false, stints: [], exchanges: [], goals: 0, assists: 0, yellowCards: 0, redCards: 0, doubleYellows: 0, penaltyCommitted: 0, penaltyReceived: 0, penaltySaved: 0, penaltyMissed: 0, goalPenalty: 0, goalFreekick: 0, ownGoals: 0, woodwork: 0 });
const games: ClubMatch[] = [{ id: "j1", seasonId: "t1", rival: "R", date: Date.UTC(2026, 8, 6), duration: 50, status: "finished", goalsFor: 1, goalsAgainst: 0, events: [], ledger: { erik: row(2080), pablo: row(1801) } }];
const players = [
  { id: "erik", shirtName: "ERIK" },
  { id: "pablo", shirtName: "PABLO" },
];
const rows = players.map((p) => analysePlayer(p, games));

describe("minutes in the stats tables", () => {
  it("the fixture really carries decimals (34.67 and 30.02 minutes)", () => {
    expect(rows.map((r) => r.minutes)).toEqual([34.67, 30.02]);
  });
  it("Jugadores: «35′» and «30′», never «34.67»", () => {
    const { container } = render(<Jugadores rows={rows} nameOf={(p) => playerName(p)} />);
    expect(screen.getAllByText("35′").length).toBeGreaterThan(0);
    expect(screen.getAllByText("30′").length).toBeGreaterThan(0);
    expect(container.textContent).not.toMatch(/\d\.\d/);
  });
  it("Comparar: both cells whole", () => {
    const { container } = render(<Comparar rows={rows} nameOf={(p) => playerName(p)} games={1} />);
    const minutes = [...container.querySelectorAll(".st-cmp li")].find((li) => li.textContent?.includes("Minutos"))!;
    expect([...minutes.querySelectorAll("b")].map((b) => b.textContent)).toEqual(["35′", "30′"]);
    expect(container.textContent).not.toMatch(/34\.67|30\.02/);
  });
});
