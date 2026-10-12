// The prompt bar's contents (pure): the shortcuts of the moment and, with a player in the hand, his
// actions. The items that act carry the same handler the key runs; the rest only teach the key.
import type { Modo } from "./view";

export interface PromptCtx {
  modo: Modo;
  /** Read-only (or still loading): nothing that edits is offered. */
  ro: boolean;
  /** The player in the hand (from the pitch or the bench). */
  hand: { k: "p" | "b"; name: string; rt: number | string } | null;
  benchView: "lista" | "cromos";
  /** The replay (Jugadas) or the charla is playing. */
  playing: boolean;
  /** Jugadas: the paso's pieces can be dragged. */
  pieces: boolean;
  /** Dibujar: a stroke is marked (the arrows move it, Supr deletes it). */
  marked?: boolean;
}

export interface PromptActs {
  /** The lineup's undo (the siete). */
  undo: () => void;
  undoStroke: () => void;
  redoStroke: () => void;
  /** The jugadas' own undo (their edits). */
  undoJugada: () => void;
  captain: () => void;
  galones: () => void;
  ficha: () => void;
  drop: () => void;
  toggle: () => void;
  prev: () => void;
  next: () => void;
  siete: () => void;
  exitCharla: () => void;
}

export interface PromptItem {
  /** The key (or the player's rating, for the one in the hand). */
  k: string;
  t: string;
  go?: () => void;
  cls?: string;
}

/** The context's key: a new one plays the items in again. */
export function promptKey(c: PromptCtx): string {
  if (c.modo === "editar" && c.hand) return "s" + c.hand.k + c.hand.name;
  return c.modo + (c.ro ? ":ro" : "") + (c.marked ? ":m" : "");
}

/** What the prompt bar offers right now (as designed: the hand, then each tool). */
export function promptItems(c: PromptCtx, a: PromptActs): PromptItem[] {
  const back: PromptItem = { k: "Esc", t: "Volver al siete", go: a.siete };
  if (c.modo === "editar" && c.hand && !c.ro) {
    const who: PromptItem = { k: String(c.hand.rt), t: c.hand.name + " en la mano", cls: "who" };
    if (c.hand.k === "p")
      return [who, { k: "Clic", t: "Cambiar con otro o con un hueco" }, { k: "C", t: "Capitán", go: a.captain }, { k: "G", t: "Galones", go: a.galones }, { k: "F", t: "Ficha", go: a.ficha }, { k: "Esc", t: "Soltar", go: a.drop }];
    return [who, { k: "Clic", t: "Entra por un cromo del campo" }, { k: "F", t: "Ficha", go: a.ficha }, { k: "Esc", t: "Soltar", go: a.drop }];
  }
  if (c.modo === "editar") {
    const view: PromptItem = { k: "R", t: c.benchView === "lista" ? "Ver en cromos" : "Ver en lista" };
    if (c.ro) return [{ k: "Q E", t: "Pestañas" }, view, { k: "1–8", t: "Herramientas" }];
    return [{ k: "Clic", t: "Elegir jugador" }, { k: "Arrastra", t: "Mover al campo" }, { k: "Q E", t: "Pestañas" }, view, { k: "1–8", t: "Herramientas" }, { k: "Ctrl Z", t: "Deshacer", go: a.undo }];
  }
  if (c.modo === "jugadas")
    return [
      { k: "Espacio", t: c.playing ? "Pausa" : "Reproducir", go: a.toggle },
      { k: "←", t: "Paso anterior", go: a.prev },
      { k: "→", t: "Paso siguiente", go: a.next },
      ...(c.pieces ? [{ k: "Arrastra", t: "Retocar el paso" }, { k: "Tab ←↑→↓", t: "Mover una ficha (⇧ más lejos)" }] : []),
      // (Ctrl Z here undoes the jugadas' edits, never the siete hidden behind them)
      ...(c.ro ? [] : [{ k: "Ctrl Z", t: "Deshacer en la jugada", go: a.undoJugada }]),
      back,
    ];
  if (c.modo === "dibujar")
    return c.ro
      ? [back]
      : c.marked
        ? [{ k: "←↑→↓", t: "Mover el trazo (⇧ más lejos)" }, { k: "Supr", t: "Borrar el trazo" }, { k: "Esc", t: "Desmarcar" }, { k: "Ctrl Z", t: "Deshacer trazo", go: a.undoStroke }]
        : [{ k: "Arrastra", t: "Dibujar en el césped" },{ k: "Ctrl Z", t: "Deshacer trazo", go: a.undoStroke }, { k: "Ctrl ⇧ Z", t: "Rehacer trazo", go: a.redoStroke }, back];
  if (c.modo === "charla")
    return [
      { k: "Espacio", t: c.playing ? "Pausa" : "Reproducir", go: a.toggle },
      { k: "←", t: "Paso anterior", go: a.prev },
      { k: "→", t: "Paso siguiente", go: a.next },
      { k: "Esc", t: "Salir de la charla", go: a.exitCharla },
    ];
  if (c.modo === "quimica") return c.ro ? [{ k: "1–8", t: "Herramientas" }, back] : [{ k: "Clic", t: "Cambia a un jugador y mira cómo se reencienden las luces" }, back];
  return [{ k: "1–8", t: "Herramientas" }, back];
}

