// La Pizarra — fútbol 7 formation presets and the lineup shape.
//
// Fútbol 7 = 1 goalkeeper + 6 outfield players (7 total). Notation here counts
// the outfield lines (they sum to 6). Pitch coordinates are percentages of the
// pitch box: x 0→100 left→right, y 0→100 top→bottom, team **attacking upward**
// (forwards near the top, keeper near the bottom). Every preset is an ordered
// list of 7 slots — index 0 is always the goalkeeper, then back-to-front. The
// stable order is what lets a player at index `i` travel to the new index-`i`
// position when the formation changes (the morph).

import type { Tactics } from "./tactics";

/** Vertical zone of a slot/player — used for the out-of-position cue. */
export type Zone = "POR" | "DEF" | "MED" | "DEL";

export type FormationName = "2-3-1" | "3-2-1" | "3-1-2" | "2-1-3" | "1-3-2" | "2-1-2-1";

export const FORMATION_NAMES: FormationName[] = ["2-3-1", "3-2-1", "3-1-2", "2-1-3", "1-3-2", "2-1-2-1"];

/** A position in a preset: a Spanish role label, its zone, and pitch spot. */
export interface SlotDef {
  position: string;
  zone: Zone;
  x: number;
  y: number;
}

/** A live slot: a preset position now bound to a player (or empty). */
export interface SlotState extends SlotDef {
  slotId: string;
  playerId: string | null;
}

/** Gold-galón role assignments for one lineup (single holder per role). */
export interface Roles {
  captainId?: string;
  penaltiesId?: string;
  freekicksId?: string;
  cornersId?: string;
}

export type RoleKey = keyof Roles;

/** The full lineup shape (mirrors the proposed `lineups` Firestore doc). */
export interface Lineup {
  formation: FormationName;
  freeMode: boolean;
  slots: SlotState[];
  bench: string[];
  roles: Roles;
  tactics: Tactics;
  /** Per-lineup position override (beats the player's natural position). */
  playerPositions: Record<string, Zone>;
  /** Players pinned to their slot (immune to formation change / Auto-XI). */
  pinned: string[];
}

// Position labels (Spanish): POR portero · LD/LI lateral · DFC central ·
// MCD pivote · MC/MI/MD medio · MCO mediapunta · ED/EI extremo · DC delantero.
export const FORMATIONS: Record<FormationName, SlotDef[]> = {
  "2-3-1": [
    { position: "POR", zone: "POR", x: 50, y: 90 },
    { position: "DFC", zone: "DEF", x: 33, y: 75 },
    { position: "DFC", zone: "DEF", x: 67, y: 75 },
    { position: "MI", zone: "MED", x: 22, y: 52 },
    { position: "MC", zone: "MED", x: 50, y: 54 },
    { position: "MD", zone: "MED", x: 78, y: 52 },
    { position: "DC", zone: "DEL", x: 50, y: 22 },
  ],
  "3-2-1": [
    { position: "POR", zone: "POR", x: 50, y: 90 },
    { position: "LD", zone: "DEF", x: 24, y: 74 },
    { position: "DFC", zone: "DEF", x: 50, y: 77 },
    { position: "LI", zone: "DEF", x: 76, y: 74 },
    { position: "MC", zone: "MED", x: 36, y: 52 },
    { position: "MC", zone: "MED", x: 64, y: 52 },
    { position: "DC", zone: "DEL", x: 50, y: 22 },
  ],
  "3-1-2": [
    { position: "POR", zone: "POR", x: 50, y: 90 },
    { position: "LD", zone: "DEF", x: 24, y: 74 },
    { position: "DFC", zone: "DEF", x: 50, y: 77 },
    { position: "LI", zone: "DEF", x: 76, y: 74 },
    { position: "MC", zone: "MED", x: 50, y: 53 },
    { position: "DC", zone: "DEL", x: 35, y: 23 },
    { position: "DC", zone: "DEL", x: 65, y: 23 },
  ],
  "2-1-3": [
    { position: "POR", zone: "POR", x: 50, y: 90 },
    { position: "DFC", zone: "DEF", x: 33, y: 75 },
    { position: "DFC", zone: "DEF", x: 67, y: 75 },
    { position: "MC", zone: "MED", x: 50, y: 55 },
    { position: "ED", zone: "DEL", x: 22, y: 24 },
    { position: "DC", zone: "DEL", x: 50, y: 20 },
    { position: "EI", zone: "DEL", x: 78, y: 24 },
  ],
  "1-3-2": [
    { position: "POR", zone: "POR", x: 50, y: 90 },
    { position: "DFC", zone: "DEF", x: 50, y: 76 },
    { position: "MI", zone: "MED", x: 24, y: 52 },
    { position: "MC", zone: "MED", x: 50, y: 54 },
    { position: "MD", zone: "MED", x: 76, y: 52 },
    { position: "DC", zone: "DEL", x: 35, y: 24 },
    { position: "DC", zone: "DEL", x: 65, y: 24 },
  ],
  "2-1-2-1": [
    { position: "POR", zone: "POR", x: 50, y: 90 },
    { position: "DFC", zone: "DEF", x: 33, y: 76 },
    { position: "DFC", zone: "DEF", x: 67, y: 76 },
    { position: "MCD", zone: "MED", x: 50, y: 62 },
    { position: "MC", zone: "MED", x: 28, y: 46 },
    { position: "MC", zone: "MED", x: 72, y: 46 },
    { position: "DC", zone: "DEL", x: 50, y: 22 },
  ],
};

/** Stable slot id by index, so morphs map old index → new index. */
export const slotIdFor = (index: number): string => `pz-slot-${index}`;

/** Build empty slots for a formation (no players assigned yet). */
export function emptySlots(formation: FormationName): SlotState[] {
  return FORMATIONS[formation].map((def, i) => ({ ...def, slotId: slotIdFor(i), playerId: null }));
}

/** Re-shape existing slots onto a new formation, keeping player-per-index. */
export function applyFormation(slots: SlotState[], formation: FormationName): SlotState[] {
  return FORMATIONS[formation].map((def, i) => ({ ...def, slotId: slotIdFor(i), playerId: slots[i]?.playerId ?? null }));
}

export interface RoleMeta {
  key: RoleKey;
  label: string;
  /** Non-chromatic glyph shown on the gold stamp (colour is never the only cue). */
  glyph: string;
  aria: string;
}

// Spanish-correct single-glyph galones. Captain = © (brazalete), P penaltis,
// F faltas (tiros libres), E esquina (córner). (MVP removed per feedback.)
export const ROLE_META: RoleMeta[] = [
  { key: "captainId", label: "Capitán", glyph: "©", aria: "Capitán" },
  { key: "penaltiesId", label: "Penaltis", glyph: "P", aria: "Lanzador de penaltis" },
  { key: "freekicksId", label: "Faltas", glyph: "F", aria: "Lanzador de faltas" },
  { key: "cornersId", label: "Córners", glyph: "E", aria: "Lanzador de córners" },
];

/** Spanish label for a zone (used in position selectors / chips). */
export const ZONE_LABEL: Record<Zone, string> = {
  POR: "Portero",
  DEF: "Defensa",
  MED: "Medio",
  DEL: "Delantero",
};

export const ZONES: Zone[] = ["POR", "DEF", "MED", "DEL"];
