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

describe("interactive analysis charts", () => {
  it("selects a real half window and reveals only that window's evidence", () => {
    const inspect = vi.fn(); render(<AnalysisInsights matches={[match]} people={people} onInspect={inspect}/>);
    fireEvent.click(screen.getByRole("button", { name: /2.ª parte · 0′–5′:/ }));
    const detail = screen.getByRole("region", { name: "Detalle del tramo" });
    expect(detail).toHaveTextContent("5′ 50″"); expect(detail).not.toHaveTextContent("0′ 10″");
    expect(detail).toHaveTextContent("4,7 min");
    fireEvent.change(screen.getByRole("combobox", { name: "Qué ver por tramos" }), { target: { value: "070" } });
    expect(detail).toHaveTextContent("0%"); expect(detail).toHaveTextContent("0/1");
    fireEvent.click(screen.getByRole("button", { name: /Ver el cálculo de esta estadística/ }));
    expect(inspect).toHaveBeenCalledWith("070");
  });
  it("selects a directed pair with its denominator and preserves scope when opening the match", () => {
    render(<AnalysisInsights matches={[match]} people={people} filters={{ playerIds: ["a"], team: "us", period: 2 }}/>);
    fireEvent.click(screen.getByRole("button", { name: "Quién conecta con quién" }));
    const table = screen.getByRole("table", { name: "Matriz dirigida de pases" });
    fireEvent.click(within(table).getByRole("button", { name: /^Álex a Bruno:/ }));
    const detail = screen.getByRole("region", { name: "Detalle de la conexión" });
    expect(detail).toHaveTextContent("Álex → Bruno"); expect(detail).toHaveTextContent("0/1");
    const link = within(detail).getByRole("link", { name: /Abrir partido/ });
    expect(link).toHaveAttribute("data-search", expect.stringContaining('"players":["a"]'));
    expect(link).toHaveAttribute("data-search", expect.stringContaining('"period":2'));
    fireEvent.change(screen.getByRole("combobox", { name: "Color y cifra de la matriz" }), { target: { value: "accuracy" } });
    expect(within(table).getByRole("button", { name: /^Álex a Bruno:/ })).toHaveTextContent("0%");
  });
  it("keeps unknown values separate from observed zero in both charts", () => {
    const unknown = { ...match, analysis: { ...match.analysis!, coverage: [], observations: match.analysis!.observations.filter(e => e.kind === "context") } };
    render(<AnalysisInsights matches={[unknown]} people={people}/>);
    const detail = screen.getByRole("region", { name: "Detalle del tramo" });
    expect(detail).toHaveTextContent("Sin información");
    fireEvent.click(screen.getByRole("button", { name: "Quién conecta con quién" }));
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
    fireEvent.change(screen.getByRole("combobox", { name: "Qué ver por tramos" }), { target: { value: "070" } });
    view.rerender(<AnalysisInsights matches={[match]} people={people} filters={{ period: 2 }}/>);
    expect(screen.getByRole("combobox", { name: "Qué ver por tramos" })).toHaveValue("070");
    expect(screen.getByRole("region", { name: "Detalle del tramo" })).toHaveTextContent("0%");
    fireEvent.click(screen.getByRole("button", { name: "Quién conecta con quién" }));
    fireEvent.change(screen.getByRole("combobox", { name: "Color y cifra de la matriz" }), { target: { value: "accuracy" } });
    view.rerender(<AnalysisInsights matches={[match]} people={people} filters={{ period: 1, playerIds: ["a"] }}/>);
    expect(screen.getByRole("combobox", { name: "Color y cifra de la matriz" })).toHaveValue("accuracy");
    expect(screen.getByRole("region", { name: "Detalle de la conexión" })).toHaveTextContent("100%");
    expect(screen.getByRole("region", { name: "Detalle de la conexión" })).not.toHaveTextContent("5′ 50″");
  });
});
