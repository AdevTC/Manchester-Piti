// CLUB · the reads only the office's rooms need (captains): «Lo que se ha mandado» (pushSent), a match's porras with
// the captain's corrections (M-46), and the content drafts on the server (clubDrafts/content, M-20). The rest comes
// from the app's shared listeners (vestuario/live: polls, board, trainings, absences, notices; useRota; standings).
import { useEffect, useState } from "react";
import { collection, doc, limit, onSnapshot, orderBy, query, type DocumentData } from "firebase/firestore";
import { db } from "../../../../firebase";
import type { PushSentDoc } from "../../../../lib/clubData";
import { pushSentSchema } from "../../../../lib/schemas";
import type { GoalPick } from "../../../../../functions/src/predictions";

export interface Snap<T> {
  data: T;
  loading: boolean;
  error: boolean;
}

/** One onSnapshot for `key` (null: none), mapped; the last good value stays on an error. */
function useSnap<T>(key: string | null, open: (next: (v: T) => void, fail: () => void) => () => void, empty: T): Snap<T> {
  const [state, setState] = useState<Snap<T> & { key: string | null }>({ data: empty, loading: !!key, error: false, key });
  useEffect(() => {
    if (!key) return;
    return open(
      (v) => setState({ data: v, loading: false, error: false, key }),
      () => setState((s) => ({ ...s, loading: false, error: true, key })),
    );
    // oxlint-disable-next-line react/exhaustive-deps -- `open` is rebuilt every render; the key says what it opens
  }, [key]);
  if (state.key !== key) return { data: empty, loading: !!key, error: false };
  return state;
}

const NO_SENT: PushSentDoc[] = [];
/** The latest notices sent to the team (M-18), newest first. */
export function usePushSent(enabled: boolean, size = 40): Snap<PushSentDoc[]> {
  return useSnap<PushSentDoc[]>(
    enabled ? `pushSent/${size}` : null,
    (next, fail) =>
      onSnapshot(
        query(collection(db, "pushSent"), orderBy("at", "desc"), limit(size)),
        (s) => next(s.docs.flatMap((d) => {
          const r = pushSentSchema.safeParse({ id: d.id, ...d.data() });
          return r.success ? [r.data] : [];
        })),
        fail,
      ),
    NO_SENT,
  );
}

export interface PorraRow {
  uid: string;
  name: string;
  goalsFor: number;
  goalsAgainst: number;
  goals: GoalPick[];
  /** «Corregida por @capi» (M-46), "" when he wrote it himself. */
  correctedByName: string;
  correctedBy: string;
}
const num = (v: unknown) => (typeof v === "number" && Number.isInteger(v) && v >= 0 ? v : 0);
function mapPorra(uid: string, d: DocumentData): PorraRow {
  const goals = Array.isArray(d.goals) ? (d.goals as unknown[]).flatMap((g) => (g && typeof g === "object" && typeof (g as GoalPick).playerId === "string" ? [g as GoalPick] : [])) : [];
  return { uid, name: typeof d.name === "string" ? d.name : "Socio", goalsFor: num(d.goalsFor), goalsAgainst: num(d.goalsAgainst), goals, correctedByName: typeof d.correctedByName === "string" ? d.correctedByName : "", correctedBy: typeof d.correctedBy === "string" ? d.correctedBy : "" };
}
const NO_PORRAS: PorraRow[] = [];
/** A match's porras (members read them once it kicked off; captains always). */
export function useMatchPorras(matchId: string | undefined): Snap<PorraRow[]> {
  return useSnap<PorraRow[]>(
    matchId ? `porras/${matchId}` : null,
    (next, fail) => onSnapshot(collection(db, "matchPrivate", matchId!, "predictions"), (s) => next(s.docs.map((d) => mapPorra(d.id, d.data())).sort((a, b) => a.name.localeCompare(b.name, "es"))), fail),
    NO_PORRAS,
  );
}

export interface DraftDocRaw {
  exists: boolean;
  rev: number;
  data: DocumentData | null;
  /** Our own write still on its way (the echo of a local change). */
  pending: boolean;
}
const NO_DRAFT_DOC: DraftDocRaw = { exists: false, rev: -1, data: null, pending: false };
/** clubDrafts/content as it is (the web room parses it). */
export function useClubDraftDoc(enabled: boolean): Snap<DraftDocRaw> {
  return useSnap<DraftDocRaw>(
    enabled ? "clubDrafts/content" : null,
    (next, fail) =>
      onSnapshot(
        doc(db, "clubDrafts", "content"),
        { includeMetadataChanges: true },
        (s) => next(s.exists() ? { exists: true, rev: typeof s.get("rev") === "number" ? (s.get("rev") as number) : 0, data: s.data(), pending: s.metadata.hasPendingWrites } : { ...NO_DRAFT_DOC, pending: s.metadata.hasPendingWrites }),
        fail,
      ),
    NO_DRAFT_DOC,
  );
}
