import { fireEvent, render, screen, within } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { Lineup } from "../formations";
import type { CalMatch } from "./boards";
import { CAMS } from "./geometry";
import { boardDoc, demoSquad, lineupOf } from "./testkit";
import { BoardHarness as Harness } from "./testkitBoard";

// Bloque 3 · «convocatoria y oficial» as a user drives it: the versions of the seven (Titular · 2ª parte ·
// Plan B) over the pitch, Comparar and la charla with them; «Mover a…» from the fan; Home / End in la
// charla and the jugadas; the familiarity on the cromos; «El oficial ha cambiado»; «Sin responder».

vi.mock("../../../components/pitch3d/support", () => ({ unsupportedReason: () => "webdriver", supported: () => false }));

const sq = demoSquad();
const SEVEN = ["evans", "illescas", "tello", "huberoski", "eguzquiza", "almachi", "adrian"];
const L7 = (): Lineup => lineupOf(SEVEN, "2-3-1", sq);
const W = 400;
const nav = () => screen.getByRole("navigation", { name: "Herramientas de la pizarra" });
const go = (name: string) => fireEvent.click(within(nav()).getByRole("button", { name: new RegExp("^(nuevo)?" + name + "$") }));
const root = (c: HTMLElement) => c.querySelector(".pzv") as HTMLElement;
const sr = (c: HTMLElement) => (c.querySelector(".pzv .sr") as HTMLElement).textContent?.replace(/[\u200b\u200c]/g, "") ?? "";
const cromoButton = (name: string) => screen.getByRole("button", { name: new RegExp("^" + name + ", dorsal") });
const pills = () => screen.getByRole("group", { name: "Versiones del siete" });
const onPitch = (c: HTMLElement) => Array.from(c.querySelectorAll(".cd[data-tok]")).map((e) => e.getAttribute("data-tok"));

beforeEach(() => {
  localStorage.clear();
  window.history.replaceState(null, "", "/pizarra");
  vi.spyOn(HTMLElement.prototype, "getBoundingClientRect").mockImplementation(function (this: HTMLElement) {
    const fr = this.matches("[data-frame]");
    const h = fr ? W * CAMS.tv.Fh : 0;
    const w = fr ? W : 0;
    return { x: 0, y: 0, left: 0, top: 0, width: w, height: h, right: w, bottom: h, toJSON: () => ({}) } as DOMRect;
  });
});
afterEach(() => {
  vi.restoreAllMocks();
  vi.useRealTimers();
});

describe("3.4 · the versions of the seven", () => {
  it("«+ Plan B» makes a copy of the titular and shows it; its changes stay in it; Titular is still there", () => {
    const commits: Lineup[] = [];
    const { container } = render(<Harness initial={L7()} onCommit={(l) => commits.push(l)} />);
    expect(within(pills()).getByRole("button", { name: "Ver el siete titular" })).toHaveAttribute("aria-pressed", "true");
    fireEvent.click(within(pills()).getByRole("button", { name: /^Crear la versión «Plan B»/ }));
    expect(commits.at(-1)?.variants?.map((v) => v.id)).toEqual(["vb"]);
    expect(within(pills()).getByRole("button", { name: "Ver la versión «Plan B»" })).toHaveAttribute("aria-pressed", "true");
    expect(sr(container)).toMatch(/Versión «Plan B» creada/);
    // TELLO to the bench on Plan B (the fan's «Banquillo»)
    fireEvent.click(cromoButton("TELLO"));
    fireEvent.click(screen.getByRole("button", { name: "Galones y posición de TELLO" }));
    fireEvent.click(screen.getByRole("button", { name: "Mandar al banquillo" }));
    const last = commits.at(-1) as Lineup;
    expect(last.slots.map((s) => s.playerId)).toEqual(SEVEN);
    expect(last.variants?.[0].slots[2].playerId).toBeNull();
    expect(onPitch(container)).not.toContain("tello");
    // back to the titular: TELLO is on its pitch
    fireEvent.click(within(pills()).getByRole("button", { name: "Ver el siete titular" }));
    expect(onPitch(container)).toContain("tello");
    expect(sr(container)).toBe("En el campo: el siete titular");
  });

  it("renamed and removed (with «Deshacer»)", () => {
    const commits: Lineup[] = [];
    render(<Harness initial={L7()} onCommit={(l) => commits.push(l)} />);
    fireEvent.click(within(pills()).getByRole("button", { name: /^Crear la versión «2ª parte»/ }));
    fireEvent.click(screen.getByRole("button", { name: "Renombrar «2ª parte»" }));
    const input = screen.getByRole("textbox", { name: "Nombre de la versión" });
    fireEvent.change(input, { target: { value: "Titular" } });
    fireEvent.keyDown(input, { key: "Enter" });
    expect(screen.getByRole("alert")).toHaveTextContent("Ya hay una versión con ese nombre.");
    fireEvent.change(input, { target: { value: "Con viento" } });
    fireEvent.keyDown(input, { key: "Enter" });
    expect(commits.at(-1)?.variants?.[0].name).toBe("Con viento");
    fireEvent.click(screen.getByRole("button", { name: "Quitar la versión «Con viento»" }));
    expect(commits.at(-1)?.variants).toEqual([]);
    fireEvent.click(screen.getByRole("button", { name: "Deshacer: recuperar la versión «Con viento»" }));
    expect(commits.at(-1)?.variants?.[0].name).toBe("Con viento");
  });

  it("a read-only official with a Plan B: the pills switch (no «+»), and Comparar faces the versions", () => {
    const L = { ...L7(), variants: [{ id: "vb" as const, name: "Plan B", formation: "3-2-1" as const, freeMode: false, slots: L7().slots.map((s, i) => (i === 6 ? { ...s, playerId: "kevin" } : { ...s })), tactics: L7().tactics }] };
    const { container } = render(<Harness initial={L} ro />);
    expect(within(pills()).getAllByRole("button").map((b) => b.textContent)).toEqual(["Titular", "Plan B"]);
    fireEvent.click(within(pills()).getByRole("button", { name: "Ver la versión «Plan B»" }));
    expect(onPitch(container)).toContain("kevin");
    expect(onPitch(container)).not.toContain("adrian");
    go("Comparar");
    const pick = screen.getByRole("combobox", { name: "Tablero con el que comparar" });
    expect(pick).toHaveValue("v:titular");
    expect(within(container.querySelector(".chg .in") as HTMLElement).getAllByRole("listitem").map((li) => li.textContent)).toEqual(["ADRIAN"]);
    expect(within(container.querySelector(".chg .out") as HTMLElement).getAllByRole("listitem").map((li) => li.textContent)).toEqual(["KEVIN"]);
  });

  it("la charla presents the titular (whatever version is on screen); the pills are not over it", () => {
    const L = { ...L7(), variants: [{ id: "vb" as const, name: "Plan B", formation: "2-3-1" as const, freeMode: false, slots: L7().slots.map((s, i) => (i === 6 ? { ...s, playerId: "kevin" } : { ...s })), tactics: L7().tactics }] };
    const { container } = render(<Harness initial={L} />);
    fireEvent.click(within(pills()).getByRole("button", { name: "Ver la versión «Plan B»" }));
    expect(onPitch(container)).toContain("kevin");
    fireEvent.click(screen.getByRole("button", { name: "La charla: presentar el siete" }));
    expect(onPitch(container)).toContain("adrian");
    expect(onPitch(container)).not.toContain("kevin");
    expect(screen.queryByRole("group", { name: "Versiones del siete" })).toBeNull();
    // its running order says the plan comes with Plan B
    expect(container.querySelector(".guion")?.textContent ?? "").toMatch(/Plan B/);
  });
});

describe("3.8 · moving without dragging", () => {
  it("«Mover a…» from the fan: the seven's puestos; one swaps him there, the focus goes back to his cromo", () => {
    const commits: Lineup[] = [];
    const { container } = render(<Harness initial={L7()} onCommit={(l) => commits.push(l)} />);
    fireEvent.click(cromoButton("TELLO"));
    fireEvent.click(screen.getByRole("button", { name: "Galones y posición de TELLO" }));
    fireEvent.click(screen.getByRole("button", { name: "Mover a TELLO a otro puesto: elegir de una lista" }));
    const dlg = screen.getByRole("dialog", { name: /Mover a TELLO/ });
    const opts = within(dlg).getAllByRole("button").filter((b) => b.classList.contains("mv-o"));
    expect(opts).toHaveLength(7);
    expect(document.activeElement).toBe(opts[0]);
    expect(opts[2]).toBeDisabled();
    fireEvent.click(within(dlg).getByRole("button", { name: "Cambiar a TELLO con ADRIAN, DC" }));
    expect(commits.at(-1)?.slots[6].playerId).toBe("tello");
    expect(commits.at(-1)?.slots[2].playerId).toBe("adrian");
    expect(screen.queryByRole("dialog", { name: /Mover a TELLO/ })).toBeNull();
    expect(sr(container)).toMatch(/TELLO por ADRIAN en DC/);
  });

  it("Escape closes «Mover a…» without moving anyone", () => {
    const commits: Lineup[] = [];
    render(<Harness initial={L7()} onCommit={(l) => commits.push(l)} />);
    fireEvent.click(cromoButton("TELLO"));
    fireEvent.click(screen.getByRole("button", { name: "Galones y posición de TELLO" }));
    fireEvent.click(screen.getByRole("button", { name: "Mover a TELLO a otro puesto: elegir de una lista" }));
    const dlg = screen.getByRole("dialog", { name: /Mover a TELLO/ });
    fireEvent.keyDown(dlg, { key: "Escape" });
    expect(screen.queryByRole("dialog", { name: /Mover a TELLO/ })).toBeNull();
    expect(commits).toHaveLength(0);
  });

  it("Home / End: la charla's first and last step, and the page doesn't scroll", () => {
    const { container } = render(<Harness initial={L7()} />);
    fireEvent.click(screen.getByRole("button", { name: "La charla: presentar el siete" }));
    const counter = () => screen.getByRole("img", { name: /^Paso \d+\/\d+/ });
    expect(fireEvent.keyDown(root(container), { key: "End" })).toBe(false);
    expect(counter()).toHaveAccessibleName(/^Paso 17\/17/);
    expect(fireEvent.keyDown(root(container), { key: "Home" })).toBe(false);
    expect(counter()).toHaveAccessibleName("Paso 1/17: sistema");
  });

  it("Home / End: the jugada's first and last paso", () => {
    const { container } = render(<Harness initial={L7()} />);
    go("Jugadas");
    expect(fireEvent.keyDown(root(container), { key: "End" })).toBe(false);
    expect(screen.getByRole("button", { name: /^Repetición:/ })).toHaveAccessibleName(/paso 4 de 4/);
    fireEvent.keyDown(root(container), { key: "Home" });
    expect(screen.getByRole("button", { name: /^Repetición:/ })).toHaveAccessibleName(/paso 1 de 4/);
  });
});

describe("3.7 · familiarity on the cromos", () => {
  const m = (id: string, j: number, played: boolean): CalMatch => ({ id, j, rival: "R" + j, dateMs: j, played, gf: null, ga: null, home: true, venue: "" });
  it("«+» where he has played twice in the officials of played matches, «!» never there and not natural", () => {
    // TELLO (DEF) played MI twice; KEVIN (DEL) never in defence
    const past = ["evans", "illescas", "almachi", "tello", "huberoski", "eguzquiza", "adrian"];
    const officials = [boardDoc("o1", lineupOf(past, "2-3-1", sq), { isOfficial: true, matchId: "p1" }), boardDoc("o2", lineupOf(past, "2-3-1", sq), { isOfficial: true, matchId: "p2" })];
    const now = lineupOf(["evans", "illescas", "kevin", "tello", "huberoski", "eguzquiza", "adrian"], "2-3-1", sq);
    const { container } = render(<Harness initial={now} session={{ officials }} props={{ calendar: [m("p1", 1, true), m("p2", 2, true)] }} />);
    expect(container.querySelector('.cd[data-tok="tello"] .cc-fam')).toHaveTextContent("+");
    expect(cromoButton("TELLO")).toHaveAccessibleName(/ya ha jugado de medio \(2 partidos en el oficial\)/);
    expect(container.querySelector('.cd[data-tok="kevin"] .cc-oop.never')).not.toBeNull();
    expect(cromoButton("KEVIN")).toHaveAccessibleName(/nunca ha jugado de defensa en el oficial/);
    // the ficha's back says where he has lined up
    fireEvent.click(cromoButton("TELLO"));
    fireEvent.click(cromoButton("TELLO"));
    const dlg = screen.getByRole("dialog", { name: "Ficha de TELLO" });
    expect(within(dlg).getByText("En el oficial")).toBeInTheDocument();
    expect(within(dlg).getByText("MED 2")).toBeInTheDocument();
  });

  it("no played official: no marks at all", () => {
    const officials = [boardDoc("o1", L7(), { isOfficial: true, matchId: "f1" })];
    const { container } = render(<Harness initial={lineupOf(["evans", "illescas", "kevin"], "2-3-1", sq)} session={{ officials }} props={{ calendar: [m("f1", 1, false)] }} />);
    expect(container.querySelector(".cc-fam, .cc-oop.never")).toBeNull();
  });
});

describe("3.5 · «El oficial ha cambiado»", () => {
  const off = (seven: string[]) => boardDoc("off", lineupOf(seven, "2-3-1", sq), { isOfficial: true, name: "Oficial J8" });
  it("the first visit only remembers it; after the captain changes it, the banner says who comes in", () => {
    const { container, unmount } = render(<Harness initial={L7()} props={{ official: off(SEVEN) }} />);
    expect(container.querySelector(".ofb")).toBeNull();
    expect(JSON.parse(localStorage.getItem("mp_pizarra_seen7:off") ?? "null")).toEqual(SEVEN);
    unmount();
    const opened: string[] = [];
    const changed = SEVEN.map((x) => (x === "adrian" ? "kevin" : x));
    const r = render(<Harness initial={L7()} session={{ open: (id) => opened.push(id) }} props={{ official: off(changed) }} />);
    const banner = screen.getByRole("group", { name: "Aviso del oficial" });
    expect(banner).toHaveTextContent("El oficial ha cambiado: entra KEVIN por ADRIAN");
    expect(banner).not.toHaveAttribute("aria-live");
    fireEvent.click(within(banner).getByRole("button", { name: "Ver el oficial" }));
    expect(opened).toEqual(["off"]);
    expect(r.container.querySelector(".ofb")).toBeNull();
    expect(JSON.parse(localStorage.getItem("mp_pizarra_seen7:off") ?? "null")).toEqual(changed);
  });

  it("«Vale» puts it away; the captain editing the official never gets it", () => {
    localStorage.setItem("mp_pizarra_seen7:off", JSON.stringify(SEVEN));
    const changed = SEVEN.map((x) => (x === "adrian" ? "kevin" : x));
    const { unmount } = render(<Harness initial={L7()} props={{ official: off(changed) }} />);
    fireEvent.click(screen.getByRole("button", { name: "Vale" }));
    expect(screen.queryByRole("group", { name: "Aviso del oficial" })).toBeNull();
    unmount();
    localStorage.setItem("mp_pizarra_seen7:off", JSON.stringify(SEVEN));
    render(<Harness initial={L7()} session={{ id: "off" }} props={{ official: off(changed) }} />);
    expect(screen.queryByRole("group", { name: "Aviso del oficial" })).toBeNull();
    expect(JSON.parse(localStorage.getItem("mp_pizarra_seen7:off") ?? "null")).toEqual(changed);
  });
});

describe("3.6 · «Sin responder» as a state of its own", () => {
  it("its chip in the convocatoria's head and its filter in «Buscar en la plantilla»", () => {
    const conv = { ...sq, list: sq.list.map((c) => (c.id === "kevin" ? { ...c, cv: "voy" as const } : c.id === "erik" ? { ...c, cv: "duda" as const } : c)) };
    const squad = { ...conv, byId: new Map(conv.list.map((c) => [c.id, c])) };
    const M8: CalMatch = { id: "m8", j: 8, rival: "MAD SKY", dateMs: 0, played: false, gf: null, ga: null, home: true, venue: "" };
    const { container } = render(<Harness initial={L7()} props={{ squad, conv: { match: M8, loading: false, error: false } }} />);
    expect(container.querySelector(".cvn.sin")).toHaveTextContent("10sin responder");
    fireEvent.click(screen.getByRole("button", { name: "Buscar en la plantilla" }));
    const sin = screen.getByRole("button", { name: "Sin responder" });
    fireEvent.click(sin);
    expect(sin).toHaveAttribute("aria-pressed", "true");
    const rows = Array.from(container.querySelectorAll(".cvl .ar[data-tok]")).map((b) => b.getAttribute("data-tok"));
    expect(rows).not.toContain("kevin");
    expect(rows).not.toContain("erik");
    expect(rows).toContain("fer");
  });
});
