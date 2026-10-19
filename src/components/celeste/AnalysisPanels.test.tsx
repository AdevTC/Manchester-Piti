import { fireEvent, render, screen, within } from "@testing-library/react";
import { useState, type ReactNode } from "react";
import { describe, expect, it, vi } from "vitest";
import type { ClubMatch } from "../../lib/clubData";
import type { AnalysisSearch } from "../../lib/analysisSearch";
import { AnalysisPanels } from "./AnalysisPanels";

vi.mock("@tanstack/react-router", () => ({ Link: ({ children }: { children: ReactNode }) => <a href="#">{children}</a> }));
vi.mock("./TechnicalStats", () => ({ TechnicalStatsPanel: () => <p>Gráficas del partido completo</p> }));
const match: ClubMatch = { id: "j1", seasonId: "t1", status: "finished", duration: 50, events: [
  { id: "p1", type: "pass", playerId: "pepe", receiverId: "luis", minute: 4, period: 1, outcome: "complete" },
  { id: "p2", type: "pass", playerId: "pepe", receiverId: "luis", minute: 30, period: 2, outcome: "incomplete" },
  { id: "p3", type: "pass", team: "opponent", minute: 31, period: 2, outcome: "complete" },
] };
function Harness({ initial = {} }: { initial?: AnalysisSearch }) {
  const [search, setSearch] = useState(initial);
  return <><output aria-label="Estado del análisis">{JSON.stringify(search)}</output><AnalysisPanels matches={[match]} people={[{ id: "pepe", name: "Pepe" }, { id: "luis", name: "Luis" }]} matchId="j1" search={search} onSearchChange={patch => setSearch(previous => ({ ...previous, ...patch }))}/></>;
}
describe("shared analysis contexts", () => {
  it("selects team and period together and retains them when opening evidence", () => {
    render(<Harness/>);
    fireEvent.change(screen.getByRole("combobox", { name: "Parte" }), { target: { value: "2" } });
    expect(screen.queryByText("Gráficas del partido completo")).not.toBeInTheDocument();
    const highlights = screen.getByLabelText("Indicadores de la selección");
    expect(within(highlights).getByRole("button", { name: /Pases intentados/ })).toHaveTextContent("1 acciones");
    fireEvent.change(screen.getByRole("combobox", { name: "Equipo" }), { target: { value: "opponent" } });
    expect(screen.getByLabelText("Estado del análisis")).toHaveTextContent('"team":"opponent"');
    fireEvent.click(within(highlights).getByRole("button", { name: /Pases intentados/ }));
    expect(screen.getByRole("heading", { name: "Pases intentados" })).toBeInTheDocument();
    expect(screen.getByLabelText("Estado del análisis")).toHaveTextContent('"period":2');
    expect(screen.getByLabelText("Estado del análisis")).toHaveTextContent('"metric":"067"');
  });
  it("clears our player selection for the rival and switches back when selecting a Piti player", () => {
    render(<Harness initial={{ players: ["pepe"] }}/>);
    fireEvent.change(screen.getByRole("combobox", { name: "Equipo" }), { target: { value: "opponent" } });
    expect(screen.getByLabelText("Estado del análisis")).not.toHaveTextContent("pepe");
    fireEvent.click(screen.getByLabelText("Luis"));
    expect(screen.getByLabelText("Estado del análisis")).toHaveTextContent('"team":"us"');
    expect(screen.getByLabelText("Estado del análisis")).toHaveTextContent('"players":["luis"]');
    expect(screen.getByRole("region", { name: "Jugadores seleccionados" })).toHaveTextContent("Luis");
  });
  it("downloads the current selection from either view without navigating away", () => {
    vi.useFakeTimers();
    const create = vi.fn((_blob: Blob) => "blob:selection"), revoke = vi.fn();
    vi.stubGlobal("URL", Object.assign(class extends URL {}, { createObjectURL: create, revokeObjectURL: revoke }));
    let downloadName = "";
    const click = vi.spyOn(HTMLAnchorElement.prototype, "click").mockImplementation(function (this: HTMLAnchorElement) { downloadName = this.download; });
    try {
      render(<Harness initial={{ players: ["pepe"], period: 1 }}/>);
      fireEvent.click(screen.getByRole("button", { name: "Exportar selección JSON" }));
      expect(create).toHaveBeenCalledTimes(1);
      expect(create.mock.calls[0][0]).toBeInstanceOf(Blob);
      expect(downloadName).toMatch(/^piti-estadisticas-\d{4}-\d{2}-\d{2}\.json$/);
      expect(screen.getByRole("status", { name: "Estado de la exportación" })).toHaveTextContent("1 partido, resultados y evidencias públicas");
      expect(document.querySelector('a[download]')).toBeNull();
      fireEvent.click(screen.getByRole("button", { name: "Catálogo de estadísticas" }));
      fireEvent.click(screen.getByRole("button", { name: "Exportar selección JSON" }));
      expect(click).toHaveBeenCalledTimes(2);
      vi.runAllTimers();
      expect(revoke).toHaveBeenCalledWith("blob:selection");
    } finally { vi.useRealTimers(); vi.unstubAllGlobals(); click.mockRestore(); }
  });
});
