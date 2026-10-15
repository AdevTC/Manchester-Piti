import type { Prediction } from "../../../functions/src/predictions";
import type { HistoricalPrediction } from "../../lib/postMatch";
export type { Prediction } from "../../../functions/src/predictions";
// Realtime Firestore subscriptions for team-only vestuario data (onSnapshot, no polling).
// Listeners are shared by key and kept warm for a minute after the last reader leaves, so
// coming back to the vestuario paints the last data at once instead of an empty block.
import { useCallback, useMemo, useState, useSyncExternalStore } from "react";
import {
  collection,
  doc,
  limit,
  onSnapshot,
  orderBy,
  query,
  where,
  Timestamp,
  type DocumentData,
  type Query,
  type SnapshotMetadata,
} from "firebase/firestore";
import { db } from "../../firebase";
import { LISTENER_RETRY_MS, markListenerStale, metaKeyOf, noteListenerFailure, recordSnapshotMeta, reopenDelay, useOnline, useSnapshotMeta } from "../../lib/syncStatus";
import { mapMvp, MVP_RESULTS_KEY } from "../../lib/firestoreMappers";
import { useFirestoreCollection } from "../../lib/useFirestoreCollection";
import type { TrainingSlot } from "../../lib/vestuario";
import { EMPTY_CAJA_SETTINGS, parseCajaMov, parseCajaSettings, type CajaMov, type CajaSettings } from "../../lib/derived/caja";
import { currentAbsences, parseAbsence, type Absence } from "../../lib/derived/absences";

interface Live<T> {
  data: T;
  loading: boolean;
  error: boolean;
}
/** What a listener hands the registry: each snapshot (with whether its data changed) and its death. */
interface Sink<T> {
  /** `changed` false = a metadata-only snapshot: readers keep the same data object (no re-render). */
  snapshot: (data: T, meta: SnapshotMetadata, changed: boolean) => void;
  /** The listener errored (Firestore has closed it). */
  fail: () => void;
}
interface Shared {
  state: { data: unknown; loading: boolean; error: boolean } | null;
  readers: Set<() => void>;
  stop: (() => void) | null;
  idle: ReturnType<typeof setTimeout> | null;
  /** A scheduled (re)open: the automatic retry, or a new reader's reopen of a permanently failing key. */
  retry: ReturnType<typeof setTimeout> | null;
}
const shared = new Map<string, Shared>();
const KEEP_WARM_MS = 60_000;
const clearTimers = (e: Shared) => {
  if (e.idle) clearTimeout(e.idle);
  if (e.retry) clearTimeout(e.retry);
  e.idle = e.retry = null;
};
type Start<T> = (sink: Sink<T>) => () => void;
/** Opens `entry` after `ms`, unless an open is already scheduled; only if it still has readers and no listener. */
function openIn<T>(key: string, entry: Shared, start: Start<T>, empty: T, ms: number): void {
  if (entry.retry) return;
  entry.retry = setTimeout(() => {
    entry.retry = null;
    if (shared.get(key) === entry && entry.readers.size && !entry.stop) open(key, entry, start, empty);
  }, ms);
}
/** A reader needs the listener: open it now, or once the key may be retried (see reopenDelay). */
function reopen<T>(key: string, entry: Shared, start: Start<T>, empty: T): void {
  const wait = reopenDelay(key);
  if (!wait) return open(key, entry, start, empty);
  // a permanently failing key: show the error (with whatever data is left) instead of loading meanwhile
  entry.state ??= { data: empty, loading: false, error: true };
  openIn(key, entry, start, empty, wait);
}
/**
 * Opens `start` for `entry`. On an error the entry keeps its last data with `error: true`, closes the dead
 * listener and reopens it: once after LISTENER_RETRY_MS while readers remain (one automatic retry per failure
 * streak; only a server snapshot ends a streak), and when a new reader subscribes (at once, or at most every
 * REOPEN_MIN_MS once the streak's retry failed too). With no readers left the entry is dropped.
 */
function open<T>(key: string, entry: Shared, start: Start<T>, empty: T): void {
  if (entry.retry) clearTimeout(entry.retry);
  entry.retry = null;
  let dead = false;
  let close: (() => void) | null = null;
  const notify = () => entry.readers.forEach((r) => r());
  close = start({
    snapshot: (data, meta, changed) => {
      if (dead) return;
      recordSnapshotMeta(key, meta);
      if (!changed && entry.state && !entry.state.error) return;
      entry.state = { data, loading: false, error: false };
      notify();
    },
    fail: () => {
      if (dead) return;
      dead = true;
      entry.stop = null;
      const streak = noteListenerFailure(key);
      close?.(); // the listener is closed already; this runs the opener's own cleanup
      entry.state = { data: entry.state ? entry.state.data : empty, loading: false, error: true };
      markListenerStale(key);
      notify();
      if (!entry.readers.size) {
        clearTimers(entry);
        if (shared.get(key) === entry) shared.delete(key);
        return;
      }
      // one automatic retry per streak
      if (streak === 1) openIn(key, entry, start, empty, LISTENER_RETRY_MS);
    },
  });
  const opened = close;
  if (dead) opened(); // failed before `start` returned: clean up now
  else
    entry.stop = () => {
      dead = true;
      opened();
    };
}
/** One onSnapshot per key, whoever reads it; `start` opens it and pushes each snapshot. */
function useShared<T>(key: string | null, start: Start<T>, empty: T): Live<T> {
  const subscribe = useCallback(
    (notify: () => void) => {
      if (!key) return () => {};
      let e = shared.get(key);
      if (!e) shared.set(key, (e = { state: null, readers: new Set(), stop: null, idle: null, retry: null }));
      const entry = e;
      if (entry.idle) clearTimeout(entry.idle);
      entry.idle = null;
      entry.readers.add(notify);
      // first reader, or the listener died: (re)open it
      if (!entry.stop) reopen(key, entry, start, empty);
      return () => {
        entry.readers.delete(notify);
        if (entry.readers.size) return;
        if (!entry.stop) {
          clearTimers(entry);
          if (shared.get(key) === entry) shared.delete(key);
          return;
        }
        entry.idle = setTimeout(() => {
          entry.stop?.();
          clearTimers(entry);
          if (shared.get(key) === entry) shared.delete(key);
          markListenerStale(key);
        }, KEEP_WARM_MS);
      };
    },
    // the key fully describes the subscription (start/map/empty are stable per call site)
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [key],
  );
  const state = useSyncExternalStore(subscribe, () => (key ? shared.get(key)?.state ?? null : null));
  if (!key) return { data: empty, loading: false, error: false };
  return state ? (state as Live<T>) : { data: empty, loading: true, error: false };
}
/** Same plain value (primitives, arrays, plain objects)? Anything else counts as different. */
function samePlain(a: unknown, b: unknown): boolean {
  if (Object.is(a, b)) return true;
  if (typeof a !== "object" || typeof b !== "object" || a === null || b === null) return false;
  if (Array.isArray(a)) return Array.isArray(b) && a.length === b.length && a.every((v, i) => samePlain(v, b[i]));
  const plain = (o: object) => {
    const p: unknown = Object.getPrototypeOf(o);
    return p === Object.prototype || p === null;
  };
  if (Array.isArray(b) || !plain(a) || !plain(b)) return false;
  const ra = a as Record<string, unknown>;
  const rb = b as Record<string, unknown>;
  const ka = Object.keys(ra);
  return ka.length === Object.keys(rb).length && ka.every((k) => Object.hasOwn(rb, k) && samePlain(ra[k], rb[k]));
}
/** Which projections are currently open per document path (dev guard, see useLiveDoc). */
const openProjections = new Map<string, Set<string>>();
/**
 * One onSnapshot per (path, mapper). The key carries `mapId` because the first reader decides what shape
 * `emit` pushes to everyone: two readers that map the same doc differently under one key corrupt each other.
 * Prefer one hook per document that maps the whole doc, with thin selectors over it (see useMatchPrivate).
 * In dev, opening one path with two different mapIds logs an error, so the pattern can't creep back.
 */
export function useLiveDoc<T>(path: string | null, mapId: string, map: (d: DocumentData | undefined) => T, empty: T): Live<T> {
  return useShared<T>(
    path && `doc:${path}#${mapId}`,
    (sink) => {
      if (import.meta.env.DEV) {
        const open = openProjections.get(path!) ?? new Set<string>();
        open.add(mapId);
        openProjections.set(path!, open);
        if (open.size > 1) console.error(`useLiveDoc: ${path} se lee con varias proyecciones (${[...open].join(", ")}); usa un solo hook que mapee el documento entero.`);
      }
      // A doc snapshot has no docChanges: a metadata-only one is told apart by its mapped value.
      let first = true;
      let last: T = empty;
      const stop = onSnapshot(
        doc(db, path!),
        { includeMetadataChanges: true },
        (s) => {
          const next = map(s.exists() ? s.data() : undefined);
          const changed = first || !samePlain(last, next);
          first = false;
          if (changed) last = next;
          sink.snapshot(last, s.metadata, changed);
        },
        () => sink.fail(),
      );
      return () => {
        stop();
        if (import.meta.env.DEV) {
          const open = openProjections.get(path!);
          open?.delete(mapId);
          if (open && !open.size) openProjections.delete(path!);
        }
      };
    },
    empty,
  );
}
const NONE: never[] = [];
function useLiveQuery<T>(key: string | null, build: () => Query, map: (id: string, d: DocumentData) => T): Live<T[]> {
  return useShared<T[]>(
    key && `query:${key}`,
    (sink) => {
      let first = true;
      let last: T[] = NONE;
      return onSnapshot(
        build(),
        { includeMetadataChanges: true },
        (s) => {
          // metadata-only snapshots carry no document changes: keep the same array
          const changed = first || s.docChanges().length > 0;
          first = false;
          if (changed) last = s.docs.map((d) => map(d.id, d.data()));
          sink.snapshot(last, s.metadata, changed);
        },
        () => sink.fail(),
      );
    },
    NONE,
  );
}
const millis = (v: unknown) => (v instanceof Timestamp ? v.toMillis() : typeof v === "number" ? v : 0);

// ---------- convocatoria
export interface Availability {
  uid: string;
  response: "yes" | "no" | "maybe";
  name: string;
  playerId: string | null;
}
export function useAvailability(matchId: string | undefined) {
  return useLiveQuery<Availability>(
    matchId ? `availability/${matchId}` : null,
    () => collection(db, "matchPrivate", matchId!, "availability"),
    (uid, d) => ({ uid, response: d.response, name: d.name ?? "Miembro", playerId: d.playerId ?? null }),
  );
}

// ---------- matchPrivate/{id}: one listener, two readers (the meeting note and the designated scorers)
export interface MatchPrivate {
  meetingNote: string;
  scorerUids: string[];
}
const EMPTY_MATCH_PRIVATE: MatchPrivate = { meetingNote: "", scorerUids: [] };
const mapMatchPrivate = (d: DocumentData | undefined): MatchPrivate =>
  d ? { meetingNote: (d.meetingNote as string | undefined) ?? "", scorerUids: (d.scorerUids as string[] | undefined) ?? [] } : EMPTY_MATCH_PRIVATE;
/** The whole private match doc. Read it through useMeetingNote / useMatchScorers; never map matchPrivate/{id} elsewhere. */
export function useMatchPrivate(matchId: string | undefined) {
  return useLiveDoc<MatchPrivate>(matchId ? `matchPrivate/${matchId}` : null, "matchPrivate", mapMatchPrivate, EMPTY_MATCH_PRIVATE);
}
export function useMeetingNote(matchId: string | undefined): Live<string> {
  const q = useMatchPrivate(matchId);
  return useMemo(() => ({ data: q.data.meetingNote, loading: q.loading, error: q.error }), [q]);
}
export function useMatchScorers(matchId: string | undefined): Live<string[]> {
  const q = useMatchPrivate(matchId);
  return useMemo(() => ({ data: q.data.scorerUids, loading: q.loading, error: q.error }), [q]);
}

// ---------- MVP
// (key and mapper shared with the boot and the server render: lib/publicData)
const mvpQuery = collection(db, "mvpResults");
export function useMvpResults() {
  const q = useFirestoreCollection(MVP_RESULTS_KEY, mvpQuery, mapMvp);
  return useMemo(() => new Map((q.data ?? []).map((r) => [r.id, r])), [q.data]);
}
const MVP_META_KEY = metaKeyOf(MVP_RESULTS_KEY);
/**
 * Is the MVP tally on screen live? `confirmed`: the last snapshot came from the server (only then does a
 * closed vote get its reveal: a cached tally never celebrates). `stale`: offline, or it was in sync and
 * lost it — the race may be missing votes. (Neither while the first server snapshot is on its way.)
 */
export function useMvpResultsSync(): { confirmed: boolean; stale: boolean } {
  const meta = useSnapshotMeta(MVP_META_KEY);
  const online = useOnline();
  return { confirmed: !!meta && !meta.fromCache, stale: !online || (!!meta && meta.fromCache && meta.since !== null) };
}
/** How long after the close a visit still gets the winner's reveal (later visits show it still). */
export const MVP_REVEAL_MS = 3 * 3_600_000;
export interface MvpRevealInput {
  /** The match (a new one decides afresh). */
  id: string | undefined;
  open: boolean;
  /** The closed vote has a winner on screen. */
  winner: boolean;
  closesAt: number | null | undefined;
  now: number;
}
/**
 * Whether a closed vote's winner is revealed with its animation. Decided once, the first time this mount
 * shows the winner, and kept: animated only when this mount saw the vote open and close, or the vote
 * closed less than MVP_REVEAL_MS ago — and only from a tally the server has confirmed (a cached one never
 * celebrates). A winner first shown still stays still: the animation never hides a name already on screen
 * (when the cached snapshot is replaced by the server's).
 */
export function useMvpReveal({ id, open, winner, closesAt, now }: MvpRevealInput): boolean {
  const { confirmed } = useMvpResultsSync();
  const [s, setS] = useState<{ id: string | undefined; sawOpen: boolean; animate: boolean | null }>({ id, sawOpen: false, animate: null });
  let cur = s.id === id ? s : { id, sawOpen: false, animate: null };
  if (open && !cur.sawOpen) cur = { ...cur, sawOpen: true, animate: null };
  if (!open && winner && cur.animate === null) cur = { ...cur, animate: confirmed && (cur.sawOpen || (!!closesAt && now - closesAt < MVP_REVEAL_MS)) };
  if (cur !== s) setS(cur);
  return !open && winner && cur.animate === true;
}
export function useMyMvpVote(matchId: string | undefined, uid: string | undefined) {
  return useLiveDoc<string>(matchId && uid ? `matches/${matchId}/votes/${uid}` : null, "playerId", (d) => (d?.playerId as string) ?? "", "");
}
export function useMvpVoters(matchId: string | undefined, enabled: boolean) {
  return useLiveQuery<{ uid: string; voterName: string; playerId: string }>(
    matchId && enabled ? `votes/${matchId}` : null,
    () => collection(db, "matches", matchId!, "votes"),
    (uid, d) => ({ uid, voterName: d.voterName ?? "Miembro", playerId: d.playerId }),
  );
}

// ---------- porra
export function useMyPrediction(matchId: string | undefined, uid: string | undefined) {
  return useLiveDoc<Prediction | null>(
    matchId && uid ? `matchPrivate/${matchId}/predictions/${uid}` : null,
    "prediction",
    (d) => (d ? { goalsFor: d.goalsFor, goalsAgainst: d.goalsAgainst, goals: d.goals, scoringVersion: d.scoringVersion } : null),
    null,
  );
}
export interface PorraRow {
  uid: string;
  name: string;
  playerId: string | null;
  points: number;
  exact: number;
  played: number;
}
export function usePorraStandings(seasonId: string | undefined) {
  return useLiveDoc<PorraRow[]>(seasonId ? `porraStandings/${seasonId}` : null, "rows", (d) => (d?.rows as PorraRow[]) ?? [], []);
}

/** Finished matches only, subscribed lazily when history opens; no future picks leak. */
export function usePorraHistory(matchIds: string[], enabled: boolean) {
  const ids = [...matchIds].sort();
  return useShared<HistoricalPrediction[]>(enabled && ids.length ? `porra-history:${ids.join(',')}` : null, sink => {
    const snapshots = new Map<string, { rows: HistoricalPrediction[]; meta: SnapshotMetadata }>();
    const stops = ids.map(matchId => onSnapshot(collection(db, 'matchPrivate', matchId, 'predictions'), { includeMetadataChanges: true }, s => {
      snapshots.set(matchId, { rows: s.docs.map(d=>({ matchId, uid:d.id, name:d.get('name') ?? 'Miembro', goalsFor:d.get('goalsFor'), goalsAgainst:d.get('goalsAgainst'), goals:d.get('goals') })), meta:s.metadata });
      if (snapshots.size !== ids.length) return;
      const all = [...snapshots.values()];
      const meta: SnapshotMetadata = { fromCache: all.some(x=>x.meta.fromCache), hasPendingWrites: all.some(x=>x.meta.hasPendingWrites), isEqual(other) { return this.fromCache === other.fromCache && this.hasPendingWrites === other.hasPendingWrites; } };
      sink.snapshot(all.flatMap(x=>x.rows), meta, true);
    }, () => sink.fail()));
    return () => stops.forEach(stop=>stop());
  }, []);
}

// ---------- trainings
export interface Training {
  id: string;
  slots: TrainingSlot[];
  note: string;
  proposedBy: string;
  proposedByName: string;
  lastSlotAt: number;
  /** Set when the proposer or an admin fixes the winning slot. */
  confirmed?: { slotId: string; at: number; end?: number; place: string; byName: string };
}
export function useOpenTrainings(now: number) {
  // Re-query at most every 10 minutes so trainings that finish drop out.
  const bucket = Math.floor(now / 600_000);
  return useLiveQuery<Training>(
    `trainings/${bucket}`,
    () => query(collection(db, "trainings"), where("lastSlotAt", ">", Timestamp.fromMillis(bucket * 600_000)), orderBy("lastSlotAt", "asc"), limit(5)),
    (id, d) => ({
      id,
      slots: ((d.slots ?? []) as { id: string; at: unknown; end?: unknown; place?: string }[]).map((s) => ({ id: s.id, at: millis(s.at), end: s.end ? millis(s.end) : undefined, place: s.place ?? "" })),
      note: d.note ?? "",
      proposedBy: d.proposedBy,
      proposedByName: d.proposedByName ?? "Alguien",
      lastSlotAt: millis(d.lastSlotAt),
      confirmed: d.confirmed?.slotId
        ? { slotId: d.confirmed.slotId, at: millis(d.confirmed.at), end: d.confirmed.end ? millis(d.confirmed.end) : undefined, place: d.confirmed.place ?? "", byName: d.confirmed.byName ?? "" }
        : undefined,
    }),
  );
}
export interface TrainingVote {
  uid: string;
  slotIds: string[];
  name: string;
}
export function useTrainingVotes(trainingId: string | undefined) {
  return useLiveQuery<TrainingVote>(
    trainingId ? `trainingVotes/${trainingId}` : null,
    () => collection(db, "trainings", trainingId!, "votes"),
    (uid, d) => ({ uid, slotIds: d.slotIds ?? [], name: d.name ?? "Miembro" }),
  );
}

// ---------- board
export interface BoardMessage {
  id: string;
  text: string;
  uid: string;
  name: string;
  playerId: string | null;
  at: number;
}
export function useBoard(size: number) {
  return useLiveQuery<BoardMessage>(
    `board/${size}`,
    () => query(collection(db, "board"), orderBy("at", "desc"), limit(size)),
    (id, d) => ({ id, text: d.text, uid: d.uid, name: d.name ?? "Miembro", playerId: d.playerId ?? null, at: millis(d.at) || Date.now() }),
  );
}

// ---------- ficha claims
export interface Claim {
  uid: string;
  playerId: string;
  playerName: string;
  nickname: string;
  email: string;
  status: "pending" | "approved" | "rejected";
}
const mapClaim = (uid: string, d: DocumentData): Claim => ({
  uid,
  playerId: d.playerId,
  playerName: d.playerName ?? "",
  nickname: d.nickname ?? "",
  email: d.email ?? "",
  status: d.status,
});
export function useMyClaim(uid: string | undefined) {
  return useLiveDoc<Claim | null>(uid ? `playerClaims/${uid}` : null, "claim", (d) => (d ? mapClaim(uid!, d) : null), null);
}
export function usePendingClaims(enabled: boolean) {
  return useLiveQuery<Claim>(
    enabled ? "claims/pending" : null,
    () => query(collection(db, "playerClaims"), where("status", "==", "pending")),
    mapClaim,
  );
}
export function usePlayerLinks(enabled: boolean) {
  return useLiveQuery<{ playerId: string; uid: string }>(
    enabled ? "playerLinks" : null,
    () => collection(db, "playerLinks"),
    (playerId, d) => ({ playerId, uid: d.uid }),
  );
}
/** Whether this member has ever written on the board (for "Primeros pasos"). */
export function useHasPosted(uid: string | undefined) {
  const q = useLiveQuery<string>(
    uid ? `board/by/${uid}` : null,
    () => query(collection(db, "board"), where("uid", "==", uid), limit(1)),
    (id) => id,
  );
  return { data: q.data.length > 0, loading: q.loading };
}

/** Everyone's porra for a match: members can read them once the match has kicked off (rules). */
export function useMatchPredictions(matchId: string | undefined, enabled: boolean) {
  return useLiveQuery<Prediction & { uid: string; name: string }>(
    matchId && enabled ? `predictions/${matchId}` : null,
    () => collection(db, "matchPrivate", matchId!, "predictions"),
    (uid, d) => ({ uid, name: d.name ?? "Miembro", goalsFor: d.goalsFor, goalsAgainst: d.goalsAgainst, goals: d.goals, scoringVersion: d.scoringVersion }),
  );
}

// ---------- the door (admins): requests, invitations and who is inside
export interface DoorRequestRow {
  uid: string;
  status: "pending" | "rejected" | "removed";
  googleName: string;
  email: string;
  photo: string;
  playerId: string | null;
  playerName: string | null;
  name: string | null;
  at: number;
}
export function useDoorRequests(enabled: boolean) {
  return useLiveQuery<DoorRequestRow>(
    enabled ? "accessRequests" : null,
    () => query(collection(db, "accessRequests"), where("status", "==", "pending")),
    (uid, d) => ({ uid, status: d.status, googleName: d.googleName ?? "", email: d.email ?? "", photo: d.photo ?? "", playerId: d.playerId ?? null, playerName: d.playerName ?? null, name: d.name ?? null, at: millis(d.at) }),
  );
}
export interface InviteRow {
  code: string;
  byName: string;
  expiresAt: number;
  maxUses: number;
  uses: number;
  revoked: boolean;
  playerId: string | null;
  playerName: string | null;
}
export function useInvites(enabled: boolean) {
  return useLiveQuery<InviteRow>(
    enabled ? "invites" : null,
    () => query(collection(db, "invites"), where("expiresAt", ">", Timestamp.fromMillis(Date.now()))),
    (code, d) => ({ code, byName: d.byName ?? "", expiresAt: millis(d.expiresAt), maxUses: d.maxUses ?? 1, uses: d.uses ?? 0, revoked: !!d.revoked, playerId: d.playerId ?? null, playerName: d.playerName ?? null }),
  );
}
export interface MemberRow {
  uid: string;
  joinedAt: number;
  via: string;
}
export function useTeamMembers(enabled: boolean) {
  return useLiveQuery<MemberRow>(enabled ? "teamMembers" : null, () => collection(db, "teamMembers"), (uid, d) => ({ uid, joinedAt: millis(d.joinedAt), via: d.via ?? "clave" }));
}
export interface PersonRow {
  uid: string;
  nickname: string;
  displayName: string;
  email: string;
  role: string;
  playerId: string | null;
  removed: boolean;
}
export function useClubPeople(enabled: boolean) {
  return useLiveQuery<PersonRow>(enabled ? "users" : null, () => collection(db, "users"), (uid, d) => ({ uid, nickname: d.nickname ?? "", displayName: d.displayName ?? "", email: d.email ?? "", role: d.role ?? "user", playerId: d.playerId || null, removed: !!d.removedAt }));
}

// ---------- your own membership (/profile: «Tu acceso» and the back of the card)
export interface Membership {
  joinedAt: number;
  /** How the account came in: "invite", "request", "returning"; older ones have none (the shared key). */
  via: string;
  /** Who let it in (a captain's uid; your own for "returning"). */
  by: string;
}
export function useMembership(uid: string | undefined) {
  return useLiveDoc<Membership | null>(uid ? `teamMembers/${uid}` : null, "membership", (d) => (d ? { joinedAt: millis(d.joinedAt), via: d.via ?? "", by: d.by ?? "" } : null), null);
}
/** A member's handle (users/{uid}.nickname), e.g. the captain who opened the door for you. */
export function useNicknameOf(uid: string | undefined) {
  return useLiveDoc<string>(uid ? `users/${uid}` : null, "nickname", (d) => (d?.nickname as string | undefined) ?? "", "");
}

// ---------- la caja (members read everything; the captains write from the admin's Caja section)
export interface Caja {
  /** caja/{seasonId} (the empty settings until a captain saves them). */
  settings: CajaSettings;
  /** The season's movements (void ones included: derived/caja leaves them out of every sum), as stored;
   *  sort them with sortMovs. */
  movs: CajaMov[];
  loading: boolean;
  error: boolean;
}
const NO_MOVS: CajaMov[] = [];
/** A season's caja: its settings and its movements, one shared listener each (vestuario and admin alike).
 *  `enabled` false (a fan, no season) opens nothing. */
export function useCaja(seasonId: string | undefined, enabled = true): Caja {
  const sid = enabled && seasonId ? seasonId : null;
  const settings = useLiveDoc<CajaSettings>(sid && `caja/${sid}`, "caja", parseCajaSettings, EMPTY_CAJA_SETTINGS);
  const movs = useLiveQuery<CajaMov | null>(
    sid && `cajaMovs/${sid}`,
    () => query(collection(db, "cajaMovs"), where("seasonId", "==", sid)),
    parseCajaMov,
  );
  const list = useMemo(() => {
    const ok = movs.data.filter((m): m is CajaMov => m !== null);
    return ok.length ? ok : NO_MOVS;
  }, [movs.data]);
  return useMemo(
    () => ({ settings: settings.data, movs: list, loading: settings.loading || movs.loading, error: settings.error || movs.error }),
    [settings.data, settings.loading, settings.error, list, movs.loading, movs.error],
  );
}

// ---------- ausencias («no puedo del 12 al 19»: members read everyone's; derived/absences for the rest)
const NO_ABSENCES: Absence[] = [];
/**
 * The team's absences that end on `today` (Madrid `YYYY-MM-DD`, derived/absences madridDate) or later —
 * yours and everyone's, soonest first (one shared listener; a new day opens a new one). `enabled` false
 * (a fan) opens nothing. Filter yours with `uid`, a player's badge with absenceOn.
 */
export function useAbsences(today: string, enabled = true): Live<Absence[]> {
  const q = useLiveQuery<Absence | null>(
    enabled && today ? `absences/${today}` : null,
    () => query(collection(db, "absences"), where("to", ">=", today)),
    parseAbsence,
  );
  const list = useMemo(() => {
    const ok = currentAbsences(q.data.filter((a): a is Absence => a !== null), today);
    return ok.length ? ok : NO_ABSENCES;
  }, [q.data, today]);
  return useMemo(() => ({ data: list, loading: q.loading, error: q.error }), [list, q.loading, q.error]);
}
