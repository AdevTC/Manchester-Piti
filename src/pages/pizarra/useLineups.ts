import { useMemo, useState } from "react";
import {
  collection,
  deleteDoc,
  deleteField,
  doc,
  getDocs,
  query,
  runTransaction,
  serverTimestamp,
  setDoc,
  updateDoc,
  where,
  writeBatch,
} from "firebase/firestore";
import { db } from "../../firebase";
import { useAuth } from "../../context/AuthContext";
import type { Lineup } from "./formations";
import { boardToData, dataToLineupDoc, lineupToData, type LineupDoc, type LineupMeta } from "./lineupDoc";
import { PREVIEW, useSeasonLineupDocs } from "./seasonLineups";
import { clearVoz } from "./v2/vozStore";

// `?preview` injects a mock session but no real Firebase auth token, so the
// `lineups` rules (request.auth != null) would reject reads/writes. In preview
// we back the store with localStorage (PREVIEW, seasonLineups.ts); real sessions use Firestore.

const LOCAL_KEY = "mp_pizarra_lineups";

/** Scope for marking a board official: a match, or the whole season (null). */
export interface OfficialScope {
  matchId: string | null;
}

export interface UseLineups {
  official: LineupDoc[];
  mine: LineupDoc[];
  /** Every board of the season the member can read (a shared link opens any of them). */
  all: LineupDoc[];
  loading: boolean;
  /** Create a new owned board from the current lineup; returns the new id. */
  create: (lineup: Lineup, name: string) => Promise<string>;
  /** Overwrite an existing owned board (autosave / explicit). Pass `matchId` to
   *  (re)link a match; omit it to keep the stored value. */
  save: (id: string, lineup: Lineup, matchId?: string | null) => Promise<void>;
  rename: (id: string, name: string) => Promise<void>;
  remove: (id: string) => Promise<void>;
  /** Admin: mark `id` official for `scope`, or pass null to unmark. */
  markOfficial: (id: string, scope: OfficialScope | null) => Promise<void>;
}

type LocalRecord = Record<string, unknown> & { id: string };

function localRead(): LocalRecord[] {
  try {
    const raw = localStorage.getItem(LOCAL_KEY);
    return raw ? (JSON.parse(raw) as LocalRecord[]) : [];
  } catch {
    return [];
  }
}
function persistLocal(next: LocalRecord[]): LocalRecord[] {
  localStorage.setItem(LOCAL_KEY, JSON.stringify(next));
  return next;
}
function localId(): string {
  return `local-${Date.now()}-${Math.floor(Math.random() * 1e6)}`;
}

/** The autosave's update: the board fields (and the match only when one is passed). */
export function saveData(lineup: Lineup, matchId?: string | null): Record<string, unknown> {
  return {
    ...boardToData(lineup),
    ...(matchId !== undefined ? { matchId } : {}),
    // no longer stored (see boardToData): dropped from older docs on their next save
    bench: deleteField(),
    pinned: deleteField(),
    updatedAt: serverTimestamp(),
  };
}

/** The doc that holds an official's scope (a match, or the season): one board per scope. */
export const officialScopeId = (seasonId: string, matchId: string | null): string => `${seasonId}__${matchId ?? "temporada"}`;

/**
 * Publishes `id` as the official of `scope` (or unpublishes it, scope null) in ONE transaction: the
 * scope doc (`lineupOfficials`) names its board, so two captains publishing at once serialize on it —
 * the second sees the first's board and unmarks it — and never leave two officials. Officials from
 * before the scope doc are found with a query and unmarked in the same transaction. Returns the boards
 * that stopped being official (their reactions go).
 */
export async function publishOfficial(seasonId: string, id: string, scope: OfficialScope | null): Promise<string[]> {
  const legacy = scope
    ? (await getDocs(query(collection(db, "lineups"), where("seasonId", "==", seasonId), where("isOfficial", "==", true)))).docs
        .filter((p) => p.id !== id && ((p.data().matchId as string | null | undefined) ?? null) === scope.matchId)
        .map((p) => p.id)
    : [];
  return runTransaction(db, async (tx) => {
    const ref = doc(db, "lineups", id);
    const snap = await tx.get(ref);
    if (!snap.exists()) throw new Error("Ese tablero ya no existe");
    const was = snap.data();
    const wasOfficial = was.isOfficial === true;
    const wasScope = ((was.matchId as string | null | undefined) ?? null) as string | null;
    const at = serverTimestamp();
    // reads first (a transaction writes after all its reads)
    const oldLockRef = wasOfficial && (!scope || wasScope !== scope.matchId) ? doc(db, "lineupOfficials", officialScopeId(seasonId, wasScope)) : null;
    const oldLock = oldLockRef ? await tx.get(oldLockRef) : null;
    const lockRef = scope ? doc(db, "lineupOfficials", officialScopeId(seasonId, scope.matchId)) : null;
    const lock = lockRef ? await tx.get(lockRef) : null;
    const others = new Set(legacy);
    const holder = lock?.exists() ? (lock.data().lineupId as unknown) : null;
    if (typeof holder === "string" && holder !== id) others.add(holder);
    const otherSnaps = await Promise.all([...others].map((o) => tx.get(doc(db, "lineups", o))));
    // writes
    const unmarked: string[] = [];
    if (scope && lockRef) {
      for (const o of otherSnaps) {
        const d = o.data();
        if (o.exists() && d?.isOfficial === true && ((d.matchId as string | null | undefined) ?? null) === scope.matchId) {
          tx.update(o.ref, { isOfficial: false, updatedAt: at });
          unmarked.push(o.id);
        }
      }
      tx.update(ref, { isOfficial: true, matchId: scope.matchId, updatedAt: at });
      tx.set(lockRef, { lineupId: id, seasonId, matchId: scope.matchId, at });
    } else {
      tx.update(ref, { isOfficial: false, updatedAt: at });
      if (wasOfficial) unmarked.push(id);
    }
    if (oldLockRef && oldLock?.exists() && oldLock.data().lineupId === id) tx.delete(oldLockRef);
    return unmarked;
  });
}

/** Deletes the reactions to boards that are no longer official (or are being deleted), in batches. */
export async function clearReactions(ids: string[]): Promise<void> {
  for (const lid of ids) {
    try {
      const snap = await getDocs(collection(db, "lineups", lid, "reactions"));
      for (let i = 0; i < snap.docs.length; i += 400) {
        const batch = writeBatch(db);
        snap.docs.slice(i, i + 400).forEach((r) => batch.delete(r.ref));
        await batch.commit();
      }
    } catch (err) {
      // the board change already happened: stale reactions are only shown on an official again
      console.error("No se pudieron limpiar las reacciones del tablero", err);
    }
  }
}

export function useLineups(seasonId: string): UseLineups {
  const { user, profile } = useAuth();
  const uid = user?.uid ?? "preview";
  const nickname = profile?.nickname ?? "preview";

  // ── Preview backend: React-state-backed localStorage. ──
  const [localRecords, setLocalRecords] = useState<LocalRecord[]>(() => (PREVIEW ? localRead() : []));

  // ── Firestore backend: one realtime subscription per season, deduped and
  //    cache-shared via the bridge (key `["lineups", seasonId]`). The raw
  //    validated docs live in the cache; dataToLineupDoc derivation stays here.
  //    `useFirestoreCollection` must run unconditionally (rules of hooks); in
  //    PREVIEW its data is ignored and `localApi` drives the UI. ──
  // Skip the Firestore subscription entirely in preview (no auth token → the
  // rules would reject the read); the localStorage-backed localApi drives it.
  // Canonical mapLineup stores the raw validated doc; dataToLineupDoc derives.
  // (seasonLineups.ts: the same key and query the match page and the admin read)
  const { data: rawLineups, isPending } = useSeasonLineupDocs(seasonId);
  const items = useMemo<LineupDoc[]>(
    () => (rawLineups ?? []).map((r) => dataToLineupDoc(r.id, r)),
    [rawLineups],
  );

  const localApi = useMemo<UseLineups | null>(() => {
    if (!PREVIEW) return null;
    const items = localRecords.map((r) => dataToLineupDoc(r.id, r)).filter((d) => d.seasonId === seasonId);

    const create: UseLineups["create"] = async (lineup, name) => {
      const id = localId();
      const meta: LineupMeta = { ownerUid: uid, ownerNickname: nickname, seasonId, name, isOfficial: false, matchId: null };
      const now = Date.now();
      const rec: LocalRecord = { id, ...lineupToData(lineup, meta), createdAt: now, updatedAt: now };
      setLocalRecords((prev) => persistLocal([...prev, rec]));
      return id;
    };
    const save: UseLineups["save"] = async (id, lineup, matchId) => {
      setLocalRecords((prev) => {
        const i = prev.findIndex((r) => r.id === id);
        if (i < 0) return prev;
        const next = [...prev];
        const rec: LocalRecord = { ...prev[i], ...boardToData(lineup), id, updatedAt: Date.now() };
        delete rec.bench;
        delete rec.pinned;
        if (matchId !== undefined) rec.matchId = matchId;
        next[i] = rec;
        return persistLocal(next);
      });
    };
    const rename: UseLineups["rename"] = async (id, name) => {
      setLocalRecords((prev) => {
        const i = prev.findIndex((r) => r.id === id);
        if (i < 0) return prev;
        const next = [...prev];
        next[i] = { ...next[i], name, updatedAt: Date.now() };
        return persistLocal(next);
      });
    };
    const remove: UseLineups["remove"] = async (id) => {
      setLocalRecords((prev) => persistLocal(prev.filter((r) => r.id !== id)));
    };
    const markOfficial: UseLineups["markOfficial"] = async (id, scope) => {
      setLocalRecords((prev) => {
        let next = prev.map((r) => ({ ...r }));
        if (scope) {
          next = next.map((r) => {
            const dd = dataToLineupDoc(r.id, r);
            if (r.id !== id && dd.seasonId === seasonId && dd.isOfficial && dd.matchId === scope.matchId) {
              return { ...r, isOfficial: false };
            }
            return r;
          });
        }
        const i = next.findIndex((r) => r.id === id);
        if (i >= 0) next[i] = { ...next[i], isOfficial: !!scope, matchId: scope?.matchId ?? null, updatedAt: Date.now() };
        return persistLocal(next);
      });
    };

    return {
      official: items.filter((d) => d.isOfficial),
      mine: items.filter((d) => d.ownerUid === uid),
      all: items,
      loading: false,
      create,
      save,
      rename,
      remove,
      markOfficial,
    };
  }, [localRecords, uid, nickname, seasonId]);

  const firestoreApi = useMemo<UseLineups>(() => {
    // The id is made here and the write goes to the local cache at once: the new board is there (and
    // opens) even offline; the server ack comes when it comes. A refused write shows up as a failed save.
    const create: UseLineups["create"] = async (lineup, name) => {
      const meta: LineupMeta = { ownerUid: uid, ownerNickname: nickname, seasonId, name, isOfficial: false, matchId: null };
      const ref = doc(collection(db, "lineups"));
      setDoc(ref, { ...lineupToData(lineup, meta), createdAt: serverTimestamp(), updatedAt: serverTimestamp() }).catch((err: unknown) =>
        console.error("No se pudo crear el tablero", err),
      );
      return ref.id;
    };
    // Only what the board edits: a rename, a publish or a match link made elsewhere is never rewritten
    // with this device's (maybe stale) copy when a queued autosave lands. The old dead weight goes.
    const save: UseLineups["save"] = async (id, lineup, matchId) => {
      await updateDoc(doc(db, "lineups", id), saveData(lineup, matchId));
    };
    const rename: UseLineups["rename"] = async (id, name) => {
      await updateDoc(doc(db, "lineups", id), { name, updatedAt: serverTimestamp() });
    };
    const remove: UseLineups["remove"] = async (id) => {
      await clearReactions([id]);
      // (Bloque 5: the charla's voice goes first — its rules read the board to allow it)
      await clearVoz(id);
      await deleteDoc(doc(db, "lineups", id));
    };
    const markOfficial: UseLineups["markOfficial"] = async (id, scope) => {
      const unmarked = await publishOfficial(seasonId, id, scope);
      await clearReactions(unmarked);
    };

    return {
      official: items.filter((d) => d.isOfficial),
      mine: items.filter((d) => d.ownerUid === uid),
      all: items,
      loading: isPending,
      create,
      save,
      rename,
      remove,
      markOfficial,
    };
  }, [items, isPending, seasonId, uid, nickname]);

  return localApi ?? firestoreApi;
}
