import { act, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { MesaView } from "../types";
import { Final, HOLD_MS } from "./Final";
import { ev, makeView } from "./testkit";

// Final: the site's G·E·P badge, goals with inline assists, «Antes de publicar» deciding whether the acta
// can go out, the press-and-hold publish (pointer and keyboard; an early release cancels with a hint),
// the published state, and «Reabrir el partido» behind a second tap.

const ended = (extra: Partial<MesaView["match"]> = {}) =>
  makeView({
    events: [
      ev("g1", "goal", 6, { playerId: "mario", playerName: "Mario", assistId: "pablo", assistName: "Pablo" }),
      ev("o1", "opponent_goal", 15),
      ev("g2", "goal", 19, { playerId: "mario", playerName: "Mario" }),
      ev("g3", "goal", 33, { playerId: "sergio", playerName: "Sergio", period: 2 }),
      ev("o2", "opponent_goal", 40, { period: 2 }),
    ],
    clock: { phase: "ended", period: 2, minute: 52, elapsedSeconds: 3120 },
    match: { score: { us: 3, them: 2 }, ...extra },
  });
const mount = (v: MesaView) => render(<div className="mesa"><Final view={v} /></div>);
const hold = () => screen.getByRole("button", { name: /Publicar el acta/ });

describe("Final", () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });
  afterEach(() => {
    vi.useRealTimers();
  });

  it("shows the result with the G·E·P badge and the goals with their assists", () => {
    mount(ended());
    const badge = screen.getByRole("img", { name: "G, victoria" });
    expect(badge).toHaveClass("pt-res", "G");
    expect(screen.getByRole("heading", { level: 1 })).toHaveTextContent("Victoria");
    expect(screen.getByText("asist. Pablo")).toBeInTheDocument();
    expect(screen.getAllByText("¿Le dio el pase alguien?")).toHaveLength(2);
    expect(screen.getByText("2 goles sin asistencia, opcional")).toBeInTheDocument();
    expect(screen.getByText("FINAL").parentElement).toHaveTextContent("52′");
    expect(screen.getByRole("button", { name: "Ver las 5 jugadas" })).toBeInTheDocument();
  });

  it("answers assists inline and publishes them after a one-second hold", async () => {
    const v = ended();
    mount(v);
    fireEvent.click(screen.getByRole("group", { name: "¿Quién le dio el pase a Mario en el 19′?" }).querySelector("button") as HTMLElement);
    expect(screen.getByText("1 gol sin asistencia, opcional")).toBeInTheDocument();
    fireEvent.click(screen.getAllByRole("button", { name: "Nadie" }).find((b) => b.tabIndex === 0) as HTMLElement);
    expect(screen.getByText("Asistencias completas")).toBeInTheDocument();
    fireEvent.pointerDown(hold(), { button: 0 });
    await act(async () => {
      vi.advanceTimersByTime(HOLD_MS + 60);
    });
    expect(v.actions.publish).toHaveBeenCalledWith({ g2: "alex", g3: "" });
    expect(screen.getAllByText("Acta publicada").length).toBeGreaterThan(0);
    expect(screen.getByText(/Publicada por ti a las/)).toBeInTheDocument();
    expect(screen.getByRole("list", { name: "Ya actualizado" })).toBeInTheDocument();
  });

  it("an early release cancels with a hint", () => {
    const v = ended();
    mount(v);
    fireEvent.pointerDown(hold(), { button: 0 });
    act(() => {
      vi.advanceTimersByTime(400);
    });
    expect(screen.getByText("Sigue… suelta para cancelar")).toBeInTheDocument();
    fireEvent.pointerUp(hold());
    expect(screen.getByText("Mantenlo un segundo; no se ha publicado")).toBeInTheDocument();
    act(() => {
      vi.advanceTimersByTime(2000);
    });
    expect(v.actions.publish).not.toHaveBeenCalled();
  });

  it("holding Enter publishes too", async () => {
    const v = ended();
    mount(v);
    fireEvent.keyDown(hold(), { key: "Enter" });
    await act(async () => {
      vi.advanceTimersByTime(HOLD_MS + 60);
    });
    expect(v.actions.publish).toHaveBeenCalledWith({});
  });

  it("a pending duplicate or queued plays block publishing", () => {
    const v = ended({ pendingDuplicates: 1 });
    v.queue = { ...v.queue, pending: 2, online: false };
    mount(v);
    expect(screen.getByText("1 duda entre anotadores")).toBeInTheDocument();
    expect(screen.getByText("2 jugadas siguen en el móvil")).toBeInTheDocument();
    expect(document.querySelector(".fine")).toHaveTextContent("Antes: 2 jugadas siguen en el móvil");
    expect(hold()).toHaveAttribute("aria-disabled", "true");
    fireEvent.pointerDown(hold(), { button: 0 });
    act(() => {
      vi.advanceTimersByTime(HOLD_MS * 2);
    });
    expect(v.actions.publish).not.toHaveBeenCalled();
  });

  it("a failed publish says so and can be retried", async () => {
    const v = ended();
    v.actions.publish = vi.fn(async () => {
      throw new Error("no");
    });
    v.notice = "No se ha podido publicar: falta red";
    mount(v);
    fireEvent.pointerDown(hold(), { button: 0 });
    await act(async () => {
      vi.advanceTimersByTime(HOLD_MS + 60);
    });
    expect(screen.getByText("No se ha podido publicar: falta red")).toBeInTheDocument();
    expect(hold()).toBeInTheDocument();
  });

  it("once published: sealed, the acta on the web, no reopening", () => {
    const v = ended({ published: true });
    mount(v);
    expect(screen.getByText("Final, acta publicada")).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: /Publicar el acta/ })).toBeNull();
    expect(screen.queryByRole("button", { name: /Reabrir/ })).toBeNull();
    expect(screen.queryByText("¿Le dio el pase alguien?")).toBeNull();
    fireEvent.click(screen.getByRole("button", { name: /Ver el acta en la web/ }));
    expect(v.nav.exit).toHaveBeenCalled();
  });

  it("«Reabrir el partido» asks for a second tap", () => {
    const v = ended();
    mount(v);
    fireEvent.click(screen.getByRole("button", { name: "Reabrir el partido" }));
    expect(v.actions.reopen).not.toHaveBeenCalled();
    fireEvent.click(screen.getByRole("button", { name: "¿Reabrir? Toca otra vez" }));
    expect(v.actions.reopen).toHaveBeenCalled();
    fireEvent.click(screen.getByRole("button", { name: "Ver las 5 jugadas" }));
    expect(v.nav.cronica).toHaveBeenCalled();
  });
});
