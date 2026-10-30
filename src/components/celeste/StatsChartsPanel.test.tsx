import { afterEach, describe, expect, it, vi } from "vitest";
import { cleanup, fireEvent, render, screen, within } from "@testing-library/react";
import { DEFAULT_ANALYSIS_PROFILE } from "../../../functions/src/narrated/types";
import type { ClubMatch } from "../../lib/clubData";
import { StatsChartsPanel } from "./StatsChartsPanel";

vi.mock("@tanstack/react-router", () => ({ Link: ({ children, params }: { children: React.ReactNode; params: { matchId: string } }) => <a href={`/partidos/${params.matchId}/numeros`}>{children}</a> }));
const people = [{ id: "a", name: "Álex", number: 7 }, { id: "b", name: "Bruno", number: 10 }];
const match: ClubMatch = { id: "m", seasonId: "s", rival: "Orduña", date: Date.UTC(2026, 9, 18, 10), status: "finished", duration: 50, starters: ["a", "b"], analysis: { version: 2, revision: 0, profile: DEFAULT_ANALYSIS_PROFILE, coverage: [{ family: "*", team: "us", state: "complete" }], observations: [
  { id: "first", kind: "context", team: "us", period: 1, order: 0, facts: { intervalStart: 0, intervalEnd: 1500 } },
  { id: "second", kind: "context", team: "us", period: 2, order: 1, facts: { intervalStart: 1500, intervalEnd: 3000 } },
  { id: "pass", kind: "pass", team: "us", actorId: "a", receiverId: "b", period: 1, order: 2, time: { from: 10, to: 10, precision: "exact" }, facts: { outcome: "complete" } },
  { id: "return", kind: "pass", team: "us", actorId: "b", receiverId: "a", period: 2, order: 3, time: { from: 1600, to: 1600, precision: "exact" }, facts: { outcome: "complete" } },
  { id: "shot", kind: "shot", team: "us", actorId: "a", period: 2, order: 4, time: { from: 1800, to: 1800, precision: "exact" }, facts: { outcome: "off_target" } },
] } };
afterEach(cleanup);

describe("shared chart panel", () => {
  it("opens on the restored network and supports keyboard highlighting plus pair evidence", () => {
    render(<StatsChartsPanel matches={[match]} people={people}/>);
    const network = screen.getByRole("group", { name: "Red dirigida de pases completados" });
    const node = within(network).getByRole("button", { name: /Resaltar a Álex/ });
    fireEvent.keyDown(node, { key: "Enter" });
    expect(node).toHaveAttribute("aria-pressed", "true");
    expect(screen.getByRole("combobox", { name: "Resaltar conexiones de" })).toHaveValue("a");
    fireEvent.click(within(screen.getByRole("list", { name: "Conexiones de la red" })).getByRole("button", { name: /Álex a Bruno/ }));
    const detail = screen.getByRole("region", { name: "Jugadas de la conexión elegida" });
    expect(detail).toHaveTextContent("1/1 con resultado conocido");
    expect(detail).toHaveTextContent("0′ 10″");
    expect(detail).not.toHaveTextContent("26′ 40″");
  });
  it("renders both matches together and keeps each acta in the pair detail", () => {
    const first = structuredClone(match);
    first.analysis!.profile = structuredClone(DEFAULT_ANALYSIS_PROFILE);
    first.analysis!.observations.find(action => action.id === "pass")!.facts.deflected = true;
    const second = structuredClone(first); second.id = "second-match";
    second.analysis!.profile.passes.deflection = "retain";
    const view = render(<StatsChartsPanel matches={[first, second]} people={people}/>);
    expect(screen.getByRole("group", { name: "Red dirigida de pases completados" })).toBeVisible();
    expect(screen.queryByRole("heading", { name: "Aún no se puede dibujar la red" })).not.toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "Bruno a Álex: 2 pases completados. Ver jugadas" }));
    const detail = screen.getByRole("region", { name: "Jugadas de la conexión elegida" });
    expect(detail).toHaveTextContent("2/2 con resultado conocido");
    expect(within(detail).getAllByRole("link").map(link => link.getAttribute("href"))).toEqual(expect.arrayContaining(["/partidos/m/numeros", "/partidos/second-match/numeros"]));
    view.rerender(<StatsChartsPanel matches={[second, first]} people={people} filters={{ period: 1 }}/>);
    expect(screen.getByRole("button", { name: "Álex a Bruno: 1 pases completados. Ver jugadas" })).toBeVisible();
    expect(screen.queryByRole("button", { name: /Bruno a Álex/ })).not.toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "Álex a Bruno: 1 pases completados. Ver jugadas" }));
    const firstHalfDetail = screen.getByRole("region", { name: "Jugadas de la conexión elegida" });
    expect(firstHalfDetail).toHaveTextContent("1/2 con resultado conocido");
    expect(within(firstHalfDetail).getByText("Fallido")).toBeVisible();
    expect(within(firstHalfDetail).getByText("Completado")).toBeVisible();
  });
  it("recalculates the selected period without leaking old pair evidence", () => {
    const view = render(<StatsChartsPanel matches={[match]} people={people}/>);
    fireEvent.click(within(screen.getByRole("list", { name: "Conexiones de la red" })).getByRole("button", { name: /Álex a Bruno/ }));
    view.rerender(<StatsChartsPanel matches={[match]} people={people} filters={{ period: 2 }}/>);
    expect(screen.queryByRole("region", { name: "Jugadas de la conexión elegida" })).not.toBeInTheDocument();
    expect(screen.getByRole("list", { name: "Conexiones de la red" })).toHaveTextContent("Bruno");
    expect(within(screen.getByRole("list", { name: "Conexiones de la red" })).getAllByRole("button")).toHaveLength(1);
  });
  it("keeps the shared player scope and shows missing rival identities honestly", () => {
    render(<StatsChartsPanel matches={[match]} people={people} filters={{ team: "opponent" }}/>);
    expect(screen.getByRole("heading", { name: "Aún no se puede dibujar la red" })).toBeVisible();
    expect(screen.queryByRole("button", { name: /Resaltar a Álex/ })).not.toBeInTheDocument();
  });
  it("restores timeline and matrix without replacing the page filters", () => {
    render(<StatsChartsPanel matches={[match]} people={people} filters={{ period: 2, playerIds: ["a"] }}/>);
    fireEvent.click(screen.getByRole("button", { name: "Tramos y matriz" }));
    expect(screen.getByRole("group", { name: "Qué ver por tramos" })).toBeVisible();
    expect(screen.queryByRole("button", { name: /^1\.ª parte ·/ })).not.toBeInTheDocument();
    fireEvent.click(within(screen.getByRole("group", { name: "Vistas de esta gráfica" })).getByRole("button", { name: "Matriz" }));
    expect(screen.getByRole("table", { name: "Matriz dirigida de pases" })).toBeVisible();
  });
  it("shows shot evidence and forwards the catalogue metric with the current selection", () => {
    const inspect = vi.fn();
    render(<StatsChartsPanel matches={[match]} people={people} filters={{ period: 2 }} onInspect={inspect}/>);
    fireEvent.click(within(screen.getByRole("group", { name: "Vistas de las gráficas" })).getByRole("button", { name: "Remates" }));
    const bars = screen.getByRole("list", { name: "Remates por resultado" });
    fireEvent.click(within(bars).getByRole("button", { name: /^Fuera/ }));
    expect(screen.getByRole("region", { name: "Jugadas del resultado de remate" })).toHaveTextContent("30′");
    fireEvent.click(screen.getByRole("button", { name: "Ver cómo se calcula ↗" }));
    expect(inspect).toHaveBeenCalledWith("031");
  });
});
