import { fireEvent, render, screen, within } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { Ahora } from "./Ahora";
import type { Standings, StandingRow } from "../../lib/standings";
import type { SeasonLeaders } from "../../lib/derived/vidrio/leaders";

const row = (team: string, pts: number, isUs = false): StandingRow => ({ team, pj: 16, g: Math.floor(pts / 3), e: pts % 3, p: 0, gf: pts, gc: 10, pts, isUs });
const TEAMS = ["Moratalaz", "Rayito", "Manchester Piti", "Pitutis", "Red Demons", "Fontarrón", "Entrepibas", "Portazgo", "Brugal", "Squirtles", "Vicálvaro", "Orduña fc", "Pan Bendito", "Palomeras"];
const standings: Standings = { id: "t1", competition: "Liga", jornada: 16, updatedAt: 1, rows: TEAMS.map((t, i) => row(t, 40 - i * 2, t === "Manchester Piti")) } as Standings;
const leaders: SeasonLeaders = {
  goals: [{ id: "a", name: "Alcides", num: "7", value: 3, provisional: 1, rank: 1, shared: false }],
  assists: [],
  topScorers: [],
  topAssisters: [],
  goalsLine: "",
  assistsLine: "",
  goalsHint: "",
  live: true,
};

describe("Ahora (Números, the season now)", () => {
  it("live: our row and the rival's say «Si acaba así», tonight's scorer «En directo», the table grows whole", () => {
    render(<Ahora standings={standings} live={{ rival: "Orduña fc", gf: 2, ga: 1 }} leaders={leaders} form={[{ l: "G", tone: "prov", label: "J17: ganando, si acaba así" }]} />);
    const table = screen.getByRole("table", { name: "Clasificación, si acaba así" });
    const us = within(table).getByRole("row", { current: true });
    expect(us).toHaveTextContent("Manchester PitiSi acaba así");
    expect(within(table).getAllByText(/equipos? más (arriba|abajo)/).length).toBeGreaterThan(0);
    expect(screen.getByText("En directo")).toBeInTheDocument();
    expect(screen.getByRole("img", { name: "J17: ganando, si acaba así" })).toHaveTextContent("G");
    fireEvent.click(screen.getByRole("button", { name: "Ver la tabla entera (14)" }));
    const whole = screen.getByRole("region", { name: "La clasificación entera" });
    expect(within(whole).getAllByRole("row")).toHaveLength(15);
    expect(within(whole).getByText("Orduña fc").closest("tr")).toHaveTextContent("Si acaba así");
  });

  it("without a live score nothing is provisional; without a table, a line", () => {
    const { rerender } = render(<Ahora standings={standings} live={null} leaders={{ ...leaders, live: false }} form={[]} />);
    expect(screen.queryByText("Si acaba así")).toBeNull();
    expect(screen.queryByText("En directo")).toBeNull();
    rerender(<Ahora standings={null} live={null} leaders={{ ...leaders, goals: [], live: false }} form={[]} />);
    expect(screen.getByText(/La clasificación sale aquí/)).toBeInTheDocument();
    expect(screen.getByText(/Nadie ha marcado todavía/)).toBeInTheDocument();
  });
});
