// Canonical per-collection mappers for the shared realtime cache bridge.
//
// A shared `queryKey` has ONE cache slot, and `useFirestoreCollection` captures
// the FIRST subscriber's `map` (see subscribeShared) — so every consumer of a
// given key MUST pass the SAME mapper, or whichever component mounts first
// silently dictates the cached shape for everyone else. To make that safe, each
// shared collection has exactly one mapper here that returns the FULL validated
// doc (with `id` and every field). Consumers derive their reduced/filtered view
// in a `useMemo` over these docs — never by passing a divergent mapper.
//
// Validation semantics mirror `parseDocs`: `safeParse({ id, ...dropNullFields })`,
// discard + log invalid docs (null instead of throwing so the bridge drops them).
import {
  seasonSchema,
  playerSchema,
  seasonMatchSchema,
  lineupSchema,
  reactionSchema,
  dropNullFields,
  type SeasonDoc,
  type PlayerDoc,
  type SeasonMatchDoc,
  type ReactionDoc,
} from "./schemas";
import { reportDroppedDoc } from "./docTelemetry";
import type { MvpResult } from "./vestuario";
import { isVisibleMatch } from "../../functions/src/matchEngine";

/** Docs of an archived season (flag set by the setSeasonArchived callable) stay
 *  in Firestore but never reach the app: the shared mappers drop them. */
const isArchived = (data: unknown) => (data as { archived?: unknown } | null)?.archived === true;

/** Raw validated lineup doc. lineupSchema is a looseObject, so all board fields
 *  (formation/slots/bench/roles/…) pass through; dataToLineupDoc derives the
 *  in-memory LineupDoc from this in the consumer. */
export type RawLineupDoc = Record<string, unknown> & { id: string };

/** Canonical `["seasons"]` mapper — full validated season doc. */
export function mapSeason(id: string, data: unknown): SeasonDoc | null {
  const r = seasonSchema.safeParse({ id, ...dropNullFields(data as Record<string, unknown>) });
  if (!r.success) {
    reportDroppedDoc("seasons", id, r.error.issues);
    return null;
  }
  return r.data;
}

/** Canonical `["players"]` mapper — full validated player doc. */
export function mapPlayer(id: string, data: unknown): PlayerDoc | null {
  if (isArchived(data)) return null;
  return mapRawPlayer(id, data);
}

/** Admin's archive reads retain player names without contaminating the public PLAYERS_KEY. */
export function mapRawPlayer(id: string, data: unknown): PlayerDoc | null {
  const r = playerSchema.safeParse({ id, ...dropNullFields(data as Record<string, unknown>) });
  if (!r.success) {
    reportDroppedDoc("players", id, r.error.issues);
    return null;
  }
  return r.data;
}

/** Canonical `["matches"]` mapper — full validated match doc. seasonMatchSchema
 *  is a looseObject, so events/competition/date pass through for every consumer. */
export function mapMatch(id: string, data: unknown): SeasonMatchDoc | null {
  if (!isVisibleMatch(data)) return null;
  return mapRawMatch(id, data);
}

/** Admin's own cache may inspect archived records; never use this mapper with MATCHES_KEY. */
export function mapRawMatch(id: string, data: unknown): SeasonMatchDoc | null {
  const r = seasonMatchSchema.safeParse({ id, ...dropNullFields(data as Record<string, unknown>) });
  if (!r.success) {
    reportDroppedDoc("matches", id, r.error.issues);
    return null;
  }
  return r.data;
}

/** Canonical `["lineups", seasonId]` mapper — raw validated lineup doc (full
 *  passthrough). Discards docs that aren't usable objects (e.g. missing
 *  seasonId); dataToLineupDoc tolerates all other missing board fields. */
export function mapLineup(id: string, data: unknown): RawLineupDoc | null {
  const raw = dropNullFields(data as Record<string, unknown>);
  const r = lineupSchema.safeParse({ id, ...raw });
  if (!r.success) {
    reportDroppedDoc("lineups", id, r.error.issues);
    return null;
  }
  return { id, ...raw };
}

/** Canonical `["lineupReactions", lineupId]` mapper — one member's reaction to
 *  an official board (`lineups/{id}/reactions/{uid}`; the doc id is the uid). */
export function mapReaction(id: string, data: unknown): ReactionDoc | null {
  const r = reactionSchema.safeParse({ id, ...dropNullFields(data as Record<string, unknown>) });
  if (!r.success) {
    reportDroppedDoc("lineups.reactions", id, r.error.issues);
    return null;
  }
  return r.data;
}

/** Every match's MVP tally (useMvpResults; public: in the bundle, seeded by the server render, waited for
 *  by the boot — lib/publicData). Here so the vestuario's live module can share it without importing the boot. */
export const MVP_RESULTS_KEY = ["mvpResults"] as const;
/** Canonical `["mvpResults"]` mapper: a match's MVP tally (`mvpResults/{matchId}`, kept by the backend):
 *  counts per player and the total, never who voted whom. */
export function mapMvp(id: string, data: unknown): MvpResult {
  const d = (data ?? {}) as { counts?: Record<string, number>; total?: number };
  return { id, counts: d.counts ?? {}, total: d.total ?? 0 };
}
