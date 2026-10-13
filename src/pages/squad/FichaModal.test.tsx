import { fireEvent, render, screen, within } from "@testing-library/react";
import type { ReactNode } from "react";
import { describe, expect, it, vi } from "vitest";
import type { ClubMatch } from "../../lib/clubData";
import type { PositionSet } from "../../lib/positions";
import { squadRow, type SquadPlayer } from "../../lib/squad";
import { FichaModal } from "./FichaModal";

// The public ficha (/plantilla): «Posición: Pivote» and, under it, «También mediocentro (MC) · central (DFC)». No WebGL: the 3D kit is a stub.

vi.mock("../../components/jersey3d/Jersey3D", () => ({ Jersey3D: () => null }));
vi.mock("@tanstack/react-router", () => ({ Link: ({ children }: { children?: ReactNode }) => <a>{children}</a> }));

const none = { matchesPlayed: 0, goals: 0, assists: 0, minutes: 0, tracked: 0 };
const open = (p: SquadPlayer) =>
  render(<FichaModal row={squadRow(p, none, Date.UTC(2026, 8, 25))} seasonName="Temporada 1" withStats={false} kit="home" theme="dark" onClose={vi.fn()} onStep={vi.fn()} onCompare={vi.fn()} />);
const posicion = () => screen.getByText("Posición").nextElementSibling as HTMLElement;

describe("FichaModal · Posición", () => {
  it("la preferida y, debajo, «También …» con nombre y código", () => {
    open({ id: "erik", shirtName: "ERIK", number: 9, positions: { main: "MCD", also: ["MC", "DFC"] } });
    expect(posicion()).toHaveTextContent("Pivote");
    expect(posicion()).toHaveTextContent("También mediocentro (MC) · central (DFC)");
  });
  it("sin «también» no hay segunda línea", () => {
    open({ id: "erik", shirtName: "ERIK", number: 9, positions: { main: "MCD", also: [] } });
    expect(posicion()).toHaveTextContent(/^Pivote$/);
  });
});

type Row = NonNullable<ClubMatch["ledger"]>[string];
const row = (minutes: number, extra: Partial<Row> = {}): Row => ({ minutes, started: true, benched: false, notCalled: false, played: minutes > 0, subIn: 0, subOut: 0, dismissed: false, stints: [], exchanges: [], goals: 0, assists: 0, yellowCards: 0, redCards: 0, doubleYellows: 0, penaltyCommitted: 0, penaltyReceived: 0, penaltySaved: 0, penaltyMissed: 0, goalPenalty: 0, goalFreekick: 0, ownGoals: 0, woodwork: 0, ...extra });
const match = (n: number, ledger: ClubMatch["ledger"]): ClubMatch => ({ id: "j" + n, rival: "Rival " + n, date: Date.UTC(2026, 8, n), duration: 50, status: "finished", goalsFor: 1, goalsAgainst: 0, events: [], ledger });
const erik: SquadPlayer = { id: "erik", shirtName: "ERIK", number: 9, positions: { main: "MCD", also: ["MC", "DFC"] } };
const set: PositionSet = { main: "MCD", also: ["MC", "DFC"] };
const withGames = (games: ClubMatch[]) =>
  render(<FichaModal row={squadRow(erik, none, Date.UTC(2026, 8, 25))} seasonName="Temporada 1" withStats kit="home" theme="dark" onClose={vi.fn()} onStep={vi.fn()} onCompare={vi.fn()} games={games} positions={set} />);

describe("FichaModal · Posiciones", () => {
  const season = [
    match(1, { erik: row(50, { goals: 1, positionsPlayed: { MCD: 30, MC: 20 }, positionEvents: { MCD: { goals: 1, assists: 0, yellowCards: 0, redCards: 0 } } }) }),
    match(2, { erik: row(50, { assists: 1, positionsPlayed: { MCD: 40, DFC: 10 }, positionEvents: { DFC: { goals: 0, assists: 1, yellowCards: 0, redCards: 0 } }, positionsEstimated: true }) }),
    match(3, { erik: row(50, { positionsPlayed: { LI: 10, LD: 10, MI: 10, MD: 10, EI: 6, ED: 4 } }) }),
  ];

  it("a third tab, «Posiciones», wired like the others", () => {
    withGames(season);
    const tabs = within(screen.getByRole("tablist", { name: "Secciones de la ficha" })).getAllByRole("tab");
    expect(tabs.map((t) => t.textContent)).toEqual(["Ficha", "Temporada 1", "Posiciones"]);
    const pos = screen.getByRole("tab", { name: "Posiciones" });
    expect(pos).toHaveAttribute("aria-selected", "false");
    expect(pos).toHaveAttribute("aria-controls", "sq-panel");
    fireEvent.click(pos);
    expect(pos).toHaveAttribute("aria-selected", "true");
    expect(screen.getByRole("tab", { name: "Ficha" })).toHaveAttribute("aria-selected", "false");
    expect(screen.getByRole("tabpanel")).toHaveAttribute("aria-labelledby", "sq-tab-posiciones");
  });

  it("the map with his positions and the season's minutes, then a table of at most 5 positions", () => {
    withGames(season);
    fireEvent.click(screen.getByRole("tab", { name: "Posiciones" }));
    const panel = screen.getByRole("tabpanel");
    expect(within(panel).getByRole("img", { name: /^Dónde ha jugado ERIK en Temporada 1\. Ha jugado de Pivote \(MCD\), 70 minutos; Mediocentro \(MC\), 20 minutos;/ })).toBeInTheDocument();
    expect(within(panel).getByText("Algunos minutos estimados por su posición preferida")).toBeInTheDocument();
    const table = within(panel).getByRole("table", { name: "Minutos por posición en Temporada 1" });
    expect(within(table).getAllByRole("columnheader").map((h) => h.textContent)).toEqual(["Posición", "Min", "PJ", "G", "A"]);
    const rows = within(table).getAllByRole("row").slice(1);
    expect(rows).toHaveLength(5);
    expect(rows[0]).toHaveTextContent("Pivote (MCD)70′210");
    expect(rows[1]).toHaveTextContent("Mediocentro (MC)20′100");
    expect(rows[2]).toHaveTextContent("Central (DFC)10′101");
  });

  it("without minutes: the empty copy, no table, no «0′»", () => {
    withGames([match(1, { erik: row(50) })]);
    fireEvent.click(screen.getByRole("tab", { name: "Posiciones" }));
    const panel = screen.getByRole("tabpanel");
    expect(within(panel).getByText("Aún sin minutos con posición")).toBeInTheDocument();
    expect(within(panel).queryByRole("table")).toBeNull();
    expect(within(panel).queryByText(/0′/)).toBeNull();
  });

  it("with no games and no positions passed, still renders the empty map", () => {
    open({ id: "nadie", shirtName: "NADIE", number: 1 });
    fireEvent.click(screen.getByRole("tab", { name: "Posiciones" }));
    expect(screen.getByRole("img", { name: /^Dónde ha jugado NADIE en Temporada 1\. Aún sin minutos con posición\.$/ })).toBeInTheDocument();
  });
});
