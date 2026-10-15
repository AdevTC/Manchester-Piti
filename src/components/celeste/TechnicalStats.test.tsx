import { act, fireEvent, render, screen, within } from "@testing-library/react";
import { createMemoryHistory, createRootRoute, createRoute, createRouter, RouterProvider } from "@tanstack/react-router";
import { z } from "zod";
import { describe, expect, it, vi } from "vitest";
import type { ClubMatch, MatchEvent } from "../../lib/clubData";

// The game-analysis panel (match tab «Estadísticas», the jugador page, /stats › Análisis del juego).
// Characterisation: one narrated match whose every number was read off the panel before it was
// rewritten in house style; the rewrite must print the same numbers. Real router (memory history) for
// the names' links; the club data is stubbed: no Firebase.

const PLAYERS = [
  { id: "p1", shirtName: "PEPE", seasons: ["t1"], number: 1 },
  { id: "p2", shirtName: "JUAN", seasons: ["t1"], number: 7 },
  { id: "p3", shirtName: "LUIS", seasons: ["t1"], number: 9 },
];
vi.mock("../../lib/clubData", async (orig) => ({ ...(await orig<typeof import("../../lib/clubData")>()), useClubData: () => ({ matches: [], players: PLAYERS, loading: false, error: null }) }));

const EVENTS: MatchEvent[] = [
  { id: "e1", type: "pass", outcome: "complete", playerId: "p1", receiverId: "p2", minute: 2 },
  { id: "e2", type: "pass", outcome: "complete", playerId: "p1", receiverId: "p2", minute: 3 },
  { id: "e3", type: "pass", outcome: "complete", playerId: "p2", receiverId: "p3", minute: 4, delivery: "long" },
  { id: "e4", type: "pass", outcome: "incomplete", playerId: "p2", minute: 6 },
  { id: "e5", type: "pass", outcome: "unknown", playerId: "p3", timingUnknown: true },
  { id: "e6", type: "cross", outcome: "complete", playerId: "p3", receiverId: "p2", minute: 8, keyPass: true },
  { id: "e7", type: "shot", outcome: "on_target", playerId: "p2", minute: 9, x: 50, y: 20, zone: "center" },
  { id: "e8", type: "shot", outcome: "off_target", playerId: "p3", minute: 21, zone: "left" },
  { id: "e9", type: "goal", playerId: "p2", assistPlayerId: "p3", minute: 30, x: 48, y: 12, zone: "center" },
  { id: "e10", type: "shot", outcome: "blocked", team: "opponent", minute: 14, x: 40, y: 30, zone: "right" },
  { id: "e11", type: "opponent_goal", minute: 41 },
  { id: "e12", type: "tackle", outcome: "won", playerId: "p1", minute: 11 },
  { id: "e13", type: "tackle", outcome: "unknown", playerId: "p1", minute: 12 },
  { id: "e14", type: "interception", playerId: "p1", minute: 15 },
  { id: "e15", type: "possession", possessionSeconds: 30, minute: 16 },
  { id: "e16", type: "possession", team: "opponent", possessionSeconds: 20, minute: 17 },
  { id: "e17", type: "pass", outcome: "complete", team: "opponent", minute: 18 },
  { id: "e18", type: "shot", outcome: "off_target", playerId: "p1" },
];
const MATCH: ClubMatch = { id: "m1", seasonId: "t1", rival: "Rival", date: Date.UTC(2026, 8, 1, 10), duration: 50, status: "finished", goalsFor: 1, goalsAgainst: 1, starters: ["p1", "p2", "p3"], analysisCoverage: "partial", events: EVENTS };
const PEOPLE = PLAYERS.map((p) => ({ id: p.id, name: p.shirtName, number: p.number }));

const { TechnicalStatsPanel } = await import("./TechnicalStats");

async function view(props: Partial<Parameters<typeof TechnicalStatsPanel>[0]> = {}) {
  const ui = <TechnicalStatsPanel matches={[MATCH]} people={PEOPLE} {...props} />;
  const root = createRootRoute({ validateSearch: z.object({ season: z.string().optional().catch("all") }), component: () => ui });
  const jugador = createRoute({ getParentRoute: () => root, path: "/jugadores/$playerId", component: () => null });
  const router = createRouter({ routeTree: root.addChildren([jugador]), history: createMemoryHistory({ initialEntries: ["/"] }) });
  render(<RouterProvider router={router} />);
  await act(() => router.load());
  return screen.findByRole("region", { name: "Estadísticas detalladas" });
}

/** A KPI's label, value and detail, as read. */
const kpi = (label: string) => screen.getByText(label).parentElement?.textContent;
/** The comparison card (title «… y el rival»). */
const compareCard = () => screen.getByRole("heading", { name: /y el rival$/ }).closest("section") as HTMLElement;
/** A comparison row's two numbers: ours, the rival's. */
const compared = (label: string) => within(compareCard()).getByText(label).parentElement?.textContent?.match(/\d+|—/g);
const rankCard = () => screen.getByRole("heading", { name: "Quién destaca" }).closest("section") as HTMLElement;
const ranking = () => within(within(rankCard()).getByRole("list")).getAllByRole("listitem").map((li) => li.textContent);
const rowsOf = (table: HTMLElement) => within(table).getAllByRole("row").slice(1).map((r) => [...r.querySelectorAll("th, td")].map((c) => c.textContent));
const allPlayers = () => rowsOf(screen.getByRole("table", { name: /^Ordenados por/ }));
const connections = () => rowsOf(screen.getByRole("table", { name: /^Conexiones dirigidas/ }));
const zone = (z: string) => screen.getByText(z).parentElement?.textContent;
/** The shots per 5′ slice, from each slice's title («10–15 min: 1 …»). */
const timeline = () => screen.getAllByTitle(/^\d+–\d+ min: /).map((el) => Number(/: (\d+)/.exec(el.getAttribute("title") ?? "")?.[1]));
/** Presses an option of one of the panel's segmented controls (st-seg). */
const choose = (group: string, option: string) => fireEvent.click(within(screen.getByRole("group", { name: group })).getByRole("button", { name: option }));

// (Before the rewrite the two-way controls were selects and the family filter a nav; a few lines changed
// their words on purpose — «1 acción», «1 gol en 4 remates», «El Piti y el rival» — every number is the
// one the old panel printed.)
describe("TechnicalStatsPanel · the numbers (characterisation)", () => {
  it("the whole team: KPIs, coverage, network, shots and the passing family", async () => {
    await view();
    expect(screen.getByText(/0 de 1 actas con narración completa · 1 acción sin minuto/)).toBeInTheDocument();
    expect(kpi("Precisión de pase")).toBe("Precisión de pase80,0%4 / 5 con resultado conocido · 1 sin resultado");
    expect(kpi("Remates a puerta")).toBe("Remates a puerta50,0%2 / 4 con destino conocido");
    expect(kpi("Conversión")).toBe("Conversión25,0%1 gol en 4 remates");
    expect(kpi("Entradas ganadas")).toBe("Entradas ganadas100,0%1 / 1 con resultado conocido · 1 sin resultado");

    expect(connections()).toEqual([
      ["PEPE", "JUAN", "2"],
      ["JUAN", "LUIS", "1"],
      ["LUIS", "JUAN", "1"],
    ]);
    expect(screen.getByText("Conexiones dirigidas · 3 parejas")).toBeInTheDocument();

    expect(screen.getByText("2 de 4 remates con coordenadas. Ataque hacia arriba.")).toBeInTheDocument();
    expect([zone("Izquierda"), zone("Centro"), zone("Derecha")]).toEqual(["Izquierda1", "Centro2", "Derecha—"]);
    expect(timeline()).toEqual([0, 1, 0, 0, 1, 0, 1, 0, 0, 0, 0]);
    expect(screen.getByText("1 remate sin minuto queda fuera de esta gráfica.")).toBeInTheDocument();

    expect(compared("Pases intentados")).toEqual(["6", "1"]);
    expect(compared("Pases completados")).toEqual(["4", "1"]);
    expect(compared("Pases fallados")).toEqual(["1", "—"]);
    expect(compared("Pases recibidos")).toEqual(["4", "—"]);
    expect(compared("Pases clave")).toEqual(["1", "—"]);
    expect(compared("Pases largos")).toEqual(["1", "—"]);
    expect(compared("Centros")).toEqual(["1", "—"]);
    expect(compared("Centros completados")).toEqual(["1", "—"]);
    expect(screen.getByText(/Posesión cronometrada: El Piti 60,0% · 30 s \/ el rival 20 s/)).toBeInTheDocument();

    expect(ranking()).toEqual(["1. PEPE2", "2. JUAN1", "2. LUIS1"]);
    expect(allPlayers()).toEqual([
      ["1 · PEPE", "2", "2", "—", "—", "—", "—", "—", "—", "100,0%"],
      ["7 · JUAN", "2", "1", "1", "3", "—", "1", "—", "—", "50,0%"],
      ["9 · LUIS", "2", "1", "—", "1", "1", "—", "1", "1", "100,0%"],
    ]);
  });

  it("the rival's shots, the crosses network and the shooting family", async () => {
    await view();
    choose("Equipo de remates", "El rival");
    choose("Tipo de conexiones", "Centros");
    choose("Familias de estadísticas", "Remate");

    expect(connections()).toEqual([["LUIS", "JUAN", "1"]]);
    expect(screen.getByText("1 de 2 remates con coordenadas. Ataque hacia arriba.")).toBeInTheDocument();
    expect([zone("Izquierda"), zone("Centro"), zone("Derecha")]).toEqual(["Izquierda—", "Centro—", "Derecha1"]);
    expect(timeline()).toEqual([0, 0, 1, 0, 0, 0, 0, 0, 1, 0, 0]);
    expect(screen.queryByText(/sin minuto quedan? fuera/)).toBeNull();

    expect(compared("Remates")).toEqual(["4", "2"]);
    expect(compared("A puerta")).toEqual(["2", "1"]);
    expect(compared("Fuera")).toEqual(["2", "—"]);
    expect(compared("Remates bloqueados")).toEqual(["—", "1"]);
    expect(compared("Al palo")).toEqual(["—", "—"]);
    expect(compared("Goles de remate")).toEqual(["1", "1"]);
    expect(compared("Ocasiones")).toEqual(["—", "—"]);

    expect(ranking()).toEqual(["1. JUAN2", "2. LUIS1", "2. PEPE1"]);
    expect(allPlayers()).toEqual([
      ["7 · JUAN", "2", "2", "—", "—", "—", "1", "—"],
      ["9 · LUIS", "1", "—", "1", "—", "—", "—", "—"],
      ["1 · PEPE", "1", "—", "1", "—", "—", "—", "—"],
    ]);
  });

  it("one player (the jugador page's start): his KPIs and his side of the comparison", async () => {
    await view({ initialPlayer: "p2" });
    expect(kpi("Precisión de pase")).toBe("Precisión de pase50,0%1 / 2 con resultado conocido · 0 sin resultado");
    expect(kpi("Remates a puerta")).toBe("Remates a puerta100,0%2 / 2 con destino conocido");
    expect(kpi("Conversión")).toBe("Conversión50,0%1 gol en 2 remates");
    expect(kpi("Entradas ganadas")).toBe("Entradas ganadas—0 / 0 con resultado conocido · 0 sin resultado");
    expect(screen.getByRole("heading", { name: "JUAN y el rival" })).toBeInTheDocument();
    expect(compared("Pases intentados")).toEqual(["2", "1"]);
    expect(compared("Pases recibidos")).toEqual(["3", "—"]);
    expect(connections()).toEqual([
      ["PEPE", "JUAN", "2"],
      ["JUAN", "LUIS", "1"],
      ["LUIS", "JUAN", "1"],
    ]);
  });
});

describe("TechnicalStatsPanel · in the house style", () => {
  it("speaks like the rest of the site: «El Piti y el rival», and «Cobertura parcial» says what it means", async () => {
    await view();
    expect(screen.getByRole("heading", { name: "El Piti y el rival" })).toBeInTheDocument();
    expect(screen.queryByText(/Piti y rival/)).toBeNull();
    const coverage = screen.getByText("Cobertura parcial").closest("p");
    expect(coverage).toHaveTextContent(/^Cobertura parcial · No todas las jugadas están apuntadas: las cifras cuentan solo lo apuntado\.$/);
  });

  it("a fully narrated acta reads «Análisis completo»", async () => {
    await view({ matches: [{ ...MATCH, analysisCoverage: "complete" }] });
    expect(screen.getByText("Análisis completo").closest("p")).toHaveTextContent("Análisis completo · Cada jugada está apuntada.");
    expect(screen.queryByText("Cobertura parcial")).toBeNull();
  });

  it("names lead to the player's page, in the season given", async () => {
    await view({ seasonId: "t1" });
    const table = screen.getByRole("table", { name: /^Ordenados por/ });
    expect(within(table).getByRole("link", { name: "JUAN" })).toHaveAttribute("href", "/jugadores/p2?season=t1");
    const pairs = screen.getByRole("table", { name: /^Conexiones dirigidas/ });
    expect(within(pairs).getAllByRole("link", { name: "PEPE" })[0]).toHaveAttribute("href", "/jugadores/p1?season=t1");
  });

  it("without a season (or «all»), a clean link; the chosen player's name in the comparison links too", async () => {
    await view({ initialPlayer: "p3", seasonId: "all" });
    expect(within(screen.getByRole("heading", { name: "LUIS y el rival" })).getByRole("link", { name: "LUIS" })).toHaveAttribute("href", "/jugadores/p3");
  });

  it("ours and the rival's are told apart in words, not by colour alone", async () => {
    await view();
    const card = compareCard();
    // the legend names both sides, and every number says whose it is to a screen reader
    expect(within(card).getByText("El Piti")).toBeInTheDocument();
    expect(within(card).getByText("El rival")).toBeInTheDocument();
    expect(within(card).getByText("Pases intentados").parentElement).toHaveTextContent("El Piti: 6Pases intentadosEl rival: 1");
    // the shots' side is a pressed button with its name
    const sides = screen.getByRole("group", { name: "Equipo de remates" });
    expect(within(sides).getByRole("button", { name: "El Piti" })).toHaveAttribute("aria-pressed", "true");
    choose("Equipo de remates", "El rival");
    expect(within(sides).getByRole("button", { name: "El rival" })).toHaveAttribute("aria-pressed", "true");
  });

  it("the map's tooltips read in Spanish, and its legend tells a goal from a shot", async () => {
    await view();
    const map = screen.getByRole("img", { name: "Mapa de remates con posición registrada" });
    expect(within(map).getByText("JUAN · 9′ · A puerta (parado)")).toBeInTheDocument();
    expect(within(map).getByText("JUAN · 30′ · Gol")).toBeInTheDocument();
    expect(screen.getByText("Gol", { selector: ".st-legend span" })).toBeInTheDocument();
  });

  it("is built from the stats pages' cards and segmented controls", async () => {
    const panel = await view();
    expect(panel.querySelectorAll(".st-card").length).toBeGreaterThanOrEqual(4);
    expect(screen.getByRole("group", { name: "Familias de estadísticas" })).toHaveClass("st-seg");
    expect(within(screen.getByRole("group", { name: "Familias de estadísticas" })).getByRole("button", { name: "Pases y creación" })).toHaveAttribute("aria-pressed", "true");
  });
});
