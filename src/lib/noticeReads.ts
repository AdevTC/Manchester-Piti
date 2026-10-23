// The bandeja's read state, notice by notice (TU boards: «Marcar como leído / no leído», a stack opened, a «Te
// toca» answered). A member's lives in users/{uid}/private/notices `{ read: { [noticeId]: boolean } }` (only he
// reads and writes it; firestore.rules caps it at 200), beside users/{uid}.noticesSeenAt, the last «Marcar todo
// como leído». A notice is unread when the map says false, or when the map says nothing and it is newer than
// that look. A fan's (no account) is this browser's (localStorage). The map stays small: an id the list no
// longer has (notices expire after 60 days) and an entry that says what the look already says both go.
import { useCallback, useMemo, useState, useSyncExternalStore } from "react";
import { doc, serverTimestamp, setDoc, writeBatch } from "firebase/firestore";
import { db } from "../firebase";
import { useLiveDoc } from "../pages/vestuario/live";

export type ReadMap = Readonly<Record<string, boolean>>;
/** The most ids the map keeps (the rules' cap). */
export const MAX_READS = 200;

interface Item {
  id: string;
  /** ms */
  at: number;
}

/** Whether `n` is unread: the map's word first («no leído» even when older than the last look), else newer than
 *  the last look (no look yet: unread). */
export function isUnreadWith(n: Item, seenAt: number | null, read: ReadMap): boolean {
  const r = read[n.id];
  if (r === false) return true;
  if (r === true) return false;
  return seenAt === null || n.at > seenAt;
}

/**
 * The map after `changes`: only ids `list` still has (when it is known), only entries that differ from what the
 * last look says, the newest MAX_READS (by the list's order, newest first).
 */
export function nextReads(read: ReadMap, changes: Readonly<Record<string, boolean>>, list: readonly Item[] | null, seenAt: number | null): Record<string, boolean> {
  const merged: Record<string, boolean> = { ...read, ...changes };
  const out: Record<string, boolean> = {};
  if (!list) {
    for (const [id, v] of Object.entries(merged).slice(-MAX_READS)) out[id] = v;
    return out;
  }
  for (const n of list) {
    if (!(n.id in merged)) continue;
    const v = merged[n.id];
    const byLook = !(seenAt === null || n.at > seenAt);
    // (read and already behind the look, or unread and still ahead of it: the look says it)
    if (v === byLook) continue;
    out[n.id] = v;
    if (Object.keys(out).length >= MAX_READS) break;
  }
  return out;
}

/**
 * What marking `ids` writes, or null for no write: nothing marked, the stored map not read yet (`ready` false: a
 * write then would replace the marks it hasn't seen), or nothing that changes. `list` null (still loading, or
 * failed) keeps every id: an empty list would drop them all.
 */
export function readsWrite(read: ReadMap, ids: readonly string[], value: boolean, list: readonly Item[] | null, seenAt: number | null, ready: boolean): Record<string, boolean> | null {
  if (!ids.length || !ready) return null;
  const next = nextReads(read, Object.fromEntries(ids.map((id) => [id, value])), list, seenAt);
  return sameMap(next, read) ? null : next;
}

const mapReads = (d: { read?: unknown } | undefined): ReadMap => {
  const raw = d?.read;
  if (!raw || typeof raw !== "object" || Array.isArray(raw)) return {};
  const out: Record<string, boolean> = {};
  for (const [k, v] of Object.entries(raw as Record<string, unknown>)) if (typeof v === "boolean") out[k] = v;
  return out;
};
const EMPTY: ReadMap = {};

// ---------- a fan's: this browser
const FAN_KEY = "piti-notices-read";
const fanListeners = new Set<() => void>();
const fanRead = (): string => {
  try {
    return localStorage.getItem(FAN_KEY) ?? "";
  } catch {
    return "";
  }
};
function fanState(raw: string): { read: ReadMap; seenAt: number | null } {
  try {
    const o = JSON.parse(raw || "{}") as { read?: unknown; seenAt?: unknown };
    return { read: mapReads(o), seenAt: typeof o.seenAt === "number" ? o.seenAt : null };
  } catch {
    return { read: EMPTY, seenAt: null };
  }
}
function fanWrite(state: { read: Record<string, boolean>; seenAt: number | null }) {
  try {
    localStorage.setItem(FAN_KEY, JSON.stringify(state));
  } catch {
    /* storage off: it lasts this page */
  }
  fanListeners.forEach((l) => l());
}
const fanSubscribe = (cb: () => void) => {
  fanListeners.add(cb);
  return () => {
    fanListeners.delete(cb);
  };
};

export interface NoticeReads {
  /** The last «Marcar todo como leído» (ms), null before any. */
  seenAt: number | null;
  read: ReadMap;
  unread: (n: Item) => boolean;
  /** Marks `ids` read (true) or unread (false). */
  mark: (ids: readonly string[], value: boolean) => Promise<void>;
  /** «Marcar todo como leído»: the look moves to now and the map empties. */
  markAll: () => Promise<void>;
}

/**
 * The read state of `list` for `uid` (a member: his private doc and users/{uid}.noticesSeenAt, `serverSeen`;
 * none: this browser's). Writes show at once (the map just written stands until the server's echoes it).
 */
export function useNoticeReads(uid: string | undefined, list: readonly Item[] | null, serverSeen: number | null): NoticeReads {
  const live = useLiveDoc<ReadMap>(uid ? `users/${uid}/private/notices` : null, "read", mapReads, EMPTY);
  const fanRaw = useSyncExternalStore(fanSubscribe, fanRead, () => "");
  const fan = useMemo(() => fanState(fanRaw), [fanRaw]);
  // (what this device just wrote, until the listener says the same; `seen`: the look it just moved)
  const serverRead = live.data;
  const [mine, setMine] = useState<{ uid: string; read: Record<string, boolean>; base: ReadMap; seen: number | null } | null>(null);
  const ours = mine && mine.uid === uid ? mine : null;
  // (the map written here stands while the listener still holds what it held then; its next snapshot, the echo
  // or another device's change, rules again)
  const read: ReadMap = uid ? (ours && ours.base === serverRead ? ours.read : serverRead) : fan.read;
  const seenAt = uid ? maxOf(serverSeen, ours?.seen ?? null) : fan.seenAt;

  const unread = useCallback((n: Item) => isUnreadWith(n, seenAt, read), [seenAt, read]);
  const mark = useCallback(
    async (ids: readonly string[], value: boolean) => {
      // (a member's map is written only once his stored one has been read: a write before would wipe it)
      const next = readsWrite(read, ids, value, list, seenAt, !uid || (!live.loading && !live.error));
      if (!next) return;
      if (!uid) {
        fanWrite({ read: next, seenAt });
        return;
      }
      setMine({ uid, read: next, base: serverRead, seen: ours?.seen ?? null });
      try {
        await setDoc(doc(db, "users", uid, "private", "notices"), { read: next });
      } catch (e) {
        setMine(null);
        throw e;
      }
    },
    [uid, read, list, seenAt, ours?.seen, serverRead, live.loading, live.error],
  );
  const markAll = useCallback(async () => {
    const now = Date.now();
    if (!uid) {
      fanWrite({ read: {}, seenAt: now });
      return;
    }
    setMine({ uid, read: {}, base: serverRead, seen: now });
    const batch = writeBatch(db);
    batch.update(doc(db, "users", uid), { noticesSeenAt: serverTimestamp() });
    batch.set(doc(db, "users", uid, "private", "notices"), { read: {} });
    try {
      await batch.commit();
    } catch (e) {
      setMine(null);
      throw e;
    }
  }, [uid, serverRead]);
  return { seenAt, read, unread, mark, markAll };
}

function sameMap(a: ReadMap, b: ReadMap): boolean {
  const ka = Object.keys(a);
  return ka.length === Object.keys(b).length && ka.every((k) => a[k] === b[k]);
}
const maxOf = (a: number | null, b: number | null): number | null => (a === null ? b : b === null ? a : Math.max(a, b));
