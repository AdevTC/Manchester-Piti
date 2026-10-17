import { fireEvent, render, screen, within } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { Cromo } from "../../pizarra/v2/model";
import type { Llegada } from "../useLlegada";
import type { MesaView } from "../types";
import { LlegadaView } from "./Llegada";
import { makeView, T0 } from "./testkit";

// «¿Quién ha venido?» as the scorer drives it: the count on the LED, a toggle per convocado with the
// pizarra's data, the note and the gold CTA to the pizarra «desde la mesa», and the save states.
vi.mock("../useLlegada", () => ({ useLlegada: vi.fn() }));

const cromo = (id: string, rt: number, pos: Cromo["pos"]): Cromo => ({
  id, num: 1, name: id, rt, pos, recentMin: 0, recentGA: 0, stats: { played: 2, goals: 0, assists: 0, minutes: 60, starts: 2, mvps: 0 },
});

function data(present: string[], extra: Partial<Llegada> = {}): Llegada {
  return {
    squad: new Map([["alex", cromo("alex", 65, "POR")], ["mario", cromo("mario", 64, "DEL")]]),
    conv: new Map([["alex", "voy"], ["mario", "duda"], ["ivan", "no"]]),
    loading: false,
    present,
    toggle: vi.fn(),
    save: "idle",
    error: "",
    retry: vi.fn(),
    ...extra,
  };
}
const mount = (v: MesaView, d: Llegada, onBack = vi.fn()) => render(<div className="mesa"><LlegadaView view={v} data={d} onBack={onBack} /></div>);

describe("¿Quién ha venido?", () => {
  beforeEach(() => {
    vi.useFakeTimers();
    vi.setSystemTime(T0 - 10 * 60 * 1000);
  });
  afterEach(() => vi.useRealTimers());

  it("counts who has come and toggles a convocado", () => {
    const d = data(["alex", "mario"]);
    mount(makeView(), d);
    expect(screen.getByText("de 10 convocados")).toBeInTheDocument();
    expect(screen.getByRole("timer")).toHaveTextContent("FALTAN10:00");
    const alex = screen.getByRole("button", { name: /^Álex, POR, forma 65/ });
    expect(alex).toHaveAttribute("aria-pressed", "true");
    expect(within(alex).getByText("Ha venido")).toBeInTheDocument();
    const ivan = screen.getByRole("button", { name: /^Iván,/ });
    expect(ivan).toHaveAttribute("aria-pressed", "false");
    expect(within(ivan).getByText("Dijo que no viene")).toBeInTheDocument();
    expect(screen.getByText("Dijeron que no o no contestaron")).toBeInTheDocument();
    fireEvent.click(ivan);
    expect(d.toggle).toHaveBeenCalledWith("ivan");
  });

  it("keeps the CTA off until seven have come", () => {
    const v = makeView();
    mount(v, data(["alex", "mario"]));
    expect(screen.getByRole("button", { name: /Faltan 5/ })).toBeDisabled();
    expect(screen.getByText("Faltan 5 para el siete")).toBeInTheDocument();
  });

  it("with seven or more, the CTA opens the pizarra on the official board; a missing keeper is said", () => {
    const v = makeView({ match: { officialBoard: "b1" } });
    const { unmount } = mount(v, data(["alex", "mario", "sergio", "dani", "marcos", "pablo", "david", "hugo"], { save: "saved" }));
    expect(screen.getByText("1 al banquillo").parentElement).toHaveTextContent("8 para elegir · 1 al banquillo");
    expect(screen.getByText("Guardado")).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "Elegir el siete en la pizarra" }));
    expect(v.nav.pizarra).toHaveBeenCalledWith("b1");
    unmount();
    mount(makeView(), data(["mario", "sergio", "dani", "marcos", "pablo", "david", "hugo"]));
    expect(screen.getByText("no ha venido ningún portero")).toBeInTheDocument();
  });

  it("shows a failed save with «Reintentar»", () => {
    const d = data(["alex"], { save: "error", error: "El servidor aún no sabe guardar la lista (falta setMatchPresent). Lo marcado se queda en esta pantalla." });
    mount(makeView(), d);
    expect(screen.getByRole("alert")).toHaveTextContent("falta setMatchPresent");
    fireEvent.click(screen.getByRole("button", { name: "Reintentar" }));
    expect(d.retry).toHaveBeenCalled();
  });

  it("goes back to the previa", () => {
    const back = vi.fn();
    mount(makeView(), data([]), back);
    fireEvent.click(screen.getByRole("button", { name: "Volver a la previa" }));
    expect(back).toHaveBeenCalled();
  });
});
