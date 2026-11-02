// r14 «La pizarra»: the seven of a board version, read and written over the app's Lineup (pure). The titular is
// the lineup itself; «2ª parte» and «Plan B» are its variants v2 / vb (formations.ts LineupVariant).
import { FORMATIONS, slotIdFor, type FormationName, type Lineup, type SlotState, type VariantId } from "../../formations";
import { isPosCode, type PosCode } from "../../../../lib/positions";
import { dropBenchedRoles } from "../../v2/ops";
import type { PzSlot, PzVer, VersionId } from "./types";

export const VERS: { id: VersionId; vid: VariantId | null; t: string }[] = [
  { id: "titular", vid: null, t: "Titular" },
  { id: "segunda", vid: "v2", t: "2ª parte" },
  { id: "planb", vid: "vb", t: "Plan B" },
];
export const verDef = (v: VersionId) => VERS.find((x) => x.id === v) ?? VERS[0];

const ZONE_CODE: Record<string, PosCode> = { POR: "POR", DEF: "DFC", MED: "MC", DEL: "DC" };
/** A stored slot's F7 code (an old board may carry a line instead of a code). */
export const codeOf = (s: SlotState): PosCode => (isPosCode(s.position) ? s.position : (ZONE_CODE[s.zone] ?? "MC"));
export const toPz = (s: SlotState): PzSlot => ({ code: codeOf(s), x: s.x, y: s.y, playerId: s.playerId ?? null });

/** The version's seven as the prototype reads it (a missing variant falls back to the titular, exists: false). */
export function verOf(L: Lineup, v: VersionId): PzVer {
  const d = verDef(v);
  const base = { formation: L.formation, freeMode: L.freeMode, slots: L.slots.map(toPz), tactics: L.tactics };
  if (!d.vid) return { id: "titular", t: "Titular", exists: true, ...base };
  const x = (L.variants ?? []).find((y) => y.id === d.vid);
  if (!x) return { id: d.id, t: d.t, exists: false, ...base };
  return { id: d.id, t: x.name || d.t, exists: true, formation: x.formation, freeMode: x.freeMode, slots: x.slots.map(toPz), tactics: x.tactics };
}

/** The stored slots of a version (to edit). */
export function slotsOf(L: Lineup, v: VersionId): SlotState[] {
  const d = verDef(v);
  if (!d.vid) return L.slots;
  return (L.variants ?? []).find((y) => y.id === d.vid)?.slots ?? L.slots;
}

/** The lineup with a version's seven changed (a missing variant is created as a copy of the titular). */
export function withVer(L: Lineup, v: VersionId, patch: { formation?: FormationName; freeMode?: boolean; slots?: SlotState[] }): Lineup {
  const d = verDef(v);
  if (!d.vid) return dropBenchedRoles({ ...L, ...patch });
  const vars = L.variants ?? [];
  const cur = vars.find((y) => y.id === d.vid) ?? { id: d.vid, name: d.t, formation: L.formation, freeMode: L.freeMode, slots: L.slots.map((s) => ({ ...s })), tactics: { ...L.tactics } };
  const next = { ...cur, ...patch };
  return { ...L, variants: vars.some((y) => y.id === d.vid) ? vars.map((y) => (y.id === d.vid ? next : y)) : [...vars, next] };
}

/** The system's spots with the players kept by slot order (the glide). */
export function slotsForSystem(slots: SlotState[], f: FormationName): SlotState[] {
  return FORMATIONS[f].map((def, i) => ({ ...def, slotId: slots[i]?.slotId ?? slotIdFor(i), playerId: slots[i]?.playerId ?? null }));
}

/** A slot list with one player id set (the rest copied). */
export function setPid(slots: SlotState[], i: number, pid: string | null): SlotState[] {
  return slots.map((s, k) => (k === i ? { ...s, playerId: pid } : { ...s }));
}

/** The seven fields an undo restores (B-PZ-01: never the rival, tags or drawings). */
export type SevenSnap = Pick<Lineup, "formation" | "freeMode" | "slots" | "tactics" | "roles" | "takers" | "playerPositions" | "variants">;
export const snapSeven = (L: Lineup): SevenSnap => structuredClone({ formation: L.formation, freeMode: L.freeMode, slots: L.slots, tactics: L.tactics, roles: L.roles, takers: L.takers, playerPositions: L.playerPositions, variants: L.variants });
export const restoreSeven = (L: Lineup, s: SevenSnap): Lineup => ({ ...L, ...structuredClone(s) });
