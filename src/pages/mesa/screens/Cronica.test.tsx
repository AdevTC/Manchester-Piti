import { fireEvent, render, screen, within } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import type { MesaEvent, MesaView } from "../types";
import { Cronica } from "./Cronica";
import { ev, makeView } from "./testkit";

// Lo que va pasando: the filters and their counts (a pending duplicate is shown, not counted), the
// duplicate card («Es el mismo gol» deletes the later play, «Son dos goles» marks it dupOk), «···» →
// Borrar / Corregir (a patch with only what changed), authors and «corregido por».

const EVENTS: MesaEvent[] = [
  ev("e1", "chance", 2, { text: "Ocasión de Sergio", playerId: "sergio" }),
  ev("e2", "opponent_chance", 3, { text: "Ocasión del Atlético", byUid: "u-david", byName: "David", mine: false }),
  ev("e3", "goal", 6, { text: "Gol de Mario", playerId: "mario", playerName: "Mario", assistId: "dani", assistName: "Dani" }),
  ev("e4", "foul", 8, { text: "Falta de Dani", playerId: "dani" }),
  ev("e5", "yellow_card", 12, { text: "Amarilla a Sergio", playerId: "sergio", editedByUid: "u-david", editedByName: "David" }),
  ev("e6", "substitution", 17, { text: "Entra Hugo por Pablo", playerId: "pablo", inPlayerId: "hugo" }),
  ev("e7", "goal", 19, { text: "Gol de Mario", playerId: "mario", playerName: "Mario", elapsedSeconds: 1152 }),
  ev("dup", "goal", 19, { text: "Gol de Mario", playerId: "mario", playerName: "Mario", elapsedSeconds: 1156, dupOf: "e7", byUid: "u-david", byName: "David", mine: false }),
];
const view = (extra: Partial<MesaView> = {}) => makeView({ events: EVENTS, clock: { phase: "first", playing: true, minute: 20, text: "19:20" }, match: { score: { us: 2, them: 0 }, pendingDuplicates: 1 }, ...extra });
const mount = (v: MesaView) => render(<div className="mesa"><Cronica view={v} /></div>);

describe("Lo que va pasando", () => {
  it("counts by filter, skipping the pending duplicate, and filters the record", () => {
    mount(view());
    const filters = screen.getByRole("group", { name: "Filtrar jugadas" });
    expect(within(filters).getByRole("button", { name: "Todo, 7 jugadas" })).toHaveAttribute("aria-pressed", "true");
    expect(within(filters).getByRole("button", { name: "Goles, 2 goles" })).toBeInTheDocument();
    expect(within(filters).getByRole("button", { name: "Tarjetas, 1 tarjeta" })).toBeInTheDocument();
    fireEvent.click(within(filters).getByRole("button", { name: "Goles, 2 goles" }));
    const list = screen.getByRole("list", { name: /Jugadas del partido/ });
    expect(within(list).queryByText("Falta de Dani")).toBeNull();
    expect(within(list).getAllByText("Gol de Mario")).toHaveLength(3);
    expect(within(list).getByText("por confirmar")).toBeInTheDocument();
  });

  it("shows authors, the assist and «corregido por»", () => {
    mount(view());
    expect(screen.getByText("Lo apuntaste tú, pase de Dani")).toBeInTheDocument();
    expect(screen.getAllByText("Lo apuntó David").length).toBeGreaterThan(0);
    expect(screen.getByText("corregido por David")).toBeInTheDocument();
    expect(screen.getByText("David también está apuntando")).toBeInTheDocument();
  });

  it("«Es el mismo gol» deletes the later play", () => {
    const v = view();
    mount(v);
    const card = screen.getByRole("alert");
    expect(card).toHaveTextContent("¿Es la misma jugada?");
    expect(within(card).getByLabelText("4 segundos de diferencia")).toBeInTheDocument();
    fireEvent.click(within(card).getByRole("button", { name: "Es el mismo gol" }));
    expect(v.actions.remove).toHaveBeenCalledWith("dup");
  });

  it("«Son dos goles» keeps both and stops asking", () => {
    const v = view();
    mount(v);
    fireEvent.click(screen.getByRole("button", { name: "Son dos goles" }));
    expect(v.actions.edit).toHaveBeenCalledWith("dup", { dupOk: true });
  });

  it("«···» → Borrar deletes any play", () => {
    const v = view();
    mount(v);
    fireEvent.click(screen.getByRole("button", { name: "Opciones de Falta de Dani, minuto 8" }));
    expect(screen.getByRole("button", { name: "Cerrar opciones de Falta de Dani, minuto 8" })).toHaveAttribute("aria-expanded", "true");
    fireEvent.click(screen.getAllByRole("button", { name: /Borrar/ }).find((b) => b.tabIndex === 0) as HTMLElement);
    expect(v.actions.remove).toHaveBeenCalledWith("e4");
  });

  it("Corregir changes the player, the type and the minute in one patch", () => {
    const v = view();
    mount(v);
    fireEvent.click(screen.getByRole("button", { name: "Opciones de Falta de Dani, minuto 8" }));
    fireEvent.click(screen.getAllByRole("button", { name: /Corregir/ }).find((b) => b.tabIndex === 0) as HTMLElement);
    const sheet = screen.getByRole("dialog");
    fireEvent.click(within(within(sheet).getByRole("group", { name: "Qué fue" })).getByRole("button", { name: "Le hacen falta" }));
    fireEvent.click(within(within(sheet).getByRole("group", { name: "Quién" })).getByRole("button", { name: "4 Pablo" }));
    fireEvent.click(within(sheet).getByRole("button", { name: "Un minuto antes" }));
    fireEvent.click(within(sheet).getByRole("button", { name: "Guardar" }));
    expect(v.actions.edit).toHaveBeenCalledWith("e4", { type: "foul_received", playerId: "pablo", elapsedSeconds: 6 * 60 + 10 });
    expect(screen.queryByRole("dialog")).toBeNull();
  });

  it("Corregir with nothing changed just closes; Escape closes too", () => {
    const v = view();
    mount(v);
    fireEvent.click(screen.getByRole("button", { name: "Opciones de Gol de Mario, minuto 6" }));
    fireEvent.click(screen.getAllByRole("button", { name: /Corregir/ }).find((b) => b.tabIndex === 0) as HTMLElement);
    expect(within(screen.getByRole("dialog")).getByRole("group", { name: "Pase de" })).toBeInTheDocument();
    fireEvent.keyDown(window, { key: "Escape" });
    expect(screen.queryByRole("dialog")).toBeNull();
    expect(v.actions.edit).not.toHaveBeenCalled();
  });

  it("splits the record by half and goes back to the mesa", () => {
    const v = view({ events: [...EVENTS, ev("s1", "corner", 30, { text: "Córner de Mario", period: 2 })] });
    v.match.clock = { ...v.match.clock, period: 2, phase: "second", kickoffAt: new Date(2026, 9, 18, 10, 32).getTime(), secondAt: new Date(2026, 9, 18, 11, 3).getTime() };
    v.match.round = 7;
    mount(v);
    expect(screen.getByText("Jornada 7, contra Atlético Demo")).toBeInTheDocument();
    const items = within(screen.getByRole("list", { name: /Jugadas del partido/ })).getAllByRole("listitem").map((li) => li.textContent ?? "");
    expect(items[0]).toContain("Córner de Mario");
    expect(items[1]).toContain("Empieza la 2ª parte a las 11:03");
    expect(items[items.length - 1]).toContain("Pitido inicial a las 10:32");
    fireEvent.click(screen.getByRole("button", { name: "Volver a la mesa" }));
    expect(v.nav.mesa).toHaveBeenCalled();
  });
});
