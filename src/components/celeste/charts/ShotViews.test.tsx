import { afterEach, describe, expect, it, vi } from "vitest";
import { cleanup, fireEvent, render, screen, within } from "@testing-library/react";
import { DEFAULT_ANALYSIS_PROFILE } from "../../../../functions/src/narrated/types";
import type { ClubMatch } from "../../../lib/clubData";
import { ShotViews } from "./ShotViews";

vi.mock("@tanstack/react-router", () => ({ Link: ({ children, params }: { children: React.ReactNode; params: { matchId: string } }) => <a href={`/partidos/${params.matchId}/numeros`}>{children}</a> }));
const people = [{ id: "a", name: "Álex", number: 7 }, { id: "b", name: "Bruno", number: 10 }];
const match: ClubMatch = { id: "m", seasonId: "s", rival: "Orduña", date: Date.UTC(2026, 9, 18, 10), status: "finished", duration: 50, starters: ["a", "b"], analysis: { version: 2, revision: 0, profile: DEFAULT_ANALYSIS_PROFILE, coverage: [{ family: "*", team: "us", state: "complete" }], observations: [
  { id: "first", kind: "context", team: "us", period: 1, order: 0, facts: { intervalStart: 0, intervalEnd: 1500 } },
  { id: "second", kind: "context", team: "us", period: 2, order: 1, facts: { intervalStart: 1500, intervalEnd: 3000 } },
  { id: "pass", kind: "pass", team: "us", actorId: "a", receiverId: "b", period: 1, order: 2, time: { from: 10, to: 10, precision: "exact" }, facts: { outcome: "complete" } },
  { id: "return", kind: "pass", team: "us", actorId: "b", receiverId: "a", period: 2, order: 3, time: { from: 1600, to: 1600, precision: "exact" }, facts: { outcome: "complete" } },
  { id: "shot", kind: "shot", team: "us", actorId: "a", period: 2, order: 4, time: { from: 1800, to: 1800, precision: "exact" }, facts: { outcome: "off_target" } },
] } };
/** The same match with a fuller shot story: a goal, a save, a block, and two rival shots. */
const rich: ClubMatch = structuredClone(match);
rich.analysis!.coverage.push({ family: "*", team: "opponent", state: "complete" });
rich.analysis!.observations.push(
  { id: "goal", kind: "goal", team: "us", actorId: "b", period: 1, order: 5, time: { from: 300, to: 300, precision: "exact" }, facts: { goal: true, outcome: "goal", onTarget: true } },
  { id: "saved", kind: "shot", team: "us", actorId: "b", period: 1, order: 6, time: { from: 600, to: 600, precision: "exact" }, facts: { outcome: "saved", onTarget: true } },
  { id: "block", kind: "shot", team: "us", actorId: "a", period: 1, order: 7, time: { from: 900, to: 900, precision: "exact" }, facts: { outcome: "blocked", outsideArea: true } },
  { id: "r1", kind: "shot", team: "opponent", period: 1, order: 8, time: { from: 400, to: 400, precision: "exact" }, facts: { outcome: "off_target" } },
  { id: "r2", kind: "goal", team: "opponent", period: 2, order: 9, time: { from: 2100, to: 2160, precision: "interval" }, facts: { goal: true, outcome: "goal", onTarget: true } },
);
afterEach(cleanup);

describe("Remates (ShotViews)", () => {
  it("keeps the shot list contract: labelled rows, the value in <strong>, evidence and the catalogue link", () => {
    const inspect = vi.fn();
    render(<ShotViews matches={[match]} people={people} filters={{ period: 2 }} onInspect={inspect}/>);
    const bars = screen.getByRole("list", { name: "Remates por resultado" });
    expect(within(bars).getByRole("button", { name: /^Remates/ }).querySelector("strong")).toHaveTextContent(/^1$/);
    expect(within(bars).getByRole("button", { name: /^Remates/ })).toHaveAttribute("aria-pressed", "true");
    const fuera = within(bars).getByRole("button", { name: /^Fuera/ });
    expect(fuera.querySelectorAll("strong")).toHaveLength(1);
    fireEvent.click(fuera);
    expect(fuera).toHaveAttribute("aria-pressed", "true");
    expect(screen.getByRole("region", { name: "Jugadas del resultado de remate" })).toHaveTextContent("30′");
    fireEvent.click(screen.getByRole("button", { name: "Ver cómo se calcula ↗" }));
    expect(inspect).toHaveBeenCalledWith("031");
  });
  it("draws each shot once in the goal, by how it ended, and the chips filter them", () => {
    render(<ShotViews matches={[rich]} people={people}/>);
    expect(screen.getByRole("heading", { name: "1 gol en 4 remates: uno de cada 4" })).toBeVisible();
    const goal = screen.getByRole("group", { name: "Cada remate, en la zona de cómo acabó" });
    const dots = within(goal).getAllByRole("button");
    expect(dots.map(dot => dot.getAttribute("aria-label")!.split(" · ")[0]).sort()).toEqual(["Bloqueado", "Fuera", "Gol", "Parado"]);
    expect(within(goal).getByRole("button", { name: /^Bloqueado · Álex .* desde fuera del área$/ })).toHaveClass("is-ring");
    fireEvent.click(within(screen.getByRole("group", { name: "Resaltar por resultado" })).getByRole("button", { name: /^Goles/ }));
    expect(within(goal).getByRole("button", { name: /^Parado/ })).toHaveClass("is-dim");
    const detail = screen.getByRole("region", { name: "Remates elegidos" });
    expect(detail).toHaveTextContent("Goles");
    fireEvent.click(within(goal).getByRole("button", { name: /^Fuera/ }));
    expect(screen.getByRole("region", { name: "Remates elegidos" })).toHaveTextContent("Remate elegido");
    expect(screen.getByRole("region", { name: "Remates elegidos" })).toHaveTextContent("30′");
    fireEvent.click(screen.getByRole("button", { name: "Cerrar detalle" }));
    expect(screen.getByRole("region", { name: "Jugadas del resultado de remate" })).toBeVisible();
  });
  it("shows the funnel with the goal-per-shot-on-target line", () => {
    render(<ShotViews matches={[rich]} people={people}/>);
    fireEvent.click(screen.getByRole("button", { name: "Embudo" }));
    const funnel = screen.getByRole("group", { name: "De todos los remates a los goles" });
    expect(within(funnel).getByRole("button", { name: /^A puerta: 2/ })).toBeVisible();
    expect(funnel).toHaveTextContent("Gol por tiro a puerta: 50 %");
    fireEvent.click(within(funnel).getByRole("button", { name: /^Bloqueados: 1/ }));
    expect(screen.getByRole("region", { name: "Remates elegidos" })).toHaveTextContent("Bloqueados");
    expect(screen.getByRole("region", { name: "Remates elegidos" })).toHaveTextContent("Jugadas de esta muestra (1)");
  });
  it("puts both teams on one timeline with the halves labelled", () => {
    render(<ShotViews matches={[rich]} people={people} filters={{ playerIds: ["a"] }}/>);
    fireEvent.click(screen.getByRole("button", { name: "Minutos" }));
    const plot = screen.getByRole("group", { name: "Remates de los dos equipos a lo largo del partido" });
    expect(within(plot).getAllByRole("button", { name: /^Piti:/ })).toHaveLength(2);
    expect(within(plot).getAllByRole("button", { name: /^Orduña:/ })).toHaveLength(2);
    expect(within(plot).getByRole("button", { name: /^Orduña: Gol/ })).toHaveClass("is-gol", "is-them");
    expect(plot).toHaveTextContent("1.ª parte");
    expect(plot).toHaveTextContent("2.ª parte");
    expect(screen.getByRole("heading", { name: "Los dos rematan lo mismo: 2 a 2" })).toBeVisible();
    expect(screen.queryByRole("list", { name: "Remates por resultado" })).not.toBeInTheDocument();
  });
  it("lists shooters with their outcomes and opens a player's shots", () => {
    const inspect = vi.fn();
    render(<ShotViews matches={[rich]} people={people} onInspect={inspect}/>);
    fireEvent.click(screen.getByRole("button", { name: "Quién" }));
    const list = screen.getByRole("list", { name: "Remates por jugador" });
    const rows = within(list).getAllByRole("button");
    expect(rows.map(row => row.getAttribute("aria-label"))).toEqual(["Álex: 2 remates. Ver jugadas", "Bruno: 2 remates. Ver jugadas"]);
    expect(rows[1]).toHaveTextContent("1 gol · 2 a puerta");
    fireEvent.click(rows[1]);
    const detail = screen.getByRole("region", { name: "Remates elegidos" });
    expect(detail).toHaveTextContent("Bruno");
    expect(detail).toHaveTextContent("Jugadas de esta muestra (2)");
    fireEvent.click(within(detail).getByRole("button", { name: "Ver sus remates en la tabla ↗" }));
    expect(inspect).toHaveBeenCalledWith("029", "b");
  });
  it("groups the rival's shots in one row and names the rival in the headline", () => {
    render(<ShotViews matches={[rich]} people={people} filters={{ team: "opponent" }}/>);
    expect(screen.getByRole("heading", { name: "Orduña: 1 gol en 2 remates: uno de cada 2" })).toBeVisible();
    fireEvent.click(screen.getByRole("button", { name: "Quién" }));
    expect(within(screen.getByRole("list", { name: "Remates por jugador" })).getAllByRole("button").map(row => row.getAttribute("aria-label"))).toEqual(["Orduña: 2 remates. Ver jugadas"]);
  });
  it("shows an empty state but keeps the honest figures when there are no shots", () => {
    render(<ShotViews matches={[match]} people={people} filters={{ period: 1 }}/>);
    expect(screen.getByRole("heading", { name: "Sin remates en esta selección" })).toBeVisible();
    expect(within(screen.getByRole("list", { name: "Remates por resultado" })).getByRole("button", { name: /^Fuera/ }).querySelector("strong")).toHaveTextContent(/^0$/);
  });
  it("opens exactly the non-overlapping woodwork and saved branches of the funnel", () => {
    const game = structuredClone(rich);
    game.analysis!.observations.find(event => event.id === "goal")!.facts.woodwork = true;
    game.analysis!.observations.push(
      { id: "post", kind: "shot", team: "us", actorId: "a", period: 1, order: 10, facts: { outcome: "woodwork" } },
      { id: "save-post", kind: "shot", team: "us", actorId: "b", period: 1, order: 11, facts: { outcome: "saved", onTarget: true, woodwork: true } },
    );
    render(<ShotViews matches={[game]} people={people}/>);
    fireEvent.click(screen.getByRole("button", { name: "Embudo" }));
    const funnel = screen.getByRole("group", { name: "De todos los remates a los goles" });
    expect(within(funnel).getByRole("button", { name: /^A puerta: 3/ })).toBeVisible();
    expect(within(funnel).queryByRole("button", { name: /^Sin precisar/ })).not.toBeInTheDocument();
    fireEvent.click(within(funnel).getByRole("button", { name: /^A la madera: 1/ }));
    expect(screen.getByRole("region", { name: "Remates elegidos" })).toHaveTextContent("Jugadas de esta muestra (1)");
    fireEvent.click(within(funnel).getByRole("button", { name: /^Parados: 2/ }));
    expect(screen.getByRole("region", { name: "Remates elegidos" })).toHaveTextContent("Jugadas de esta muestra (2)");
    fireEvent.click(screen.getByRole("button", { name: "Quién" }));
    expect(within(screen.getByRole("list", { name: "Remates por jugador" })).getByRole("button", { name: /^Bruno:/ })).toHaveTextContent("1 gol · 3 a puerta");
  });
  it("does not invent a zero precision or an inside-area location for an unknown shot", () => {
    const game = structuredClone(match);
    game.analysis!.observations.find(event => event.id === "shot")!.facts = {};
    render(<ShotViews matches={[game]} people={people}/>);
    expect(screen.getByText(/a puerta \(sin precisar\)/)).toBeVisible();
    expect(screen.getByText("desde fuera, con zona conocida").nextElementSibling).toHaveTextContent("-");
    expect(screen.getByText("Zona registrada en 0 de 1 remates; los demás no se suponen dentro del área.")).toBeVisible();
  });
  it("states the known-location sample instead of treating unlocated shots as inside the area", () => {
    render(<ShotViews matches={[rich]} people={people}/>);
    expect(screen.getByText("desde fuera, con zona conocida").nextElementSibling).toHaveTextContent("100 %");
    expect(screen.getByText("Zona registrada en 1 de 4 remates; los demás no se suponen dentro del área.")).toBeVisible();
  });
  it("labels a canonical goal as a goal without requiring an extra outcome field", () => {
    const game = structuredClone(match);
    game.events = [{ id: "canonical-goal", type: "goal", playerId: "a", minute: 12 }];
    render(<ShotViews matches={[game]} people={people}/>);
    const detail = screen.getByRole("region", { name: "Jugadas del resultado de remate" });
    const goal = within(detail).getByText("Gol · Álex").closest("li")!;
    expect(goal.querySelector("small")).toHaveTextContent(/^Gol$/);
    expect(goal).not.toHaveTextContent("Resultado sin precisar");
  });
  it("keeps unplottable shots in the timeline total with an explanation", () => {
    const game = structuredClone(rich);
    game.analysis!.observations = game.analysis!.observations.filter(event => event.kind !== "context");
    render(<ShotViews matches={[game]} people={people}/>);
    fireEvent.click(screen.getByRole("button", { name: "Minutos" }));
    const plot = screen.getByRole("group", { name: "Remates de los dos equipos a lo largo del partido" });
    expect(within(plot).queryAllByRole("button")).toHaveLength(0);
    expect(screen.getByText(/6 remates no se dibujan:/)).toHaveTextContent("sin límites de parte registrados");
    expect(screen.getByRole("heading", { name: "El Piti remata más: 4 a 2" })).toBeVisible();
  });

});
