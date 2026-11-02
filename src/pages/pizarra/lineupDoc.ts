// The `lineups` Firestore document and the pure (de)serialization between it
// and the in-memory Lineup. No React / no Firestore calls here so this stays
// unit-testable (sub-project 4). Firestore rejects `undefined`, so writes are
// pruned and `matchId` is normalized to `null`.
import type { z } from "zod";
import { emptySlots, type FormationName, type Lineup, type LineupVariant, type SlotState, type Sub, type Takers } from "./formations";
import { migrateTakers, takersOf } from "./v2/takers";
import { defaultTactics, TACTICS, type Tactics } from "./tactics";
import { parseDrawings, strokeToData } from "./drawings";
import { parsePlays, playToData } from "./plays";
import { copyTactica, parseShapeOff, parseStyle, tacticaToData } from "./v2/tacticaData";
import { condPlanToData, parseCondPlanR14 } from "./data/condPlan";
import { copyRivalPlan, parseRivalPlan, rivalPlanToData } from "./data/rival";
import { copyPlan, parsePlan, planToData } from "./data/plan";
import { parseSeasonPlayRefs } from "./data/seasonPlayRefs";
import { parseTags } from "./v2/tags";
import { reportDroppedDoc } from "../../lib/docTelemetry";
import {
  LINEUP_FORMATIONS,
  LINEUP_LIMITS,
  lineupPositionsSchema,
  lineupRolesSchema,
  lineupSlotSchema,
  lineupSlotsSchema,
  lineupSubSchema,
  lineupTacticsSchema,
  lineupTakersSchema,
  MATCHDAY_LIMITS,
  lineupVariantSchema,
  VARIANT_LIMITS,
} from "../../lib/schemas";

/** Metadata stored alongside the board fields in the `lineups` collection. */
export interface LineupMeta {
  ownerUid: string;
  ownerNickname: string;
  seasonId: string; // "all" or a season id
  name: string;
  isOfficial: boolean;
  matchId: string | null; // null = season-scoped official (or not official)
  /** r14 (PZ-D22T): a scorer's copy made from la mesa («De la mesa» in Tableros). Written only on create. */
  fromMesa?: boolean;
}

/** r14 · the server's own fields of a board (functions/src/pizarraR14.ts): read-only for the client. */
export interface LineupServerMeta {
  /** The fan view's token (PZ-D21F), null = no public link. */
  fanToken?: string | null;
  /** The official seven's fingerprint and version (PZ-D01): a reaction counts only with `rev === sevenRev`. */
  sevenKey?: string | null;
  sevenRev?: number;
}

/** A full board as held in memory after loading from the store. */
export interface LineupDoc extends Lineup, LineupMeta, LineupServerMeta {
  id: string;
  createdAt: number | null; // ms epoch; null while a local write is pending
  updatedAt: number | null;
}

/** The fields the board itself edits (an autosave writes only these: never the metadata). */
export const BOARD_FIELDS = ["formation", "freeMode", "slots", "roles", "tactics", "playerPositions", "drawings", "plays", "subs", "takers", "variants", "shapeOff", "condPlan", "style", "rival", "tags", "plan", "seasonPlays"] as const;

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
    ...(d.subs ? { subs: d.subs.map((x) => ({ ...x })) } : {}),
    ...(d.takers ? { takers: copyTakers(d.takers) } : {}),
    ...(d.rival !== undefined ? { rival: d.rival ? copyRivalPlan(d.rival) : null } : {}),
    drawings: structuredClone(d.drawings),
    plays: structuredClone(d.plays),
    variants: structuredClone(d.variants ?? []),
    ...copyTactica(d),
    ...(d.tags ? { tags: [...d.tags] } : {}),
    ...(d.plan !== undefined ? { plan: d.plan ? copyPlan(d.plan) : null } : {}),
    ...(d.seasonPlays ? { seasonPlays: [...d.seasonPlays] } : {}),
  };
}

/**
 * The board fields of a write. The bench (the whole squad minus the seven, rebuilt from the squad on
 * every load) and `pinned` (no longer used) are not stored.
 */
export function boardToData(lineup: Lineup): Record<string, unknown> {
  return {
    formation: lineup.formation,
    freeMode: lineup.freeMode,
    slots: lineup.slots.map((s) => ({ ...s })),
    roles: pruneUndefined(lineup.roles as Record<string, unknown>),
    tactics: { ...lineup.tactics },
    playerPositions: { ...lineup.playerPositions },
    subs: (lineup.subs ?? []).map((x) => ({ id: x.id, min: x.min, out: x.out, in: x.in })),
    takers: copyTakers(takersOf(lineup)),
    // (only once a rival was ever set: null takes it off; older rules never see the field otherwise)
    ...(lineup.rival !== undefined ? { rival: rivalPlanToData(lineup.rival) } : {}),
    drawings: (lineup.drawings ?? []).map(strokeToData),
    plays: (lineup.plays ?? []).map(playToData),
    variants: (lineup.variants ?? []).map(variantToData),
    ...tacticaToData(lineup),
    // (r14: the rules keep their «ver», PZ-D07)
    condPlan: condPlanToData(lineup.condPlan),
    // (only once tags were ever set: older rules never see the field otherwise)
    ...(lineup.tags !== undefined ? { tags: [...lineup.tags] } : {}),
    // (r14: only once set, like the rival and the tags)
    ...(lineup.plan !== undefined ? { plan: planToData(lineup.plan) } : {}),
    ...(lineup.seasonPlays !== undefined ? { seasonPlays: [...lineup.seasonPlays] } : {}),
  };
}

/** A variant as stored (plain objects, nothing undefined). */
export function variantToData(v: LineupVariant): Record<string, unknown> {
  return { id: v.id, name: v.name, formation: v.formation, freeMode: v.freeMode, slots: v.slots.map((s) => ({ ...s })), tactics: { ...v.tactics } };
}

/** Plain board+meta payload for a new board (timestamps added by the caller). */
export function lineupToData(lineup: Lineup, meta: LineupMeta): Record<string, unknown> {
  return {
    ...boardToData(lineup),
    ownerUid: meta.ownerUid,
    ownerNickname: meta.ownerNickname,
    seasonId: meta.seasonId,
    name: meta.name,
    isOfficial: meta.isOfficial,
    matchId: meta.matchId ?? null,
    ...(meta.fromMesa ? { fromMesa: true } : {}),
  };
}

/**
 * One field through its schema: the parsed value, else the fallback. A present but invalid value is
 * reported (the same telemetry as a dropped doc) — the board opens repaired instead of breaking.
 */
function field<S extends z.ZodType>(schema: S, value: unknown, fallback: z.output<S>, docId: string, name: string): z.output<S> {
  if (value === undefined || value === null) return fallback;
  const r = schema.safeParse(value);
  if (r.success) return r.data;
  reportDroppedDoc(`lineups.${name}`, docId, r.error.issues);
  return fallback;
}

const isFormation = (v: unknown): v is FormationName => (LINEUP_FORMATIONS as readonly unknown[]).includes(v);

/** The seven: as stored when valid, else the formation's spots with whoever could be read from them. */
function readSlots(raw: unknown, formation: FormationName, docId: string): SlotState[] {
  const r = lineupSlotsSchema.safeParse(raw);
  if (r.success) return r.data;
  if (raw !== undefined) reportDroppedDoc("lineups.slots", docId, r.error.issues);
  const slots = emptySlots(formation);
  if (!Array.isArray(raw)) return slots;
  const seen = new Set<string>();
  slots.forEach((s, i) => {
    const one = lineupSlotSchema.safeParse(raw[i]);
    const id = one.success ? one.data.playerId : null;
    if (id && !seen.has(id)) {
      seen.add(id);
      s.playerId = id;
    }
  });
  return slots;
}

/** The planned cambios: the valid ones (at most SUBS_MAX), an invalid one dropped and reported. */
function readSubs(raw: unknown, docId: string): Sub[] {
  if (raw === undefined || raw === null) return [];
  if (!Array.isArray(raw)) {
    reportDroppedDoc("lineups.subs", docId, []);
    return [];
  }
  const out: Sub[] = [];
  const seen = new Set<string>();
  raw.forEach((x) => {
    const r = lineupSubSchema.safeParse(x);
    if (r.success && !seen.has(r.data.id) && out.length < MATCHDAY_LIMITS.subs) {
      seen.add(r.data.id);
      out.push(r.data);
    } else reportDroppedDoc("lineups.subs", docId, r.success ? [] : r.error.issues);
  });
  return out;
}

const copyTakers = (t: Takers): Takers => ({ penalties: [...t.penalties], freekicks: [...t.freekicks], corners: [...t.corners] });

const TACTIC_KEYS = new Set<string>(TACTICS.map((t) => t.key));

/** The board's variants: each one through its schema (an invalid one is dropped and reported), once per id. */
export function parseVariants(raw: unknown, docId: string): LineupVariant[] {
  if (raw === undefined || raw === null) return [];
  if (!Array.isArray(raw)) {
    reportDroppedDoc("lineups.variants", docId, []);
    return [];
  }
  const out: LineupVariant[] = [];
  raw.forEach((item) => {
    const r = lineupVariantSchema.safeParse(item);
    if (!r.success) {
      reportDroppedDoc("lineups.variants", docId, r.error.issues);
      return;
    }
    if (out.length >= VARIANT_LIMITS.variants || out.some((v) => v.id === r.data.id)) return;
    const tactics: Tactics = defaultTactics();
    Object.entries(r.data.tactics).forEach(([k, val]) => {
      if (TACTIC_KEYS.has(k)) tactics[k as keyof Tactics] = val;
    });
    out.push({ id: r.data.id, name: r.data.name, formation: r.data.formation, freeMode: r.data.freeMode, slots: r.data.slots, tactics });
  });
  return out;
}

/** Build a LineupDoc from a raw store record (Firestore data or local JSON), repairing what is malformed. */
export function dataToLineupDoc(id: string, data: Record<string, unknown>): LineupDoc {
  let formation: FormationName = "2-3-1";
  if (isFormation(data.formation)) formation = data.formation;
  else if (data.formation !== undefined) reportDroppedDoc("lineups.formation", id, []);
  const tactics: Tactics = defaultTactics();
  Object.entries(field(lineupTacticsSchema, data.tactics, {}, id, "tactics")).forEach(([k, v]) => {
    if (TACTIC_KEYS.has(k)) tactics[k as keyof Tactics] = v;
  });
  const str = (v: unknown, max: number, fallback: string) => (typeof v === "string" && v.length <= max ? v : fallback);
  const ids = (v: unknown) => (Array.isArray(v) ? v.filter((x): x is string => typeof x === "string") : []);
  const roles = pruneUndefined(field(lineupRolesSchema, data.roles, {}, id, "roles"));
  return {
    id,
    formation,
    freeMode: data.freeMode === true,
    slots: readSlots(data.slots, formation, id),
    // not stored any more (rebuilt from the squad); older docs still carry it
    bench: ids(data.bench),
    roles,
    tactics,
    playerPositions: field(lineupPositionsSchema, data.playerPositions, {}, id, "playerPositions"),
    pinned: ids(data.pinned),
    // boards saved before the cambios plan none; the old single galones read as one-item lists
    subs: readSubs(data.subs, id),
    takers: migrateTakers(field(lineupTakersSchema.nullable(), data.takers, null, id, "takers"), roles),
    ...(data.rival !== undefined ? { rival: parseRivalPlan(data.rival, id) ?? null } : {}),
    // boards saved before drawings/jugadas existed load with none; invalid items are dropped
    drawings: parseDrawings(data.drawings, id),
    plays: parsePlays(data.plays, id),
    variants: parseVariants(data.variants, id),
    shapeOff: parseShapeOff(data.shapeOff, id),
    condPlan: parseCondPlanR14(data.condPlan, id),
    style: parseStyle(data.style, id),
    ...(data.tags !== undefined ? { tags: parseTags(data.tags, id) } : {}),
    ...(data.plan !== undefined ? { plan: parsePlan(data.plan, id) ?? null } : {}),
    ...(data.seasonPlays !== undefined ? { seasonPlays: parseSeasonPlayRefs(data.seasonPlays, id) } : {}),
    ownerUid: str(data.ownerUid, LINEUP_LIMITS.id, ""),
    ownerNickname: str(data.ownerNickname, LINEUP_LIMITS.nickname, ""),
    seasonId: str(data.seasonId, LINEUP_LIMITS.id, "all"),
    name: str(data.name, LINEUP_LIMITS.name, "Sin nombre") || "Sin nombre",
    isOfficial: data.isOfficial === true,
    matchId: typeof data.matchId === "string" && data.matchId ? data.matchId : null,
    fromMesa: data.fromMesa === true,
    fanToken: typeof data.fanToken === "string" && data.fanToken ? data.fanToken : null,
    sevenKey: typeof data.sevenKey === "string" ? data.sevenKey : null,
    sevenRev: typeof data.sevenRev === "number" && Number.isInteger(data.sevenRev) && data.sevenRev >= 0 ? data.sevenRev : 0,
    createdAt: toMillis(data.createdAt),
    updatedAt: toMillis(data.updatedAt),
  };
}
