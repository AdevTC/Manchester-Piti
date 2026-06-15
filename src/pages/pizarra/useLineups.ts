import { useEffect, useMemo, useState } from "react";
import {
  addDoc,
  collection,
  deleteDoc,
  doc,
  getDocs,
  onSnapshot,
  query,
  serverTimestamp,
  updateDoc,
  where,
  writeBatch,
} from "firebase/firestore";
import { db } from "../../firebase";
import { useAuth } from "../../context/AuthContext";
import type { Lineup } from "./formations";
import { dataToLineupDoc, lineupToData, type LineupDoc, type LineupMeta } from "./lineupDoc";

// `?preview` injects a mock session but no real Firebase auth token, so the
// `lineups` rules (request.auth != null) would reject reads/writes. In preview
// we back the store with localStorage; real sessions use Firestore.
const PREVIEW =
  import.meta.env.DEV &&
  typeof window !== "undefined" &&
  new URLSearchParams(window.location.search).has("preview");

const LOCAL_KEY = "mp_pizarra_lineups";

/** Scope for marking a board official: a match, or the whole season (null). */
export interface OfficialScope {
  matchId: string | null;
}

export interface UseLineups {
  official: LineupDoc[];
  mine: LineupDoc[];
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

export function useLineups(seasonId: string): UseLineups {
  const { user, profile } = useAuth();
  const uid = user?.uid ?? "preview";
  const nickname = profile?.nickname ?? "preview";

  // ── Preview backend: React-state-backed localStorage. ──
  const [localRecords, setLocalRecords] = useState<LocalRecord[]>(() => (PREVIEW ? localRead() : []));

  // ── Firestore backend: one realtime subscription per season. ──
  const [docs, setDocs] = useState<{ seasonId: string; items: LineupDoc[] }>({ seasonId: "", items: [] });
  useEffect(() => {
    if (PREVIEW) return;
    const q = query(collection(db, "lineups"), where("seasonId", "==", seasonId));
    const unsub = onSnapshot(
      q,
      (snap) => setDocs({ seasonId, items: snap.docs.map((d) => dataToLineupDoc(d.id, d.data())) }),
      (err) => {
        console.error("Error cargando tableros:", err);
        setDocs({ seasonId, items: [] });
      },
    );
    return () => unsub();
  }, [seasonId]);

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
        const cur = dataToLineupDoc(id, prev[i]);
        const meta: LineupMeta = {
          ownerUid: cur.ownerUid,
          ownerNickname: cur.ownerNickname,
          seasonId: cur.seasonId,
          name: cur.name,
          isOfficial: cur.isOfficial,
          matchId: matchId !== undefined ? matchId : cur.matchId,
        };
        const next = [...prev];
        next[i] = { id, ...lineupToData(lineup, meta), createdAt: cur.createdAt ?? Date.now(), updatedAt: Date.now() };
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
      loading: false,
      create,
      save,
      rename,
      remove,
      markOfficial,
    };
  }, [localRecords, uid, nickname, seasonId]);

  const firestoreApi = useMemo<UseLineups>(() => {
    const loaded = docs.seasonId === seasonId;
    const items = loaded ? docs.items : [];

    const create: UseLineups["create"] = async (lineup, name) => {
      const meta: LineupMeta = { ownerUid: uid, ownerNickname: nickname, seasonId, name, isOfficial: false, matchId: null };
      const ref = await addDoc(collection(db, "lineups"), {
        ...lineupToData(lineup, meta),
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
      });
      return ref.id;
    };
    const save: UseLineups["save"] = async (id, lineup, matchId) => {
      const cur = items.find((d) => d.id === id);
      const meta: LineupMeta = {
        ownerUid: cur?.ownerUid ?? uid,
        ownerNickname: cur?.ownerNickname ?? nickname,
        seasonId,
        name: cur?.name ?? "Sin nombre",
        isOfficial: cur?.isOfficial ?? false,
        matchId: matchId !== undefined ? matchId : (cur?.matchId ?? null),
      };
      await updateDoc(doc(db, "lineups", id), { ...lineupToData(lineup, meta), updatedAt: serverTimestamp() });
    };
    const rename: UseLineups["rename"] = async (id, name) => {
      await updateDoc(doc(db, "lineups", id), { name, updatedAt: serverTimestamp() });
    };
    const remove: UseLineups["remove"] = async (id) => {
      await deleteDoc(doc(db, "lineups", id));
    };
    const markOfficial: UseLineups["markOfficial"] = async (id, scope) => {
      const batch = writeBatch(db);
      if (scope) {
        // Uniqueness: unmark the current official of the same scope.
        const prevSnap = await getDocs(
          query(collection(db, "lineups"), where("seasonId", "==", seasonId), where("isOfficial", "==", true)),
        );
        prevSnap.forEach((p) => {
          const m = (p.data().matchId as string | null) ?? null;
          if (p.id !== id && m === scope.matchId) batch.update(p.ref, { isOfficial: false, updatedAt: serverTimestamp() });
        });
        batch.update(doc(db, "lineups", id), { isOfficial: true, matchId: scope.matchId, updatedAt: serverTimestamp() });
      } else {
        batch.update(doc(db, "lineups", id), { isOfficial: false, updatedAt: serverTimestamp() });
      }
      await batch.commit();
    };

    return {
      official: items.filter((d) => d.isOfficial),
      mine: items.filter((d) => d.ownerUid === uid),
      loading: !loaded,
      create,
      save,
      rename,
      remove,
      markOfficial,
    };
  }, [docs, seasonId, uid, nickname]);

  return localApi ?? firestoreApi;
}
