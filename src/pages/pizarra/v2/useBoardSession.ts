// The board being edited: which one (a deep link, the last one opened here, your latest, or a fresh
// draft that becomes a board on its first change), its lineup (your unsaved edits over the stored doc),
// whether you may edit it (useLineups' docs + the lineups rules: your own non-official boards; admins
// any), and the autosave (one write ~1s after the last change, retried when it fails; pending edits are
// flushed when the page is hidden or closed and when you leave the board).
// Around it, your boards: open, new, copy, rename (unique per owner and season), delete (with a few
// seconds to undo), the linked match and the official (admins publish it for a match or the season).
// What changes under the board (another tab, a new official, a board deleted elsewhere, a failed
// save) comes back as a notice for the board to say.
import { useEffect, useMemo, useRef, useState, useSyncExternalStore } from "react";
import type { FormationName, Lineup } from "../formations";
import { seedLineup } from "../lineupOps";
import { dataToLineupDoc, extractLineup, lineupToData, type LineupDoc } from "../lineupDoc";
import type { UseLineups } from "../useLineups";
import { apiError } from "../../../lib/clubApi";
import { cleanName, copyName, nameError, uniqueName } from "./boards";
import { takersOf } from "./takers";
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
  /** A new empty board (the same system), opened; with a seed, its seven and its name. */
  newBoard: (seed?: NewBoardSeed) => Promise<string>;
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

/** What a new board starts with besides an empty seven: a system, its seven by slot, and a name. */
export interface NewBoardSeed {
  formation: FormationName;
  slots: (string | null)[];
  name: string;
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
  /** The season the URL asks for (?season=, a link to a board of another season). Until it is the season
   *  on screen, nothing is ready and the linked board is not looked for: its boards haven't arrived. */
  urlSeason?: string;
}

/** How long a deleted board can still be brought back (ms): ≥ 10 s to reach «Deshacer» (WCAG 2.2.1). */
export const DELETE_MS = 12000;
/** The autosave writes this long after the last change (ms). */
export const SAVE_DEBOUNCE_MS = 1000;
/** A failed save is tried again after these waits (ms); then on the next edit or when the connection is back. */
export const RETRY_MS = [2000, 5000, 15000] as const;
/** Refusals that a retry cannot fix (the rules said no, the board is gone, the data is invalid). */
const permanent = (err: unknown): boolean => {
  const code = (err as { code?: unknown } | null)?.code;
  return code === "permission-denied" || code === "not-found" || code === "invalid-argument";
};

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
  JSON.stringify([L.formation, L.freeMode, L.slots.map((s) => [s.playerId, s.x, s.y]), L.roles, L.tactics, L.playerPositions, L.drawings, L.plays, L.subs ?? [], takersOf(L)]);
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

export function useBoardSession({ seasonId, lineups, squadIds, squadReady, uid, isAdmin, draftName, urlSeason }: SessionArgs): BoardSession {
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
  const making = useRef<Promise<string> | null>(null);
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
  // (a link's season not adopted yet: these are another season's boards, the link's isn't among them)
  const seasonSettled = urlSeason === undefined || urlSeason === seasonId;
  const ready = squadReady && !lineups.loading && seasonSettled;
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
          } else if (w.sig && cur.sig && w.sig !== cur.sig && w.squad === cur.squad && !(sent?.key === key && sent.sig === cur.sig)) {
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
  const latest = useRef({ save: lineups.save, remove: lineups.remove, id, key, squadIds, pending: null as Lineup | null, send: (() => undefined) as (k: string, id: string, L: Lineup, quiet: boolean) => void });
  /** The debounce timer of the autosave, and the retries of a failed one. */
  const debounce = useRef(0);
  const retry = useRef({ n: 0, t: 0 });
  /** The lineup whose write is on its way (not sent again until it fails). */
  const inFlight = useRef<Lineup | null>(null);

  /**
   * Writes the board now. A failed write is retried (2 s, 5 s, 15 s, then when the connection comes
   * back) with whatever is pending then; meanwhile the status stays «Sin guardar» (`quiet` retries do
   * not flip it to «Guardando»). Reads only refs and setters: safe from any timer or listener.
   */
  const send = (k: string, bid: string, snapshot: Lineup, quiet: boolean) => {
    window.clearTimeout(debounce.current);
    window.clearTimeout(retry.current.t);
    debounce.current = 0;
    retry.current.t = 0;
    if (!quiet) setSaved({ key: k, status: "saving", at: 0 });
    setSent({ key: k, sig: storedSig(snapshot, latest.current.squadIds) });
    inFlight.current = snapshot;
    latest.current
      .save(bid, snapshot)
      .then(() => {
        if (inFlight.current === snapshot) inFlight.current = null;
        failing.current = false;
        retry.current.n = 0;
        setLocal((p) => (p && p.key === k && p.lineup === snapshot ? { ...p, dirty: false } : p));
        setSaved({ key: k, status: "saved", at: Date.now() });
      })
      .catch((err: unknown) => {
        if (inFlight.current === snapshot) inFlight.current = null;
        console.error("No se pudo guardar el tablero", err);
        // said once per run of failures, not on every retry
        if (!failing.current) tell(apiError(err));
        failing.current = true;
        setSaved({ key: k, status: "error", at: 0 });
        const n = retry.current.n;
        if (n >= RETRY_MS.length || permanent(err)) return; // the next edit, or the connection coming back, tries again
        retry.current.n = n + 1;
        retry.current.t = window.setTimeout(() => {
          retry.current.t = 0;
          const cur = latest.current;
          if (cur.key === k && cur.id === bid && cur.pending && inFlight.current !== cur.pending) cur.send(k, bid, cur.pending, true);
        }, RETRY_MS[n]);
      });
  };

  useEffect(() => {
    latest.current = { save: lineups.save, remove: lineups.remove, id, key, squadIds, pending: mine?.dirty && id && !readOnly ? mine.lineup : null, send };
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

  // The connection is back: a failed save gets its retries again (the autosave below re-runs on it).
  useEffect(() => {
    if (online) retry.current.n = 0;
  }, [online]);

  // Autosave: one write ~1s after the last change (again when the connection comes back). An edit whose
  // write is already on its way is not sent again (offline, its write waits in the cache).
  useEffect(() => {
    if (!mine?.dirty || !id || readOnly) return;
    const snapshot = mine.lineup;
    if (inFlight.current === snapshot) return;
    const t = window.setTimeout(() => latest.current.send(key, id, snapshot, false), SAVE_DEBOUNCE_MS);
    debounce.current = t;
    return () => window.clearTimeout(t);
  }, [mine, id, readOnly, key, online]);

  // Closing the tab, switching app or locking the phone: the edit waiting for its debounce is written
  // now (the page may never come back to run the timer, nor unmount).
  useEffect(() => {
    const flush = () => {
      const { id: lid, key: k, pending, send: go } = latest.current;
      if (lid && pending && inFlight.current !== pending) go(k, lid, pending, false);
    };
    const onVisibility = () => {
      if (document.visibilityState === "hidden") flush();
    };
    window.addEventListener("pagehide", flush);
    document.addEventListener("visibilitychange", onVisibility);
    return () => {
      window.removeEventListener("pagehide", flush);
      document.removeEventListener("visibilitychange", onVisibility);
    };
  }, []);

  // Leaving this board (another board or season, or the page) with an edit still waiting for its write:
  // write it now. The cleanup runs before `latest` moves on, so it still holds the board being left.
  useEffect(
    () => () => {
      window.clearTimeout(retry.current.t);
      retry.current = { n: 0, t: 0 };
      const { save, id: lid, pending } = latest.current;
      if (lid && pending && inFlight.current !== pending) {
        inFlight.current = pending;
        save(lid, pending).catch((err: unknown) => console.error("No se pudo guardar el tablero", err));
      }
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

  /** One new board at a time: a second tap while one is being made gets the same one (no extra copies). */
  const once = (make: () => Promise<string>): Promise<string> => {
    if (making.current) return making.current;
    const p = make().finally(() => {
      if (making.current === p) making.current = null;
    });
    making.current = p;
    return p;
  };

  const copyBoard = (srcId: string | null, openIt: boolean): Promise<string> => once(() => copyNow(srcId, openIt));
  const copyNow = async (srcId: string | null, openIt: boolean): Promise<string> => {
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

  const newBoard = (seed?: NewBoardSeed): Promise<string> =>
    once(async () => {
      const L0 = seedLineup(seed?.formation ?? lineup.formation, []);
      // (a seed: «Copiar el siete del último partido» — its seven on the same system, and its name)
      const slots = seed ? L0.slots.map((s, i) => ({ ...s, playerId: seed.slots[i] ?? null })) : L0.slots;
      const L = withBench({ ...L0, slots }, squadIds);
      const nm = uniqueName(seed?.name ?? "Tablero nuevo", taken());
      const nid = await lineups.create(L, nm);
      openFresh(nid, L, nm);
      return nm;
    });

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
