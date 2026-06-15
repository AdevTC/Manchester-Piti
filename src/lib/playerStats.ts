// Shared, pure per-player stat computation from match events. Extracted from
// Expedientes so La Pizarra's chemistry can reuse the exact same logic (one
// source of truth). No React, no Firestore — unit-testable.

export interface StatEvent {
  type: string;
  playerId?: string;
  assistPlayerId?: string;
}
export interface MatchLike {
  events?: StatEvent[];
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
}

/** A zeroed stat line — the honest fallback for a player with no record. */
export const EMPTY_STATS: PlayerStats = {
  goals: 0, assists: 0, yellowCards: 0, redCards: 0, doubleYellows: 0, woodwork: 0,
  penaltySaved: 0, goalPenalty: 0, goalFreekick: 0, penaltyMissed: 0, ownGoals: 0, matchesPlayed: 0,
};

export function computeStats(playerId: string, matches: MatchLike[]): PlayerStats {
  const s: PlayerStats = {
    goals: 0, assists: 0, yellowCards: 0, redCards: 0, doubleYellows: 0, woodwork: 0,
    penaltySaved: 0, goalPenalty: 0, goalFreekick: 0, penaltyMissed: 0, ownGoals: 0, matchesPlayed: 0,
  };
  matches.forEach((match) => {
    let played = false;
    (match.events || []).forEach((ev) => {
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
      }
      if (type === "goal" && assistPlayerId === playerId) { played = true; s.assists += 1; }
    });
    if (played) s.matchesPlayed += 1;
  });
  return s;
}
