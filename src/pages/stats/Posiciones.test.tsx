import { cleanup, fireEvent, render, screen, within } from "@testing-library/react";
import type { ReactNode } from "react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { analysePlayer } from "../../lib/clubAnalytics";
import { playerName, type ClubMatch } from "../../lib/clubData";
import { Posiciones } from "./Posiciones";

// /stats › Posiciones: «Por posición» (the club's pitch with the 13 positions, minutes and «el dueño»,
// a sortable table, a selection that lists who played there) and «Por sistema» (record per system).

vi.mock("@tanstack/react-router", () => ({
  Link: ({ children, to, params, className }: { children?: ReactNode; to: string; params?: Record<string, string>; className?: string }) => (
    <a className={className} href={params ? to.replace(/\$(\w+)/g, (_, k: string) => params[k] ?? "") : to}>
      {children}
    </a>
  ),
}));

type Row = NonNullable<ClubMatch["ledger"]>[string];
const row = (minutes: number, extra: Partial<Row> = {}): Row => ({ minutes, started: true, benched: false, notCalled: false, played: minutes > 0, subIn: 0, subOut: 0, dismissed: false, stints: [], exchanges: [], goals: 0, assists: 0, yellowCards: 0, redCards: 0, doubleYellows: 0, penaltyCommitted: 0, penaltyReceived: 0, penaltySaved: 0, penaltyMissed: 0, goalPenalty: 0, goalFreekick: 0, ownGoals: 0, woodwork: 0, ...extra });
const match = (n: number, gf: number, ga: number, system: string | null | undefined, ledger: ClubMatch["ledger"]): ClubMatch => ({ id: "j" + n, seasonId: "t1", rival: "Rival " + n, date: Date.UTC(2026, 8, n), duration: 50, status: "finished", goalsFor: gf, goalsAgainst: ga, events: [], ledger, ...(system === undefined ? {} : { system }) });
const ev = (goals = 0, assists = 0) => ({ goals, assists, yellowCards: 0, redCards: 0 });

const games = [
  match(1, 2, 0, "2-3-1", {
    erik: row(50, { goals: 1, positionsPlayed: { MCD: 50 }, positionEvents: { MCD: ev(1) } }),
    pablo: row(50, { positionsPlayed: { DFC: 50 } }),
    dani: row(50, { assists: 1, positionsPlayed: { DFC: 30, MC: 20 }, positionEvents: { MC: ev(0, 1) } }),
  }),
  match(2, 1, 1, "2-3-1", { erik: row(50, { positionsPlayed: { MCD: 30, MC: 20 } }), pablo: row(50, { positionsPlayed: { DFC: 50 } }) }),
  match(3, 3, 0, "3-2-1", { pablo: row(50, { positionsPlayed: { DC: 50 } }) }),
  match(4, 0, 1, null, { erik: row(50, { positionsPlayed: { MCD: 50 }, positionsEstimated: true }) }),
];
const players = [
  { id: "erik", firstName: "Erik", lastName: "Gómez", shirtName: "ERIK" },
  { id: "pablo", firstName: "Pablo", lastName: "Ruiz", shirtName: "PABLITO" },
  { id: "dani", shirtName: "DANI" },
];
const rowsOf = (gs: ClubMatch[]) => players.map((p) => analysePlayer(p, gs));
const show = (gs: ClubMatch[] = games) => render(<Posiciones games={gs} rows={rowsOf(gs)} nameOf={(p) => playerName(p)} />);
const pitch = () => screen.getByRole("group", { name: /^El campo del club/ });
const spot = (code: string) => within(pitch()).getByRole("button", { name: new RegExp(`^${code} ·`) });
const table = () => screen.getByRole("table", { name: "Minutos por posición" });
const bodyRows = () => within(table()).getAllByRole("row").slice(1);

afterEach(() => vi.restoreAllMocks());

describe("Posiciones · Por posición", () => {
  it("is an st-card with the 13 positions on the pitch", () => {
    show();
    const card = screen.getByRole("region", { name: "¿De quién es cada puesto?" });
    expect(card).toHaveClass("st-card");
    expect(within(pitch()).getAllByRole("button")).toHaveLength(13);
  });

  it("each spot prints its code, minutes and the owner's first name (or his name without one)", () => {
    show();
    expect(spot("MCD")).toHaveTextContent("MCD130′Erik");
    expect(spot("DFC")).toHaveTextContent("DFC130′Pablo");
    // MC: 20′ each — tie by name: DANI before ERIK; Dani has no first name, his name is shown
    expect(spot("MC")).toHaveTextContent("MC40′DANI");
    // label in name: the visible «130′» is inside it
    expect(spot("MCD")).toHaveAccessibleName("MCD · Pivote: 130′, 130 minutos; el dueño, Erik, con 130 minutos");
  });

  it("«1 minuto» in the singular", () => {
    show([match(1, 1, 0, null, { erik: row(1, { positionsPlayed: { MC: 1 } }) })]);
    expect(spot("MC")).toHaveAccessibleName("MC · Mediocentro: 1′, 1 minuto; el dueño, Erik, con 1 minuto");
    expect(spot("LIB")).toHaveAccessibleName("LIB · Líbero: Sin estrenar");
  });

  it("a position nobody played says «Sin estrenar», never «0′»", () => {
    show();
    expect(spot("LIB")).toHaveTextContent("LIBSin estrenar");
    expect(screen.queryByText(/(^|\D)0′/)).toBeNull();
  });

  it("the table lists only played positions: Posición · Min · Jugadores · G · A · Dueño, by minutes", () => {
    show();
    expect(within(table()).getAllByRole("columnheader").map((h) => h.textContent)).toEqual(["Posición", "Min", "Jugadores", "G", "A", "Dueño"]);
    expect(bodyRows().map((r) => within(r).getByRole("rowheader").textContent)).toEqual(["Central (DFC)", "Pivote (MCD)", "Punta (DC)", "Mediocentro (MC)"]);
    expect(within(bodyRows()[0]).getAllByRole("cell").map((c) => c.textContent)).toEqual(["130′", "2", "0", "0", "Pablo"]);
    expect(within(bodyRows()[3]).getAllByRole("cell").map((c) => c.textContent)).toEqual(["40′", "2", "0", "1", "DANI"]);
  });

  it("marks the «Jugadores» column (header and cells) so the phone layout can drop it", () => {
    show();
    expect(within(table()).getByRole("columnheader", { name: "Jugadores" })).toHaveClass("jug");
    expect(bodyRows().every((r) => within(r).getAllByRole("cell")[1].classList.contains("jug"))).toBe(true);
  });

  it("sorts by a column (aria-sort), and back the other way", () => {
    show();
    const posHead = within(table()).getByRole("columnheader", { name: /Posición/ });
    expect(within(table()).getByRole("columnheader", { name: /Min/ })).toHaveAttribute("aria-sort", "descending");
    fireEvent.click(within(posHead).getByRole("button"));
    expect(posHead).toHaveAttribute("aria-sort", "ascending");
    expect(bodyRows().map((r) => within(r).getByRole("rowheader").textContent)).toEqual(["Central (DFC)", "Pivote (MCD)", "Mediocentro (MC)", "Punta (DC)"]);
    fireEvent.click(within(posHead).getByRole("button"));
    expect(posHead).toHaveAttribute("aria-sort", "descending");
    expect(bodyRows()[0]).toHaveTextContent("Punta (DC)");
  });

  it("selecting a spot presses it and its row, and lists that position's players with their minutes", () => {
    show();
    expect(screen.getByText(/Toca un puesto/)).toBeInTheDocument();
    fireEvent.click(spot("DFC"));
    expect(spot("DFC")).toHaveAttribute("aria-pressed", "true");
    expect(within(bodyRows()[0]).getByRole("button")).toHaveAttribute("aria-pressed", "true");
    const list = screen.getByRole("list", { name: "Quién ha jugado de Central (DFC)" });
    expect(within(list).getAllByRole("listitem").map((li) => li.textContent)).toEqual(["PABLITO100′", "DANI30′"]);
    fireEvent.click(spot("DFC"));
    expect(spot("DFC")).toHaveAttribute("aria-pressed", "false");
    expect(screen.queryByRole("list", { name: /Quién ha jugado/ })).toBeNull();
  });

  it("a pick on the pitch brings the detail into view (not on mount, not when unpicking)", () => {
    const scroll = vi.spyOn(Element.prototype, "scrollIntoView");
    show();
    expect(scroll).not.toHaveBeenCalled();
    fireEvent.click(spot("DFC"));
    expect(scroll).toHaveBeenCalledTimes(1);
    expect(scroll.mock.contexts[0]).toHaveClass("st-posd");
    expect(scroll).toHaveBeenCalledWith({ block: "nearest", behavior: "smooth" });
    fireEvent.click(spot("DFC"));
    expect(scroll).toHaveBeenCalledTimes(1);
    scroll.mockRestore();
  });

  it("a season change drops a pick whose position has no minutes there", () => {
    const view = show();
    fireEvent.click(spot("DFC"));
    expect(spot("DFC")).toHaveAttribute("aria-pressed", "true");
    const other = [games[3]]; // only Erik at MCD
    view.rerender(<Posiciones games={other} rows={rowsOf(other)} nameOf={(p) => playerName(p)} />);
    expect(within(pitch()).queryAllByRole("button", { pressed: true })).toHaveLength(0);
    expect(screen.queryByRole("list", { name: /Quién ha jugado/ })).toBeNull();
    // a position that still has minutes stays picked
    fireEvent.click(spot("MCD"));
    view.rerender(<Posiciones games={games} rows={rowsOf(games)} nameOf={(p) => playerName(p)} />);
    expect(spot("MCD")).toHaveAttribute("aria-pressed", "true");
  });

  it("selecting a row presses its spot too", () => {
    show();
    fireEvent.click(within(bodyRows()[1]).getByRole("button", { name: "Pivote (MCD)" }));
    expect(spot("MCD")).toHaveAttribute("aria-pressed", "true");
    expect(within(screen.getByRole("list", { name: "Quién ha jugado de Pivote (MCD)" })).getAllByRole("listitem").map((li) => li.textContent)).toEqual(["ERIK130′"]);
  });

  it("a position nobody played says so when selected", () => {
    show();
    fireEvent.click(spot("LIB"));
    expect(screen.getByText("Nadie ha jugado de Líbero (LIB) en este período.")).toBeInTheDocument();
  });

  it("says in words when some minutes are estimated", () => {
    show();
    expect(screen.getByText(/minutos estimados por la posición preferida en 1 partido sin pizarra oficial/)).toBeInTheDocument();
  });

  it("without minutes by position: the explicit empty copy, no pitch, no table", () => {
    show([match(1, 1, 0, null, { erik: row(50) })]);
    expect(screen.getByText("Aún sin minutos con posición")).toBeInTheDocument();
    expect(screen.queryByRole("group", { name: /^El campo del club/ })).toBeNull();
    expect(screen.queryByRole("table")).toBeNull();
  });
});

describe("Posiciones · Por sistema", () => {
  const sistemas = () => screen.getByRole("region", { name: "El récord de cada sistema" });
  const items = () => within(screen.getByRole("list", { name: "Sistemas jugados" })).getAllByRole("listitem");

  it("one row per system played: name, PJ, G-E-P, GF:GC and pts/partido", () => {
    show();
    expect(sistemas()).toHaveClass("st-card");
    expect(items()).toHaveLength(2);
    expect(items()[0]).toHaveTextContent("2-3-1 · Clásico");
    expect(items()[0]).toHaveTextContent("PJ2");
    expect(items()[0]).toHaveTextContent("G-E-P1-1-0");
    expect(items()[0]).toHaveTextContent("GF:GC3:1");
    expect(items()[0]).toHaveTextContent("2,00pts/partido");
    expect(items()[1]).toHaveTextContent("3-2-1");
    expect(items()[1]).toHaveTextContent("3,00pts/partido");
  });

  it("«Mejor sistema» only for the best points per game with at least 2 played", () => {
    show();
    expect(within(sistemas()).getAllByText("Mejor sistema")).toHaveLength(1);
    expect(within(items()[0]).getByText("Mejor sistema")).toBeInTheDocument();
    cleanup();
    show([games[0], games[2]]); // each system played once
    expect(sistemas()).not.toHaveTextContent("Mejor sistema");
  });

  it("no «Mejor sistema» when the best is 0 points per game", () => {
    show([match(1, 0, 1, "2-3-1", {}), match(2, 0, 2, "2-3-1", {})]);
    expect(items()[0]).toHaveTextContent("0,00pts/partido");
    expect(sistemas()).not.toHaveTextContent("Mejor sistema");
  });

  it("no «Mejor sistema» when two systems played at least twice tie on the best", () => {
    show([match(1, 1, 0, "2-3-1", {}), match(2, 0, 1, "2-3-1", {}), match(3, 2, 0, "3-2-1", {}), match(4, 0, 0, "3-2-1", {}), match(5, 0, 0, "3-2-1", {}), match(6, 0, 3, "3-2-1", {})]);
    // 2-3-1: 3 pts in 2 = 1,50; 3-2-1: 5 pts in 4 = 1,25 → not a tie yet
    expect(sistemas()).toHaveTextContent("Mejor sistema");
    cleanup();
    show([match(1, 1, 0, "2-3-1", {}), match(2, 0, 1, "2-3-1", {}), match(3, 2, 0, "3-2-1", {}), match(4, 0, 2, "3-2-1", {}), match(5, 0, 0, "2-2-2", {})]);
    // 2-3-1 and 3-2-1: 1,50 each
    expect(items().filter((li) => li.textContent?.includes("1,50pts/partido"))).toHaveLength(2);
    expect(sistemas()).not.toHaveTextContent("Mejor sistema");
  });

  it("the footer counts the matches without an official board", () => {
    show();
    expect(within(sistemas()).getByText("1 partido sin pizarra oficial no cuenta aquí")).toBeInTheDocument();
  });

  it("free mode reads «Libre · Sin sistema fijo»", () => {
    show([match(1, 1, 0, "libre", { erik: row(50, { positionsPlayed: { MC: 50 } }) })]);
    expect(items()[0]).toHaveTextContent("Libre · Sin sistema fijo");
  });

  it("empty: «Aún no hay partidos con pizarra oficial», and how many didn't count", () => {
    show([match(1, 1, 0, null, { erik: row(50) }), match(2, 0, 0, undefined, { erik: row(50) })]);
    expect(within(sistemas()).getByText("Aún no hay partidos con pizarra oficial")).toBeInTheDocument();
    expect(within(sistemas()).getByText("2 partidos sin pizarra oficial no cuentan aquí")).toBeInTheDocument();
    expect(screen.queryByRole("list", { name: "Sistemas jugados" })).toBeNull();
  });
});
