// The board being edited: which one (a deep link, the last one opened here, your latest, or a fresh
// draft that becomes a board on its first change), its lineup (your unsaved edits over the stored doc),
// whether you may edit it (useLineups' docs + the lineups rules: your own non-official boards; admins
// any), and the autosave (one write ~1s after the last change; pending edits are flushed on leave).
// Around it, your boards: open, new, copy, rename (unique per owner and season), delete (with a few
// seconds to undo), the linked match and the official (admins publish it for a match or the season).
// What changes under the board (another tab, a new official, a board deleted elsewhere, a failed
// save) comes back as a notice for the board to say.
import { useEffect, useMemo, useRef, useState, useSyncExternalStore } from "react";
import type { Lineup } from "../formations";
import { seedLineup } from "../lineupOps";
import { dataToLineupDoc, extractLineup, lineupToData, type LineupDoc } from "../lineupDoc";
import type { UseLineups } from "../useLineups";
import { apiError } from "../../../lib/clubApi";
import { cleanName, copyName, nameError, uniqueName } from "./boards";
import { normalize, withBench } from "./ops";
import { deepTablero } from "./deeplink";

export type SaveStatus = "draft" | "saving" | "saved" | "error" | "offline";

export interface BoardSession {
  /** Changes when another board (or season) is shown: per-board UI state resets on it. */
  key: string;
  ready: boolean;
  /** The stored board's id (null = the draft, not stored yet). */
  id: string | null;
  name: string;
  lineup: Lineup;
  readOnly: boolean;
  official: boolean;
  /** Nickname of the board's owner (for a read-only board that is not the official). */
  owner: string;
  matchId: string | null;
  status: SaveStatus;
  savedAt: number | null;
  /** Your boards this season (the ones being deleted left out), and the season's officials. */
  mine: LineupDoc[];
  officials: LineupDoc[];
  /** Something the board should say: changed in another tab, a new official, deleted elsewhere… */
  notice: { n: number; msg: string } | null;
  commit: (next: Lineup) => void;
  /** Read-only board: make it yours (a copy you can edit) and open it. */
  duplicate: () => void;
  /** Back to your own board (the latest; a draft if you have none). */
  openMine: () => void;
  open: (id: string) => void;
  /** A new empty board (the same system), opened. */
  newBoard: () => Promise<string>;
  /** A copy of a board (null = the one on screen, with its unsaved edits); returns the copy's name. */
  copyBoard: (id: string | null, openIt: boolean) => Promise<string>;
  /** Rename the board on screen (rejects with the reason when the name can't be used). */
  rename: (name: string) => Promise<void>;
  /** Delete a board after a few seconds; the returned function undoes it meanwhile. */
  remove: (id: string) => () => void;
  /** Link the board on screen to a match (null unlinks). An official's match is its scope. */
  linkMatch: (matchId: string | null) => Promise<void>;
  /** Admins: the board on screen becomes the official for a match (or the season, null). */
  publish: (matchId: string | null) => Promise<void>;
  /** Admins: a board stops being official. */
  unpublish: (id: string) => Promise<void>;
}

export interface SessionArgs {
  seasonId: string;
  lineups: UseLineups;
  squadIds: string[];
  squadReady: boolean;
  uid: string;
  isAdmin: boolean;
  /** Name for a board born from the draft (e.g. the next match). */
  draftName: string;
}

/** How long a deleted board can still be brought back (ms). */
export const DELETE_MS = 6000;

const REMEMBER = "mp_pizarra_v2_board:";
const remembered = (seasonId: string): string | null => {
  try {
    return localStorage.getItem(REMEMBER + seasonId);
  } catch {
    return null;
  }
};
const newest = (docs: LineupDoc[]): LineupDoc | undefined =>
  docs.slice().sort((a, b) => (b.updatedAt ?? b.createdAt ?? 0) - (a.updatedAt ?? a.createdAt ?? 0))[0];

/** What a lineup looks like once stored and read back (to tell our own writes from someone else's). */
const sig = (L: Lineup): string =>
  JSON.stringify([L.formation, L.freeMode, L.slots.map((s) => [s.playerId, s.x, s.y]), L.roles, L.tactics, L.playerPositions, L.drawings, L.plays]);
const META = { ownerUid: "", ownerNickname: "", seasonId: "", name: "", isOfficial: false, matchId: null };
const storedSig = (L: Lineup, squadIds: string[]): string => sig(normalize(extractLineup(dataToLineupDoc("x", lineupToData(L, META))), squadIds));

const onlineNow = () => (typeof navigator === "undefined" ? true : navigator.onLine !== false);
function subscribeOnline(cb: () => void): () => void {
  window.addEventListener("online", cb);
  window.addEventListener("offline", cb);
  return () => {
    window.removeEventListener("online", cb);
    window.removeEventListener("offline", cb);
  };
}

interface Choice {
  season: string;
  id: string | null;
  /** Just created here: keep it even before the store lists it. */
  fresh?: boolean;
  /** Born from the draft: it keeps the draft's key, so its history and selection carry on. */
  keepKey?: string;
  /** The name it was created with (until the store lists it). */
  name?: string;
}
interface Local {
  key: string;
  lineup: Lineup;
  dirty: boolean;
}
/** What was on screen at the last render (to notice what changed under it). */
interface Watch {
  season: string;
  key: string;
  id: string | null;
  sig: string | null;
  official: boolean;
  matchId: string | null;
  owner: string;
  squad: string[];
}

export function useBoardSession({ seasonId, lineups, squadIds, squadReady, uid, isAdmin, draftName }: SessionArgs): BoardSession {
  const [deep] = useState(deepTablero);
  const [deepChecked, setDeepChecked] = useState(false);
  const [choice, setChoice] = useState<Choice | null>(null);
  const [local, setLocal] = useState<Local | null>(null);
  const [saved, setSaved] = useState<{ key: string; status: "saving" | "saved" | "error"; at: number } | null>(null);
  const [hidden, setHidden] = useState<string[]>([]);
  const [notice, setNotice] = useState<{ n: number; msg: string } | null>(null);
  const [sent, setSent] = useState<{ key: string; sig: string } | null>(null);
  const [watch, setWatch] = useState<Watch | null>(null);
  const creating = useRef(false);
  const failing = useRef(false);
  const deleting = useRef(new Map<string, number>());
  const online = useSyncExternalStore(subscribeOnline, onlineNow, () => true);
  const tell = (msg: string) => setNotice((p) => ({ n: (p?.n ?? 0) + 1, msg }));

  const all = useMemo(() => {
    const seen = new Set<string>();
    return [...lineups.all, ...lineups.mine, ...lineups.official].filter((d) => (seen.has(d.id) ? false : (seen.add(d.id), true)));
  }, [lineups.all, lineups.mine, lineups.official]);
  const mineV = useMemo(() => lineups.mine.filter((d) => !hidden.includes(d.id)), [lineups.mine, hidden]);
  const officials = useMemo(() => lineups.official.filter((d) => d.isOfficial && !hidden.includes(d.id)), [lineups.official, hidden]);
  const find = (id: string | null) => (id && !hidden.includes(id) ? all.find((d) => d.id === id) : undefined);

  let id: string | null;
  if (choice && choice.season === seasonId && (choice.id === null || choice.fresh || find(choice.id))) id = choice.id && !hidden.includes(choice.id) ? choice.id : null;
  else {
    const mem = remembered(seasonId);
    id = (deep && find(deep)?.id) || (mem && mineV.find((d) => d.id === mem)?.id) || newest(mineV)?.id || null;
  }
  const doc = find(id);
  const key = (choice?.season === seasonId && choice.id === id && choice.keepKey) || `${seasonId}:${id ?? "draft"}`;
  const ready = squadReady && !lineups.loading;
  const readOnly = !!doc && !(isAdmin || (doc.ownerUid === uid && !doc.isOfficial));
  const freshName = choice?.season === seasonId && choice.id === id && id ? choice.name : undefined;
  const name = doc?.name ?? freshName ?? draftName;

  const base = useMemo(() => normalize(doc ? extractLineup(doc) : seedLineup("2-3-1", []), squadIds), [doc, squadIds]);
  const baseSig = useMemo(() => (doc ? sig(base) : null), [doc, base]);
  const mine = local && local.key === key ? local : null;
  const lineup = mine && (mine.dirty || !doc) ? mine.lineup : base;

  // ── what changed under the board since the last render (derived while rendering, said once) ──
  if (ready) {
    const cur: Watch = { season: seasonId, key, id, sig: baseSig, official: !!doc?.isOfficial, matchId: doc?.matchId ?? null, owner: doc?.ownerUid ?? "", squad: squadIds };
    const w = watch;
    if (!w || w.key !== cur.key || w.id !== cur.id || w.sig !== cur.sig || w.official !== cur.official || w.squad !== cur.squad) {
      let msg: string | null = null;
      if (w && w.season === seasonId && w.id) {
        if (w.id === cur.id && w.key === cur.key) {
          if (w.official && !cur.official) {
            const repl = officials.find((d) => d.id !== w.id && (d.matchId ?? null) === w.matchId);
            if (repl) {
              msg = "Hay un oficial nuevo: «" + repl.name + "»";
              // whoever was only looking at the official goes on looking at the official
              if (w.owner !== uid && !isAdmin) setChoice({ season: seasonId, id: repl.id });
            } else msg = "Este tablero ya no es el oficial";
          } else if (w.sig !== cur.sig && cur.sig && w.squad === cur.squad && !(sent?.key === key && sent.sig === cur.sig)) {
            msg = mine?.dirty ? "Otra pestaña ha cambiado este tablero: se queda tu versión" : "Tablero actualizado desde otra pestaña o dispositivo";
          }
        } else if (w.id !== cur.id && !all.some((d) => d.id === w.id) && !hidden.includes(w.id)) {
          msg = "Ese tablero se ha borrado en otro dispositivo";
        }
      }
      setWatch(cur);
      if (msg) tell(msg);
    }
    if (deep && !deepChecked) {
      setDeepChecked(true);
      if (!all.some((d) => d.id === deep)) tell("Ese tablero ya no existe o no es de esta temporada");
    }
  }

  // Latest values for the timers and the leave-flush (written after render, read in callbacks).
  const latest = useRef({ save: lineups.save, remove: lineups.remove, id, pending: null as Lineup | null });
  useEffect(() => {
    latest.current = { save: lineups.save, remove: lineups.remove, id, pending: mine?.dirty && id && !readOnly ? mine.lineup : null };
  });

  // Remember the board for the next visit (per season).
  useEffect(() => {
    if (!ready || !id) return;
    try {
      localStorage.setItem(REMEMBER + seasonId, id);
    } catch {
      /* private mode */
    }
  }, [ready, id, seasonId]);

  // Autosave: one write ~1s after the last change (again when the connection comes back).
  useEffect(() => {
    if (!mine?.dirty || !id || readOnly) return;
    const snapshot = mine.lineup;
    const t = window.setTimeout(() => {
      setSaved({ key, status: "saving", at: 0 });
      setSent({ key, sig: storedSig(snapshot, squadIds) });
      latest.current
        .save(id, snapshot)
        .then(() => {
          failing.current = false;
          setLocal((p) => (p && p.key === key && p.lineup === snapshot ? { ...p, dirty: false } : p));
          setSaved({ key, status: "saved", at: Date.now() });
        })
        .catch((err: unknown) => {
          console.error("No se pudo guardar el tablero", err);
          // said once per run of failures, not on every retry
          if (!failing.current) tell(apiError(err));
          failing.current = true;
          setSaved({ key, status: "error", at: 0 });
        });
    }, 1000);
    return () => window.clearTimeout(t);
  }, [mine, id, readOnly, key, online, squadIds]);

  // Leaving this board (another board or season, or the page) with an edit still waiting for its write:
  // write it now. The cleanup runs before `latest` moves on, so it still holds the board being left.
  useEffect(
    () => () => {
      const { save, id: lid, pending } = latest.current;
      if (lid && pending) save(lid, pending).catch((err: unknown) => console.error("No se pudo guardar el tablero", err));
    },
    [key],
  );
  // Leaving the page with a delete still waiting: it goes through now.
  useEffect(() => {
    const timers = deleting.current;
    return () => {
      timers.forEach((t, did) => {
        window.clearTimeout(t);
        latest.current.remove(did).catch((err: unknown) => console.error("No se pudo borrar el tablero", err));
      });
      timers.clear();
    };
  }, []);

  /** Open a board just created here (shown with its lineup even before the store lists it). */
  const openFresh = (nid: string, L: Lineup, nm: string) => {
    setChoice({ season: seasonId, id: nid, fresh: true, name: nm });
    setLocal({ key: `${seasonId}:${nid}`, lineup: L, dirty: false });
  };
  const taken = () => mineV.map((d) => d.name);

  /** The draft becomes a stored board (once); resolves to its id. */
  const ensureId = async (): Promise<string> => {
    if (id) return id;
    if (creating.current) throw new Error("Guardando el tablero: inténtalo en un momento.");
    creating.current = true;
    const k0 = key;
    const L = withBench(lineup, squadIds);
    const nm = uniqueName(draftName, taken());
    try {
      setSent({ key: k0, sig: storedSig(L, squadIds) });
      const nid = await lineups.create(L, nm);
      setChoice({ season: seasonId, id: nid, fresh: true, keepKey: k0, name: nm });
      setLocal((p) => (p && p.key === k0 ? { ...p, dirty: p.lineup !== L } : p));
      setSaved({ key: k0, status: "saved", at: Date.now() });
      return nid;
    } finally {
      creating.current = false;
    }
  };

  const commit = (next: Lineup) => {
    if (!ready || readOnly) return;
    const L = withBench(next, squadIds);
    setLocal({ key, lineup: L, dirty: true });
    if (id || creating.current) return;
    // The draft becomes a board on its first change.
    creating.current = true;
    const k0 = key;
    const nm = uniqueName(draftName, taken());
    setSent({ key: k0, sig: storedSig(L, squadIds) });
    lineups
      .create(L, nm)
      .then((nid) => {
        setChoice({ season: seasonId, id: nid, fresh: true, keepKey: k0, name: nm });
        setLocal((p) => (p && p.key === k0 ? { ...p, dirty: p.lineup !== L } : p));
        setSaved({ key: k0, status: "saved", at: Date.now() });
      })
      .catch((err: unknown) => {
        console.error("No se pudo crear el tablero", err);
        setSaved({ key: k0, status: "error", at: 0 });
        tell(apiError(err));
      })
      .finally(() => {
        creating.current = false;
      });
  };

  const copyBoard = async (srcId: string | null, openIt: boolean): Promise<string> => {
    const other = srcId && srcId !== id ? find(srcId) : undefined;
    if (srcId && srcId !== id && !other) throw new Error("Ese tablero ya no existe");
    const L = other ? normalize(extractLineup(other), squadIds) : lineup;
    const src = other ?? doc;
    const nm = copyName(src?.name ?? name, !!src?.isOfficial, taken());
    const stored = withBench(L, squadIds);
    const nid = await lineups.create(stored, nm);
    if (openIt) openFresh(nid, stored, nm);
    return nm;
  };

  const duplicate = () => {
    if (!doc) return;
    copyBoard(null, true).catch((err: unknown) => {
      console.error("No se pudo duplicar el tablero", err);
      tell(apiError(err));
    });
  };

  const openMine = () => {
    setChoice({ season: seasonId, id: newest(mineV)?.id ?? null });
  };

  const open = (oid: string) => {
    if (oid === id) return;
    setChoice({ season: seasonId, id: oid });
  };

  const newBoard = async (): Promise<string> => {
    const L = withBench({ ...seedLineup(lineup.formation, []) }, squadIds);
    const nm = uniqueName("Tablero nuevo", taken());
    const nid = await lineups.create(L, nm);
    openFresh(nid, L, nm);
    return nm;
  };

  const rename = async (raw: string): Promise<void> => {
    if (!ready || readOnly) throw new Error("Este tablero es de solo lectura");
    const nm = cleanName(raw);
    const owner = doc?.ownerUid ?? uid;
    const err = nameError(nm, all.filter((d) => d.ownerUid === owner && !hidden.includes(d.id)), id);
    if (err) throw new Error(err);
    if (nm === name) return;
    if (!id) {
      if (creating.current) throw new Error("Guardando el tablero: inténtalo en un momento.");
      creating.current = true;
      const k0 = key;
      const L = withBench(lineup, squadIds);
      try {
        const nid = await lineups.create(L, nm);
        setChoice({ season: seasonId, id: nid, fresh: true, keepKey: k0, name: nm });
        setSaved({ key: k0, status: "saved", at: Date.now() });
      } finally {
        creating.current = false;
      }
      return;
    }
    await lineups.rename(id, nm);
  };

  const remove = (rid: string): (() => void) => {
    const wasOpen = rid === id;
    setHidden((h) => (h.includes(rid) ? h : [...h, rid]));
    if (wasOpen) setChoice({ season: seasonId, id: newest(mineV.filter((d) => d.id !== rid))?.id ?? null });
    const t = window.setTimeout(() => {
      deleting.current.delete(rid);
      latest.current.remove(rid).catch((err: unknown) => {
        console.error("No se pudo borrar el tablero", err);
        setHidden((h) => h.filter((x) => x !== rid));
        tell(apiError(err));
      });
    }, DELETE_MS);
    deleting.current.set(rid, t);
    return () => {
      if (!deleting.current.has(rid)) return;
      window.clearTimeout(t);
      deleting.current.delete(rid);
      setHidden((h) => h.filter((x) => x !== rid));
      if (wasOpen) setChoice({ season: seasonId, id: rid });
    };
  };

  const linkMatch = async (matchId: string | null): Promise<void> => {
    if (!ready || readOnly) throw new Error("Este tablero es de solo lectura");
    if (doc?.isOfficial) {
      await lineups.markOfficial(doc.id, { matchId });
      return;
    }
    const bid = await ensureId();
    const L = withBench(lineup, squadIds);
    setSent({ key, sig: storedSig(L, squadIds) });
    await lineups.save(bid, L, matchId);
  };

  const publish = async (matchId: string | null): Promise<void> => {
    if (!isAdmin) throw new Error("Solo los capitanes y los admins publican el oficial.");
    if (!ready || readOnly) throw new Error("Este tablero es de solo lectura");
    const bid = await ensureId();
    await lineups.markOfficial(bid, { matchId });
  };

  const unpublish = async (oid: string): Promise<void> => {
    if (!isAdmin) throw new Error("Solo los capitanes y los admins quitan el oficial.");
    await lineups.markOfficial(oid, null);
  };

  const sv = saved && saved.key === key ? saved : null;
  const pending = !!mine?.dirty || sv?.status === "saving";
  const status: SaveStatus = !id
    ? sv?.status === "error"
      ? "error"
      : mine?.dirty
        ? online
          ? "saving"
          : "offline"
        : "draft"
    : sv?.status === "error"
      ? "error"
      : pending
        ? online
          ? "saving"
          : "offline"
        : "saved";

  return {
    key,
    ready,
    id,
    name,
    lineup,
    readOnly,
    official: !!doc?.isOfficial,
    owner: doc?.ownerNickname ?? "",
    matchId: doc?.matchId ?? null,
    status,
    savedAt: sv?.status === "saved" ? Math.max(sv.at, doc?.updatedAt ?? 0) : (doc?.updatedAt ?? null),
    mine: mineV,
    officials,
    notice,
    commit,
    duplicate,
    openMine,
    open,
    newBoard,
    copyBoard,
    rename,
    remove,
    linkMatch,
    publish,
    unpublish,
  };
}
