import { afterEach, describe, expect, it, vi } from "vitest";
import { cleanup, fireEvent, render, screen, within } from "@testing-library/react";
import { DEFAULT_ANALYSIS_PROFILE } from "../../../../functions/src/narrated/types";
import type { ClubMatch } from "../../../lib/clubData";
import { PassNetworkView } from "./PassNetwork";

vi.mock("@tanstack/react-router", () => ({ Link: ({ children, params }: { children: React.ReactNode; params: { matchId: string } }) => <a href={`/partidos/${params.matchId}/numeros`}>{children}</a> }));
const people = [{ id: "a", name: "Álex", number: 7 }, { id: "b", name: "Bruno", number: 10 }];
const match: ClubMatch = { id: "m", seasonId: "s", rival: "Orduña", date: Date.UTC(2026, 9, 18, 10), status: "finished", duration: 50, starters: ["a", "b"], analysis: { version: 2, revision: 0, profile: DEFAULT_ANALYSIS_PROFILE, coverage: [{ family: "*", team: "us", state: "complete" }], observations: [
  { id: "first", kind: "context", team: "us", period: 1, order: 0, facts: { intervalStart: 0, intervalEnd: 1500 } },
  { id: "second", kind: "context", team: "us", period: 2, order: 1, facts: { intervalStart: 1500, intervalEnd: 3000 } },
  { id: "pass", kind: "pass", team: "us", actorId: "a", receiverId: "b", period: 1, order: 2, time: { from: 10, to: 10, precision: "exact" }, facts: { outcome: "complete" } },
  { id: "return", kind: "pass", team: "us", actorId: "b", receiverId: "a", period: 2, order: 3, time: { from: 1600, to: 1600, precision: "exact" }, facts: { outcome: "complete" } },
  { id: "shot", kind: "shot", team: "us", actorId: "a", period: 2, order: 4, time: { from: 1800, to: 1800, precision: "exact" }, facts: { outcome: "off_target" } },
] } };
/** The same match with an acta that places both players (Álex up front, Bruno in goal) and their minutes. */
const withPositions = (): ClubMatch => { const m = structuredClone(match); m.ledger = { a: { minutes: 50, secondsPlayed: 3000, stints: [], positionsPlayed: { DC: 50 } }, b: { minutes: 50, secondsPlayed: 3000, stints: [], positionsPlayed: { POR: 50 } } } as unknown as ClubMatch["ledger"]; return m; };
const network = () => screen.getByRole("group", { name: "Red dirigida de pases completados" });
afterEach(cleanup);

describe("Red de pases", () => {
  it("supports keyboard highlighting, keeps the pair list and opens the pair evidence", () => {
    render(<PassNetworkView matches={[match]} people={people}/>);
    const node = within(network()).getByRole("button", { name: /Resaltar a Álex/ });
    expect(node).toHaveAccessibleName("Resaltar a Álex: 1 pases dados y 1 recibidos");
    fireEvent.keyDown(node, { key: "Enter" });
    expect(node).toHaveAttribute("aria-pressed", "true");
    expect(screen.getByRole("combobox", { name: "Resaltar conexiones de" })).toHaveValue("a");
    expect(screen.getByRole("heading", { name: "Conexiones de Álex" })).toBeVisible();
    fireEvent.click(within(screen.getByRole("list", { name: "Conexiones de la red" })).getByRole("button", { name: /Álex a Bruno/ }));
    const detail = screen.getByRole("region", { name: "Jugadas de la conexión elegida" });
    expect(detail).toHaveTextContent("1/1 con resultado conocido");
    expect(detail).toHaveTextContent("0′ 10″");
    expect(detail).not.toHaveTextContent("26′ 40″");
    fireEvent.keyDown(node, { key: " " });
    expect(node).toHaveAttribute("aria-pressed", "false");
    expect(screen.getByRole("combobox", { name: "Resaltar conexiones de" })).toHaveValue("");
  });
  it("tells the strongest pair and the figures of the sample", () => {
    render(<PassNetworkView matches={[match]} people={people}/>);
    expect(screen.getByRole("heading", { name: "Álex y Bruno, la pareja que más se encuentra" })).toBeVisible();
    expect(screen.getByText(/1 pase de Álex a Bruno y 1 de vuelta/)).toBeVisible();
    const kpis = screen.getByText("pases completados").closest("dl")!;
    expect(kpis).toHaveTextContent("pases completados2");
    expect(kpis).toHaveTextContent("conexiones dirigidas2");
    expect(kpis).toHaveTextContent("partido1");
  });
  it("draws on the pitch when the actas give positions and switches to the ring", () => {
    render(<PassNetworkView matches={[withPositions()]} people={people}/>);
    const views = screen.getByRole("group", { name: "Vistas de esta gráfica" });
    expect(within(views).getByRole("button", { name: "Sobre el campo" })).toHaveAttribute("aria-pressed", "true");
    expect(network()).toHaveClass("pn-wrap--campo");
    const alex = within(network()).getByRole("button", { name: /Resaltar a Álex/ }), bruno = within(network()).getByRole("button", { name: /Resaltar a Bruno/ });
    expect(parseFloat(alex.style.top)).toBeLessThan(parseFloat(bruno.style.top));
    fireEvent.click(within(views).getByRole("button", { name: "En círculo" }));
    expect(network()).toHaveClass("pn-wrap--circulo");
    fireEvent.click(within(network()).getByRole("button", { name: /Resaltar a Bruno/ }));
    expect(screen.getByText("Portero · 50′ en el campo")).toBeVisible();
    expect(screen.getByText("Pases dados por cada 10′").nextSibling).toHaveTextContent("0,2");
  });
  it("falls back to the ring without positions", () => {
    render(<PassNetworkView matches={[match]} people={people}/>);
    expect(screen.queryByRole("group", { name: "Vistas de esta gráfica" })).not.toBeInTheDocument();
    expect(network()).toHaveClass("pn-wrap--circulo");
  });
  it("renders both matches together and keeps each acta in the pair detail", () => {
    const first = structuredClone(match);
    first.analysis!.profile = structuredClone(DEFAULT_ANALYSIS_PROFILE);
    first.analysis!.observations.find(action => action.id === "pass")!.facts.deflected = true;
    const second = structuredClone(first); second.id = "second-match";
    second.analysis!.profile.passes.deflection = "retain";
    const view = render(<PassNetworkView matches={[first, second]} people={people}/>);
    expect(network()).toBeVisible();
    expect(screen.queryByRole("heading", { name: "Aún no se puede dibujar la red" })).not.toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "Bruno a Álex: 2 pases completados. Ver jugadas" }));
    const detail = screen.getByRole("region", { name: "Jugadas de la conexión elegida" });
    expect(detail).toHaveTextContent("2/2 con resultado conocido");
    expect(within(detail).getAllByRole("link").map(link => link.getAttribute("href"))).toEqual(expect.arrayContaining(["/partidos/m/numeros", "/partidos/second-match/numeros"]));
    view.rerender(<PassNetworkView matches={[second, first]} people={people} filters={{ period: 1 }}/>);
    expect(screen.getByRole("button", { name: "Álex a Bruno: 1 pases completados. Ver jugadas" })).toBeVisible();
    expect(screen.queryByRole("button", { name: /Bruno a Álex/ })).not.toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "Álex a Bruno: 1 pases completados. Ver jugadas" }));
    const firstHalfDetail = screen.getByRole("region", { name: "Jugadas de la conexión elegida" });
    expect(firstHalfDetail).toHaveTextContent("1/2 con resultado conocido");
    expect(within(firstHalfDetail).getByText("Fallido")).toBeVisible();
    expect(within(firstHalfDetail).getByText("Completado")).toBeVisible();
  });
  it("recalculates the selected period without leaking old pair evidence", () => {
    const view = render(<PassNetworkView matches={[match]} people={people}/>);
    fireEvent.click(within(screen.getByRole("list", { name: "Conexiones de la red" })).getByRole("button", { name: /Álex a Bruno/ }));
    expect(screen.getByRole("region", { name: "Jugadas de la conexión elegida" })).toBeVisible();
    view.rerender(<PassNetworkView matches={[match]} people={people} filters={{ period: 2 }}/>);
    expect(screen.queryByRole("region", { name: "Jugadas de la conexión elegida" })).not.toBeInTheDocument();
    expect(screen.getByRole("list", { name: "Conexiones de la red" })).toHaveTextContent("Bruno");
    expect(within(screen.getByRole("list", { name: "Conexiones de la red" })).getAllByRole("button")).toHaveLength(1);
  });
  it("resets the chosen pair when the filters change even if the pair still exists", () => {
    const view = render(<PassNetworkView matches={[match]} people={people}/>);
    fireEvent.click(screen.getByRole("button", { name: /Álex a Bruno/ }));
    view.rerender(<PassNetworkView matches={[match]} people={people} filters={{ period: 1 }}/>);
    expect(screen.getByRole("button", { name: /Álex a Bruno/ })).toHaveAttribute("aria-pressed", "false");
    expect(screen.queryByRole("region", { name: "Jugadas de la conexión elegida" })).not.toBeInTheDocument();
  });
  it("forwards the sender to the catalogue and closes the detail", () => {
    const inspect = vi.fn();
    render(<PassNetworkView matches={[match]} people={people} onInspect={inspect}/>);
    fireEvent.click(screen.getByRole("button", { name: /Bruno a Álex/ }));
    fireEvent.click(screen.getByRole("button", { name: "Ver todos los pases completados del emisor ↗" }));
    expect(inspect).toHaveBeenCalledWith("068", "b");
    fireEvent.click(screen.getByRole("button", { name: "Cerrar detalle" }));
    expect(screen.queryByRole("region", { name: "Jugadas de la conexión elegida" })).not.toBeInTheDocument();
  });
  it("shows missing rival identities honestly", () => {
    render(<PassNetworkView matches={[match]} people={people} filters={{ team: "opponent" }}/>);
    expect(screen.getByRole("heading", { name: "Aún no se puede dibujar la red" })).toBeVisible();
    expect(screen.queryByRole("button", { name: /Resaltar a Álex/ })).not.toBeInTheDocument();
  });
});
