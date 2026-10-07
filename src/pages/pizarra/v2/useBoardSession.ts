// The board being edited: which one (a deep link, the last one opened here, your latest, or a fresh
// draft that becomes a board on its first change), its lineup (your unsaved edits over the stored doc),
// whether you may edit it (useLineups' docs + the lineups rules: your own non-official boards; admins
// any), and the autosave (one write ~1s after the last change; pending edits are flushed on leave).
import { useEffect, useMemo, useRef, useState } from "react";
import type { Lineup } from "../formations";
import { seedLineup } from "../lineupOps";
import { extractLineup, type LineupDoc } from "../lineupDoc";
import type { UseLineups } from "../useLineups";
import { normalize, withBench } from "./ops";

export type SaveStatus = "draft" | "saving" | "saved" | "error";

export interface BoardSession {
  /** Changes when another board (or season) is shown: per-board UI state resets on it. */
  key: string;
  ready: boolean;
  name: string;
  lineup: Lineup;
  readOnly: boolean;
  official: boolean;
  /** Nickname of the board's owner (for a read-only board that is not the official). */
  owner: string;
  matchId: string | null;
  status: SaveStatus;
  savedAt: number | null;
  commit: (next: Lineup) => void;
  /** Read-only board: make it yours (a copy you can edit) and open it. */
  duplicate: () => void;
  /** Back to your own board (the latest; a draft if you have none). */
  openMine: () => void;
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

const REMEMBER = "mp_pizarra_v2_board:";
const remembered = (seasonId: string): string | null => {
  try {
    return localStorage.getItem(REMEMBER + seasonId);
  } catch {
    return null;
  }
};
const deepLink = (): string | null => {
  if (typeof window === "undefined") return null;
  return new URLSearchParams(window.location.search).get("tablero");
};
const newest = (docs: LineupDoc[]): LineupDoc | undefined =>
  docs.slice().sort((a, b) => (b.updatedAt ?? b.createdAt ?? 0) - (a.updatedAt ?? a.createdAt ?? 0))[0];

interface Choice {
  season: string;
  id: string | null;
  /** Just created here: keep it even before the store lists it. */
  fresh?: boolean;
  /** Born from the draft: it keeps the draft's key, so its history and selection carry on. */
  keepKey?: string;
}
interface Local {
  key: string;
  lineup: Lineup;
  dirty: boolean;
}

export function useBoardSession({ seasonId, lineups, squadIds, squadReady, uid, isAdmin, draftName }: SessionArgs): BoardSession {
  const [deep] = useState(deepLink);
  const [choice, setChoice] = useState<Choice | null>(null);
  const [local, setLocal] = useState<Local | null>(null);
  const [saved, setSaved] = useState<{ key: string; status: "saving" | "saved" | "error"; at: number } | null>(null);
  const creating = useRef(false);

  const all = useMemo(() => {
    const seen = new Set<string>();
    return [...lineups.mine, ...lineups.official].filter((d) => (seen.has(d.id) ? false : (seen.add(d.id), true)));
  }, [lineups.mine, lineups.official]);
  const find = (id: string | null) => (id ? all.find((d) => d.id === id) : undefined);

  let id: string | null;
  if (choice && choice.season === seasonId && (choice.id === null || choice.fresh || find(choice.id))) id = choice.id;
  else {
    const mem = remembered(seasonId);
    id = (deep && find(deep)?.id) || (mem && lineups.mine.find((d) => d.id === mem)?.id) || newest(lineups.mine)?.id || null;
  }
  const doc = find(id);
  const key = (choice?.season === seasonId && choice.id === id && choice.keepKey) || `${seasonId}:${id ?? "draft"}`;
  const ready = squadReady && !lineups.loading;
  const readOnly = !!doc && !(isAdmin || (doc.ownerUid === uid && !doc.isOfficial));

  const base = useMemo(() => normalize(doc ? extractLineup(doc) : seedLineup("2-3-1", []), squadIds), [doc, squadIds]);
  const mine = local && local.key === key ? local : null;
  const lineup = mine && (mine.dirty || !doc) ? mine.lineup : base;

  // Latest values for the timers and the leave-flush (written after render, read in callbacks).
  const latest = useRef({ save: lineups.save, id, pending: null as Lineup | null });
  useEffect(() => {
    latest.current = { save: lineups.save, id, pending: mine?.dirty && id && !readOnly ? mine.lineup : null };
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

  // Autosave: one write ~1s after the last change.
  useEffect(() => {
    if (!mine?.dirty || !id || readOnly) return;
    const snapshot = mine.lineup;
    const t = window.setTimeout(() => {
      setSaved({ key, status: "saving", at: 0 });
      latest.current
        .save(id, snapshot)
        .then(() => {
          setLocal((p) => (p && p.key === key && p.lineup === snapshot ? { ...p, dirty: false } : p));
          setSaved({ key, status: "saved", at: Date.now() });
        })
        .catch((err: unknown) => {
          console.error("No se pudo guardar el tablero", err);
          setSaved({ key, status: "error", at: 0 });
        });
    }, 1000);
    return () => window.clearTimeout(t);
  }, [mine, id, readOnly, key]);

  // Leaving this board (another board or season, or the page) with an edit still waiting for its write:
  // write it now. The cleanup runs before `latest` moves on, so it still holds the board being left.
  useEffect(
    () => () => {
      const { save, id: lid, pending } = latest.current;
      if (lid && pending) save(lid, pending).catch((err: unknown) => console.error("No se pudo guardar el tablero", err));
    },
    [key],
  );

  const commit = (next: Lineup) => {
    if (!ready || readOnly) return;
    const L = withBench(next, squadIds);
    setLocal({ key, lineup: L, dirty: true });
    if (id || creating.current) return;
    // The draft becomes a board on its first change.
    creating.current = true;
    const k0 = key;
    lineups
      .create(L, draftName)
      .then((nid) => {
        setChoice({ season: seasonId, id: nid, fresh: true, keepKey: k0 });
        setLocal((p) => (p && p.key === k0 ? { ...p, dirty: p.lineup !== L } : p));
        setSaved({ key: k0, status: "saved", at: Date.now() });
      })
      .catch((err: unknown) => {
        console.error("No se pudo crear el tablero", err);
        setSaved({ key: k0, status: "error", at: 0 });
      })
      .finally(() => {
        creating.current = false;
      });
  };

  const duplicate = () => {
    if (!doc) return;
    lineups
      .create(withBench(lineup, squadIds), doc.isOfficial ? "Copia del oficial" : `Copia de ${doc.name}`)
      .then((nid) => setChoice({ season: seasonId, id: nid, fresh: true }))
      .catch((err: unknown) => console.error("No se pudo duplicar el tablero", err));
  };

  const openMine = () => {
    setChoice({ season: seasonId, id: newest(lineups.mine)?.id ?? null });
  };

  const sv = saved && saved.key === key ? saved : null;
  const status: SaveStatus = !id
    ? sv?.status === "error"
      ? "error"
      : mine?.dirty
      ? "saving"
      : "draft"
    : sv?.status === "error"
      ? "error"
      : mine?.dirty || sv?.status === "saving"
        ? "saving"
        : "saved";

  return {
    key,
    ready,
    name: doc?.name ?? draftName,
    lineup,
    readOnly,
    official: !!doc?.isOfficial,
    owner: doc?.ownerNickname ?? "",
    matchId: doc?.matchId ?? null,
    status,
    savedAt: sv?.status === "saved" ? Math.max(sv.at, doc?.updatedAt ?? 0) : (doc?.updatedAt ?? null),
    commit,
    duplicate,
    openMine,
  };
}
