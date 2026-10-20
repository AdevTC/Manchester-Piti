import { cleanup, fireEvent, render, screen, within } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { DEFAULT_ANALYSIS_PROFILE, type Observation } from "../../../functions/src/narrated/types";
import type { ClubMatch } from "../../lib/clubData";
import { AnalysisWorkspace } from "./AnalysisWorkspace";

const people = [{ id: "a", name: "Álex", number: 1 }, { id: "b", name: "Bruno", number: 8 }, { id: "c", name: "César", number: 10 }, { id: "d", name: "Dani", number: 14 }, { id: "unused", name: "No jugó" }];
const pass = (id: string, actorId: string, outcome: string): Observation => ({ id, kind: "pass", team: "us", actorId, order: 1, period: 1, time: { from: 10, to: 10, precision: "exact" }, facts: { outcome } });
const matches: ClubMatch[] = [
  { id: "known", seasonId: "s1", status: "finished", duration: 50, starters: ["a", "b", "c"], bench: ["unused"], notCalled: [], analysis: { version: 2, revision: 0, profile: DEFAULT_ANALYSIS_PROFILE, observations: [pass("a1", "a", "complete"), pass("b1", "b", "complete"), pass("b2", "b", "failed"), pass("b3", "b", "failed")], coverage: [{ family: "*", team: "us", state: "complete" }] } },
  { id: "unknown", seasonId: "s1", status: "finished", duration: 50, starters: ["d"], events: [] },
];
const table = () => screen.getByRole("table", { name: "Estadísticas por jugador" });
const bodyRows = () => within(table()).getAllByRole("row").filter(row => row.parentElement?.tagName === "TBODY");
const playerRow = (name: string) => bodyRows().find(row => within(row).queryByRole("rowheader", { name: new RegExp(name) }))!;
const passCell = (name: string) => within(playerRow(name)).getByRole("button", { name: new RegExp(`^${name}: Pases intentados,`) });

beforeEach(() => { window.sessionStorage.clear(); });
afterEach(() => { cleanup(); vi.restoreAllMocks(); vi.unstubAllGlobals(); window.sessionStorage.clear(); });

describe("configurable statistics workspace", () => {
  it("shows every participant, distinguishes zero from missing and uses the pooled total", () => {
    render(<AnalysisWorkspace matches={matches} people={people} onInspect={vi.fn()}/>);
    expect(bodyRows()).toHaveLength(4);
    expect(table()).not.toHaveTextContent("No jugó");
    expect(passCell("Álex")).toHaveTextContent("1");
    expect(passCell("César")).toHaveTextContent("0");
    expect(passCell("Dani")).toHaveTextContent("-Sin información");
    const footer = within(table()).getByRole("row", { name: /Total del Piti/ });
    expect(within(footer).getByRole("button", { name: /Total del Piti: Precisión de pase,/ })).toHaveTextContent("50%");
    expect(screen.getByText(/los porcentajes no son la suma/)).toBeVisible();
  });

  it("sorts both directions with unknowns last and exposes the precise player on inspection", () => {
    const inspect = vi.fn();
    render(<AnalysisWorkspace matches={matches} people={people} onInspect={inspect}/>);
    fireEvent.click(within(table()).getByRole("button", { name: "Ordenar por Pases intentados, de mayor a menor" }));
    expect(bodyRows().map(row => within(row).getByRole("rowheader").textContent)).toEqual(["8Bruno", "1Álex", "10César", "14Dani"]);
    fireEvent.click(within(table()).getByRole("button", { name: "Ordenar por Pases intentados, de menor a mayor" }));
    expect(bodyRows().map(row => within(row).getByRole("rowheader").textContent)).toEqual(["10César", "1Álex", "8Bruno", "14Dani"]);
    expect(within(table()).getByRole("columnheader", { name: /Pases intentados/ })).toHaveAttribute("aria-sort", "ascending");
    fireEvent.click(passCell("Álex"));
    expect(inspect).toHaveBeenLastCalledWith("067", "a");
  });

  it("searches names without accents while keeping the contextual total unchanged", () => {
    render(<AnalysisWorkspace matches={matches} people={people} onInspect={vi.fn()}/>);
    fireEvent.change(screen.getByRole("searchbox", { name: "Buscar jugador o dorsal" }), { target: { value: "alex" } });
    expect(bodyRows()).toHaveLength(1);
    expect(playerRow("Álex")).toBeVisible();
    expect(within(table()).getByRole("button", { name: /Total del Piti: Pases intentados,/ })).toHaveTextContent("4");
    expect(screen.getByText(/1 de 4 jugadores visibles/)).toBeVisible();
  });

  it("allows catalogue columns beyond the presets and keeps team-only values out of player rows", () => {
    const inspect = vi.fn();
    render(<AnalysisWorkspace matches={matches} people={people} onInspect={inspect}/>);
    fireEvent.click(screen.getByText("Personalizar columnas"));
    fireEvent.click(screen.getByRole("button", { name: "Quitar todas" }));
    expect(screen.getByRole("heading", { name: "Elige las columnas que quieres ver" })).toBeVisible();
    fireEvent.change(screen.getByRole("searchbox", { name: "Buscar columna" }), { target: { value: "016" } });
    fireEvent.click(screen.getByRole("checkbox"));
    const cell = within(playerRow("Álex")).getByRole("button");
    expect(cell).toHaveTextContent("-Solo contexto");
    fireEvent.click(cell);
    expect(inspect).toHaveBeenLastCalledWith("016", undefined);
    expect(within(table()).getAllByRole("columnheader")).toHaveLength(2);
  });

  it("preserves presentation on remount but never persists or replaces the parent's data filters", () => {
    const first = render(<AnalysisWorkspace matches={matches} people={people} onInspect={vi.fn()}/>);
    fireEvent.click(screen.getByRole("button", { name: "Pases y creación" }));
    fireEvent.click(within(table()).getByRole("button", { name: "Ordenar por Pases intentados, de menor a mayor" }));
    fireEvent.change(screen.getByRole("searchbox", { name: "Buscar jugador o dorsal" }), { target: { value: "alex" } });
    first.unmount();
    render(<AnalysisWorkspace matches={matches} people={people} filters={{ playerIds: ["b"] }} onInspect={vi.fn()}/>);
    expect(screen.getByRole("button", { name: "Pases y creación" })).toHaveAttribute("aria-pressed", "true");
    expect(within(table()).getByRole("columnheader", { name: /Pases intentados/ })).toHaveAttribute("aria-sort", "ascending");
    expect(bodyRows()).toHaveLength(1);
    expect(playerRow("Bruno")).toBeVisible();
    expect(screen.getByRole("searchbox", { name: "Buscar jugador o dorsal" })).toHaveValue("");
    expect(window.sessionStorage.getItem("piti-analysis-workspace-v1")).not.toContain("playerIds");
  });

  it("renders a configurable ranking with missing players unranked and a two-series comparison", () => {
    const inspect = vi.fn();
    render(<AnalysisWorkspace matches={matches} people={people} onInspect={inspect}/>);
    fireEvent.click(screen.getByRole("button", { name: "Ranking" }));
    const ranking = screen.getByRole("region", { name: "Ranking de Pases intentados" });
    expect(within(ranking).getByRole("button", { name: /Puesto 1, Bruno: 3/ })).toBeVisible();
    expect(within(ranking).getByText(/Sin cifra, fuera del ranking: Dani/)).toBeVisible();
    fireEvent.change(screen.getByRole("combobox", { name: "Orden del ranking" }), { target: { value: "asc" } });
    fireEvent.click(within(ranking).getByRole("button", { name: /Puesto 1, César: 0/ }));
    expect(inspect).toHaveBeenLastCalledWith("067", "c");
    fireEvent.click(screen.getByRole("button", { name: "Dos métricas" }));
    const comparison = screen.getByRole("region", { name: "Comparación de dos métricas" });
    expect(within(comparison).getAllByRole("listitem")).toHaveLength(4);
    expect(within(comparison).getByText(/Cada serie utiliza su propia escala/)).toBeVisible();
    fireEvent.change(screen.getByRole("combobox", { name: "Segunda métrica" }), { target: { value: "070" } });
    fireEvent.click(within(comparison).getByRole("button", { name: /Álex, Precisión de pase: 100%/ }));
    expect(inspect).toHaveBeenLastCalledWith("070", "a");
  });

  it("shows opponent totals without invented own-player rankings and handles an empty sample", () => {
    const { rerender } = render(<AnalysisWorkspace matches={matches} people={people} filters={{ team: "opponent" }} onInspect={vi.fn()}/>);
    expect(table()).toHaveTextContent("Total del rival");
    expect(table()).not.toHaveTextContent("Álex");
    fireEvent.click(screen.getByRole("button", { name: "Ranking" }));
    expect(screen.getByText("Esta cifra describe al equipo; no se reparte entre jugadores.")).toBeVisible();
    rerender(<AnalysisWorkspace matches={[]} people={people} onInspect={vi.fn()}/>);
    expect(screen.getByRole("heading", { name: "Aún no hay cifras comparables" })).toBeVisible();
  });
  it("compares a contextual metric only at the total level and never assigns it to a player", () => {
    const inspect = vi.fn();
    render(<AnalysisWorkspace matches={matches} people={people} onInspect={inspect}/>);
    fireEvent.click(screen.getByRole("button", { name: "Dos métricas" }));
    fireEvent.change(screen.getByRole("combobox", { name: "Segunda métrica" }), { target: { value: "016" } });
    const comparison = screen.getByRole("region", { name: "Comparación de dos métricas" });
    expect(within(comparison).getAllByRole("listitem")).toHaveLength(1);
    expect(comparison).toHaveTextContent("Hay una métrica de equipo");
    expect(comparison).not.toHaveTextContent("Álex");
    fireEvent.click(within(comparison).getByRole("button", { name: /^Total del Piti, Pases intentados: 4/ }));
    expect(inspect).toHaveBeenLastCalledWith("067", undefined);
  });
  it("an incompatible opponent and own-player selection remains not applicable instead of zero", () => {
    render(<AnalysisWorkspace matches={matches} people={people} filters={{ team: "opponent", playerIds: ["a"] }} onInspect={vi.fn()}/>);
    const value = within(table()).getByRole("button", { name: /^Total del rival: Pases intentados,/ });
    expect(value).toHaveTextContent("-No aplicable");
    expect(table()).not.toHaveTextContent("Álex");
  });
});
