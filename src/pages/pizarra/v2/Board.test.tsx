import { act, fireEvent, render, screen, within } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import type { Lineup } from "../formations";
import { demoSquad, lineupOf } from "./testkit";
import { BoardHarness as Harness } from "./testkitBoard";

// The board as a user drives it (no Firebase): a harness session keeps the lineup in state, like the
// real one does between autosaves.

const sq = demoSquad();
const SEVEN = ["evans", "illescas", "tello", "huberoski", "eguzquiza", "almachi", "adrian"];

const cromoButton = (name: string) => screen.getByRole("button", { name: new RegExp("^" + name + ", dorsal") });
const cardOf = (container: HTMLElement, id: string) => container.querySelector(`.cd[data-tok="${id}"]`) as HTMLElement;

afterEach(() => {
  vi.useRealTimers();
});

describe("La pizarra · el tablero", () => {
  it("tap to place: tap an empty slot, then a cromo from the tray", () => {
    const commits: Lineup[] = [];
    render(<Harness initial={lineupOf(["evans", null, "tello", "huberoski", "eguzquiza", "almachi", "adrian"], "2-3-1", sq)} onCommit={(l) => commits.push(l)} />);
    expect(screen.getByText("6/7")).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "Hueco DFC vacío: toca para elegir jugador" }));
    expect(screen.getByRole("heading", { name: "Hueco DFC" })).toBeInTheDocument();
    const tray = screen.getByRole("group", { name: "Hueco DFC" });
    // the best fit for a defence slot comes first: the available natural defender
    const first = within(tray).getAllByRole("button")[0];
    expect(first).toHaveAccessibleName(/^ILLESCAS, dorsal 4/);
    fireEvent.click(first);
    expect(commits.at(-1)?.slots[1].playerId).toBe("illescas");
    expect(cromoButton("ILLESCAS")).toHaveAccessibleName(/ILLESCAS, dorsal 4, DFC/);
    expect(screen.getByText("7/7")).toBeInTheDocument();
    expect(screen.getByText("Listo")).toBeInTheDocument();
  });

  it("tap a cromo, then another: they swap; tapping it again opens his ficha", () => {
    const commits: Lineup[] = [];
    render(<Harness initial={lineupOf(SEVEN, "2-3-1", sq)} onCommit={(l) => commits.push(l)} />);
    fireEvent.click(cromoButton("TELLO"));
    expect(screen.getByText(/TELLO en la mano/, { selector: ".hint span" })).toBeInTheDocument();
    fireEvent.click(cromoButton("ILLESCAS"));
    expect(commits.at(-1)?.slots.map((s) => s.playerId).slice(1, 3)).toEqual(["tello", "illescas"]);
    fireEvent.click(cromoButton("ADRIAN"));
    fireEvent.click(cromoButton("ADRIAN"));
    const ficha = screen.getByRole("dialog", { name: "Ficha de ADRIAN" });
    expect(within(ficha).getByText("PARTIDOS")).toBeInTheDocument();
    fireEvent.click(within(ficha).getByRole("button", { name: "Cerrar" }));
    expect(screen.queryByRole("dialog", { name: "Ficha de ADRIAN" })).not.toBeInTheDocument();
  });

  it("long-press on a pitch cromo opens the fan; Capitán gives him the armband", () => {
    vi.useFakeTimers();
    const commits: Lineup[] = [];
    const { container } = render(<Harness initial={lineupOf(SEVEN, "2-3-1", sq)} onCommit={(l) => commits.push(l)} />);
    const cc = cardOf(container, "tello").querySelector(".cc") as HTMLElement;
    fireEvent.pointerDown(cc, { button: 0, clientX: 100, clientY: 100 });
    act(() => {
      vi.advanceTimersByTime(500);
    });
    const fan = screen.getByRole("dialog", { name: /Menú rápido de TELLO/ });
    fireEvent.click(within(fan).getByRole("button", { name: "Capitán: dar a TELLO" }));
    expect(commits.at(-1)?.roles.captainId).toBe("tello");
    expect(screen.queryByRole("dialog", { name: /Menú rápido/ })).not.toBeInTheDocument();
    expect(cardOf(container, "tello").querySelector(".cc-gal")?.textContent).toBe("C");
    expect(screen.getByText("Capitán: TELLO")).toBeInTheDocument();
    // the click that ends the long press does not count as a tap
    fireEvent.click(cc);
    expect(screen.queryByText(/TELLO en la mano/, { selector: ".hint span" })).not.toBeInTheDocument();
  });

  it("undo rewinds the last change and redo plays it again", () => {
    render(<Harness initial={lineupOf(["evans", null, "tello", "huberoski", "eguzquiza", "almachi", "adrian"], "2-3-1", sq)} />);
    const undoB = screen.getByRole("button", { name: "Deshacer" });
    const redoB = screen.getByRole("button", { name: "Rehacer" });
    expect(undoB).toBeDisabled();
    fireEvent.click(screen.getByRole("button", { name: "Hueco DFC vacío: toca para elegir jugador" }));
    fireEvent.click(within(screen.getByRole("group", { name: "Hueco DFC" })).getAllByRole("button")[0]);
    expect(screen.getByText("7/7")).toBeInTheDocument();
    fireEvent.click(undoB);
    expect(screen.getByText("6/7")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Hueco DFC vacío: toca para elegir jugador" })).toBeInTheDocument();
    expect(redoB).toBeEnabled();
    fireEvent.click(redoB);
    expect(screen.getByText("7/7")).toBeInTheDocument();
    expect(redoB).toBeDisabled();
    // keyboard too
    fireEvent.keyDown(screen.getByRole("button", { name: "Deshacer" }), { key: "z", ctrlKey: true });
    expect(screen.getByText("6/7")).toBeInTheDocument();
    fireEvent.keyDown(screen.getByRole("button", { name: "Deshacer" }), { key: "y", ctrlKey: true });
    expect(screen.getByText("7/7")).toBeInTheDocument();
  });

  it("keyboard: a cromo in the hand moves with the arrows and drops with Enter", () => {
    const commits: Lineup[] = [];
    render(<Harness initial={lineupOf(["evans", null, "tello", "huberoski", "eguzquiza", "almachi", "adrian"], "2-3-1", sq)} onCommit={(l) => commits.push(l)} />);
    const adrian = cromoButton("ADRIAN");
    fireEvent.click(adrian);
    // from the striker, straight down is the centre midfielder: Enter swaps them
    fireEvent.keyDown(adrian, { key: "ArrowDown" });
    expect(screen.getByText("Sobre EGUZQUIZA, MC: Intro para cambiarlos")).toBeInTheDocument();
    fireEvent.keyDown(adrian, { key: "Enter" });
    expect(commits.at(-1)?.slots.map((s) => s.playerId).slice(4)).toEqual(["adrian", "almachi", "eguzquiza"]);
    // Escape lets go of a cromo in the hand
    fireEvent.click(cromoButton("TELLO"));
    fireEvent.keyDown(cromoButton("TELLO"), { key: "Escape" });
    expect(screen.queryByText(/TELLO en la mano/, { selector: ".hint span" })).not.toBeInTheDocument();
  });

  it("read-only: nothing moves, the strip offers a copy", () => {
    vi.useFakeTimers();
    const commits: Lineup[] = [];
    const dup = vi.fn();
    const { container } = render(<Harness initial={lineupOf(["evans", null, "tello", "huberoski", "eguzquiza", "almachi", "adrian"], "2-3-1", sq)} ro onCommit={(l) => commits.push(l)} onDuplicate={dup} />);
    expect(screen.getByText("OFICIAL · SOLO LECTURA")).toBeInTheDocument();
    expect(screen.getByText("Oficial · solo lectura")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Hueco DFC vacío: toca para elegir jugador" })).toBeDisabled();
    expect(screen.getByRole("button", { name: /Sugerir siete/ })).toBeDisabled();
    expect(screen.getByRole("button", { name: "Auto-colocar por posición" })).toBeDisabled();
    expect(screen.getByRole("button", { name: "Deshacer" })).toBeDisabled();
    expect(screen.getByRole("button", { name: "Sistema siguiente" })).toBeDisabled();
    fireEvent.click(cromoButton("TELLO"));
    expect(screen.getByText("Oficial: solo lectura. Duplícalo para editar")).toBeInTheDocument();
    const cc = cardOf(container, "tello").querySelector(".cc") as HTMLElement;
    fireEvent.pointerDown(cc, { button: 0, clientX: 100, clientY: 100 });
    act(() => {
      vi.advanceTimersByTime(600);
    });
    expect(screen.queryByRole("dialog", { name: /Menú rápido/ })).not.toBeInTheDocument();
    expect(container.querySelector(".gs")).toBeNull();
    expect(container.querySelector(".dl-h")).toBeNull();
    expect(commits).toHaveLength(0);
    fireEvent.click(screen.getByRole("button", { name: "Duplicar" }));
    expect(dup).toHaveBeenCalledTimes(1);
  });

  it("«Tu sitio»: your cromo wears the ring and the «Tú» tag", () => {
    const { container } = render(<Harness initial={lineupOf(SEVEN, "2-3-1", sq)} />);
    const me = cardOf(container, "tello");
    expect(me.classList.contains("me")).toBe(true);
    expect(me.querySelector(".cc-me")?.textContent).toBe("Tú");
    expect(cardOf(container, "evans").querySelector(".cc-me")).toBeNull();
  });

  it("the system pill changes the system; the other modes open their panels", () => {
    const commits: Lineup[] = [];
    render(<Harness initial={lineupOf(SEVEN, "2-3-1", sq)} onCommit={(l) => commits.push(l)} />);
    fireEvent.click(screen.getByRole("button", { name: "Sistema siguiente" }));
    expect(commits.at(-1)?.formation).toBe("3-2-1");
    expect(screen.getByRole("button", { name: "Sistema 3-2-1: elegir sistema" })).toBeInTheDocument();
    fireEvent.click(within(screen.getByRole("navigation", { name: "Modos de la pizarra" })).getByRole("button", { name: /Jugadas/ }));
    expect(screen.getByRole("group", { name: "Repetición de la jugada" })).toBeInTheDocument();
    fireEvent.click(within(screen.getByRole("navigation", { name: "Modos de la pizarra" })).getByRole("button", { name: /Dibujar/ }));
    expect(screen.getByRole("group", { name: "Herramienta de dibujo" })).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "La charla: presentar el siete" }));
    expect(screen.getByRole("heading", { name: "El guion" })).toBeInTheDocument();
  });
});
