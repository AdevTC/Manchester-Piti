import { render, screen, within } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import type { ClubMatch } from "../../lib/clubData";
import type { PositionSet } from "../../lib/positions";
import { SusPosiciones } from "./SusPosiciones";

// /jugadores/:id › «Sus posiciones»: the history map + the per-position table, for the period the page shows.

type Row = NonNullable<ClubMatch["ledger"]>[string];
const row = (minutes: number, extra: Partial<Row> = {}): Row => ({ minutes, started: true, benched: false, notCalled: false, played: minutes > 0, subIn: 0, subOut: 0, dismissed: false, stints: [], exchanges: [], goals: 0, assists: 0, yellowCards: 0, redCards: 0, doubleYellows: 0, penaltyCommitted: 0, penaltyReceived: 0, penaltySaved: 0, penaltyMissed: 0, goalPenalty: 0, goalFreekick: 0, ownGoals: 0, woodwork: 0, ...extra });
const match = (n: number, ledger: ClubMatch["ledger"], seasonId = "t1"): ClubMatch => ({ id: "j" + n, seasonId, rival: "Rival " + n, date: Date.UTC(2026, 8, n), duration: 50, status: "finished", goalsFor: 2, goalsAgainst: 0, events: [], ledger });
const ev = (goals = 0, assists = 0) => ({ goals, assists, yellowCards: 0, redCards: 0 });
const set: PositionSet = { main: "MCD", also: ["MC"] };

const t1 = [
  match(1, { erik: row(50, { goals: 1, positionsPlayed: { MCD: 50 }, positionEvents: { MCD: ev(1) } }) }),
  match(2, { erik: row(50, { positionsPlayed: { MCD: 30, MC: 20 }, positionsEstimated: true }) }),
  match(3, { erik: row(50, { assists: 1, positionsPlayed: { MCD: 40, DFC: 10 }, positionEvents: { DFC: ev(0, 1) } }) }),
];
const t2 = [match(9, { erik: row(50, { positionsPlayed: { DC: 50 } }) }, "t2")];

const show = (games: ClubMatch[], periodName = "Temporada 1") =>
  render(<SusPosiciones playerId="erik" name="ERIK" positions={set} games={games} periodName={periodName} mvpOf={(id) => (id === "j1" ? "erik" : null)} />);

describe("SusPosiciones", () => {
  it("is an st-card section titled «Sus posiciones», for the period shown", () => {
    show(t1);
    const sec = screen.getByRole("region", { name: "Sus posiciones" });
    expect(sec).toHaveClass("st-card");
    expect(within(sec).getByText(/Temporada 1 · minutos por posición exacta/)).toBeInTheDocument();
  });

  it("draws the history map with his positions, the minutes and «estimado»", () => {
    show(t1);
    expect(screen.getByRole("img", { name: /^Dónde ha jugado ERIK · Temporada 1\. Ha jugado de Pivote \(MCD\), 120 minutos; Mediocentro \(MC\), 20 minutos; Central \(DFC\), 10 minutos\. Preferida: Pivote \(MCD\)\./ })).toBeInTheDocument();
    expect(screen.getByText("Algunos minutos estimados por su posición preferida")).toBeInTheDocument();
  });

  it("leads with his most-played position, then a row per position with Valoración («—» when null)", () => {
    show(t1);
    expect(screen.getByText(/^Más minutos de/)).toHaveTextContent("Más minutos de Pivote (MCD): 120′ en 3 partidos");
    const table = screen.getByRole("table", { name: "Sus posiciones · Temporada 1" });
    expect(within(table).getAllByRole("columnheader").map((h) => h.textContent)).toEqual(["Posición", "Minutos", "PJ", "G", "A", "Valoración"]);
    const rows = within(table).getAllByRole("row").slice(1);
    expect(rows.map((r) => within(r).getByRole("rowheader").textContent)).toEqual(["Pivote (MCD)", "Mediocentro (MC)", "Central (DFC)"]);
    const cells = (i: number) => within(rows[i]).getAllByRole("cell").map((c) => c.textContent);
    expect(cells(0).slice(0, 4)).toEqual(["120′", "3", "1", "0"]);
    expect(Number(cells(0)[4])).toBeGreaterThanOrEqual(45); // 3 matches as his main position: a rating
    expect(cells(1)).toEqual(["20′", "1", "0", "0", "—"]);
    expect(cells(2)).toEqual(["10′", "1", "0", "1", "—"]);
  });

  it("singular «partido» when he played there once", () => {
    show(t2, "Temporada 2");
    expect(screen.getByText(/^Más minutos de/)).toHaveTextContent("Más minutos de Punta (DC): 50′ en 1 partido");
  });

  it("follows the games it is given (the page's season selector)", () => {
    const { rerender } = show(t1);
    expect(screen.getByRole("table")).not.toHaveTextContent("Punta");
    rerender(<SusPosiciones playerId="erik" name="ERIK" positions={set} games={[...t1, ...t2]} periodName="Todo el historial" />);
    expect(screen.getByRole("table", { name: "Sus posiciones · Todo el historial" })).toHaveTextContent("Punta (DC)50′");
  });

  it("without minutes by position: the explicit empty copy, no table, no «0′»", () => {
    show([match(1, { erik: row(50, { goals: 1 }) })]);
    expect(screen.getByText("Aún sin minutos con posición")).toBeInTheDocument();
    expect(screen.queryByRole("table")).toBeNull();
    expect(screen.queryByText(/^Más minutos de/)).toBeNull();
    expect(screen.queryByText(/0′/)).toBeNull();
    expect(screen.getByText(/la pizarra oficial del partido/)).toBeInTheDocument();
  });
});
