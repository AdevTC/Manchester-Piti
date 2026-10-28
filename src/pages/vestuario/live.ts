import type { Prediction } from "../../../functions/src/predictions";
import type { HistoricalPrediction } from "../../lib/postMatch";
export type { Prediction } from "../../../functions/src/predictions";
// Realtime Firestore subscriptions for team-only vestuario data (onSnapshot, no polling).
// Listeners are shared by key and kept warm for a minute after the last reader leaves, so
// coming back to the vestuario paints the last data at once instead of an empty block.
import { useCallback, useMemo, useState, useSyncExternalStore } from "react";
import type { DocumentData, Query, SnapshotMetadata } from "firebase/firestore";
// (every listener opens once Firebase is in, handed the SDK: lib/fb)
import { withFirebase, type Fb } from "../../lib/fb";
import { LISTENER_RETRY_MS, markListenerStale, metaKeyOf, noteListenerFailure, recordSnapshotMeta, reopenDelay, useOnline, useSnapshotMeta } from "../../lib/syncStatus";
import { mapMatch, mapMvp, mapNotice, MVP_RESULTS_KEY, mvpPrivateWhileOpen } from "../../lib/firestoreMappers";
import { mergeNotices, type Notice, type NoticeAudience } from "../../lib/derived/notices";
import { MATCHES_KEY, matchQuery } from "../../lib/publicData";
import { visibleMatchLinks } from "../../lib/matchVisibility";
import { useFirestoreCollection } from "../../lib/useFirestoreCollection";
import { renderNow } from "../../lib/serverTime";
import { useTakingOver } from "../../hooks/useClock";
import type { TrainingSlot } from "../../lib/vestuario";
import { EMPTY_CAJA_SETTINGS, parseCajaMov, parseCajaSettings, type CajaMov, type CajaSettings } from "../../lib/derived/caja";
import { parseCajaClaim, sortClaims, type CajaClaim } from "../../lib/derived/cajaClaims";
import { byAbsence, currentAbsences, parseAbsence, type Absence } from "../../lib/derived/absences";
import { parseRotaTurns, type RotaTurnsDoc } from "../../lib/derived/rota";
import { parsePoll, parsePollVote, type Poll, type PollVote } from "../../lib/derived/polls";
import { parseRatingDoc, parseReactionDoc, type RatingDoc, type ReactionDoc } from "../../lib/derived/trasElPartido";

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
type Start<T> = (sink: Sink<T>, fb: Fb) => () => void;
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
  const sink: Sink<T> = {
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
  };
  close = withFirebase((fb) => start(sink, fb));
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
  // (the server render has no listeners: the public pages paint from the data bundle, the live data comes on the client)
  const state = useSyncExternalStore(subscribe, () => (key ? shared.get(key)?.state ?? null : null), () => null);
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
    (sink, fb) => {
      if (import.meta.env.DEV) {
        const open = openProjections.get(path!) ?? new Set<string>();
        open.add(mapId);
        openProjections.set(path!, open);
        if (open.size > 1) console.error(`useLiveDoc: ${path} se lee con varias proyecciones (${[...open].join(", ")}); usa un solo hook que mapee el documento entero.`);
      }
      // A doc snapshot has no docChanges: a metadata-only one is told apart by its mapped value.
      let first = true;
      let last: T = empty;
      const stop = fb.onSnapshot(
        fb.doc(fb.db, path!),
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
function useLiveQuery<T>(key: string | null, build: (fb: Fb) => Query, map: (id: string, d: DocumentData) => T): Live<T[]> {
  return useShared<T[]>(
    key && `query:${key}`,
    (sink, fb) => {
      let first = true;
      let last: T[] = NONE;
      return fb.onSnapshot(
        build(fb),
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
const millis = (v: unknown) =>
  typeof v === "object" && v !== null && typeof (v as { toMillis?: unknown }).toMillis === "function" ? (v as { toMillis: () => number }).toMillis() : typeof v === "number" ? v : 0;

// ---------- convocatoria
export interface Availability {
  uid: string;
  response: "yes" | "no" | "maybe";
  name: string;
  playerId: string | null;
  /** Only on a «No puedo» an absence wrote (`source: "absence"`): its id ("" if missing). A hand answer
   *  has none — the «Ausente · hasta 19 oct» badges (derived/absences absentBadge) read it. */
  absenceId?: string;
}
export function useAvailability(matchId: string | undefined) {
  return useLiveQuery<Availability>(
    matchId ? `availability/${matchId}` : null,
    (fb) => fb.collection(fb.db, "matchPrivate", matchId!, "availability"),
    (uid, d) => ({
      uid,
      response: d.response,
      name: d.name ?? "Miembro",
      playerId: d.playerId ?? null,
      ...(byAbsence(d) ? { absenceId: typeof d.absenceId === "string" ? d.absenceId : "" } : {}),
    }),
  );
}

// ---------- tras el partido: public, so fans read them too. One listener per subcollection and match,
// whoever reads it (the match page opens them while its acta is published; lib/derived/trasElPartido).
const NO_REACTIONS: ReactionDoc[] = [];
const NO_RATINGS: RatingDoc[] = [];
export function useMatchReactions(matchId: string | undefined): Live<ReactionDoc[]> {
  const q = useLiveQuery<ReactionDoc | null>(matchId ? `reactions/${matchId}` : null, (fb) => fb.collection(fb.db, "matches", matchId!, "reactions"), (uid, d) => parseReactionDoc(uid, d));
  return useMemo(() => ({ ...q, data: q.data.length ? q.data.filter((d): d is ReactionDoc => d !== null) : NO_REACTIONS }), [q]);
}
export function useMatchRatings(matchId: string | undefined): Live<RatingDoc[]> {
  const q = useLiveQuery<RatingDoc | null>(matchId ? `ratings/${matchId}` : null, (fb) => fb.collection(fb.db, "matches", matchId!, "ratings"), (uid, d) => parseRatingDoc(uid, d));
  return useMemo(() => ({ ...q, data: q.data.length ? q.data.filter((d): d is RatingDoc => d !== null) : NO_RATINGS }), [q]);
}

// ---------- matchPrivate/{id}: one listener, two readers (the meeting note and the designated scorers)
export interface MatchPrivate {
  meetingNote: string;
  scorerUids: string[];
  /** How many porras the match has (the server's count: the porras themselves stay private before the whistle). */
  porraCount: number | null;
  /** r12 M-42: the notas could not be rated at publication (null when they were, or nothing is known). */
  notasError: { at: number; message: string } | null;
}
const EMPTY_MATCH_PRIVATE: MatchPrivate = { meetingNote: "", scorerUids: [], porraCount: null, notasError: null };
const notasErrorOf = (v: unknown): MatchPrivate["notasError"] => {
  const o = v as { at?: unknown; message?: unknown } | null | undefined;
  return o && typeof o.at === "number" && typeof o.message === "string" ? { at: o.at, message: o.message } : null;
};
const mapMatchPrivate = (d: DocumentData | undefined): MatchPrivate =>
  d ? { meetingNote: (d.meetingNote as string | undefined) ?? "", scorerUids: (d.scorerUids as string[] | undefined) ?? [], porraCount: typeof d.porraCount === "number" ? d.porraCount : null, notasError: notasErrorOf(d.notasError) } : EMPTY_MATCH_PRIVATE;
/** The whole private match doc. Read it through useMeetingNote / useMatchScorers; never map matchPrivate/{id} elsewhere. */
export function useMatchPrivate(matchId: string | undefined) {
  return useLiveDoc<MatchPrivate>(matchId ? `matchPrivate/${matchId}` : null, "matchPrivate", mapMatchPrivate, EMPTY_MATCH_PRIVATE);
}
export function useMeetingNote(matchId: string | undefined): Live<string> {
  const q = useMatchPrivate(matchId);
  return useMemo(() => ({ data: q.data.meetingNote, loading: q.loading, error: q.error }), [q]);
}
/** How many porras the match has, before anyone may read them (null until the server has counted). */
export function usePorraCount(matchId: string | undefined): number | null {
  return useMatchPrivate(matchId).data.porraCount;
}
export function useMatchScorers(matchId: string | undefined): Live<string[]> {
  const q = useMatchPrivate(matchId);
  return useMemo(() => ({ data: q.data.scorerUids, loading: q.loading, error: q.error }), [q]);
}

// ---------- MVP
// (key and mapper shared with the boot and the server render: lib/publicData)
const mvpQuery = (fb: Fb) => fb.collection(fb.db, "mvpResults");
export function useMvpResults() {
  const q = useFirestoreCollection(MVP_RESULTS_KEY, mvpQuery, mapMvp);
  const matches = useFirestoreCollection(MATCHES_KEY, matchQuery, mapMatch);
  // (an open vote never shows counts, whatever an older doc holds: mvpPrivateWhileOpen, on the server's clock;
  // a server-rendered page's own instant while React takes it over)
  const takingOver = useTakingOver();
  return useMemo(() => {
    const list = matches.data ?? [];
    return new Map(mvpPrivateWhileOpen(visibleMatchLinks(q.data ?? [], list, (r) => r.id), list, renderNow(takingOver)).map((r) => [r.id, r]));
  }, [q.data, matches.data, takingOver]);
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
    (fb) => fb.collection(fb.db, "matches", matchId!, "votes"),
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
  return useShared<HistoricalPrediction[]>(enabled && ids.length ? `porra-history:${ids.join(',')}` : null, (sink, fb) => {
    const snapshots = new Map<string, { rows: HistoricalPrediction[]; meta: SnapshotMetadata }>();
    const stops = ids.map(matchId => fb.onSnapshot(fb.collection(fb.db, 'matchPrivate', matchId, 'predictions'), { includeMetadataChanges: true }, s => {
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
    (fb) => fb.query(fb.collection(fb.db, "trainings"), fb.where("lastSlotAt", ">", fb.Timestamp.fromMillis(bucket * 600_000)), fb.orderBy("lastSlotAt", "asc"), fb.limit(5)),
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
    (fb) => fb.collection(fb.db, "trainings", trainingId!, "votes"),
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
    (fb) => fb.query(fb.collection(fb.db, "board"), fb.orderBy("at", "desc"), fb.limit(size)),
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
    (fb) => fb.query(fb.collection(fb.db, "playerClaims"), fb.where("status", "==", "pending")),
    mapClaim,
  );
}
export function usePlayerLinks(enabled: boolean) {
  return useLiveQuery<{ playerId: string; uid: string }>(
    enabled ? "playerLinks" : null,
    (fb) => fb.collection(fb.db, "playerLinks"),
    (playerId, d) => ({ playerId, uid: d.uid }),
  );
}
/** Whether this member has ever written on the board (for "Primeros pasos"). */
export function useHasPosted(uid: string | undefined) {
  const q = useLiveQuery<string>(
    uid ? `board/by/${uid}` : null,
    (fb) => fb.query(fb.collection(fb.db, "board"), fb.where("uid", "==", uid), fb.limit(1)),
    (id) => id,
  );
  return { data: q.data.length > 0, loading: q.loading };
}

/** Everyone's porra for a match: members can read them once the match has kicked off (rules). */
export function useMatchPredictions(matchId: string | undefined, enabled: boolean) {
  return useLiveQuery<Prediction & { uid: string; name: string }>(
    matchId && enabled ? `predictions/${matchId}` : null,
    (fb) => fb.collection(fb.db, "matchPrivate", matchId!, "predictions"),
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
    (fb) => fb.query(fb.collection(fb.db, "accessRequests"), fb.where("status", "==", "pending")),
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
    (fb) => fb.query(fb.collection(fb.db, "invites"), fb.where("expiresAt", ">", fb.Timestamp.fromMillis(Date.now()))),
    (code, d) => ({ code, byName: d.byName ?? "", expiresAt: millis(d.expiresAt), maxUses: d.maxUses ?? 1, uses: d.uses ?? 0, revoked: !!d.revoked, playerId: d.playerId ?? null, playerName: d.playerName ?? null }),
  );
}
export interface MemberRow {
  uid: string;
  joinedAt: number;
  via: string;
}
export function useTeamMembers(enabled: boolean) {
  return useLiveQuery<MemberRow>(enabled ? "teamMembers" : null, (fb) => fb.collection(fb.db, "teamMembers"), (uid, d) => ({ uid, joinedAt: millis(d.joinedAt), via: d.via ?? "clave" }));
}
export interface PersonRow {
  uid: string;
  nickname: string;
  displayName: string;
  email: string;
  role: string;
  playerId: string | null;
  removed: boolean;
  /** When the access was taken away (ms; 0 = inside, or unknown). */
  removedAt?: number;
  /** Who took it away (r12: the captain, or his own uid when he left); absent on the old removals. */
  removedBy?: string | null;
}
export function useClubPeople(enabled: boolean) {
  return useLiveQuery<PersonRow>(enabled ? "users" : null, (fb) => fb.collection(fb.db, "users"), (uid, d) => ({ uid, nickname: d.nickname ?? "", displayName: d.displayName ?? "", email: d.email ?? "", role: d.role ?? "user", playerId: d.playerId || null, removed: !!d.removedAt, removedAt: millis(d.removedAt), removedBy: typeof d.removedBy === "string" ? d.removedBy : null }));
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
    (fb) => fb.query(fb.collection(fb.db, "cajaMovs"), fb.where("seasonId", "==", sid)),
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

// ---------- «Ya la he pagado» (cajaClaims: a member reads his own, the captains all; derived/cajaClaims)
const NO_CLAIMS: CajaClaim[] = [];
const okClaims = (list: (CajaClaim | null)[]): CajaClaim[] => {
  const ok = sortClaims(list.filter((c): c is CajaClaim => c !== null));
  return ok.length ? ok : NO_CLAIMS;
};
/** The member's own payment notices (every season, pending first). `uid` undefined (a fan) opens nothing. */
export function useMyCajaClaims(uid: string | undefined): Live<CajaClaim[]> {
  const q = useLiveQuery<CajaClaim | null>(uid ? `cajaClaims/uid/${uid}` : null, (fb) => fb.query(fb.collection(fb.db, "cajaClaims"), fb.where("uid", "==", uid)), parseCajaClaim);
  const list = useMemo(() => okClaims(q.data), [q.data]);
  return useMemo(() => ({ data: list, loading: q.loading, error: q.error }), [list, q.loading, q.error]);
}
/** A season's payment notices, for the captains' La caja («Pagos avisados»; pending first). `enabled` false
 *  (not a captain) opens nothing: the rules let only captains read everyone's. */
export function useCajaClaims(seasonId: string | undefined, enabled: boolean): Live<CajaClaim[]> {
  const sid = enabled && seasonId ? seasonId : null;
  const q = useLiveQuery<CajaClaim | null>(sid && `cajaClaims/season/${sid}`, (fb) => fb.query(fb.collection(fb.db, "cajaClaims"), fb.where("seasonId", "==", sid)), parseCajaClaim);
  const list = useMemo(() => okClaims(q.data), [q.data]);
  return useMemo(() => ({ data: list, loading: q.loading, error: q.error }), [list, q.loading, q.error]);
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
    (fb) => fb.query(fb.collection(fb.db, "absences"), fb.where("to", ">=", today)),
    parseAbsence,
  );
  const list = useMemo(() => {
    const ok = currentAbsences(q.data.filter((a): a is Absence => a !== null), today);
    return ok.length ? ok : NO_ABSENCES;
  }, [q.data, today]);
  return useMemo(() => ({ data: list, loading: q.loading, error: q.error }), [list, q.loading, q.error]);
}

// ---------- turnos del equipo: the season's rotaTurns (one small doc per match at most: the frozen history
// and the captains' pins). Members only: `enabled` false (a fan) opens nothing.
export interface SeasonRotaTurns {
  id: string;
  doc: RotaTurnsDoc;
}
export function useSeasonRotaTurns(seasonId: string | undefined, enabled = true): Live<SeasonRotaTurns[]> {
  return useLiveQuery<SeasonRotaTurns>(enabled && seasonId ? `rotaTurns/${seasonId}` : null, (fb) => fb.query(fb.collection(fb.db, "rotaTurns"), fb.where("seasonId", "==", seasonId)), (id, d) => ({ id, doc: parseRotaTurns(d) }));
}

// ---------- encuestas (members only; derived/polls for the rest)
const POLLS_LIMIT = 20;
const NO_POLLS: Poll[] = [];
/**
 * The latest polls, newest first (one shared listener). Open and closed alike: filter the vestuario's list
 * with visiblePolls (open, or closed within 7 days). `enabled` false (a fan) opens nothing.
 */
export function usePolls(enabled = true): Live<Poll[]> {
  const q = useLiveQuery<Poll | null>(
    enabled ? `polls/${POLLS_LIMIT}` : null,
    (fb) => fb.query(fb.collection(fb.db, "polls"), fb.orderBy("createdAt", "desc"), fb.limit(POLLS_LIMIT)),
    (id, d) => parsePoll(id, d, Date.now()),
  );
  const list = useMemo(() => {
    const ok = q.data.filter((p): p is Poll => p !== null);
    return ok.length ? ok : NO_POLLS;
  }, [q.data]);
  return useMemo(() => ({ data: list, loading: q.loading, error: q.error }), [list, q.loading, q.error]);
}
const NO_POLL_VOTES: PollVote[] = [];
/** A poll's votes (public to the team): one shared listener per poll. */
export function usePollVotes(pollId: string | undefined): Live<PollVote[]> {
  const q = useLiveQuery<PollVote | null>(pollId ? `pollVotes/${pollId}` : null, (fb) => fb.collection(fb.db, "polls", pollId!, "votes"), parsePollVote);
  const list = useMemo(() => {
    const ok = q.data.filter((v): v is PollVote => v !== null);
    return ok.length ? ok : NO_POLL_VOTES;
  }, [q.data]);
  return useMemo(() => ({ data: list, loading: q.loading, error: q.error }), [list, q.loading, q.error]);
}

// ---------- centro de avisos
const NOTICES_LIMIT = 30;
const noticesOf = (audience: NoticeAudience, uid?: string) => (fb: Fb) =>
  uid
    ? fb.query(fb.collection(fb.db, "notices"), fb.where("audience", "==", audience), fb.where("uid", "==", uid), fb.orderBy("at", "desc"), fb.limit(NOTICES_LIMIT))
    : fb.query(fb.collection(fb.db, "notices"), fb.where("audience", "==", audience), fb.orderBy("at", "desc"), fb.limit(NOTICES_LIMIT));
const NO_NOTICES: Notice[] = [];
/**
 * The bell's notices, newest first: the team's, the captains' (only for an `admin`) and `uid`'s own. Three
 * shared listeners, each filtered by audience so the rules can prove the read (firestore.rules), each opened
 * only when it applies; no `uid` (a fan) opens none.
 */
export function useNotices(uid: string | undefined, admin: boolean): Live<Notice[]> {
  const team = useLiveQuery<Notice | null>(uid ? "notices/team" : null, noticesOf("team"), mapNotice);
  const captains = useLiveQuery<Notice | null>(uid && admin ? "notices/captains" : null, noticesOf("captains"), mapNotice);
  const mine = useLiveQuery<Notice | null>(uid ? `notices/personal/${uid}` : null, noticesOf("personal", uid), mapNotice);
  const ok = (l: (Notice | null)[]) => l.filter((n): n is Notice => n !== null);
  const list = useMemo(() => {
    const all = mergeNotices(ok(team.data), ok(captains.data), ok(mine.data));
    return all.length ? all : NO_NOTICES;
  }, [team.data, captains.data, mine.data]);
  const loading = team.loading || captains.loading || mine.loading;
  const error = team.error || captains.error || mine.error;
  return useMemo(() => ({ data: list, loading, error }), [list, loading, error]);
}

// ---------- r12 · the acta's Después and Historial (captains): what was sent and who changed what, for ONE match
/** pushSent where matchId == id (M-18: «Los avisos que salieron»). Captains only (rules); a where without orderBy
 *  needs no composite index: the screen sorts. */
export function useMatchPushSent<T>(matchId: string | undefined, enabled: boolean, map: (id: string, d: DocumentData) => T): Live<T[]> {
  return useLiveQuery<T>(matchId && enabled ? `pushSent/match/${matchId}` : null, (fb) => fb.query(fb.collection(fb.db, "pushSent"), fb.where("matchId", "==", matchId!)), map);
}
/** matchAudit where matchId == id (H-PAR-05: the acta's history). Captains only (rules); the screen sorts. */
export function useMatchAudit<T>(matchId: string | undefined, enabled: boolean, map: (id: string, d: DocumentData) => T): Live<T[]> {
  return useLiveQuery<T>(matchId && enabled ? `matchAudit/${matchId}` : null, (fb) => fb.query(fb.collection(fb.db, "matchAudit"), fb.where("matchId", "==", matchId!)), map);
}
