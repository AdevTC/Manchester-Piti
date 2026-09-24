// Realtime Firestore subscriptions for team-only vestuario data (onSnapshot, no polling).
import { useEffect, useMemo, useState } from "react";
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
} from "firebase/firestore";
import { db } from "../../firebase";
import { useFirestoreCollection } from "../../lib/useFirestoreCollection";
import type { MvpResult, TrainingSlot } from "../../lib/vestuario";

interface Live<T> {
  data: T;
  loading: boolean;
  error: boolean;
}
function useLiveDoc<T>(path: string | null, map: (d: DocumentData | undefined) => T, empty: T): Live<T> {
  const [state, setState] = useState<{ path: string | null; data: T; loading: boolean; error: boolean }>({ path: null, data: empty, loading: true, error: false });
  useEffect(() => {
    if (!path) return;
    return onSnapshot(
      doc(db, path),
      (s) => setState({ path, data: map(s.exists() ? s.data() : undefined), loading: false, error: false }),
      () => setState({ path, data: empty, loading: false, error: true }),
    );
    // map/empty are module-level or stable per call site
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [path]);
  if (!path) return { data: empty, loading: false, error: false };
  return state.path === path ? state : { data: empty, loading: true, error: false };
}
function useLiveQuery<T>(key: string | null, build: () => Query, map: (id: string, d: DocumentData) => T): Live<T[]> {
  const [state, setState] = useState<{ key: string | null; data: T[]; loading: boolean; error: boolean }>({ key: null, data: [], loading: true, error: false });
  useEffect(() => {
    if (!key) return;
    return onSnapshot(
      build(),
      (s) => setState({ key, data: s.docs.map((d) => map(d.id, d.data())), loading: false, error: false }),
      () => setState({ key, data: [], loading: false, error: true }),
    );
    // the key fully describes the query
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [key]);
  if (!key) return { data: [], loading: false, error: false };
  return state.key === key ? state : { data: [], loading: true, error: false };
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
export function useMeetingNote(matchId: string | undefined) {
  return useLiveDoc<string>(matchId ? `matchPrivate/${matchId}` : null, (d) => (d?.meetingNote as string) ?? "", "");
}

// ---------- MVP
const mapMvp = (id: string, d: unknown): MvpResult => {
  const data = (d ?? {}) as { counts?: Record<string, number>; total?: number };
  return { id, counts: data.counts ?? {}, total: data.total ?? 0 };
};
const mvpQuery = collection(db, "mvpResults");
export function useMvpResults() {
  const q = useFirestoreCollection(["mvpResults"], mvpQuery, mapMvp);
  return useMemo(() => new Map((q.data ?? []).map((r) => [r.id, r])), [q.data]);
}
export function useMyMvpVote(matchId: string | undefined, uid: string | undefined) {
  return useLiveDoc<string>(matchId && uid ? `matches/${matchId}/votes/${uid}` : null, (d) => (d?.playerId as string) ?? "", "");
}
export function useMvpVoters(matchId: string | undefined, enabled: boolean) {
  return useLiveQuery<{ uid: string; voterName: string; playerId: string }>(
    matchId && enabled ? `votes/${matchId}` : null,
    () => collection(db, "matches", matchId!, "votes"),
    (uid, d) => ({ uid, voterName: d.voterName ?? "Miembro", playerId: d.playerId }),
  );
}

// ---------- porra
export interface Prediction {
  goalsFor: number;
  goalsAgainst: number;
}
export function useMyPrediction(matchId: string | undefined, uid: string | undefined) {
  return useLiveDoc<Prediction | null>(
    matchId && uid ? `matchPrivate/${matchId}/predictions/${uid}` : null,
    (d) => (d ? { goalsFor: d.goalsFor, goalsAgainst: d.goalsAgainst } : null),
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
  return useLiveDoc<PorraRow[]>(seasonId ? `porraStandings/${seasonId}` : null, (d) => (d?.rows as PorraRow[]) ?? [], []);
}

// ---------- trainings
export interface Training {
  id: string;
  slots: TrainingSlot[];
  note: string;
  proposedBy: string;
  proposedByName: string;
  lastSlotAt: number;
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
  return useLiveDoc<Claim | null>(uid ? `playerClaims/${uid}` : null, (d) => (d ? mapClaim(uid!, d) : null), null);
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
