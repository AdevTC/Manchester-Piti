import { fireEvent, render, screen, within } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { EnJuego } from "./EnJuego";
import type { MesaEvent, MesaPlayer, MesaView } from "./types";

const player = (id: string, name: string, number: string, more: Partial<MesaPlayer> = {}): MesaPlayer => ({
  id, name, number, guest: false, keeper: false, minutes: 19, pending: 0, played: true, offAt: null, sentOff: false, vacancy: null, pos: null, stints: [{ from: 0, to: null }], spot: { x: 50, y: 50 },
  stickers: { goals: 0, assists: 0, yellow: false, red: false, injured: false },
  ...more,
});

/** The three on the pitch with their positions (Álex POR, Mario DC, Pablo MC). */
const posed = () => [player("k", "Álex", "1", { keeper: true, pos: "POR", spot: { x: 50, y: 93 } }), player("m", "Mario", "7", { pos: "DC", spot: { x: 50, y: 14 } }), player("p", "Pablo", "4", { pos: "MC", spot: { x: 16, y: 46 } })];

function makeView(over: Partial<MesaView> = {}): MesaView {
  const actions = {
    add: vi.fn(() => "live-r1"),
    addMany: vi.fn(() => ["live-w-0"]),
    edit: vi.fn(async () => undefined),
    remove: vi.fn(async () => undefined),
    undo: vi.fn(async () => undefined),
    clock: vi.fn(async () => undefined),
    publish: vi.fn(async () => undefined),
    reopen: vi.fn(async () => undefined),
    resend: vi.fn(),
    discard: vi.fn(),
    retryNow: vi.fn(),
  };
  return {
    match: {
      id: "m1", seasonId: "s1", rival: "Atlético Demo", rivalShort: "ATL", rivalInitials: "AD", competition: "Liga", round: null, lineup: { fromBoard: false, system: null }, hasStandings: false, home: true, date: 0,
      score: { us: 2, them: 1 }, queuedGoals: { us: 0, them: 0 }, published: false, pendingDuplicates: 0,
      clock: { phase: "first", playing: true, held: false, elapsedSeconds: 1122, periodSeconds: 1122, period: 1, halfSeconds: 1500, added: 0, minute: 19, text: "18:42", revision: 3, breakSeconds: 0, kickoffAt: null, secondAt: null },
    },
    field: [player("k", "Álex", "1", { keeper: true, spot: { x: 50, y: 93 } }), player("m", "Mario", "7", { spot: { x: 50, y: 14 }, stickers: { goals: 2, assists: 0, yellow: false, red: false, injured: false } }), player("p", "Pablo", "4", { spot: { x: 16, y: 46 } })],
    bench: [player("h", "Hugo", "8", { played: false, minutes: 0, stints: [], spot: null })],
    events: [],
    presence: [{ uid: "me", name: "Jordi", at: 1, fresh: true, me: true }, { uid: "u2", name: "David", at: 1, fresh: true, me: false }],
    me: { uid: "me", name: "Jordi", admin: true },
    queue: { online: true, pending: 0, byPlayer: {}, items: [], review: [], lastTryAt: null },
    lastOwn: null,
    nextSub: null,
    nameOf: (id: string) => ({ k: "Álex", m: "Mario", p: "Pablo", h: "Hugo" })[id] ?? id,
    notice: "",
    actions,
    nav: { cronica: vi.fn(), mesa: vi.fn(), exit: vi.fn(), acta: vi.fn(), pizarra: vi.fn() },
    ...over,
  };
}

/** The change «Entra Hugo, sale Pablo» as the view has it once written (still in the queue): Hugo in Pablo's
 *  place, Pablo on the bench, the play tapped at 18:20. */
const CHANGE_AT = { elapsed: 1100, period: 1 };
function changed(view: MesaView): MesaView {
  const pablo = view.field.find((p) => p.id === "p")!;
  const hugo = view.bench.find((p) => p.id === "h")!;
  const change: MesaEvent = {
    id: "live-r1", type: "substitution", side: "us", minute: 19, elapsedSeconds: CHANGE_AT.elapsed, period: 1, playerId: "p", playerName: "Pablo", assistId: null, assistName: null, inPlayerId: "h", inName: "Hugo",
    text: "Entra Hugo, sale Pablo", tag: "CAMBIO", goal: null, pendingScorer: false, assistReviewed: false, byUid: "me", byName: "Tú", editedByUid: null, editedByName: null, editedAt: null, dupOf: null, queued: true, local: true, mine: true,
  };
  return {
    ...view,
    field: view.field.map((p) => (p.id === "p" ? { ...hugo, pos: pablo.pos, spot: pablo.spot, played: true } : p)),
    bench: [{ ...pablo, pos: null, spot: null, offAt: 19 }],
    events: [change],
  };
}
const swapOf = (playerId: string, inPlayerId: string) => ({ type: "position_swap", playerId, inPlayerId });

describe("La mesa · En juego", () => {
  it("pinta el marcador, el reloj, el campo, el banquillo y quién más anota", () => {
    const view = makeView();
    render(<EnJuego view={view} />);
    expect(screen.getByRole("img", { name: "Manchester Piti 2, Atlético Demo 1" })).toBeInTheDocument();
    expect(screen.getByText("18:42")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /^Mario, dorsal 7, 19′, 2 goles/ })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /Hugo, sin jugar/ })).toBeInTheDocument();
    expect(screen.getByRole("img", { name: "Tú y David anotando, al día" })).toBeInTheDocument();
  });

  it("justo tras el pitido, sin jugadas, el rótulo «INICIO» deshace el inicio (reset del reloj)", async () => {
    const base = makeView();
    const kicked = new Date(2026, 9, 18, 10, 31).getTime();
    const view = makeView({ match: { ...base.match, round: 7, clock: { ...base.match.clock, elapsedSeconds: 4, periodSeconds: 4, minute: 1, text: "00:04", kickoffAt: kicked } } });
    const { rerender } = render(<EnJuego view={view} />);
    expect(screen.getByText("Jornada 7, liga")).toBeInTheDocument();
    expect(screen.getByRole("status")).toHaveTextContent("Pitido inicial a las 10:31");
    fireEvent.click(within(screen.getByRole("status")).getByRole("button", { name: "Deshacer" }));
    expect(view.actions.clock).toHaveBeenCalledWith("reset");
    // with a play written, the whistle stays
    rerender(<EnJuego view={{ ...makeView({ match: view.match }), events: [{ id: "e1", type: "foul", side: "us", minute: 1, elapsedSeconds: 3, period: 1, playerId: "p", playerName: "Pablo", assistId: null, assistName: null, inPlayerId: null, inName: null, text: "Falta de Pablo", tag: "FALTA", goal: null, pendingScorer: false, assistReviewed: false, byUid: "u2", byName: "David", editedByUid: null, editedByName: null, editedAt: null, dupOf: null, queued: false, local: false, mine: false }] }} />);
    expect(screen.queryByText(/Pitido inicial/)).toBeNull();
  });

  it("«Gol del Piti» pregunta quién marcó; luego el campo pide el pase y se manda como corrección", () => {
    const view = makeView();
    const { rerender } = render(<EnJuego view={view} />);
    fireEvent.click(screen.getByRole("button", { name: /Gol del Piti/ }));
    const sheet = screen.getByRole("dialog", { name: "¿Quién marcó?" });
    fireEvent.click(within(sheet).getByRole("button", { name: /Mario/ }));
    expect(view.actions.add).toHaveBeenCalledWith("goal", { playerId: "m" });
    rerender(<EnJuego view={{ ...view, match: { ...view.match, score: { us: 3, them: 1 } } }} />);
    fireEvent.click(screen.getByRole("button", { name: "Asistencia de Pablo" }));
    expect(view.actions.edit).toHaveBeenCalledWith("live-r1", { assistPlayerId: "p" });
  });

  it("mientras pide el pase, tocar al goleador abre su anillo: otro gol suyo sube el marcador", () => {
    const view = makeView();
    render(<EnJuego view={view} />);
    fireEvent.click(screen.getByRole("button", { name: /Gol del Piti/ }));
    fireEvent.click(within(screen.getByRole("dialog", { name: "¿Quién marcó?" })).getByRole("button", { name: /Mario/ }));
    fireEvent.click(screen.getByRole("button", { name: "Mario, ha marcado. Toca para apuntarle otra jugada" }));
    const ring = screen.getByRole("dialog", { name: "Acciones de Mario" });
    fireEvent.click(within(ring).getByRole("button", { name: /^Gol/ }));
    expect(view.actions.add).toHaveBeenCalledTimes(2);
    expect(view.actions.add).toHaveBeenLastCalledWith("goal", { playerId: "m" });
    expect(view.actions.edit).not.toHaveBeenCalled();
  });

  it("tras una roja, el hueco del expulsado se llena con alguien del banquillo (en los dos órdenes)", () => {
    const dani = player("d", "Dani", "2", { played: true, sentOff: true, stints: [{ from: 0, to: 600 }], spot: null, vacancy: { spot: { x: 30, y: 74 }, code: "DFC" } });
    const view = makeView({ bench: [player("h", "Hugo", "8", { played: false, minutes: 0, stints: [], spot: null }), dani] });
    render(<EnJuego view={view} />);
    expect(screen.getByRole("button", { name: /^Dani, expulsado. Que entre/ })).toBeDisabled();
    fireEvent.click(screen.getByRole("button", { name: "Hueco de Dani, expulsado, DFC. Toca para que entre alguien" }));
    fireEvent.click(screen.getByRole("button", { name: "Entra Hugo" }));
    expect(view.actions.add).toHaveBeenLastCalledWith("substitution", { playerId: "d", inPlayerId: "h" });
    fireEvent.click(screen.getByRole("button", { name: /Hugo, sin jugar/ }));
    fireEvent.click(screen.getByRole("button", { name: "Entra Hugo por Dani, expulsado" }));
    expect(view.actions.add).toHaveBeenCalledTimes(2);
  });

  it("sin alineación, el hueco del expulsado sale como botón sobre el banquillo", () => {
    const dani = player("d", "Dani", "2", { played: true, sentOff: true, stints: [{ from: 0, to: 600 }], spot: null, vacancy: { spot: null, code: null } });
    const view = makeView({ bench: [player("h", "Hugo", "8", { played: false, minutes: 0, stints: [], spot: null }), dani] });
    render(<EnJuego view={view} />);
    fireEvent.click(screen.getByRole("button", { name: /Hugo, sin jugar/ }));
    fireEvent.click(screen.getByRole("button", { name: "Entra Hugo por Dani (expulsado)" }));
    expect(view.actions.add).toHaveBeenLastCalledWith("substitution", { playerId: "d", inPlayerId: "h" });
  });

  it("«Sin asistencia» deja el gol revisado sin pase: el acta no vuelve a preguntar", () => {
    const view = makeView();
    render(<EnJuego view={view} />);
    fireEvent.click(screen.getByRole("button", { name: /Gol del Piti/ }));
    fireEvent.click(within(screen.getByRole("dialog", { name: "¿Quién marcó?" })).getByRole("button", { name: /Mario/ }));
    fireEvent.click(screen.getByRole("button", { name: "Sin asistencia" }));
    expect(view.actions.edit).toHaveBeenCalledWith("live-r1", { assistPlayerId: "" });
  });

  it("«Lo apunto luego» y «Autogol suyo» van sin goleador", () => {
    const view = makeView();
    render(<EnJuego view={view} />);
    fireEvent.click(screen.getByRole("button", { name: /Gol del Piti/ }));
    fireEvent.click(screen.getByRole("button", { name: "Lo apunto luego" }));
    expect(view.actions.add).toHaveBeenLastCalledWith("goal", undefined);
    fireEvent.click(screen.getByRole("button", { name: /Gol del Piti/ }));
    fireEvent.click(screen.getByRole("button", { name: "Autogol suyo" }));
    expect(view.actions.add).toHaveBeenLastCalledWith("opponent_own_goal", undefined);
  });

  it("tocar una camiseta abre el anillo; el portero tiene Parada y la tarjeta pide el color", () => {
    const view = makeView();
    render(<EnJuego view={view} />);
    fireEvent.click(screen.getByRole("button", { name: /^Álex, dorsal 1/ }));
    const ring = screen.getByRole("dialog", { name: "Acciones de Álex" });
    expect(within(ring).getByRole("button", { name: "Parada" })).toBeInTheDocument();
    fireEvent.click(within(ring).getByRole("button", { name: "Tarjeta" }));
    fireEvent.click(within(screen.getByRole("dialog", { name: "Acciones de Álex" })).getByRole("button", { name: /Amarilla/ }));
    expect(view.actions.add).toHaveBeenCalledWith("yellow_card", { playerId: "k" });
  });

  it("un cambio se escribe al momento; su rótulo dice dónde juega el que entra y ofrece «Recolocar»", () => {
    const view = makeView({ field: posed() });
    const { rerender } = render(<EnJuego view={view} />);
    fireEvent.click(screen.getByRole("button", { name: /Hugo, sin jugar/ }));
    fireEvent.click(screen.getByRole("button", { name: "Sale Pablo" }));
    expect(view.actions.add).toHaveBeenCalledWith("substitution", { playerId: "p", inPlayerId: "h" });
    rerender(<EnJuego view={changed(view)} />);
    const strap = screen.getByRole("status");
    expect(strap).toHaveTextContent("Entra Hugo, sale Pablo");
    expect(strap).toHaveTextContent("Ocupa su sitio: mediocentro");
    expect(within(strap).getByRole("button", { name: "Recolocar" })).toBeInTheDocument();
    // the change's own «Deshacer» takes the written change back
    fireEvent.click(within(strap).getByRole("button", { name: "Deshacer" }));
    expect(view.actions.undo).toHaveBeenCalled();
    expect(view.actions.addMany).not.toHaveBeenCalled();
  });

  it("«Recolocar»: el que entra ya está elegido, se cambia con un compañero; «Deshacer» la última y «Hecho» manda solo las recolocaciones, a la hora del cambio", () => {
    const view = makeView({ field: posed() });
    const { rerender } = render(<EnJuego view={view} />);
    fireEvent.click(screen.getByRole("button", { name: /Hugo, sin jugar/ }));
    fireEvent.click(screen.getByRole("button", { name: "Sale Pablo" }));
    rerender(<EnJuego view={changed(view)} />);
    fireEvent.click(within(screen.getByRole("status")).getByRole("button", { name: "Recolocar" }));
    expect(screen.getByRole("status")).toHaveTextContent("¿Con quién cambia el sitio Hugo?");
    expect(screen.getByRole("button", { name: /^Hugo, mediocentro/ })).toHaveAttribute("aria-pressed", "true");
    fireEvent.click(screen.getByRole("button", { name: "Hugo y Mario se cambian el sitio" }));
    expect(screen.getByRole("status")).toHaveTextContent("Hugo, a punta · Mario, a mediocentro");
    expect(screen.getByRole("status")).toHaveTextContent("RECOLOCACIÓN");
    // two more pairs, the last one taken back
    fireEvent.click(screen.getByRole("button", { name: "Álex, portero. Elegir para cambiar de sitio" }));
    fireEvent.click(screen.getByRole("button", { name: "Álex y Mario se cambian el sitio" }));
    fireEvent.click(screen.getByRole("button", { name: "Hugo, punta. Elegir para cambiar de sitio" }));
    fireEvent.click(screen.getByRole("button", { name: "Hugo y Álex se cambian el sitio" }));
    fireEvent.click(within(screen.getByRole("status")).getByRole("button", { name: "Deshacer" }));
    fireEvent.click(within(screen.getByRole("status")).getByRole("button", { name: "Hecho" }));
    expect(view.actions.add).toHaveBeenCalledTimes(1);
    expect(view.actions.addMany).toHaveBeenCalledWith([swapOf("h", "m"), swapOf("k", "m")], CHANGE_AT);
  });

  it("una sola recolocación tras el cambio va como una jugada, con la hora del cambio", () => {
    const view = makeView({ field: posed() });
    const { rerender } = render(<EnJuego view={view} />);
    fireEvent.click(screen.getByRole("button", { name: /Hugo, sin jugar/ }));
    fireEvent.click(screen.getByRole("button", { name: "Sale Pablo" }));
    rerender(<EnJuego view={changed(view)} />);
    fireEvent.click(within(screen.getByRole("status")).getByRole("button", { name: "Recolocar" }));
    fireEvent.click(screen.getByRole("button", { name: "Hugo y Mario se cambian el sitio" }));
    fireEvent.click(within(screen.getByRole("status")).getByRole("button", { name: "Hecho" }));
    expect(view.actions.add).toHaveBeenLastCalledWith("position_swap", { playerId: "h", inPlayerId: "m" }, CHANGE_AT);
    expect(view.actions.addMany).not.toHaveBeenCalled();
  });

  it("sin «Hecho» no se manda nada más: el cambio ya está escrito", () => {
    const view = makeView({ field: posed() });
    const { rerender, unmount } = render(<EnJuego view={view} />);
    fireEvent.click(screen.getByRole("button", { name: /Hugo, sin jugar/ }));
    fireEvent.click(screen.getByRole("button", { name: "Sale Pablo" }));
    rerender(<EnJuego view={changed(view)} />);
    fireEvent.click(within(screen.getByRole("status")).getByRole("button", { name: "Recolocar" }));
    fireEvent.click(screen.getByRole("button", { name: "Hugo y Mario se cambian el sitio" }));
    unmount();
    expect(view.actions.add).toHaveBeenCalledTimes(1);
    expect(view.actions.addMany).not.toHaveBeenCalled();
  });

  it("«Cambiar de sitio» desde el anillo, sin cambio: toca a un compañero y va como una jugada", () => {
    const view = makeView({ field: posed() });
    render(<EnJuego view={view} />);
    fireEvent.click(screen.getByRole("button", { name: /^Mario, dorsal 7/ }));
    fireEvent.click(within(screen.getByRole("dialog", { name: "Acciones de Mario" })).getByRole("button", { name: "Cambiar de sitio" }));
    const strap = screen.getByRole("status");
    expect(strap).toHaveTextContent("¿Con quién cambia el sitio Mario?");
    expect(strap).toHaveTextContent("Toca a un compañero");
    expect(within(strap).getByRole("button", { name: "Cancelar" })).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "Mario y Pablo se cambian el sitio" }));
    fireEvent.click(within(screen.getByRole("status")).getByRole("button", { name: "Hecho" }));
    expect(view.actions.add).toHaveBeenCalledWith("position_swap", { playerId: "m", inPlayerId: "p" }, undefined);
    expect(view.actions.addMany).not.toHaveBeenCalled();
  });

  it("la fila del rival y su «···»", () => {
    const view = makeView();
    render(<EnJuego view={view} />);
    const riv = screen.getByRole("group", { name: "Jugadas de Atlético Demo" });
    fireEvent.click(within(riv).getByRole("button", { name: "Falta" }));
    expect(view.actions.add).toHaveBeenCalledWith("opponent_foul", undefined);
    fireEvent.click(within(riv).getByRole("button", { name: "Más jugadas del rival" }));
    fireEvent.click(screen.getByRole("button", { name: "Fuera de juego" }));
    expect(view.actions.add).toHaveBeenLastCalledWith("opponent_offside", undefined);
  });

  it("en pausa solo se apuntan cambios, tarjetas y golpes", () => {
    const base = makeView();
    const view = makeView({ match: { ...base.match, clock: { ...base.match.clock, playing: false, held: true } } });
    render(<EnJuego view={view} />);
    expect(screen.getByRole("button", { name: /Gol del Piti/ })).toBeDisabled();
    expect(screen.getByRole("button", { name: /Seguir/ })).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: /Seguir/ }));
    expect(view.actions.clock).toHaveBeenCalledWith("resume");
  });

  it("«Fin de la 1ª» pide confirmación", () => {
    const view = makeView();
    render(<EnJuego view={view} />);
    fireEvent.click(screen.getByRole("button", { name: "Fin de la 1ª" }));
    expect(view.actions.clock).not.toHaveBeenCalled();
    fireEvent.click(screen.getByRole("button", { name: "¿Seguro?" }));
    expect(view.actions.clock).toHaveBeenCalledWith("halftime");
  });

  it("sin cobertura: «Sin red», ↓N por jugador, la marca en el marcador y la cola en el dock", () => {
    const base = makeView();
    const view = makeView({
      match: { ...base.match, queuedGoals: { us: 1, them: 0 } },
      field: base.field.map((p) => (p.id === "m" ? { ...p, pending: 2 } : p)),
      queue: { online: false, pending: 3, byPlayer: { m: 2 }, items: [], review: [], lastTryAt: 1 },
    });
    const { container } = render(<EnJuego view={view} />);
    fireEvent.click(screen.getByRole("button", { name: /Sin red/ }));
    expect(view.actions.retryNow).toHaveBeenCalled();
    expect(screen.getByRole("button", { name: /Mario, dorsal 7, 19′, 2 goles, 2 sin subir/ })).toBeInTheDocument();
    expect(screen.getByRole("img", { name: /1 gol sin subir/ })).toBeInTheDocument();
    expect(screen.getByText("3 jugadas guardadas en el móvil")).toBeInTheDocument();
    expect(screen.getByText("Se suben solas al volver la señal")).toBeInTheDocument();
    expect(container.querySelector(".box.off")).not.toBeNull();
  });

  it("«Por revisar»: corregir el minuto y reenviar, o descartar", () => {
    const base = makeView();
    const view = makeView({ queue: { ...base.queue, review: [{ requestId: "r9", type: "foul", text: "Falta de Pablo", playerId: "p", minute: 12, count: 1, reason: "Ese jugador ya no está en el campo." }] } });
    render(<EnJuego view={view} />);
    fireEvent.click(screen.getByRole("button", { name: /1 jugada por revisar/ }));
    expect(screen.getByText("Ese jugador ya no está en el campo.")).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "Un minuto más" }));
    fireEvent.click(screen.getByRole("button", { name: "Reenviar" }));
    expect(view.actions.resend).toHaveBeenCalledWith("r9", { minute: 13 });
    fireEvent.click(screen.getByRole("button", { name: "Descartar" }));
    expect(view.actions.discard).toHaveBeenCalledWith("r9");
  });

  it("la última jugada lleva a lo que va pasando y el cambio previsto se hace de un toque", () => {
    const view = makeView({
      events: [{ id: "e1", type: "foul", side: "us", minute: 18, elapsedSeconds: 1060, period: 1, playerId: "p", playerName: "Pablo", assistId: null, assistName: null, inPlayerId: null, inName: null, text: "Falta de Pablo", tag: "FALTA", goal: null, pendingScorer: false, assistReviewed: false, byUid: "u2", byName: "David", editedByUid: null, editedByName: null, editedAt: null, dupOf: null, queued: false, local: false, mine: false }],
      nextSub: { inId: "h", outId: "p", inName: "Hugo", outName: "Pablo" },
    });
    render(<EnJuego view={view} />);
    expect(screen.getByText("Falta de Pablo")).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: /1 jugada/ }));
    expect(view.nav.cronica).toHaveBeenCalled();
    fireEvent.click(screen.getByRole("button", { name: "Toca: entra Hugo por Pablo" }));
    expect(view.actions.add).toHaveBeenCalledWith("substitution", { playerId: "p", inPlayerId: "h" });
  });
});
