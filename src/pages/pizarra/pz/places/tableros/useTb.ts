// r14 «La pizarra» · Tableros: what every region of the place reads (the store, the place's UI state, the board
// operations, the history snapshots) and the small moves they share (open, select, compare, delete with 12 s).
import { usePz } from "../../store/context";
import type { PzApi } from "../../store/api";
import type { PzBoard } from "../../store/types";
import { useBoardHistory } from "../../../data/history";
import { pb, usePb, type PbState } from "./pb";
import { useTablerosOps, type TablerosOps } from "./ops";
import type { CmpCtx } from "./tablerosView";

export interface Tb {
  P: PzApi;
  U: PbState;
  ops: TablerosOps;
  /** The season's boards as the gallery shows them (no draft, none on its way out). */
  boards: PzBoard[];
  /** The official (null while it is being taken off). */
  off: PzBoard | null;
  /** The board on screen (null = the draft). */
  cur: PzBoard | null;
  selId: string | null;
  sel: PzBoard | null;
  mine: (b: PzBoard) => boolean;
  canCreate: boolean;
  ctx: CmpCtx;
  histLoading: boolean;
}

export function useTb(): Tb {
  const P = usePz();
  const U = usePb();
  const ops = useTablerosOps(P);
  // (the store's clock: render stays pure; a hidden board shows again only if its delete failed)
  const now = P.state.W.now;
  const gone = (id: string) => (U.hidden[id] ?? 0) > now || (U.pend?.kind === "mesa" && U.pend.ids.includes(id));
  const boards = P.sel.boards().filter((b) => !b.draft && !gone(b.id));
  const quitting = U.pend?.kind === "quitar" ? U.pend.ids[0] : null;
  const off0 = P.sel.official();
  const off = off0 && off0.id !== quitting && !gone(off0.id) ? off0 : null;
  const cur0 = P.sel.board();
  const cur = cur0 && !cur0.draft ? cur0 : null;
  const has = (id: string | null | undefined) => !!id && boards.some((b) => b.id === id);
  const selId = has(U.sel) ? U.sel : has(cur?.id) ? (cur?.id ?? null) : off ? off.id : (boards[0]?.id ?? null);
  const sel = selId ? (boards.find((b) => b.id === selId) ?? null) : null;
  const m = P.sel.me();
  const canCreate = m.member && !m.socia && P.state.estado !== "cargando" && P.state.estado !== "error";
  // the history of the board on screen (Comparar's «Cómo estaba») and of the selected one (the inspector)
  const hCur = useBoardHistory(cur?.id ?? null, P.state.route.place === "tableros");
  const hSel = useBoardHistory(sel && sel.id !== cur?.id ? sel.id : null, P.state.route.place === "tableros");
  const snaps: CmpCtx["snaps"] = {};
  if (cur) snaps[cur.id] = hCur.snaps;
  if (sel && sel.id !== cur?.id) snaps[sel.id] = hSel.snaps;
  return {
    P,
    U,
    ops,
    boards,
    off,
    cur,
    selId,
    sel,
    mine: (b) => b.ownerUid === m.uid,
    canCreate,
    ctx: { snaps },
    histLoading: hCur.loading || hSel.loading,
  };
}

/** Open a board in Siete. */
export function openIn(P: PzApi, id: string): void {
  if (P.state.boardId !== id) P.act.openBoard(id);
  P.nav("/pizarra/siete");
}

/** Select a card (its details on the right; on the phone, the pitch previews it). */
export function pick(P: PzApi, b: PzBoard): void {
  pb.set({ sel: b.id, editing: null, nameErr: "", tagErr: "", confirmDel: null, tagDraft: "" });
  P.say("«" + b.name + "» seleccionado");
}

/** Comparar A and B (keys of tablerosView.itemOf). */
export function goCmp(P: PzApi, a: string | null, b: string | null): void {
  pb.set({ cmpA: a, cmpB: b, view: "juntos" });
  P.act.closeSheet();
  P.nav("/pizarra/tableros/comparar");
}

/** Delete with 12 s to undo (the session deletes it then); the gallery keeps a «Deshacer» card meanwhile. */
export function del(P: PzApi, b: PzBoard, group: "mine" | "team"): void {
  const before = P.state.hist.undo.length;
  P.act.deleteBoard(b.id);
  if (P.state.hist.undo.length === before) return;
  const until = Date.now() + 12000;
  const hide = () => pb.set((s) => ({ hidden: { ...s.hidden, [b.id]: until + 6000 } }));
  const show = () =>
    pb.set((s) => {
      const hidden = { ...s.hidden };
      delete hidden[b.id];
      return { hidden, pend: s.pend?.kind === "board" && s.pend.ids[0] === b.id ? null : s.pend };
    });
  // the store's entry undoes the session's delete; it also brings the card back here
  const e = P.state.hist.undo[P.state.hist.undo.length - 1];
  const u = e.undo;
  const r = e.redo;
  e.undo = () => {
    u();
    show();
  };
  e.redo = () => {
    r();
    hide();
  };
  hide();
  pb.set({ pend: { kind: "board", ids: [b.id], name: b.name, group, until }, confirmDel: null, sel: null });
  P.act.closeSheet();
}

/** The pending card's «Deshacer»: only while its entry is still the last one (else the toolbar's Deshacer). */
export function undoPend(P: PzApi, U: PbState): void {
  const pd = U.pend;
  if (!pd) return;
  const top = P.state.hist.undo[P.state.hist.undo.length - 1];
  const want = pd.kind === "board" ? "«" + pd.name + "» borrado" : pd.kind === "mesa" ? pd.name : "Ya no hay oficial publicado";
  if (top && top.label === want) {
    P.act.undo();
    pb.set({ pend: null, ...(pd.kind === "board" ? { sel: pd.ids[0] } : {}) });
  } else {
    pb.set({ pend: null });
    P.toast("Ya no se puede recuperar desde aquí: usa Deshacer arriba");
  }
}
