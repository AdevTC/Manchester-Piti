import { fireEvent, render, screen, within } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
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
    expect(v.actions.addMany).toHaveBeenCalledWith([{ type: "substitution", playerId: "marcos", inPlayerId: "ivan" }]);
    expect(v.actions.add).not.toHaveBeenCalled();
    await Promise.resolve();
    expect(v.actions.clock).toHaveBeenCalledWith("second");
  });

  it("«Los cambios» says who each one comes on for and where he plays; a tap swaps the places", async () => {
    const v = halftime();
    v.field = v.field.map((p) => ({ ...p, pos: ({ alex: "POR", mario: "DC", sergio: "MC", dani: "DFC", marcos: "DFC", david: "MD", hugo: "MI" } as Record<string, string>)[p.id] ?? null }));
    mount(v);
    expect(screen.queryByRole("region", { name: "Los cambios de la 2ª" })).toBeNull();
    fireEvent.click(row("Marcos"));
    fireEvent.click(row("Mario"));
    fireEvent.click(row("Iván"));
    fireEvent.click(row("Rubén"));
    const card = screen.getByRole("region", { name: "Los cambios de la 2ª" });
    const ivan = within(card).getByRole("radiogroup", { name: "¿Por quién entra Iván?" });
    // by default the places in pitch order: Iván for Mario (DC), Rubén for Marcos (DFC)
    expect(within(ivan).getByRole("radio", { name: "DC por Mario" })).toHaveAttribute("aria-checked", "true");
    fireEvent.click(within(ivan).getByRole("radio", { name: "DFC por Marcos" }));
    expect(within(within(card).getByRole("radiogroup", { name: "¿Por quién entra Iván?" })).getByRole("radio", { name: "DFC por Marcos" })).toHaveAttribute("aria-checked", "true");
    expect(within(within(card).getByRole("radiogroup", { name: "¿Por quién entra Rubén?" })).getByRole("radio", { name: "DC por Mario" })).toHaveAttribute("aria-checked", "true");
    fireEvent.click(cta());
    expect(v.actions.addMany).toHaveBeenCalledWith(expect.arrayContaining([{ type: "substitution", playerId: "marcos", inPlayerId: "ivan" }, { type: "substitution", playerId: "mario", inPlayerId: "ruben" }]));
    await Promise.resolve();
    expect(v.actions.clock).toHaveBeenCalledWith("second");
  });

  it("a red in the 1ª: the seventh fills the hueco of the one sent off", async () => {
    const v = halftime();
    const dani = v.field.find((p) => p.id === "dani")!;
    v.field = v.field.filter((p) => p.id !== "dani");
    v.bench = [...v.bench, { ...dani, sentOff: true, stints: [{ from: 0, to: 600 }], vacancy: { spot: null, code: "DFC" } }];
    mount(v);
    expect(cta()).toHaveTextContent("Elige el siete: 6 de 7");
    fireEvent.click(row("Iván"));
    const card = screen.getByRole("region", { name: "Los cambios de la 2ª" });
    expect(within(card).getByRole("radio", { name: "DFC por Dani (expulsado)" })).toHaveAttribute("aria-checked", "true");
    fireEvent.click(cta());
    expect(v.actions.addMany).toHaveBeenCalledWith([{ type: "substitution", playerId: "dani", inPlayerId: "ivan" }]);
  });

  it("«Recolocar»: two of the seven swap places; the wave sends the changes and then the swaps", async () => {
    const v = halftime();
    v.field = v.field.map((p) => ({ ...p, pos: ({ alex: "POR", mario: "DC", sergio: "MC", dani: "DFC", marcos: "DFC", pablo: "MI", david: "MD" } as Record<string, string>)[p.id] ?? null }));
    mount(v);
    fireEvent.click(row("Marcos"));
    fireEvent.click(row("Iván"));
    const rec = screen.getByRole("region", { name: "Recolocar para la 2ª" });
    // Iván comes on in Marcos's place (DFC); he swaps with Mario (DC)
    fireEvent.click(within(rec).getByRole("button", { name: "Elegir a Iván (DFC) para cambiar de sitio" }));
    expect(within(rec).getByText("¿Con quién cambia el sitio Iván? Toca a un compañero")).toBeInTheDocument();
    fireEvent.click(within(rec).getByRole("button", { name: "Iván y Mario se cambian el sitio" }));
    expect(within(rec).getByRole("button", { name: "Elegir a Mario (DFC) para cambiar de sitio" })).toBeInTheDocument();
    expect(within(rec).getByText("Iván ↔ Mario")).toBeInTheDocument();
    // a second pair, taken back with «Deshacer»
    fireEvent.click(within(rec).getByRole("button", { name: "Elegir a Sergio (MC) para cambiar de sitio" }));
    fireEvent.click(within(rec).getByRole("button", { name: "Sergio y David se cambian el sitio" }));
    expect(within(rec).getByText("Iván ↔ Mario · Sergio ↔ David")).toBeInTheDocument();
    fireEvent.click(within(rec).getByRole("button", { name: "Deshacer" }));
    expect(within(rec).getByText("Iván ↔ Mario")).toBeInTheDocument();
    fireEvent.click(cta());
    expect(v.actions.addMany).toHaveBeenCalledWith([
      { type: "substitution", playerId: "marcos", inPlayerId: "ivan" },
      { type: "position_swap", playerId: "ivan", inPlayerId: "mario" },
    ]);
    await Promise.resolve();
    expect(v.actions.clock).toHaveBeenCalledWith("second");
  });

  it("no changes: just the 2ª, nothing written", async () => {
    const v = halftime();
    mount(v);
    fireEvent.click(cta());
    expect(v.actions.addMany).not.toHaveBeenCalled();
    await Promise.resolve();
    expect(v.actions.clock).toHaveBeenCalledWith("second");
  });

  it("«parados» counts the break from the clock", () => {
    const v = halftime();
    v.match = { ...v.match, clock: { ...v.match.clock, breakSeconds: 185 } };
    mount(v);
    expect(screen.getByRole("timer", { name: "Parados desde hace 3 minutos" })).toHaveTextContent("3:05");
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
    expect(v.actions.addMany).toHaveBeenCalledTimes(1);
    expect(vi.mocked(v.actions.addMany).mock.calls[0][0]).toHaveLength(3);
    await Promise.resolve();
    expect(v.actions.clock).toHaveBeenCalledWith("second");
  });
});
