import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import type { MesaView } from "../types";
import { Descanso } from "./Descanso";
import { ev, makeView, player, squad } from "./testkit";

// Descanso: the first half in mirrored bars from the events, «Quién ha jugado» picking the seven of the
// 2ª with projected minutes, «Igualar minutos», and «Arrancar la 2ª» = the subs, then the clock's `second`.

function halftime(): MesaView {
  const { field, bench } = squad(26);
  const pablo = field.find((p) => p.id === "pablo");
  const hugo = { ...bench[0], played: true, minutes: 10, stints: [{ from: 960, to: null }] };
  const pabloOff = pablo ? { ...pablo, minutes: 16, stints: [{ from: 0, to: 960 }], offAt: 16 } : player("pablo", "Pablo", "4");
  const events = [
    ...[2, 4, 7, 9, 11].map((m, i) => ev(`c${i}`, "chance", m)),
    ...[3, 14].map((m, i) => ev(`oc${i}`, "opponent_chance", m)),
    ...[5, 9].map((m, i) => ev(`w${i}`, "woodwork", m)),
    ...[10, 13, 20].map((m, i) => ev(`s${i}`, "save", m, { playerId: "alex" })),
    ...[8, 18, 22].map((m, i) => ev(`f${i}`, "foul", m)),
    ...[4, 6, 12, 16, 21].map((m, i) => ev(`of${i}`, "opponent_foul", m)),
    ev("g1", "goal", 6, { playerId: "mario", playerName: "Mario" }),
    ev("y1", "yellow_card", 12, { playerId: "sergio" }),
    ev("og", "opponent_goal", 15),
  ];
  return makeView({
    field: [...field.filter((p) => p.id !== "pablo"), hugo],
    bench: [pabloOff, bench[1], bench[2]],
    events,
    clock: { phase: "halftime", period: 1, elapsedSeconds: 1560, periodSeconds: 1560, minute: 26, text: "26:00" },
    match: { score: { us: 1, them: 1 } },
  });
}
const mount = (v: MesaView) => render(<div className="mesa"><Descanso view={v} /></div>);
const cta = () => screen.getAllByRole("button").find((b) => b.classList.contains("cta")) as HTMLButtonElement;
const row = (name: string) => screen.getByRole("button", { name: new RegExp(`^${name},`) });

describe("Descanso", () => {
  it("draws the first half from the events", () => {
    mount(halftime());
    expect(screen.getByText(/la 1ª acabó en el 26/)).toBeInTheDocument();
    expect(screen.getByRole("img", { name: "Ocasiones: Piti 5, Atlético Demo 2" })).toBeInTheDocument();
    expect(screen.getByRole("img", { name: "Al palo: Piti 2, Atlético Demo 0" })).toBeInTheDocument();
    expect(screen.getByRole("img", { name: "Paradas de Álex: Piti 3" })).toBeInTheDocument();
    expect(screen.getByRole("img", { name: "Faltas hechas: Piti 3, Atlético Demo 5" })).toBeInTheDocument();
    expect(row("Mario")).toHaveAccessibleName(/26 minutos en la 1ª, 1 gol\. Juega la 2ª: 51 minutos en total/);
    expect(row("Sergio")).toHaveAccessibleName(/amarilla/);
    expect(row("Iván")).toHaveAccessibleName(/sin jugar en la 1ª\. Descansa en la 2ª/);
  });

  it("starts with the seven on the pitch and only allows seven with a keeper", () => {
    mount(halftime());
    expect(cta()).toHaveTextContent("Arrancar la 2ª parte");
    expect(cta()).toBeEnabled();
    fireEvent.click(row("Marcos"));
    expect(cta()).toBeDisabled();
    expect(cta()).toHaveTextContent("Elige el siete: 6 de 7");
    fireEvent.click(row("Iván"));
    expect(cta()).toHaveTextContent("Arrancar con 1 cambio");
    fireEvent.click(row("Álex"));
    fireEvent.click(row("Rubén"));
    expect(cta()).toHaveTextContent("Elige el siete: falta portero");
  });

  it("«Arrancar» sends the subs and then starts the 2ª", async () => {
    const v = halftime();
    mount(v);
    fireEvent.click(row("Marcos"));
    fireEvent.click(row("Iván"));
    fireEvent.click(cta());
    expect(v.actions.add).toHaveBeenCalledWith("substitution", { playerId: "marcos", inPlayerId: "ivan" });
    await Promise.resolve();
    expect(v.actions.clock).toHaveBeenCalledWith("second");
  });

  it("«Igualar minutos» picks the keeper and the six with fewest minutes", async () => {
    const v = halftime();
    mount(v);
    const fair = screen.getByRole("button", { name: "Igualar minutos" });
    expect(fair).toHaveAttribute("aria-pressed", "false");
    fireEvent.click(fair);
    expect(fair).toHaveAttribute("aria-pressed", "true");
    expect(row("Rubén")).toHaveAttribute("aria-pressed", "true");
    expect(row("Pablo")).toHaveAttribute("aria-pressed", "true");
    expect(row("Marcos")).toHaveAttribute("aria-pressed", "false");
    expect(cta()).toHaveTextContent("Arrancar con 3 cambios");
    expect(screen.getByText(/Jugadores de campo/)).toHaveTextContent("Jugadores de campo: de 25′ a 51′");
    fireEvent.click(cta());
    expect(v.actions.add).toHaveBeenCalledTimes(3);
    await Promise.resolve();
    expect(v.actions.clock).toHaveBeenCalledWith("second");
  });
});
