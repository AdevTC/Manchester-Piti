// Shared, pure per-player stat computation from match events. Extracted from
// Expedientes so La Pizarra's chemistry can reuse the exact same logic (one
// source of truth). No React, no Firestore — unit-testable.

import { isVisibleMatch, type Participation } from '../../functions/src/matchEngine';
import type { TechnicalStats } from '../../functions/src/matchAnalysis';
import { isPendingDup } from './eventMeta';
export interface StatEvent {
  type: string;
  playerId?: string;
  assistPlayerId?: string;
  /** La mesa: a possible duplicate still unresolved counts nothing (eventMeta isPendingDup). */
  dupOf?: string;
  dupOk?: boolean;
}
export interface MatchLike {
  events?: StatEvent[];
  status?: string;
  archived?: boolean;
  individuallyArchived?: boolean;
  ledger?: Record<string, Participation>;
}
export interface PlayerStats {
  goals: number;
  assists: number;
  yellowCards: number;
  redCards: number;
  doubleYellows: number;
  woodwork: number;
  penaltySaved: number;
  goalPenalty: number;
  goalFreekick: number;
  penaltyMissed: number;
  ownGoals: number;
  matchesPlayed: number;
  /** La mesa's plays: chances, saves (not the penalties stopped: those are penaltySaved), fouls made and
   *  suffered. Older actas without them count 0. */
  chances: number;
  saves: number;
  fouls: number;
  foulsReceived: number;
}

/** A zeroed stat line — the honest fallback for a player with no record. */
export const EMPTY_STATS: PlayerStats = {
  goals: 0, assists: 0, yellowCards: 0, redCards: 0, doubleYellows: 0, woodwork: 0,
  penaltySaved: 0, goalPenalty: 0, goalFreekick: 0, penaltyMissed: 0, ownGoals: 0, matchesPlayed: 0,
  chances: 0, saves: 0, fouls: 0, foulsReceived: 0,
};

export function computeStats(playerId: string, matches: MatchLike[]): PlayerStats {
  const s: PlayerStats = { ...EMPTY_STATS };
  matches.forEach((match) => {
    if (!isVisibleMatch(match)) return;
    if (match.status && match.status !== 'finished') return;
    if (match.ledger?.[playerId]) {
      const row = match.ledger[playerId];
      for (const key of ['goals', 'assists', 'yellowCards', 'redCards', 'doubleYellows', 'woodwork', 'penaltySaved', 'goalPenalty', 'goalFreekick', 'penaltyMissed', 'ownGoals'] as const) s[key] += row[key] ?? 0;
      // the ledger carries the technical counts of the acta (matchEngine: Object.assign of analyseActions'
      // row), where «saves» also counts the penalties stopped
      const tech = row as Participation & Partial<TechnicalStats>;
      s.chances += row.chances ?? 0;
      s.saves += Math.max(0, (tech.saves ?? 0) - (row.penaltySaved ?? 0));
      s.fouls += tech.fouls ?? 0;
      s.foulsReceived += tech.foulsReceived ?? 0;
      if (row.played) s.matchesPlayed++;
      return;
    }
    let played = false;
    (match.events || []).filter((ev) => !isPendingDup(ev)).forEach((ev) => {
      const { type, playerId: epId, assistPlayerId } = ev;
      if (epId === playerId) {
        played = true;
        if (type === "goal") s.goals += 1;
        else if (type === "goal_penalty") { s.goals += 1; s.goalPenalty += 1; }
        else if (type === "goal_freekick") { s.goals += 1; s.goalFreekick += 1; }
        else if (type === "own_goal") s.ownGoals += 1;
        else if (type === "assist") s.assists += 1;
        else if (type === "yellow_card") s.yellowCards += 1;
        else if (type === "red_card") s.redCards += 1;
        else if (type === "double_yellow") { s.doubleYellows += 1; s.yellowCards += 2; s.redCards += 1; }
        else if (type === "penalty_saved") s.penaltySaved += 1;
        else if (type === "penalty_missed") s.penaltyMissed += 1;
        else if (type === "woodwork") s.woodwork += 1;
        else if (type === "chance") s.chances += 1;
        else if (type === "save") s.saves += 1;
        else if (type === "foul") s.fouls += 1;
        else if (type === "foul_received") s.foulsReceived += 1;
      }
      if (["goal", "goal_penalty", "goal_freekick"].includes(type) && assistPlayerId === playerId) { played = true; s.assists += 1; }
    });
    if (played) s.matchesPlayed += 1;
  });
  return s;
}
