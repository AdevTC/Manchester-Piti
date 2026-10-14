// La pizarra «Noche de partido» — what the board knows about each player (a cromo) and the small
// lineup helpers every other module shares. Pure (no React).
import type { Lineup, RoleKey, Zone } from "../formations";
import { normPlaysAs } from "../positions";
import { isPosCode, lineOf, type ResolvedPositions } from "../../../lib/positions";
import { plural } from "./plural";
import { inPlace, logicGrade } from "./encaje";

export type Baja = "Lesionado" | "Sancionado" | "Inactivo";
/** The player's answer to the convocatoria (wired in phase 3; absent = unknown). */
export type Convocatoria = "voy" | "duda" | "no";

/** The minutes a cromo prints: its known minutes, or null («—») when no acta of his knows them. */
export const knownMinutes = (s: CromoStats): number | null => (s.timed === 0 ? null : s.minutes);

export interface CromoStats {
  played: number;
  goals: number;
  assists: number;
  /** His known minutes (derived/minutesOf: the ledgers'; a legacy acta adds nothing). */
  minutes: number;
  /** Matches whose acta knows his minutes: 0 prints «—» for the minutes (absent in hand-made squads: known). */
  timed?: number;
  starts: number;
  mvps: number;
}

/** One of the season's last matches for a player (the ficha's form bars). */
export interface FormGame {
  /** Its jornada (derived/jornada; null = none, no number shown). */
  j: number | null;
  played: boolean;
  /** Minutes on the pitch (derived/minutesOf: null when the acta does not know them, a legacy one). */
  min: number | null;
  /** Goals + assists. */
  ga: number;
}

/** A player as the board shows him. */
export interface Cromo {
  id: string;
  num: number;
  /** Shirt name, as printed on the cromo. */
  name: string;
  /** Natural position (set by an admin); unknown = fits anywhere. */
  pos?: Zone;
  /** His exact positions (preferida, también, línea: resolvePositions); absent = only `pos` is known. */
  ps?: ResolvedPositions;
  /** Form rating (45–95, see ratings.ts), from the season's matches. */
  rt: number;
  /** No match played yet: the rating is only a floor for sorting, shown as «—» (see rtTxt). */
  unrated?: boolean;
  /** Why his form is what it is, in a few words («3 goles en sus 2 últimos»). */
  why?: string;
  stats: CromoStats;
  /** INTERNAL (scores only, never printed): his season minutes with a legacy acta he played counted as
   *  the whole match (derived/minutesOf presenceMinutes). Absent: stats.minutes. */
  presenceMin?: number;
  /** Minutes and goals+assists over the recent window (the «sobre»). */
  recentMin: number;
  recentGA: number;
  /** The season's last matches, oldest first (ficha.ts formGames); absent = not worked out. */
  form?: FormGame[];
  baja?: Baja;
  /** Suspended: team matches he still misses and the sanction's reason (chemistry.suspensions). */
  sancion?: { left: number; reason?: string };
  cv?: Convocatoria;
}

/** The baja's chip: «Sancionado · 2» with the matches he still misses, else the baja's word. */
export function bajaChip(c: Pick<Cromo, "baja" | "sancion">): string {
  if (!c.baja) return "";
  return c.baja === "Sancionado" && c.sancion ? c.baja + " · " + c.sancion.left : c.baja;
}

/** The baja in words, for the screen reader and the ficha: «sancionado 2 partidos más (Federación)». */
export function bajaWords(c: Pick<Cromo, "baja" | "sancion">): string {
  if (!c.baja) return "";
  const s = c.sancion;
  if (c.baja !== "Sancionado" || !s) return c.baja.toLowerCase();
  return "sancionado " + plural(s.left, "partido") + " más" + (s.reason ? " (" + s.reason + ")" : "");
}

export interface PairStats {
  /** Matches both were on the pitch at the same time. */
  tog: number;
  /** INTERNAL (the link score, togPoints): minutes both were on the pitch at the same time (the ledger's
   *  stints; a legacy acta both played counts as the whole match). Never printed. */
  min: number;
  /** The printable minutes together: only from matches whose actas know both players' minutes. */
  known?: number;
  /** Some match together does not know their minutes (a legacy acta): print matches, not minutes. */
  unk?: boolean;
  /** Goals one assisted to the other (both directions). */
  ast: number;
}

export interface Squad {
  list: Cromo[];
  byId: Map<string, Cromo>;
  pairs: Map<string, PairStats>;
  /** The recent window, e.g. "J5–J7" (empty when nothing has been played). */
  recentLabel: string;
  /** Matches the team has finished this season (the química is only a hint with very few). */
  games: number;
  /** Minutes the team has played this season (their durations; absent = 50 a match). */
  teamMin?: number;
}

/** The rating as the cromo prints it: «—» before his first match. */
export const rtTxt = (c: Pick<Cromo, "rt" | "unrated">): string => (c.unrated ? "—" : String(c.rt));
/** «forma 82: 3 goles en sus 2 últimos» / «sin forma aún: sin partidos esta temporada». */
export function formAria(c: Pick<Cromo, "rt" | "unrated" | "why">): string {
  return (c.unrated ? "sin forma aún" : "forma " + c.rt) + (c.why ? ": " + c.why.charAt(0).toLowerCase() + c.why.slice(1) : "");
}
/** The team's minutes this season
 (the scale of the química's minutes together). */
export const teamMinutes = (sq: Squad): number => sq.teamMin ?? sq.games * 50;

export const pairKey = (a: string, b: string): string => (a < b ? a + "|" + b : b + "|" + a);
export const pairOf = (sq: Squad, a: string, b: string): PairStats => sq.pairs.get(pairKey(a, b)) ?? { tog: 0, ast: 0, min: 0 };

/** The line a player plays in this lineup: the per-board override's (a «Jugar de» code reads as its
 *  line), else his natural one. */
export function natOf(L: Lineup, sq: Squad, id: string): Zone | undefined {
  const over = normPlaysAs(L.playerPositions[id]);
  if (over) return isPosCode(over) ? lineOf(over) : over;
  return sq.byId.get(id)?.pos;
}

/** Whether a player plays a zone as his natural one (an unknown position is NOT natural: the química
 *  only rewards what it knows). */
export function natural(L: Lineup, sq: Squad, id: string, zone: Zone): boolean {
  return natOf(L, sq, id) === zone;
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

/** A board is «siete listo» with seven on the pitch and a goalkeeper in goal: one in his place there
 *  (the encaje's logicGrade), or one nobody knows the position of. */
export function isFull(L: Lineup, sq: Squad): boolean {
  const g = L.slots[0]?.playerId;
  if (placedCount(L) !== 7 || !g) return false;
  const x = logicGrade(L, sq, g, 0);
  return x == null || inPlace(x);
}
