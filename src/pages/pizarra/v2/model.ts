// La pizarra «Noche de partido» — what the board knows about each player (a cromo) and the small
// lineup helpers every other module shares. Pure (no React).
import type { Lineup, RoleKey, Zone } from "../formations";
import { normZone } from "../positions";

export type Baja = "Lesionado" | "Sancionado" | "Inactivo";
/** The player's answer to the convocatoria (wired in phase 3; absent = unknown). */
export type Convocatoria = "voy" | "duda" | "no";

export interface CromoStats {
  played: number;
  goals: number;
  assists: number;
  minutes: number;
  starts: number;
  mvps: number;
}

/** A player as the board shows him. */
export interface Cromo {
  id: string;
  num: number;
  /** Shirt name, as printed on the cromo. */
  name: string;
  /** Natural position (set by an admin); unknown = fits anywhere. */
  pos?: Zone;
  /** Form rating (48–96), from the season's stats. */
  rt: number;
  stats: CromoStats;
  /** Minutes and goals+assists over the recent window (the «sobre»). */
  recentMin: number;
  recentGA: number;
  baja?: Baja;
  cv?: Convocatoria;
}

export interface PairStats {
  /** Matches both played. */
  tog: number;
  /** Goals one assisted to the other (both directions). */
  ast: number;
}

export interface Squad {
  list: Cromo[];
  byId: Map<string, Cromo>;
  pairs: Map<string, PairStats>;
  /** The recent window, e.g. "J5–J7" (empty when nothing has been played). */
  recentLabel: string;
}

export const pairKey = (a: string, b: string): string => (a < b ? a + "|" + b : b + "|" + a);
export const pairOf = (sq: Squad, a: string, b: string): PairStats => sq.pairs.get(pairKey(a, b)) ?? { tog: 0, ast: 0 };

/** The position a player plays in this lineup: the per-board override, else his natural one. */
export function natOf(L: Lineup, sq: Squad, id: string): Zone | undefined {
  return normZone(L.playerPositions[id]) ?? sq.byId.get(id)?.pos;
}

/** Whether a player fits a zone (an unknown position never counts against him). */
export function fits(L: Lineup, sq: Squad, id: string, zone: Zone): boolean {
  const n = natOf(L, sq, id);
  return n == null || n === zone;
}

export const isAvailable = (sq: Squad, id: string): boolean => {
  const c = sq.byId.get(id);
  return !!c && !c.baja;
};

export const placedCount = (L: Lineup): number => L.slots.filter((s) => s.playerId).length;

// The galones, as the design prints them on the cromo stickers.
export interface Galon {
  key: RoleKey;
  label: string;
  letter: "C" | "P" | "F" | "E";
}
export const GALONES: Galon[] = [
  { key: "captainId", label: "Capitán", letter: "C" },
  { key: "penaltiesId", label: "Penaltis", letter: "P" },
  { key: "freekicksId", label: "Faltas", letter: "F" },
  { key: "cornersId", label: "Córners", letter: "E" },
];
export const galonesOf = (L: Lineup, id: string): Galon[] => GALONES.filter((g) => L.roles[g.key] === id);

/** A board is «siete listo» with seven on the pitch and a goalkeeper in goal. */
export function isFull(L: Lineup, sq: Squad): boolean {
  const g = L.slots[0]?.playerId;
  return placedCount(L) === 7 && !!g && fits(L, sq, g, "POR");
}
