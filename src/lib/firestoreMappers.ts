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
  dropNullFields,
  type SeasonDoc,
  type PlayerDoc,
  type SeasonMatchDoc,
} from "./schemas";

/** Raw validated lineup doc. lineupSchema is a looseObject, so all board fields
 *  (formation/slots/bench/roles/…) pass through; dataToLineupDoc derives the
 *  in-memory LineupDoc from this in the consumer. */
export type RawLineupDoc = Record<string, unknown> & { id: string };

/** Canonical `["seasons"]` mapper — full validated season doc. */
export function mapSeason(id: string, data: unknown): SeasonDoc | null {
  const r = seasonSchema.safeParse({ id, ...dropNullFields(data as Record<string, unknown>) });
  if (!r.success) {
    console.error(`[schema] doc inválido en seasons/${id}:`, r.error.issues);
    return null;
  }
  return r.data;
}

/** Canonical `["players"]` mapper — full validated player doc. */
export function mapPlayer(id: string, data: unknown): PlayerDoc | null {
  const r = playerSchema.safeParse({ id, ...dropNullFields(data as Record<string, unknown>) });
  if (!r.success) {
    console.error(`[schema] doc inválido en players/${id}:`, r.error.issues);
    return null;
  }
  return r.data;
}

/** Canonical `["matches"]` mapper — full validated match doc. seasonMatchSchema
 *  is a looseObject, so events/competition/date pass through for every consumer. */
export function mapMatch(id: string, data: unknown): SeasonMatchDoc | null {
  const r = seasonMatchSchema.safeParse({ id, ...dropNullFields(data as Record<string, unknown>) });
  if (!r.success) {
    console.error(`[schema] doc inválido en matches/${id}:`, r.error.issues);
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
    console.error(`[schema] doc inválido en lineups/${id}:`, r.error.issues);
    return null;
  }
  return { id, ...raw };
}
