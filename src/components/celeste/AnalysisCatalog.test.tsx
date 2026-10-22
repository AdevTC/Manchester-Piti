import { fireEvent, render, screen, within } from "@testing-library/react";
import { useState, type ReactNode } from "react";
import { describe, expect, it, vi } from "vitest";
import { NARRATED_METRICS } from "../../../functions/src/narrated/catalog";
import type { MetricResult } from "../../../functions/src/narrated/types";
import type { AnalysisSearch } from "../../lib/analysisSearch";
import { AnalysisCatalog } from "./AnalysisCatalog";

vi.mock("@tanstack/react-router", () => ({ Link: ({ children, to, params, search }: { children: ReactNode; to: string; params: { matchId: string }; search?: Record<string, unknown> }) => <a href={to.replace("$matchId", params.matchId)} data-search={JSON.stringify(search)}>{children}</a> }));
const baseline: MetricResult[] = NARRATED_METRICS.map(metric => ({ id: metric.id, unit: "count", value: null, status: metric.audio.viability === "excluded" ? "not_applicable" : "unknown", observed: 0, pending: 0, evidenceEventIds: [], ruleId: `metric:${metric.id}`, ruleVersion: 1, parameters: {}, reason: "Falta información de esta familia." }));
function Harness({ initial = {}, overrides = [] }: { initial?: AnalysisSearch; overrides?: Partial<MetricResult>[] }) {
  const [search, setSearch] = useState(initial);
  const results = baseline.map(result => ({ ...result, ...overrides.find(item => item.id === result.id) }));
  return <AnalysisCatalog matches={[{ id: "j1", rival: "Rival de prueba", date: Date.UTC(2026, 9, 1), events: [{ id: "pase1", type: "pass", playerId: "p1", receiverId: "p2", minute: 4, outcome: "complete" }] }]} people={[{ id: "p1", name: "Pepe" }, { id: "p2", name: "Luis" }]} results={results} search={search} onChange={patch => setSearch(previous => ({ ...previous, ...patch }))}/>;
}

describe("the narrated catalogue", () => {
  it("keeps the player, team and period context when following evidence into a match", () => {
    render(<Harness initial={{ metric: "067", players: ["p1"], team: "us", period: 2 }} overrides={[{ id: "067", value: 1, status: "partial", observed: 1, evidenceEventIds: ["j1:pase1"] }]}/>);
    const evidence = screen.getByRole("region", { name: "Jugadas que sustentan la estadística" });
    const link = within(evidence).getByRole("link");
    // (the match's Números screen, with the catalogue and its scope)
    expect(link).toHaveAttribute("href", "/partidos/j1/numeros");
    expect(JSON.parse(link.getAttribute("data-search")!)).toEqual({ analysis: "catalog", metric: "067", players: ["p1"], team: "us", period: 2 });
  });
  it("shows all 321 audio candidates by default and explicitly includes the 91 exclusions on request", () => {
    render(<Harness/>);
    expect(screen.getByRole("status")).toHaveTextContent("321 estadísticas");
    fireEvent.click(screen.getByRole("checkbox", { name: "Incluir las 91 fuera del audio" }));
    expect(screen.getByRole("status")).toHaveTextContent("412 estadísticas");
    fireEvent.change(screen.getByRole("searchbox"), { target: { value: "inventada-no-existe" } });
    expect(screen.getByRole("status")).toHaveTextContent("0 estadísticas");
    expect(screen.getByText(/No hay estadísticas con estos filtros/)).toBeInTheDocument();
  });
  it("distinguishes a known zero from missing information and exposes the sample, rule and evidence", () => {
    render(<Harness initial={{ q: "Pases intentados" }} overrides={[{ id: "067", value: 1, status: "partial", observed: 1, pending: 2, numerator: 1, denominator: 3, evidenceEventIds: ["j1:pase1"], reason: "Dos pases pendientes de resultado." }]}/>);
    const trigger = within(screen.getByRole("list", { name: "Estadísticas del catálogo" })).getByRole("button", { name: /Pases intentados/ });
    fireEvent.click(trigger);
    expect(screen.getByRole("heading", { name: "Pases intentados" })).toHaveFocus();
    const detail = screen.getByRole("region", { name: "Pases intentados" });
    expect(detail).toHaveTextContent("Dos pases pendientes de resultado.");
    expect(detail).toHaveTextContent("Numerador1Denominador3");
    expect(detail).toHaveTextContent("metric:067 · versión 1");
    const evidence = within(detail).getByRole("region", { name: "Jugadas que sustentan la estadística" });
    expect(evidence).toHaveTextContent("Pase · Pepe → Luis");
    expect(evidence).toHaveTextContent("4′");
    expect(within(evidence).getByRole("link")).toHaveAttribute("href", "/partidos/j1/numeros");
    fireEvent.keyDown(detail, { key: "Escape" });
    expect(screen.queryByRole("heading", { name: "Pases intentados" })).not.toBeInTheDocument();
    expect(trigger).toHaveFocus();
  });
  it("a family change closes the old detail so a metric from the previous filter is not misrepresented", () => {
    render(<Harness initial={{ metric: "067" }}/>);
    expect(screen.getByRole("heading", { name: "Pases intentados" })).toHaveFocus();
    fireEvent.change(screen.getByRole("combobox", { name: "Familia" }), { target: { value: "Goles y marcador" } });
    expect(screen.queryByRole("heading", { name: "Pases intentados" })).not.toBeInTheDocument();
    expect(screen.getByRole("status")).toHaveTextContent("Goles y marcador");
  });
  it("renders 0 only for a supplied real zero and keeps unknown as an em dash", () => {
    render(<Harness initial={{ q: "Pases intentados" }} overrides={[{ id: "067", value: 0, status: "complete", reason: "Cobertura completa sin pases." }]}/>);
    const list = screen.getByRole("list", { name: "Estadísticas del catálogo" });
    expect(within(list).getByText("0")).toBeInTheDocument();
    expect(within(list).getByText("Completo")).toBeInTheDocument();
    fireEvent.change(screen.getByRole("searchbox"), { target: { value: "Pases completados" } });
    expect(within(list).getAllByText("—").length).toBeGreaterThan(0);
    expect(within(list).getAllByText("Sin información").length).toBeGreaterThan(0);
    expect(within(list).queryByText("0")).not.toBeInTheDocument();
  });
});
