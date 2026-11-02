// r14 «La pizarra» · Tableros: the place's own UI state (filters, the selected card, the comparison, the rename and
// tag drafts, the pending delete). One copy for the lead, stage, side, peek, panel and the sheets (the prototype's
// window.__PB): it is how you look, not what you change, so it is neither undoable nor saved.
import { useSyncExternalStore } from "react";

export type Filtro = "todos" | "mios" | "oficial" | "equipo";
export type Orden = "recientes" | "nombre" | "partido";
export type CmpView = "a" | "juntos" | "b";

export interface PbPend {
  /** What is waiting to go (a board, la mesa's copies, the official being taken off). */
  kind: "board" | "mesa" | "quitar";
  ids: string[];
  name: string;
  group: "mine" | "team" | "off";
  until: number;
}

export interface PbState {
  filtro: Filtro;
  q: string;
  orden: Orden;
  sel: string | null;
  editing: string | null;
  draft: string;
  nameErr: string;
  tagDraft: string;
  tagErr: string;
  pend: PbPend | null;
  confirmDel: string | null;
  cmpA: string | null;
  cmpB: string | null;
  view: CmpView;
  newsOk: boolean;
  linkAsk: string | null;
  linkAll: boolean;
  /** Boards just made here (the card plays its entrance once). */
  seen: Record<string, number>;
  /** An operation on its way (rename, link, new board…): its buttons wait. */
  busy: string;
  /** Boards on their way out (deleted, 12 s to undo): hidden from the gallery until then (ms). */
  hidden: Record<string, number>;
}

const INIT: PbState = { filtro: "todos", q: "", orden: "recientes", sel: null, editing: null, draft: "", nameErr: "", tagDraft: "", tagErr: "", pend: null, confirmDel: null, cmpA: null, cmpB: null, view: "juntos", newsOk: false, linkAsk: null, linkAll: false, seen: {}, busy: "", hidden: {} };

let S: PbState = { ...INIT, orden: readOrden() };
let subs: (() => void)[] = [];

function readOrden(): Orden {
  try {
    const v = typeof localStorage === "undefined" ? null : localStorage.getItem("mp_pizarra_orden");
    return v === "nombre" || v === "partido" ? v : "recientes";
  } catch {
    return "recientes";
  }
}

export const pb = {
  get: (): PbState => S,
  set(patch: Partial<PbState> | ((s: PbState) => Partial<PbState>)): void {
    const p = typeof patch === "function" ? patch(S) : patch;
    S = { ...S, ...p };
    if (p.orden) {
      try {
        localStorage.setItem("mp_pizarra_orden", p.orden);
      } catch {
        /* private mode */
      }
    }
    subs.slice().forEach((f) => f());
  },
  reset(): void {
    S = { ...INIT, orden: S.orden, seen: {}, hidden: {} };
    subs.slice().forEach((f) => f());
  },
  subscribe(fn: () => void): () => void {
    subs.push(fn);
    return () => {
      subs = subs.filter((x) => x !== fn);
    };
  },
};

/** The place's UI state; the component re-renders when it changes. */
export function usePb(): PbState {
  return useSyncExternalStore(pb.subscribe, pb.get, pb.get);
}
