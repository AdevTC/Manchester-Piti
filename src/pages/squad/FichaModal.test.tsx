import { fireEvent, render, screen, within } from "@testing-library/react";
import type { ReactNode } from "react";
import { afterEach, describe, expect, it, vi } from "vitest";
import type { ClubMatch } from "../../lib/clubData";
import type { PositionSet } from "../../lib/positions";
import { squadRow, type SquadPlayer } from "../../lib/squad";
import { FichaModal } from "./FichaModal";
import { mvpOfFrom } from "../../lib/derived/mvpOf";

// (no MVP results here: the shared reader, empty)
const NO_MVP = mvpOfFrom(new Map(), [], 0);

// The public ficha (/plantilla): «Posición: Pivote» and, under it, «También mediocentro (MC) · central (DFC)». No WebGL: the 3D kit is a stub.

// the kit's canvas stands in as what the real one is to the keyboard and screen readers: a focusable image
vi.mock("../../components/jersey3d/Jersey3D", () => ({ Jersey3D: ({ label }: { label: string }) => <canvas tabIndex={0} role="img" aria-label={label} /> }));
vi.mock("@tanstack/react-router", () => ({ Link: ({ children }: { children?: ReactNode }) => <a>{children}</a> }));

const none = { matchesPlayed: 0, goals: 0, assists: 0, minutes: 0, tracked: 0 };
const open = (p: SquadPlayer) =>
  render(<FichaModal row={squadRow(p, none, Date.UTC(2026, 8, 25))} seasonName="Temporada 1" withStats={false} kit="home" theme="dark" onClose={vi.fn()} onStep={vi.fn()} onCompare={vi.fn()} mvpOf={NO_MVP} />);
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
  render(<FichaModal row={squadRow(erik, none, Date.UTC(2026, 8, 25))} seasonName="Temporada 1" withStats kit="home" theme="dark" onClose={vi.fn()} onStep={vi.fn()} onCompare={vi.fn()} games={games} positions={set} mvpOf={NO_MVP} />);

describe("FichaModal · Posiciones", () => {
  const season = [
    match(1, { erik: row(50, { goals: 1, positionsPlayed: { MCD: 30, MC: 20 }, positionEvents: { MCD: { goals: 1, assists: 0, yellowCards: 0, redCards: 0 } } }) }),
    match(2, { erik: row(50, { assists: 1, positionsPlayed: { MCD: 40, DFC: 10 }, positionEvents: { DFC: { goals: 0, assists: 1, yellowCards: 0, redCards: 0 } }, positionsEstimated: true }) }),
    match(3, { erik: row(50, { positionsPlayed: { LI: 10, LD: 10, MI: 10, MD: 10, EI: 6, ED: 4 } }) }),
  ];

  it("a third tab, «Posiciones», wired like the others", () => {
    withGames(season);
    const tabs = within(screen.getByRole("tablist", { name: "Secciones de la ficha" })).getAllByRole("tab");
    expect(tabs.map((t) => t.getAttribute("aria-label") ?? t.textContent)).toEqual(["Ficha", "Temporada 1", "Posiciones"]);
    // the season tab: its full name, or «Temporada» where three tabs would truncate it (CSS picks one)
    const seasonTab = screen.getByRole("tab", { name: "Temporada 1" });
    expect(seasonTab.querySelector(".lg")).toHaveTextContent("Temporada 1");
    expect(seasonTab.querySelector(".sh")).toHaveTextContent(/^Temporada$/);
    const pos = screen.getByRole("tab", { name: "Posiciones" });
    expect(pos).toHaveAttribute("aria-selected", "false");
    expect(pos).toHaveAttribute("aria-controls", "sq-panel");
    fireEvent.click(pos);
    expect(pos).toHaveAttribute("aria-selected", "true");
    expect(screen.getByRole("tab", { name: "Ficha" })).toHaveAttribute("aria-selected", "false");
    expect(screen.getByRole("tabpanel")).toHaveAttribute("aria-labelledby", "sq-tab-posiciones");
  });

  it("phone: the map with his positions and the season's minutes, then a table of at most 5 positions", () => {
    withGames(season);
    fireEvent.click(screen.getByRole("tab", { name: "Posiciones" }));
    const panel = screen.getByRole("tabpanel");
    expect(within(panel).getByRole("img", { name: /^Dónde ha jugado ERIK en Temporada 1\. Ha jugado de Pivote \(MCD\), 70 minutos; Mediocentro \(MC\), 20 minutos;/ })).toBeInTheDocument();
    expect(within(panel).getByText("Algunos minutos estimados por su posición preferida")).toBeInTheDocument();
    expect(within(panel).getByText(/^Más minutos de/)).toHaveTextContent("Más minutos de Pivote (MCD): 70′ en 2 partidos");
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

describe("FichaModal · Posiciones en escritorio", () => {
  const desk = (matches: boolean) =>
    vi.stubGlobal("matchMedia", (q: string) => ({ matches: matches && q === "(min-width: 900px)", media: q, addEventListener: vi.fn(), removeEventListener: vi.fn() }));
  afterEach(() => vi.unstubAllGlobals());
  const season = [match(1, { erik: row(50, { positionsPlayed: { MC: 40, MCD: 10 } }) })];

  it("puts the map over the shirt's column and keeps the words in the tab, so it fits unscrolled", () => {
    desk(true);
    withGames(season);
    expect(document.querySelector(".sq-pos-stage")).toBeNull();
    expect(screen.getByRole("img", { name: /^Camiseta de ERIK/ }).closest("[inert]")).toBeNull();
    expect(screen.getByRole("button", { name: "Girar la camiseta" })).toBeInTheDocument();
    fireEvent.click(screen.getByRole("tab", { name: "Posiciones" }));
    const stage = document.querySelector(".sq-pos-stage");
    expect(stage).not.toBeNull();
    expect(within(stage as HTMLElement).getByRole("img", { name: /^Dónde ha jugado ERIK en Temporada 1\. Ha jugado de Mediocentro \(MC\), 40 minutos/ })).toBeInTheDocument();
    const panel = screen.getByRole("tabpanel");
    expect(within(panel).queryByRole("img")).toBeNull();
    expect(within(panel).getByText(/^Más minutos de/)).toHaveTextContent("Más minutos de Mediocentro (MC): 40′ en 1 partido");
    expect(within(panel).getByRole("table")).toBeInTheDocument();
    // the shirt's caption and turn button step aside while the map is there
    expect(screen.queryByRole("button", { name: "Girar la camiseta" })).toBeNull();
    // and the shirt under the map is inert: its canvas can't take focus, be announced or turn with the arrows
    const canvas = document.querySelector("canvas")!;
    expect(canvas.closest("[inert]")).not.toBeNull();
    expect(canvas.closest(".sq-stage")).not.toBeNull();
    expect(screen.getByRole("button", { name: "Jugador siguiente" })).toBeInTheDocument();
    fireEvent.click(screen.getByRole("tab", { name: "Ficha" }));
    expect(document.querySelector(".sq-pos-stage")).toBeNull();
    expect(document.querySelector("canvas")!.closest("[inert]")).toBeNull();
  });

  it("phone: the map stays in the tab", () => {
    desk(false);
    withGames(season);
    fireEvent.click(screen.getByRole("tab", { name: "Posiciones" }));
    expect(document.querySelector(".sq-pos-stage")).toBeNull();
    expect(within(screen.getByRole("tabpanel")).getByRole("img")).toBeInTheDocument();
    expect(document.querySelector("canvas")!.closest("[inert]")).toBeNull();
  });
});
