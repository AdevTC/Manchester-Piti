import { afterEach, describe, expect, it, vi } from "vitest";
import { cleanup, fireEvent, render, screen, within } from "@testing-library/react";
import { DEFAULT_ANALYSIS_PROFILE } from "../../../functions/src/narrated/types";
import type { ClubMatch } from "../../lib/clubData";
import { AnalysisInsights } from "./AnalysisInsights";

vi.mock("@tanstack/react-router", () => ({ Link: ({ children, search, params }: { children: React.ReactNode; search: Record<string, unknown>; params: { matchId: string } }) => <a href={`/partidos/${params.matchId}`} data-search={JSON.stringify(search)}>{children}</a> }));
const people = [{ id: "a", name: "Álex", number: 1 }, { id: "b", name: "Bruno", number: 8 }];
const match: ClubMatch = { id: "m", seasonId: "s", rival: "Rival local", status: "finished", duration: 10, starters: ["a", "b"], analysis: { version: 2, revision: 0, profile: DEFAULT_ANALYSIS_PROFILE, observations: [
  { id: "half1", kind: "context", team: "us", period: 1, order: 0, facts: { intervalStart: 0, intervalEnd: 320 } },
  { id: "half2", kind: "context", team: "us", period: 2, order: 1, facts: { intervalStart: 320, intervalEnd: 600 } },
  { id: "first", kind: "pass", team: "us", actorId: "a", receiverId: "b", order: 2, period: 1, time: { from: 10, to: 10, precision: "exact" }, facts: { outcome: "complete" } },
  { id: "second", kind: "pass", team: "us", actorId: "a", intendedReceiverId: "b", order: 3, period: 2, time: { from: 350, to: 350, precision: "exact" }, facts: { outcome: "failed" } },
], coverage: [{ family: "*", team: "us", state: "complete" }] } };
afterEach(cleanup);
const pickMetric = (name: string) => fireEvent.click(within(screen.getByRole("group", { name: "Qué ver por tramos" })).getByRole("button", { name }));

describe("interactive analysis charts", () => {
  it("selects a real half window and reveals only that window's evidence", () => {
    const inspect = vi.fn(); render(<AnalysisInsights matches={[match]} people={people} onInspect={inspect}/>);
    fireEvent.click(screen.getByRole("button", { name: /2.ª parte · 0′–5′:/ }));
    const detail = screen.getByRole("region", { name: "Detalle del tramo" });
    expect(detail).toHaveTextContent("5′ 50″"); expect(detail).not.toHaveTextContent("0′ 10″");
    expect(screen.getByRole("region", { name: "Lectura del tramo" })).toHaveTextContent("4,7 min");
    pickMetric("Precisión de pase");
    expect(detail).toHaveTextContent("0%"); expect(detail).toHaveTextContent("0/1");
    fireEvent.click(screen.getByRole("button", { name: /Ver el cálculo de esta estadística/ }));
    expect(inspect).toHaveBeenCalledWith("070");
  });
  it("selects a directed pair with its denominator and opens the match with a clean address", () => {
    render(<AnalysisInsights matches={[match]} people={people} filters={{ playerIds: ["a"], team: "us", period: 2 }}/>);
    fireEvent.click(screen.getByRole("button", { name: "Matriz" }));
    const table = screen.getByRole("table", { name: "Matriz dirigida de pases" });
    fireEvent.click(within(table).getByRole("button", { name: /^Álex a Bruno:/ }));
    const detail = screen.getByRole("region", { name: "Detalle de la conexión" });
    expect(detail).toHaveTextContent("Álex → Bruno"); expect(detail).toHaveTextContent("0/1");
    const link = within(detail).getByRole("link", { name: /Abrir partido/ });
    // (the match page has no player or half of its own: the link carries neither)
    expect(link).toHaveAttribute("data-search", "{}");
    fireEvent.click(within(screen.getByRole("group", { name: "Color y cifra de la matriz" })).getByRole("button", { name: "Acierto de pase" }));
    expect(within(table).getByRole("button", { name: /^Álex a Bruno:/ })).toHaveTextContent("0%");
  });
  it("keeps unknown values separate from observed zero in both charts", () => {
    const unknown = { ...match, analysis: { ...match.analysis!, coverage: [], observations: match.analysis!.observations.filter(e => e.kind === "context") } };
    render(<AnalysisInsights matches={[unknown]} people={people}/>);
    const detail = screen.getByRole("region", { name: "Detalle del tramo" });
    expect(detail).toHaveTextContent("Sin información");
    fireEvent.click(screen.getByRole("button", { name: "Matriz" }));
    expect(screen.getByRole("button", { name: /^Álex a Bruno:/ })).toHaveTextContent("-");
  });
  it("recalculates a changed parent scope and presents a clear absent-player state", () => {
    const view = render(<AnalysisInsights matches={[match]} people={people}/>);
    view.rerender(<AnalysisInsights matches={[match]} people={people} filters={{ playerIds: ["absent"] }}/>);
    expect(screen.getByRole("heading", { name: "No hay tramos comparables en esta selección" })).toBeVisible();
    expect(screen.queryByRole("region", { name: "Detalle del tramo" })).not.toBeInTheDocument();
  });
  it("preserves the chosen comparison when the parent changes player or period", () => {
    const view = render(<AnalysisInsights matches={[match]} people={people}/>);
    pickMetric("Precisión de pase");
    view.rerender(<AnalysisInsights matches={[match]} people={people} filters={{ period: 2 }}/>);
    expect(within(screen.getByRole("group", { name: "Qué ver por tramos" })).getByRole("button", { name: "Precisión de pase" })).toHaveAttribute("aria-pressed", "true");
    expect(screen.getByRole("region", { name: "Detalle del tramo" })).toHaveTextContent("0%");
    fireEvent.click(screen.getByRole("button", { name: "Matriz" }));
    fireEvent.click(within(screen.getByRole("group", { name: "Color y cifra de la matriz" })).getByRole("button", { name: "Acierto de pase" }));
    view.rerender(<AnalysisInsights matches={[match]} people={people} filters={{ period: 1, playerIds: ["a"] }}/>);
    expect(within(screen.getByRole("group", { name: "Color y cifra de la matriz" })).getByRole("button", { name: "Acierto de pase" })).toHaveAttribute("aria-pressed", "true");
    expect(screen.getByRole("region", { name: "Detalle de la conexión" })).toHaveTextContent("100%");
    expect(screen.getByRole("region", { name: "Detalle de la conexión" })).not.toHaveTextContent("5′ 50″");
  });
  it("draws the rival below the axis in the same tramos and shows its plays on request", () => {
    const both: ClubMatch = { ...match, analysis: { ...match.analysis!, observations: [...match.analysis!.observations,
      { id: "theirs", kind: "pass", team: "opponent", opponentId: "9", order: 4, period: 1, time: { from: 100, to: 100, precision: "exact" }, facts: { outcome: "complete", opponentReceiverId: "10" } },
      { id: "ours", kind: "goal", team: "us", actorId: "b", order: 5, period: 1, time: { from: 60, to: 60, precision: "exact" }, facts: {} },
      { id: "late", kind: "goal", team: "opponent", order: 6, period: 2, time: { from: 400, to: 400, precision: "approximate" }, facts: {} },
    ], coverage: [{ family: "*", team: "us", state: "complete" }, { family: "*", team: "opponent", state: "complete" }] } };
    render(<AnalysisInsights matches={[both]} people={people}/>);
    expect(screen.getByRole("group", { name: /abajo Rival local$/ })).toBeVisible();
    const first = screen.getByRole("button", { name: /^1.ª parte · 0′–5′:/ });
    expect(first).toHaveAccessibleName(/Manchester Piti 1, Rival local 1\./);
    expect(screen.getByRole("img", { name: "Gol del Piti, de Bruno · 1.ª parte, 1′" })).toBeInTheDocument();
    expect(screen.queryByRole("img", { name: /Gol de Rival local/ })).not.toBeInTheDocument();
    const detail = screen.getByRole("region", { name: "Detalle del tramo" });
    expect(detail).toHaveTextContent("0′ 10″"); expect(detail).not.toHaveTextContent("1′ 40″");
    fireEvent.click(within(screen.getByRole("group", { name: "De quién son las jugadas" })).getByRole("button", { name: "Del rival" }));
    expect(detail).toHaveTextContent("Rival local · Pases intentados"); expect(detail).toHaveTextContent("1′ 40″"); expect(detail).not.toHaveTextContent("0′ 10″");
  });
  it("draws a rival with data in too few tramos as its points and stops comparing tramo by tramo", () => {
    const thin: ClubMatch = { ...match, analysis: { ...match.analysis!, observations: [...match.analysis!.observations,
      { id: "theirs", kind: "pass", team: "opponent", opponentId: "9", order: 4, period: 1, time: { from: 100, to: 100, precision: "exact" }, facts: { outcome: "complete", opponentReceiverId: "10" } },
    ], coverage: [{ family: "*", team: "us", state: "complete" }, { family: "*", team: "opponent", state: "partial" }] } };
    const { container } = render(<AnalysisInsights matches={[thin]} people={people}/>);
    expect(screen.getByRole("heading", { name: "El mejor tramo del Piti en pases intentados: 1.ª parte · 0′–5′" })).toBeVisible();
    expect(screen.getByText("De Rival local solo hay dato en 1 de 3 tramos, así que no se comparan tramo a tramo.")).toBeVisible();
    expect(screen.getByText(/Rival local, hacia abajo \(dato en 1 de 3 tramos\)/)).toBeVisible();
    expect(container.querySelectorAll(".gt-stem--them")).toHaveLength(1);
    expect(container.querySelectorAll(".gt-area--them")).toHaveLength(0);
  });
  it("orders the matrix by position from the goalkeeper or by passes given", () => {
    const sheet: ClubMatch = { ...match, ledger: { a: { stints: [], minutes: 10, positionsPlayed: { DC: 10 } }, b: { stints: [], minutes: 10, positionsPlayed: { POR: 10 } } } as unknown as ClubMatch["ledger"] };
    render(<AnalysisInsights matches={[sheet]} people={people}/>);
    fireEvent.click(screen.getByRole("button", { name: "Matriz" }));
    const rows = () => within(screen.getByRole("table", { name: "Matriz dirigida de pases" })).getAllByRole("rowheader").map(cell => cell.textContent);
    expect(rows()).toEqual(["8Bruno", "1Álex", "Recibe"]);
    expect(screen.getByRole("heading", { name: "Álex es quien más reparte: 1 pase completado" })).toBeVisible();
    fireEvent.click(within(screen.getByRole("group", { name: "Orden" })).getByRole("button", { name: "Por volumen" }));
    expect(rows()).toEqual(["1Álex", "8Bruno", "Recibe"]);
  });
});
