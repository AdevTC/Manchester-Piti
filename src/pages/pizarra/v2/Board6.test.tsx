import { act, fireEvent, render, screen, within } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import type { Lineup } from "../formations";
import type { Stroke } from "../drawings";
import { demoSquad, lineupOf } from "./testkit";
import { BoardHarness as Harness } from "./testkitBoard";

// Heavy suite: it renders the whole board in jsdom (1–2 s per test alone); under load it crossed 5 s.
vi.setConfig({ testTimeout: 15_000 });

// Bloque 1 of the audit, as a user meets it: undo that acts on the tool on screen (and never rewinds
// over another tab's change), the galones that leave with their player, the keys that respect what you
// are typing, la charla with holes in the seven, Ajustes' camera, and «Buscar en la plantilla».

vi.mock("../../../components/pitch3d/support", () => ({ unsupportedReason: () => "webdriver", supported: () => false }));

const sq = demoSquad();
const SEVEN = ["evans", "illescas", "tello", "huberoski", "eguzquiza", "almachi", "adrian"];
const L7 = (): Lineup => lineupOf(SEVEN, "2-3-1", sq);
const nav = () => screen.getByRole("navigation", { name: "Herramientas de la pizarra" });
const go = (name: string) => fireEvent.click(within(nav()).getByRole("button", { name: new RegExp("^(nuevo)?" + name + "$") }));
const modo = (c: HTMLElement) => c.querySelector(".pzv")?.getAttribute("data-modo");
const stroke = (id: string): Stroke => ({ id, kind: "pase", color: "sky", points: [{ x: 10, y: 10 }, { x: 30, y: 30 }] });
const cromoButton = (name: string) => screen.getByRole("button", { name: new RegExp("^" + name + ", dorsal") });
const hint = () => document.querySelector(".hint span")?.textContent ?? "";

afterEach(() => {
  vi.useRealTimers();
});

describe("Deshacer acts on the tool on screen", () => {
  it("Ctrl Z outside the siete never rewinds the hidden lineup; in Tableros it does nothing", () => {
    const commits: Lineup[] = [];
    const { container } = render(<Harness initial={L7()} onCommit={(l) => commits.push(l)} />);
    fireEvent.click(screen.getByRole("button", { name: "Sistema siguiente" }));
    expect(commits.at(-1)?.formation).toBe("2-1-2-1");
    const n = commits.length;
    go("Tableros");
    fireEvent.keyDown(document.body, { key: "z", ctrlKey: true });
    expect(commits).toHaveLength(n);
    expect(screen.getByRole("button", { name: "Deshacer" })).toBeDisabled();
    // the Jugadas have their own (nothing edited yet: nothing to undo)
    go("Jugadas");
    fireEvent.keyDown(document.body, { key: "z", ctrlKey: true });
    expect(commits).toHaveLength(n);
    // back on the siete it rewinds the lineup
    go("Siete");
    expect(modo(container)).toBe("editar");
    fireEvent.keyDown(document.body, { key: "z", ctrlKey: true });
    expect(commits.at(-1)?.formation).toBe("2-3-1");
  });

  it("⌘ Z works like Ctrl Z; AltGr (Ctrl + Alt) never undoes", () => {
    const commits: Lineup[] = [];
    render(<Harness initial={L7()} onCommit={(l) => commits.push(l)} />);
    fireEvent.click(screen.getByRole("button", { name: "Sistema siguiente" }));
    const n = commits.length;
    fireEvent.keyDown(document.body, { key: "z", ctrlKey: true, altKey: true });
    expect(commits).toHaveLength(n);
    fireEvent.keyDown(document.body, { key: "z", metaKey: true });
    expect(commits.at(-1)?.formation).toBe("2-3-1");
    fireEvent.keyDown(document.body, { key: "z", metaKey: true, shiftKey: true });
    expect(commits.at(-1)?.formation).toBe("2-1-2-1");
    // ⌘ 1 is the browser's, not a tool
    fireEvent.keyDown(document.body, { key: "3", metaKey: true });
    expect(document.querySelector(".pzv")?.getAttribute("data-modo")).toBe("editar");
  });

  it("Dibujar: undone and redone by stroke id, so a stroke another tab drew meanwhile stays", () => {
    const commits: Lineup[] = [];
    const initial = { ...L7(), drawings: [stroke("a"), stroke("b")] };
    const { rerender } = render(<Harness initial={initial} onCommit={(l) => commits.push(l)} />);
    go("Dibujar");
    fireEvent.click(screen.getByRole("button", { name: "Borrar todos los trazos" }));
    fireEvent.click(within(screen.getByRole("group", { name: "¿Borrar todos los trazos?" })).getByRole("button", { name: /Borrar todo/ }));
    expect(commits.at(-1)?.drawings).toEqual([]);
    // another tab draws «c» meanwhile
    const remote = { ...L7(), drawings: [stroke("c")] };
    rerender(<Harness initial={initial} onCommit={(l) => commits.push(l)} session={{ lineup: remote }} />);
    fireEvent.keyDown(document.body, { key: "z", ctrlKey: true });
    expect(commits.at(-1)?.drawings.map((s) => s.id)).toEqual(["a", "b", "c"]);
    // and Ctrl ⇧ Z / Ctrl Y clears them again, «c» kept
    rerender(<Harness initial={initial} onCommit={(l) => commits.push(l)} session={{ lineup: { ...remote, drawings: commits.at(-1)?.drawings ?? [] } }} />);
    fireEvent.keyDown(document.body, { key: "y", ctrlKey: true });
    expect(commits.at(-1)?.drawings.map((s) => s.id)).toEqual(["c"]);
  });

  it("Jugadas: Ctrl Z undoes the last edit of a jugada (a new one goes), Ctrl ⇧ Z brings it back", () => {
    const commits: Lineup[] = [];
    render(<Harness initial={L7()} onCommit={(l) => commits.push(l)} />);
    go("Jugadas");
    fireEvent.click(screen.getByRole("button", { name: /Nueva jugada/ }));
    expect(commits.at(-1)?.plays).toHaveLength(1);
    const formation = commits.at(-1)?.formation;
    fireEvent.keyDown(document.body, { key: "z", ctrlKey: true });
    expect(commits.at(-1)?.plays).toHaveLength(0);
    expect(commits.at(-1)?.formation).toBe(formation);
    fireEvent.keyDown(document.body, { key: "z", ctrlKey: true, shiftKey: true });
    expect(commits.at(-1)?.plays).toHaveLength(1);
  });

  it("a change from another tab starts the lineup's history again: Deshacer can't put an old lineup over it", () => {
    const commits: Lineup[] = [];
    const { rerender } = render(<Harness initial={L7()} onCommit={(l) => commits.push(l)} />);
    fireEvent.click(screen.getByRole("button", { name: "Sistema siguiente" }));
    expect(screen.getByRole("button", { name: "Deshacer" })).toBeEnabled();
    const n = commits.length;
    const remote = lineupOf(["evans", "illescas", "tello", "huberoski", "eguzquiza", "almachi", "kevin"], "2-1-3", sq);
    rerender(<Harness initial={L7()} onCommit={(l) => commits.push(l)} session={{ lineup: remote }} />);
    expect(screen.getByRole("button", { name: "Deshacer" })).toBeDisabled();
    fireEvent.keyDown(document.body, { key: "z", ctrlKey: true });
    expect(commits).toHaveLength(n);
  });
});

describe("the galones belong to the seven", () => {
  it("sending the captain to the bench says he leaves the captaincy, and Ajustes lists only who is on the pitch", () => {
    vi.useFakeTimers();
    const commits: Lineup[] = [];
    const { container } = render(<Harness initial={{ ...L7(), roles: { captainId: "tello", cornersId: "kevin" } }} onCommit={(l) => commits.push(l)} />);
    const cc = container.querySelector('.cd[data-tok="tello"] .cc') as HTMLElement;
    fireEvent.pointerDown(cc, { button: 0, clientX: 100, clientY: 100 });
    act(() => {
      vi.advanceTimersByTime(500);
    });
    fireEvent.click(within(screen.getByRole("dialog", { name: /Menú rápido de TELLO/ })).getByRole("button", { name: "Mandar al banquillo" }));
    expect(commits.at(-1)?.roles.captainId).toBeUndefined();
    expect(screen.getByText("TELLO deja la capitanía")).toBeInTheDocument();
    go("Ajustes");
    const leg = container.querySelector(".leg") as HTMLElement;
    expect(leg).toHaveTextContent("Capitán · sin asignar");
    // (a stale galón of someone on the bench isn't listed either)
    expect(leg).toHaveTextContent("Córners · sin asignar");
  });
});

describe("keys that respect what you are doing", () => {
  it("Escape in «Buscar en la plantilla» leaves the player in the hand", () => {
    render(<Harness initial={L7()} />);
    fireEvent.click(cromoButton("TELLO"));
    expect(hint()).toMatch(/TELLO en la mano/);
    fireEvent.click(screen.getByRole("button", { name: "Buscar en la plantilla" }));
    const search = screen.getByRole("searchbox", { name: "Buscar jugador" });
    fireEvent.keyDown(search, { key: "Escape" });
    expect(hint()).toMatch(/TELLO en la mano/);
  });
});

describe("«Buscar en la plantilla» finds who is on the pitch too", () => {
  it("lists him with his slot; tapping him puts him in the hand", () => {
    render(<Harness initial={L7()} />);
    fireEvent.click(screen.getByRole("button", { name: "Buscar en la plantilla" }));
    fireEvent.change(screen.getByRole("searchbox", { name: "Buscar jugador" }), { target: { value: "hub" } });
    const on = screen.getByRole("group", { name: "En el campo" });
    fireEvent.click(within(on).getByRole("button", { name: "HUBEROSKI, en el campo de MI: señalarlo" }));
    expect(hint()).toMatch(/HUBEROSKI en la mano/);
  });
});

describe("la charla with holes in the seven", () => {
  it("asks first: «Presentar igualmente» plays it, «Empezar por el plan» starts there, nothing plays meanwhile", () => {
    vi.useFakeTimers();
    const six = lineupOf(["evans", null, "tello", "huberoski", "eguzquiza", "almachi", "adrian"], "2-3-1", sq);
    const { container, unmount } = render(<Harness initial={six} />);
    fireEvent.click(screen.getByRole("button", { name: "La charla: presentar el siete" }));
    const ask = screen.getByRole("group", { name: "Falta 1 en el siete: ¿presentar igualmente?" });
    act(() => {
      vi.advanceTimersByTime(6000);
    });
    expect(screen.getByRole("img", { name: /^Paso 1\/17/ })).toBeInTheDocument();
    fireEvent.click(within(ask).getByRole("button", { name: "Presentar igualmente" }));
    expect(screen.queryByRole("group", { name: /presentar igualmente/ })).toBeNull();
    act(() => {
      vi.advanceTimersByTime(2700);
    });
    expect(screen.getByRole("img", { name: /^Paso 2\/17/ })).toBeInTheDocument();
    unmount();
    // the empty seven: only the plan or back to the siete
    const r = render(<Harness initial={lineupOf([], "2-3-1", sq)} />);
    fireEvent.click(screen.getByRole("button", { name: "La charla: presentar el siete" }));
    const empty = screen.getByRole("group", { name: "El siete está vacío: ¿presentar igualmente?" });
    expect(within(empty).queryByRole("button", { name: "Presentar igualmente" })).toBeNull();
    fireEvent.click(within(empty).getByRole("button", { name: "Empezar por el plan" }));
    expect(screen.getByRole("img", { name: /^Paso 11\/17: el plan/ })).toBeInTheDocument();
    r.unmount();
    // «Completar el siete» goes back to it
    const r2 = render(<Harness initial={six} />);
    fireEvent.click(screen.getByRole("button", { name: "La charla: presentar el siete" }));
    fireEvent.click(screen.getByRole("button", { name: "Completar el siete" }));
    expect(modo(r2.container)).toBe("editar");
    expect(container).toBeDefined();
  });
});

describe("Ajustes · la cámara", () => {
  it("Cámara is TV or Cenital (one pressed); Estadio 3D is its own switch", () => {
    const onPrefs = vi.fn();
    render(<Harness initial={L7()} props={{ onPrefs }} />);
    go("Ajustes");
    const cam = screen.getByRole("group", { name: "Cámara" });
    const opts = within(cam).getAllByRole("button");
    expect(opts.map((b) => b.textContent)).toEqual(["Estadio · TV", "Cenital"]);
    expect(opts.filter((b) => b.getAttribute("aria-pressed") === "true")).toHaveLength(1);
    const v3 = screen.getByRole("button", { name: "Estadio 3D" });
    expect(v3).toHaveClass("tg");
    expect(cam).not.toContainElement(v3);
    fireEvent.click(v3);
    expect(onPrefs).toHaveBeenLastCalledWith({ v3: false });
  });
});
