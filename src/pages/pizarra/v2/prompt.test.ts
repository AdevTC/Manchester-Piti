import { describe, expect, it, vi } from "vitest";
import { promptItems, promptKey, type PromptActs, type PromptCtx } from "./prompt";
import { selBarView } from "./handView";
import { RAIL, RAIL_ORDER } from "./rail";

// What the prompt bar offers in each context (as designed), and that nothing that edits is offered on a
// read-only board; the selected player's bar texts; the rail's order (the 1–8 shortcuts).

const acts = (): PromptActs => ({
  undo: vi.fn(),
  undoStroke: vi.fn(),
  redoStroke: vi.fn(),
  undoJugada: vi.fn(),
  captain: vi.fn(),
  galones: vi.fn(),
  ficha: vi.fn(),
  drop: vi.fn(),
  toggle: vi.fn(),
  prev: vi.fn(),
  next: vi.fn(),
  siete: vi.fn(),
  exitCharla: vi.fn(),
});
const ctx = (o: Partial<PromptCtx>): PromptCtx => ({ modo: "editar", ro: false, hand: null, benchView: "lista", playing: false, pieces: false, ...o });
const show = (c: PromptCtx, a = acts()) => promptItems(c, a).map((x) => x.k + " " + x.t + (x.go ? " ▸" : ""));

describe("the prompt bar's items", () => {
  it("the siete: how to edit, the tabs, the bench view, the tools, deshacer", () => {
    expect(show(ctx({}))).toEqual(["Clic Elegir jugador", "Arrastra Mover al campo", "Q E Pestañas", "R Ver en cromos", "1–8 Herramientas", "Ctrl Z Deshacer ▸"]);
    expect(show(ctx({ benchView: "cromos" }))[3]).toBe("R Ver en lista");
    // read-only: nothing that edits
    expect(show(ctx({ ro: true }))).toEqual(["Q E Pestañas", "R Ver en cromos", "1–8 Herramientas"]);
  });

  it("a player in the hand: who (with his rating) and his actions, as buttons", () => {
    const a = acts();
    const its = promptItems(ctx({ hand: { k: "p", name: "TELLO", rt: 79 } }), a);
    expect(its.map((x) => x.k + " " + x.t)).toEqual(["79 TELLO en la mano", "Clic Cambiar con otro o con un hueco", "C Capitán", "G Galones", "F Ficha", "Esc Soltar"]);
    expect(its[0].cls).toBe("who");
    its[2].go?.();
    its[3].go?.();
    its[4].go?.();
    its[5].go?.();
    expect([a.captain, a.galones, a.ficha, a.drop].map((f) => (f as ReturnType<typeof vi.fn>).mock.calls.length)).toEqual([1, 1, 1, 1]);
    // from the bench: no capitán / galones
    expect(show(ctx({ hand: { k: "b", name: "ERIK", rt: 86 } }))).toEqual(["86 ERIK en la mano", "Clic Entra por un cromo del campo", "F Ficha ▸", "Esc Soltar ▸"]);
  });

  it("jugadas, dibujar, la charla, química and the rest", () => {
    // Ctrl Z is the tool's own: the jugadas' edits, the strokes (with their redo); never the hidden siete
    expect(show(ctx({ modo: "jugadas" }))).toEqual(["Espacio Reproducir ▸", "← Paso anterior ▸", "→ Paso siguiente ▸", "Ctrl Z Deshacer en la jugada ▸", "Esc Volver al siete ▸"]);
    expect(show(ctx({ modo: "jugadas", ro: true }))).toEqual(["Espacio Reproducir ▸", "← Paso anterior ▸", "→ Paso siguiente ▸", "Esc Volver al siete ▸"]);
    expect(show(ctx({ modo: "jugadas", playing: true, pieces: true }))).toEqual(["Espacio Pausa ▸", "← Paso anterior ▸", "→ Paso siguiente ▸", "Arrastra Retocar el paso", "Ctrl Z Deshacer en la jugada ▸", "Esc Volver al siete ▸"]);
    expect(show(ctx({ modo: "dibujar" }))).toEqual(["Arrastra Dibujar en el césped", "Ctrl Z Deshacer trazo ▸", "Ctrl ⇧ Z Rehacer trazo ▸", "Esc Volver al siete ▸"]);
    expect(show(ctx({ modo: "dibujar", ro: true }))).toEqual(["Esc Volver al siete ▸"]);
    expect(show(ctx({ modo: "charla", playing: true }))).toEqual(["Espacio Pausa ▸", "← Paso anterior ▸", "→ Paso siguiente ▸", "Esc Salir de la charla ▸"]);
    expect(show(ctx({ modo: "quimica" }))).toEqual(["Clic Cambia a un jugador y mira cómo se reencienden las luces", "Esc Volver al siete ▸"]);
    expect(show(ctx({ modo: "tableros" }))).toEqual(["1–8 Herramientas", "Esc Volver al siete ▸"]);
  });

  it("a new context has a new key (the items play in again)", () => {
    const keys = [ctx({}), ctx({ hand: { k: "p", name: "TELLO", rt: 79 } }), ctx({ hand: { k: "b", name: "TELLO", rt: 79 } }), ctx({ modo: "jugadas" }), ctx({ ro: true })].map(promptKey);
    expect(new Set(keys).size).toBe(keys.length);
  });
});

describe("the selected player's bar", () => {
  it("on the pitch: his slot, swap text, the armband; from the bench: where he goes", () => {
    const p = { id: "tello", name: "TELLO", num: 20, rt: 79, pos: "DEF" as const };
    expect(selBarView(p, "DFC", true)).toMatchObject({ pos: "DFC", onPitch: true, captain: true, kick: "TELLO · DFC · en la mano", txt: "Toca con quién se cambia: otro del campo o uno del banquillo" });
    expect(selBarView(p, null, true)).toMatchObject({ pos: "DEF", onPitch: false, captain: false, kick: "TELLO · del banquillo · en la mano", txt: "Toca a quién sustituye o un hueco libre" });
    expect(selBarView({ ...p, pos: "POR" }, null, false).gk).toBe(true);
    expect(selBarView({ ...p, pos: undefined }, null, false).pos).toBe("—");
  });
});

describe("the rail", () => {
  it("En el campo, then Gestión: the 1–8 order", () => {
    expect(RAIL.map((g) => g.g)).toEqual(["En el campo", "Gestión"]);
    expect(RAIL_ORDER).toEqual(["editar", "quimica", "jugadas", "dibujar", "tableros", "comparar", "compartir", "ajustes"]);
  });
});
