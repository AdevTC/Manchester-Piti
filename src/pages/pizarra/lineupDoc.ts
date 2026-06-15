// The `lineups` Firestore document and the pure (de)serialization between it
// and the in-memory Lineup. No React / no Firestore calls here so this stays
// unit-testable (sub-project 4). Firestore rejects `undefined`, so writes are
// pruned and `matchId` is normalized to `null`.
import type { Lineup } from "./formations";

/** Metadata stored alongside the board fields in the `lineups` collection. */
export interface LineupMeta {
  ownerUid: string;
  ownerNickname: string;
  seasonId: string; // "all" or a season id
  name: string;
  isOfficial: boolean;
  matchId: string | null; // null = season-scoped official (or not official)
}

/** A full board as held in memory after loading from the store. */
export interface LineupDoc extends Lineup, LineupMeta {
  id: string;
  createdAt: number | null; // ms epoch; null while a local write is pending
  updatedAt: number | null;
}

/** A Firestore Timestamp-ish value (avoids importing the class for a type). */
interface TimestampLike {
  toMillis: () => number;
}
function isTimestampLike(v: unknown): v is TimestampLike {
  return typeof v === "object" && v !== null && typeof (v as { toMillis?: unknown }).toMillis === "function";
}
function toMillis(v: unknown): number | null {
  if (isTimestampLike(v)) return v.toMillis();
  if (typeof v === "number") return v;
  return null;
}

/** Drop keys whose value is `undefined` (Firestore rejects them). */
export function pruneUndefined<T extends Record<string, unknown>>(obj: T): Partial<T> {
  const out: Partial<T> = {};
  (Object.keys(obj) as (keyof T)[]).forEach((k) => {
    if (obj[k] !== undefined) out[k] = obj[k];
  });
  return out;
}

/** The board fields (the Lineup) extracted from a doc, for loading the board. */
export function extractLineup(d: LineupDoc): Lineup {
  return {
    formation: d.formation,
    freeMode: d.freeMode,
    slots: d.slots.map((s) => ({ ...s })),
    bench: [...d.bench],
    roles: { ...d.roles },
    tactics: { ...d.tactics },
    playerPositions: { ...d.playerPositions },
    pinned: [...d.pinned],
  };
}

/** Plain board+meta payload for a write (timestamps added by the caller). */
export function lineupToData(lineup: Lineup, meta: LineupMeta): Record<string, unknown> {
  return {
    formation: lineup.formation,
    freeMode: lineup.freeMode,
    slots: lineup.slots.map((s) => ({ ...s })),
    bench: [...lineup.bench],
    roles: pruneUndefined(lineup.roles as Record<string, unknown>),
    tactics: { ...lineup.tactics },
    playerPositions: { ...lineup.playerPositions },
    pinned: [...lineup.pinned],
    ownerUid: meta.ownerUid,
    ownerNickname: meta.ownerNickname,
    seasonId: meta.seasonId,
    name: meta.name,
    isOfficial: meta.isOfficial,
    matchId: meta.matchId ?? null,
  };
}

/** Build a LineupDoc from a raw store record (Firestore data or local JSON). */
export function dataToLineupDoc(id: string, data: Record<string, unknown>): LineupDoc {
  const d = data as Partial<LineupDoc> & { createdAt?: unknown; updatedAt?: unknown };
  return {
    id,
    formation: d.formation as LineupDoc["formation"],
    freeMode: !!d.freeMode,
    slots: (d.slots as LineupDoc["slots"]) ?? [],
    bench: (d.bench as string[]) ?? [],
    roles: (d.roles as LineupDoc["roles"]) ?? {},
    tactics: (d.tactics as LineupDoc["tactics"]) ?? ({} as LineupDoc["tactics"]),
    playerPositions: (d.playerPositions as LineupDoc["playerPositions"]) ?? {},
    pinned: (d.pinned as string[]) ?? [],
    ownerUid: (d.ownerUid as string) ?? "",
    ownerNickname: (d.ownerNickname as string) ?? "",
    seasonId: (d.seasonId as string) ?? "all",
    name: (d.name as string) ?? "Sin nombre",
    isOfficial: !!d.isOfficial,
    matchId: (d.matchId as string | null) ?? null,
    createdAt: toMillis(d.createdAt),
    updatedAt: toMillis(d.updatedAt),
  };
}
