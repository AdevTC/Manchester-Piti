// r14 «La pizarra» · Tableros: the board operations the store doesn't have (MARCO § 3: «lo que el store NO hace por
// ti»): new boards from an origin, duplicate with its voices, rename with its errors, link to a match, take the
// official off (12 s to undo), recover a snapshot, clean la mesa's copies. A thin adapter over the app's own data
// operations (useLineups — the same season query, shared through the cache —, data/boards, data/history), every
// change undoable through the store's history and said with a toast.
import { useMemo } from "react";
import { doc, serverTimestamp, updateDoc } from "firebase/firestore";
import { db } from "../../../../../firebase";
import { apiError } from "../../../../../lib/clubApi";
import { useAuth } from "../../../../../context/AuthContext";
import { useLineups, type UseLineups } from "../../../useLineups";
import { seedLineup } from "../../../lineupOps";
import { normalize, withBench } from "../../../v2/ops";
import { cleanName, copyName, nameError, uniqueName } from "../../../v2/boards";
import { copyBoardVoices, deleteMesaCopies, isMesaCopy, mesaCopiesToClean } from "../../../data/boards";
import { restoreFrom, type HistorySnap } from "../../../data/history";
import type { LineupDoc } from "../../../lineupDoc";
import type { FormationName, Lineup } from "../../../formations";
import type { PzApi } from "../../store/api";
import type { PzState } from "../../store/types";
import { pb } from "./pb";

/** Resolves true once `ok(state)` holds (the new board reached the store), false after `ms`. */
export function whenStore(P: PzApi, ok: (S: PzState) => boolean, ms = 8000): Promise<boolean> {
  if (ok(P.state)) return Promise.resolve(true);
  return new Promise((resolve) => {
    let off: () => void = () => undefined;
    const t = window.setTimeout(() => {
      off();
      resolve(false);
    }, ms);
    off = P.subscribe(() => {
      if (!ok(P.state)) return;
      window.clearTimeout(t);
      off();
      resolve(true);
    });
  });
}

/** Writes that wait their 12 s (taking the official off, la mesa's copies): run at once if the page goes away. */
const waiting = new Map<string, { t: number; run: () => void }>();
function arm(key: string, run: () => void, ms = 12000): () => boolean {
  const t = window.setTimeout(() => {
    waiting.delete(key);
    run();
  }, ms);
  waiting.set(key, { t, run });
  return () => {
    const w = waiting.get(key);
    if (!w) return false;
    window.clearTimeout(w.t);
    waiting.delete(key);
    return true;
  };
}
if (typeof window !== "undefined") {
  window.addEventListener("pagehide", () => {
    waiting.forEach((w) => {
      window.clearTimeout(w.t);
      w.run();
    });
    waiting.clear();
  });
}

export interface NewSeed {
  formation: FormationName;
  /** Player ids by slot (null = an empty spot). */
  ids: (string | null)[];
  name: string;
  /** The match it is for (default: the next one). */
  matchId?: string | null;
}

export interface TablerosOps {
  /** The season's stored boards (their meta: fromMesa…), by id. */
  doc(id: string): LineupDoc | undefined;
  isMesa(id: string): boolean;
  /** La mesa's copies a captain can clean (not official, of matches already played). */
  mesaCopies(): string[];
  create(seed: NewSeed): Promise<string | null>;
  duplicate(id: string): Promise<string | null>;
  /** "" when it went (or nothing changed), else why not. */
  rename(id: string, raw: string): Promise<string>;
  link(id: string, matchId: string | null): Promise<void>;
  quitarOficial(id: string): void;
  restore(id: string, snap: HistorySnap): void;
  cleanMesa(): void;
}

export function makeOps(P: PzApi, lineups: Pick<UseLineups, "all" | "create" | "rename" | "remove" | "markOfficial">, uid: string): TablerosOps {
  const docOf = (id: string) => lineups.all.find((d) => d.id === id);
  const squadIds = () => P.state.W.squad.map((p) => p.id);
  const mineNames = (owner: string) => lineups.all.filter((d) => d.ownerUid === owner).map((d) => d.name);
  const fail = (what: string, e: unknown) => {
    console.error(what, e);
    P.toast(what + ": " + apiError(e), { icon: "warn" });
  };
  /** The new board reached the store: open it and keep it selected. */
  const openNew = async (nid: string, place: "siete" | "tableros") => {
    const there = await whenStore(P, (S) => S.W.boards.some((b) => b.id === nid));
    if (!there) return;
    pb.set((s) => ({ sel: nid, seen: { ...s.seen, [nid]: Date.now() } }));
    P.act.openBoard(nid);
    if (place === "siete") {
      await whenStore(P, (S) => S.boardId === nid, 4000);
      P.nav("/pizarra/siete");
    }
  };
  const removeNow = (id: string) => lineups.remove(id).catch((e: unknown) => fail("No se ha podido deshacer", e));

  const ops: TablerosOps = {
    doc: docOf,
    isMesa: (id) => {
      const d = docOf(id);
      return !!d && isMesaCopy(d);
    },
    mesaCopies: () => mesaCopiesToClean(lineups.all, (mid) => !!P.state.W.matches.find((m) => m.id === mid)?.played).map((d) => d.id),
    async create(seed) {
      const m = P.sel.me();
      if (!m.member || m.socia) {
        P.toast("Para tener tableros, entra con tu ficha");
        return null;
      }
      pb.set({ busy: "nuevo" });
      try {
        const L0 = seedLineup(seed.formation, []);
        const L = withBench({ ...L0, slots: L0.slots.map((s, i) => ({ ...s, playerId: seed.ids[i] ?? null })) }, squadIds());
        const name = uniqueName(seed.name, mineNames(uid));
        const matchId = seed.matchId === undefined ? P.state.W.next : seed.matchId;
        const nid = await lineups.create(L, name, matchId);
        P.act.closeSheet();
        const undo = () => void removeNow(nid);
        P.pushUndo("Tablero nuevo: «" + name + "»", undo, () => void ops.create(seed), { toast: false });
        P.toast("Tablero nuevo: «" + name + "»" + (seed.ids.some(Boolean) ? "" : " · toca un hueco para empezar"), { undo: true });
        await openNew(nid, "siete");
        return nid;
      } catch (e) {
        fail("No se ha podido crear el tablero", e);
        return null;
      } finally {
        pb.set({ busy: "" });
      }
    },
    async duplicate(id) {
      const m = P.sel.me();
      const src = P.sel.board(id);
      const d = docOf(id);
      if (!src || !d) return null;
      if (!m.member || m.socia) {
        P.toast("Para editar, entra con tu ficha");
        return null;
      }
      pb.set({ busy: "copia" });
      try {
        const L: Lineup = withBench(normalize(src.lineup, squadIds()), squadIds());
        const name = copyName(src.name, src.isOfficial, mineNames(uid));
        const nid = await lineups.create(L, name, src.matchId);
        P.act.closeSheet();
        // its voices go with it (PZ-D08): never blocks the copy
        void copyBoardVoices(src.id, nid, uid).then((n) => {
          if (n == null) P.toast("Copia creada, pero la voz no se ha copiado", { icon: "warn" });
        });
        P.pushUndo("Copia creada: «" + name + "»", () => void removeNow(nid), () => void ops.duplicate(id), { toast: false });
        P.toast("Copia creada: «" + name + "» · ya puedes editarla", { undo: true });
        await openNew(nid, "tableros");
        return nid;
      } catch (e) {
        fail("No se ha podido duplicar", e);
        return null;
      } finally {
        pb.set({ busy: "" });
      }
    },
    async rename(id, raw) {
      const b = P.sel.board(id);
      if (!b || !P.sel.canEdit(b)) return "Solo lectura";
      const nm = cleanName(raw);
      const err = nameError(
        nm,
        lineups.all.filter((x) => x.ownerUid === b.ownerUid),
        id,
      );
      if (err) return b.ownerUid !== uid && err.startsWith("Ya tienes") ? "@" + b.ownerNick + " ya tiene un tablero con ese nombre" : err;
      if (nm === b.name) return "";
      const was = b.name;
      try {
        await lineups.rename(id, nm);
      } catch (e) {
        return apiError(e);
      }
      P.pushUndo(
        "Renombrado: «" + nm + "»",
        () => void lineups.rename(id, was).catch((e: unknown) => fail("No se ha podido deshacer", e)),
        () => void lineups.rename(id, nm).catch((e: unknown) => fail("No se ha podido rehacer", e)),
        { toast: false },
      );
      P.toast("Renombrado: «" + nm + "»", { undo: true });
      return "";
    },
    async link(id, matchId) {
      const b = P.sel.board(id);
      if (!b || !P.sel.canEdit(b)) return;
      const was = b.matchId;
      if (was === matchId) return;
      const write = async (mid: string | null) => {
        if (b.isOfficial) await lineups.markOfficial(id, { matchId: mid });
        else await updateDoc(doc(db, "lineups", id), { matchId: mid, updatedAt: serverTimestamp() });
      };
      try {
        await write(matchId);
      } catch (e) {
        fail("No se ha podido cambiar el partido", e);
        return;
      }
      const M = matchId ? P.state.W.matches.find((x) => x.id === matchId) : null;
      const label = M ? "Vinculado a " + (M.j ? "J" + M.j + " · " : "") + M.rival + (b.isOfficial ? ": el equipo lo ve como el oficial de ese partido" : "") : b.isOfficial ? "Ahora es el oficial de toda la temporada" : "Sin partido vinculado";
      P.pushUndo(label, () => void write(was).catch((e: unknown) => fail("No se ha podido deshacer", e)), () => void write(matchId).catch((e: unknown) => fail("No se ha podido rehacer", e)), { toast: false });
      P.toast(label, { undo: true, long: b.isOfficial });
    },
    quitarOficial(id) {
      const b = P.sel.board(id);
      if (!b || !b.isOfficial || !P.sel.me().cap) return;
      const name = b.name;
      const go = () =>
        void lineups.markOfficial(id, null).catch((e: unknown) => {
          pb.set({ pend: null });
          fail("No se ha podido quitar el oficial", e);
        });
      let cancel = arm("quitar:" + id, () => {
        pb.set((s) => (s.pend?.kind === "quitar" && s.pend.ids[0] === id ? { pend: null } : {}));
        go();
      });
      pb.set({ pend: { kind: "quitar", ids: [id], name, group: "off", until: Date.now() + 12000 } });
      P.act.closeSheet();
      P.pushUndo(
        "Ya no hay oficial publicado",
        () => {
          cancel();
          pb.set({ pend: null });
        },
        () => {
          cancel = arm("quitar:" + id, go);
          pb.set({ pend: { kind: "quitar", ids: [id], name, group: "off", until: Date.now() + 12000 } });
        },
        { toast: false },
      );
      P.toast("Ya no hay oficial publicado: «" + name + "» vuelve a ser un tablero", { undo: true, long: true });
    },
    restore(id, snap) {
      const b = P.sel.board(id);
      if (!b || !P.sel.canEdit(b)) {
        P.toast("Solo lectura: duplícalo para recuperar una foto");
        return;
      }
      const L = restoreFrom(b.lineup, snap);
      P.act.saveBoard({ formation: L.formation, freeMode: L.freeMode, slots: L.slots, roles: L.roles, takers: L.takers, tactics: L.tactics }, "Recuperado: «" + (snap.label || "la foto") + "»", { boardId: id, long: true });
    },
    cleanMesa() {
      const ids = ops.mesaCopies();
      if (!ids.length || !P.sel.me().cap) return;
      const label = ids.length === 1 ? "1 copia de la mesa borrada" : ids.length + " copias de la mesa borradas";
      const go = () =>
        void deleteMesaCopies(ids).then((failed) => {
          pb.set((s) => (s.pend?.kind === "mesa" ? { pend: null } : {}));
          if (failed.length) P.toast(failed.length === 1 ? "Una copia no se ha podido borrar" : failed.length + " copias no se han podido borrar", { icon: "warn" });
        });
      let cancel = arm("mesa", go);
      pb.set({ pend: { kind: "mesa", ids, name: label, group: "team", until: Date.now() + 12000 }, sel: null });
      P.pushUndo(
        label,
        () => {
          cancel();
          pb.set({ pend: null });
        },
        () => {
          cancel = arm("mesa", go);
          pb.set({ pend: { kind: "mesa", ids, name: label, group: "team", until: Date.now() + 12000 } });
        },
        { toast: false },
      );
      P.toast(label, { undo: true, long: true });
    },
  };
  return ops;
}

/** The operations, bound to the season on screen and who is signed in. */
export function useTablerosOps(P: PzApi): TablerosOps {
  const lineups = useLineups(P.state.W.season.id);
  const { user } = useAuth();
  const uid = user?.uid ?? "";
  // (P changes identity on every store version: the ops read it live, so the newest is fine)
  return useMemo(() => makeOps(P, lineups, uid), [P, lineups, uid]);
}
