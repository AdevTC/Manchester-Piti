import { act, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { MesaView } from "../types";
import { Antes } from "./Antes";
import { makeView, T0 } from "./testkit";

// Antes del pitido as the scorer drives it: the countdown to the scheduled kick-off, the seven and the
// bench, the checklist («Cambiar» → the pizarra, «Probar aviso» vibrates), «Pitar el inicio» → the clock's
// start, and the lower third's «Deshacer» → reset.

const mount = (v: MesaView) => render(<div className="mesa"><Antes view={v} /></div>);

describe("Antes del pitido", () => {
  beforeEach(() => {
    vi.useFakeTimers();
    vi.setSystemTime(T0 - (12 * 60 + 4) * 1000);
    Object.defineProperty(navigator, "vibrate", { value: vi.fn(() => true), configurable: true });
  });
  afterEach(() => {
    vi.useRealTimers();
  });

  it("counts down to kick-off and shows the seven and the bench", () => {
    mount(makeView());
    expect(screen.getByRole("timer")).toHaveTextContent("FALTAN12:04");
    act(() => {
      vi.advanceTimersByTime(2000);
    });
    expect(screen.getByRole("timer")).toHaveTextContent("12:02");
    expect(screen.getByRole("group", { name: "El siete en el campo: Mario, Sergio, Dani, Marcos, Pablo, David y Álex de portero" })).toBeInTheDocument();
    expect(screen.getByRole("group", { name: "Banquillo: Hugo, Rubén y Iván" })).toBeInTheDocument();
    expect(screen.getByText("Tres en la banda")).toBeInTheDocument();
    expect(screen.getByText("Pablo (tú) y David anotan")).toBeInTheDocument();
    expect(screen.getByRole("heading", { level: 1 })).toHaveTextContent(/listo para pitar/);
  });

  it("«Cambiar» opens the pizarra and «Probar aviso» vibrates and latches", () => {
    const v = makeView();
    mount(v);
    fireEvent.click(screen.getByRole("button", { name: "Cambiar" }));
    expect(v.nav.pizarra).toHaveBeenCalled();
    fireEvent.click(screen.getByRole("button", { name: /Probar aviso/ }));
    expect(navigator.vibrate).toHaveBeenCalledWith([40, 60, 40]);
    expect(screen.getByRole("status")).toHaveTextContent("Probado");
    expect(screen.queryByRole("button", { name: /Probar aviso/ })).toBeNull();
  });

  it("«Pitar el inicio» starts the clock; «Deshacer» resets it", () => {
    const v = makeView();
    const { rerender } = mount(v);
    fireEvent.click(screen.getByRole("button", { name: /Pitar el inicio/ }));
    expect(v.actions.clock).toHaveBeenCalledWith("start");
    // The server answers: the clock runs.
    const live = makeView({ clock: { phase: "first", playing: true, text: "00:03", periodSeconds: 3, elapsedSeconds: 3 } });
    live.actions = v.actions;
    rerender(<div className="mesa"><Antes view={live} /></div>);
    expect(screen.getByText(/Pitido inicial a las/)).toBeInTheDocument();
    expect(screen.getByRole("heading", { level: 1 })).toHaveTextContent("Ya se juega");
    fireEvent.click(screen.getByRole("button", { name: "Deshacer" }));
    expect(v.actions.clock).toHaveBeenCalledWith("reset");
  });

  it("the lower third leaves after nine seconds and «Ir a la mesa» goes to the scoring screen", () => {
    const v = makeView();
    const { rerender } = mount(v);
    fireEvent.click(screen.getByRole("button", { name: /Pitar el inicio/ }));
    const live = makeView({ clock: { phase: "first", playing: true } });
    rerender(<div className="mesa"><Antes view={live} /></div>);
    act(() => {
      vi.advanceTimersByTime(10_000);
    });
    expect(screen.queryByRole("button", { name: "Deshacer" })).toBeNull();
    fireEvent.click(screen.getByRole("button", { name: /Ir a la mesa/ }));
    expect(live.nav.mesa).toHaveBeenCalled();
  });

  it("says where the seven comes from: the official board with its system, or the convocatoria", () => {
    const { unmount } = mount(makeView({ match: { lineup: { fromBoard: true, system: "2-3-1 · Clásico" }, round: 7 } }));
    expect(screen.getByText("El siete de la pizarra")).toBeInTheDocument();
    expect(screen.getByText("2-3-1 · Clásico · Siete de siete titulares")).toBeInTheDocument();
    expect(screen.getByText("Jornada 7, liga")).toBeInTheDocument();
    unmount();
    mount(makeView());
    expect(screen.getByText("El siete de la convocatoria")).toBeInTheDocument();
    expect(screen.getByText("Convocatoria · Siete de siete titulares")).toBeInTheDocument();
    expect(screen.getByText("Liga")).toBeInTheDocument();
  });

  it("an incomplete seven is flagged without colour alone", () => {
    const base = makeView();
    mount(makeView({ field: base.field.slice(0, 6) }));
    expect(screen.getByText("Convocatoria · 6 de siete titulares")).toBeInTheDocument();
    expect(screen.getByRole("heading", { level: 1 })).toHaveTextContent("Casi listo para pitar");
  });
});
