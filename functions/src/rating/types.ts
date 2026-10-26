// What the «valoración Piti» reads: a finished match (the web's ClubMatch and the stored match doc are both one) and
// the league table. Pure types, shared by the functions (the notas stored with the acta) and the web.
import type { NarratedMatch } from "../narrated/types.js";

/** A finished match as the rating reads it. */
export interface RatingMatch extends NarratedMatch {
  rival?: string;
  competition?: string;
  /** The notas its acta froze (./frozen: read with storedNotasOf). */
  notas?: unknown;
}

/** One team of the league table (`standings/{seasonId}`), as the rival's strength reads it. */
export interface StandingsRowLike {
  team: string;
  isUs: boolean;
  pj: number;
  pts: number;
}
/** The league table of a season (`standings/{seasonId}`; the doc id is the season's). */
export interface StandingsLike {
  id: string;
  jornada: number | null;
  rows: readonly StandingsRowLike[];
}

/** A match's length in minutes (50 when the acta has none). */
export const DEFAULT_DURATION = 50;
export const durationOf = (m: { duration?: number }): number => (typeof m.duration === "number" && m.duration > 0 ? m.duration : DEFAULT_DURATION);
