import { act, fireEvent, render, screen, within } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { MesaView } from "../types";
import { ev, makeView, squad } from "../screens/testkit";
import { BoardScreens } from "./Board";
import { HOLD_MS } from "./useBoard";

// La mesa r12 (SC-Mesa390…1920): each phase, sheet and door, and every B-MESA bug the client can fix, with the test
// that failed on the old screens (named after the bug).

vi.mock("../useLlegada", () => ({
  useLlegada: () => ({ squad: new Map(), conv: null, loading: false, present: [], toggle: vi.fn(), save: "idle", error: "", retry: vi.fn() }),
}));

const playing = (over: Parameters<typeof makeView>[0] = {}) => makeView({ ...over, clock: { phase: "first", playing: true, minute: 12, elapsedSeconds: 690, periodSeconds: 690, text: "11:30", ...over.clock } });
const mount = (v: MesaView, vista?: string) => render(<BoardScreens view={v} vista={vista} />);
const line = () => document.querySelector(".me-line") as HTMLElement;
const rejected = (message: string) => Object.assign(new Error(message), { code: "functions/failed-precondition" });
const flush = async () => {
  await act(async () => {
    for (let i = 0; i < 6; i++) await Promise.resolve();
  });
};

beforeEach(() => vi.useFakeTimers());
afterEach(() => vi.useRealTimers());

describe("las puertas", () => {
  it("B-MESA-12: un acta ya publicada abre su puerta, no la previa con «Pitar el inicio»", () => {
    mount(makeView({ match: { published: true, score: { us: 1, them: 8 } } }));
    expect(screen.getByRole("heading", { name: "Acta publicada · la mesa está cerrada" })).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: /Pitar el inicio/ })).toBeNull();
    expect(screen.getByText(/díselo a un capitán/)).toBeInTheDocument();
  });
  it("un capitán puede ir a corregirla a la sala", () => {
    const v = makeView({ match: { published: true }, me: { uid: "u-pablo", name: "Pablo", admin: true } });
    mount(v);
    fireEvent.click(screen.getByRole("button", { name: "Corregir el acta en la sala" }));
    expect(v.nav.go).toHaveBeenCalledWith("/admin/partidos/m7/acta");
  });
});

describe("antes del pitido", () => {
  it("todo listo: el siete, la banda, quién anota y «Pitar el inicio»", () => {
    mount(makeView({ match: { present: ["alex", "mario", "sergio", "dani", "marcos", "pablo", "david", "hugo"] } }));
    expect(screen.getByRole("heading", { name: "Todo listo para pitar" })).toBeInTheDocument();
    expect(screen.getByText("La lista: han venido 8")).toBeInTheDocument();
    expect(screen.getByText("Portero: ÁLEX")).toBeInTheDocument();
    expect(screen.getByText(/Banda: HUGO · cambios ilimitados/)).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /Pitar el inicio/ })).toBeInTheDocument();
  });
  it("B-MESA-09: el doble toque en «Pitar el inicio» manda un solo pitido", async () => {
    let done: () => void = () => undefined;
    const v = makeView();
    v.actions.clock = vi.fn(() => new Promise<void>((ok) => (done = ok)));
    mount(v);
    const kick = screen.getByRole("button", { name: /Pitar el inicio/ });
    fireEvent.click(kick);
    fireEvent.click(kick);
    expect(v.actions.clock).toHaveBeenCalledTimes(1);
    expect(kick).toHaveTextContent("Pitando…");
    done();
    await flush();
    expect(within(line()).getByText("Pitido inicial")).toBeInTheDocument();
  });
  it("B-MESA-05: si el pitido falla, la línea dice por qué", async () => {
    const v = makeView();
    v.actions.clock = vi.fn(async () => {
      throw rejected("Otra persona ha cambiado el reloj.");
    });
    mount(v);
    fireEvent.click(screen.getByRole("button", { name: /Pitar el inicio/ }));
    await flush();
    expect(line()).toHaveTextContent("No se ha guardado");
    expect(line()).toHaveTextContent("Otra persona ha cambiado el reloj.");
  });
  it("B-MESA-10: el «Deshacer» del pitido que falla también lo dice", async () => {
    const v = makeView();
    const clock = vi.fn(async (a: string) => {
      if (a === "reset") throw rejected("Hay jugadas registradas.");
    });
    v.actions.clock = clock;
    mount(v);
    fireEvent.click(screen.getByRole("button", { name: /Pitar el inicio/ }));
    await flush();
    fireEvent.click(within(line()).getByRole("button", { name: /Deshacer/ }));
    await flush();
    expect(clock).toHaveBeenLastCalledWith("reset");
    expect(line()).toHaveTextContent("Hay jugadas registradas.");
  });
  it("M-36: + Invitado y Añadir anotador desde la mesa", async () => {
    const v = makeView({ me: { uid: "u-pablo", name: "Pablo", admin: true }, scorerOptions: [{ uid: "u-jorge", name: "Jorge" }] });
    mount(v);
    fireEvent.click(screen.getAllByRole("button", { name: "+ Invitado" })[0]);
    fireEvent.change(screen.getByLabelText("Su nombre"), { target: { value: "Rafa" } });
    fireEvent.click(screen.getByRole("button", { name: "Añadir a la lista" }));
    await flush();
    expect(v.actions.addGuest).toHaveBeenCalledWith("Rafa");
    expect(line()).toHaveTextContent("Rafa entra en la lista y en la banda");
    fireEvent.click(screen.getByRole("button", { name: "Añadir anotador" }));
    fireEvent.click(screen.getByRole("button", { name: "Jorge" }));
    await flush();
    // (an admin always may: only the anotadores are listed)
    expect(v.actions.setScorers).toHaveBeenCalledWith(["u-jorge"]);
  });
});

describe("en juego", () => {
  it("M-31: el gol del Piti cuenta a un toque; las camisetas preguntan quién marcó y el pase", async () => {
    const v = playing();
    v.actions.add = vi.fn(() => "live-g");
    mount(v);
    fireEvent.click(screen.getByRole("button", { name: /Gol del Piti/ }));
    expect(v.actions.add).toHaveBeenCalledWith("goal", {}, undefined);
    expect(screen.getByText("¿Quién marcó?")).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: /^Mario,.*marcó él/ }));
    expect(v.actions.edit).toHaveBeenCalledWith("live-g", { playerId: "mario" });
    expect(screen.getByText("¿Y el pase?")).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "Sin pase" }));
    expect(v.actions.edit).toHaveBeenLastCalledWith("live-g", { assistPlayerId: "" });
  });
  it("M-31: si no se contesta, queda «por completar»", () => {
    mount(playing());
    fireEvent.click(screen.getByRole("button", { name: /Gol del Piti/ }));
    act(() => {
      vi.advanceTimersByTime(15_000);
    });
    expect(line()).toHaveTextContent("Gol sin autor");
    expect(line()).toHaveTextContent("Final te lo pedirá");
  });
  it("M-33: el gol del rival avisa a los 8 s y se puede deshacer antes", async () => {
    const v = playing();
    v.actions.add = vi.fn(() => "live-r");
    mount(v);
    fireEvent.click(screen.getByRole("button", { name: /Gol de ATL/ }));
    expect(line()).toHaveTextContent("el aviso al club sale en 8 s");
    fireEvent.click(within(line()).getByRole("button", { name: /Deshacer/ }));
    await flush();
    expect(v.actions.remove).toHaveBeenCalledWith("live-r");
    expect(line()).toHaveTextContent("nadie se ha enterado");
  });
  it("M-32: la camiseta abre la hoja del jugador, con en propia, penalti y falta", () => {
    mount(playing());
    fireEvent.click(screen.getByRole("button", { name: /^Sergio,.*abrir sus acciones/ }));
    const sheet = screen.getByRole("dialog", { name: "SERGIO" });
    for (const t of ["En propia", "Gol de penalti", "Gol de falta", "Penalti fallado"]) expect(within(sheet).getByRole("button", { name: t })).toBeInTheDocument();
  });
  it("un cambio desde el banquillo en dos toques", () => {
    const v = playing();
    mount(v);
    fireEvent.click(screen.getByRole("button", { name: /^Hugo, sin jugar/ }));
    fireEvent.click(screen.getByRole("button", { name: /^Pablo,.*sale él/ }));
    expect(v.actions.add).toHaveBeenCalledWith("substitution", { playerId: "pablo", inPlayerId: "hugo" }, undefined);
  });
  it("B-MESA-11: la presencia no dice «al día» con jugadas sin subir", () => {
    mount(playing({ queue: { online: true, pending: 2, byPlayer: {}, items: [], review: [], lastTryAt: null } }));
    const who = screen.getByLabelText(/anotando/);
    expect(who).not.toHaveAccessibleName(/al día/);
    expect(who).toHaveTextContent("2 subiendo");
  });
  it("M-48: la duración se corrige desde la hoja del reloj", async () => {
    const v = playing();
    mount(v);
    fireEvent.click(screen.getByRole("button", { name: /Reloj/ }));
    fireEvent.click(screen.getByRole("button", { name: "Dos minutos más" }));
    await flush();
    expect(v.actions.setDuration).toHaveBeenCalledWith(52);
  });
  it("B-PAR-01: los galones del oficial salen en el campo; sin ellos, nada", () => {
    const { unmount } = mount(playing({ galones: { captainId: "mario", viceId: null, takers: { penalties: ["sergio"], freekicks: [], corners: [] } } }));
    expect(screen.getByRole("button", { name: /^Mario,.*capitán/ })).toBeInTheDocument();
    unmount();
    mount(playing());
    expect(screen.queryByRole("button", { name: /capitán/ })).toBeNull();
  });
});

describe("descanso", () => {
  const half = (over: Parameters<typeof makeView>[0] = {}) => makeView({ ...over, clock: { phase: "halftime", period: 1, elapsedSeconds: 1500, breakSeconds: 90, ...over.clock } });
  it("B-MESA-02: cualquiera de los siete puede ir de portero", async () => {
    const v = half();
    mount(v);
    fireEvent.click(screen.getByRole("button", { name: "Portero en la 2ª: Mario" }));
    expect(screen.getByText("MARIO se pone de portero · ÁLEX a su sitio")).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: /Arrancar con 0|Arrancar la 2ª/ }));
    await flush();
    expect(v.actions.addMany).toHaveBeenCalledWith([{ type: "position_swap", playerId: "alex", inPlayerId: "mario" }], { elapsed: 1500, period: 2 });
  });
  it("B-MESA-05: arranca la 2ª antes de escribir los cambios; si falla, no se escribe nada y lo dice", async () => {
    const v = half();
    v.actions.clock = vi.fn(async () => {
      throw rejected("Otra persona ha cambiado el reloj.");
    });
    mount(v);
    fireEvent.click(screen.getByRole("button", { name: /^Pablo, juega la 2ª/ }));
    fireEvent.click(screen.getByRole("button", { name: /^Hugo, no juega la 2ª/ }));
    fireEvent.click(screen.getByRole("button", { name: "Arrancar con 1 cambio" }));
    await flush();
    expect(v.actions.clock).toHaveBeenCalledWith("second");
    expect(v.actions.addMany).not.toHaveBeenCalled();
    expect(line()).toHaveTextContent("Otra persona ha cambiado el reloj.");
  });
  it("B-MESA-07: la selección sigue al campo cuando otro anotador hace un cambio", async () => {
    const v = half();
    const { rerender } = mount(v);
    // (the other scorer brought Hugo on for Pablo during the break)
    const { field, bench } = squad();
    const hugo = { ...bench[0], played: true, stints: [{ from: 1500, to: null }] };
    const pablo = { ...field[5], stints: [{ from: 0, to: 1500 }], offAt: 25 };
    const moved = { ...v, field: [...field.filter((p) => p.id !== "pablo"), hugo], bench: [pablo, ...bench.slice(1)] };
    rerender(<BoardScreens view={moved} />);
    fireEvent.click(screen.getByRole("button", { name: "Arrancar la 2ª parte" }));
    await flush();
    expect(v.actions.addMany).not.toHaveBeenCalled();
    expect(v.actions.clock).toHaveBeenCalledWith("second");
  });
  it("M-37: «Volver a la 1ª» con dos toques", async () => {
    const v = half();
    mount(v);
    fireEvent.click(screen.getByRole("button", { name: "Volver a la 1ª" }));
    expect(v.actions.clock).not.toHaveBeenCalled();
    fireEvent.click(screen.getByRole("button", { name: "¿Seguro? Toca otra vez" }));
    await flush();
    expect(v.actions.clock).toHaveBeenCalledWith("resume_first");
  });
  it("B-PAR-01: el «2ª parte» de la pizarra se ofrece y pone su siete; sin él, no sale", () => {
    const { unmount } = mount(half({ secondHalf: { seven: ["alex", "mario", "sergio", "dani", "marcos", "david", "hugo"], keeper: "alex", codes: {} } }));
    fireEvent.click(screen.getByRole("button", { name: "El siete de la pizarra · 2ª parte" }));
    expect(screen.getByRole("button", { name: "Arrancar con 1 cambio" })).toBeInTheDocument();
    expect(screen.getByText("HUGO entra por PABLO")).toBeInTheDocument();
    unmount();
    mount(half());
    expect(screen.queryByRole("button", { name: "El siete de la pizarra · 2ª parte" })).toBeNull();
  });
});

describe("final y después", () => {
  const ended = (events = [ev("g1", "goal", 6, { pendingScorer: true }), ev("o1", "opponent_goal", 15)]) =>
    makeView({ events, clock: { phase: "ended", period: 2, elapsedSeconds: 3000 }, match: { score: { us: 1, them: 1 } } });
  it("B-MESA-03: un gol sin goleador bloquea el acta y se elige allí mismo", async () => {
    const { field } = squad();
    const v = { ...ended(), field: field.map((p) => ({ ...p, stints: [{ from: 0, to: null }] })) };
    mount(v);
    expect(screen.getByText("Falta quién marcó algún gol: elígelo arriba")).toBeInTheDocument();
    expect(screen.getByText(/No se puede publicar: 1 gol sin goleador/)).toBeInTheDocument();
    const ask = screen.getByRole("group", { name: "¿Quién marcó el gol del 6′?" });
    fireEvent.click(within(ask).getByRole("button", { name: "MARIO" }));
    expect(v.actions.edit).toHaveBeenCalledWith("g1", { playerId: "mario" });
    fireEvent.pointerDown(screen.getByRole("button", { name: /Mantén para publicar/ }), { button: 0 });
    act(() => {
      vi.advanceTimersByTime(HOLD_MS + 50);
    });
    expect(v.actions.publish).not.toHaveBeenCalled();
  });
  it("se publica manteniendo un segundo y sale «Acta publicada» con la crónica corta (M-38)", async () => {
    const v = ended([ev("g1", "goal", 6, { playerId: "mario", assistReviewed: true })]);
    const { rerender } = mount(v);
    fireEvent.pointerDown(screen.getByRole("button", { name: /Mantén para publicar/ }), { button: 0 });
    act(() => {
      vi.advanceTimersByTime(HOLD_MS + 50);
    });
    await flush();
    expect(v.actions.publish).toHaveBeenCalled();
    rerender(<BoardScreens view={{ ...v, match: { ...v.match, published: true } }} />);
    expect(screen.getByRole("heading", { name: "Acta publicada" })).toBeInTheDocument();
    fireEvent.change(screen.getByLabelText("La crónica corta"), { target: { value: "Empate con sabor a City." } });
    fireEvent.click(screen.getByRole("button", { name: "Guardar la crónica" }));
    await flush();
    expect(v.actions.saveReport).toHaveBeenCalledWith("Empate con sabor a City.");
  });
  it("B-MESA-10: «Reabrir el partido» que falla lo dice", async () => {
    const v = ended([]);
    v.actions.reopen = vi.fn(async () => {
      throw rejected("Sin conexión con el reloj.");
    });
    mount(v);
    fireEvent.click(screen.getByRole("button", { name: "Reabrir el partido" }));
    fireEvent.click(screen.getByRole("button", { name: "¿Reabrir? Toca otra vez" }));
    await flush();
    expect(line()).toHaveTextContent("Sin conexión con el reloj.");
  });
});

describe("la crónica", () => {
  const withPlays = () => playing({ events: [ev("s1", "substitution", 10, { playerId: "pablo", inPlayerId: "hugo", text: "Entra Hugo por Pablo" }), ev("f1", "foul", 11, { playerId: "mario", text: "Falta de Mario" })] });
  it("B-MESA-04: una corrección rechazada lo dice en la hoja y en la línea", async () => {
    const v = withPlays();
    v.actions.edit = vi.fn(async () => {
      throw rejected("Ese jugador ya estaba en el campo.");
    });
    mount(v, "cronica");
    fireEvent.click(screen.getByRole("button", { name: "Corregir: Falta de Mario" }));
    fireEvent.click(screen.getByRole("button", { name: "Un minuto menos" }));
    fireEvent.click(screen.getByRole("button", { name: "Guardar" }));
    await flush();
    expect(screen.getByRole("alert")).toHaveTextContent("Ese jugador ya estaba en el campo.");
    expect(line()).toHaveTextContent("Ese jugador ya estaba en el campo.");
  });
  it("B-MESA-04: un borrado rechazado lo dice", async () => {
    const v = withPlays();
    v.actions.remove = vi.fn(async () => {
      throw rejected("Esa jugada ya se ha borrado.");
    });
    mount(v, "cronica");
    fireEvent.click(screen.getByRole("button", { name: "Borrar: Falta de Mario" }));
    await flush();
    expect(line()).toHaveTextContent("Esa jugada ya se ha borrado.");
  });
  it("filtra por tipo y marca el inicio de la 2ª", () => {
    mount(playing({ events: [ev("a", "foul", 5, { text: "Falta de Mario" }), ev("b", "goal", 30, { period: 2, playerId: "mario", text: "Gol de Mario" })] }), "cronica");
    expect(screen.getByText("Empieza la 2ª parte")).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: /^Goles/ }));
    expect(screen.queryByText("Falta de Mario")).toBeNull();
    expect(screen.getByText("Gol de Mario")).toBeInTheDocument();
  });
});
