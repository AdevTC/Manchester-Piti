/** Narration is interpreted outside the website. This contract stores facts, not AI-computed totals. */
import type { MatchEvent, Participation } from '../matchEngine.js';
import type { MatchClock } from '../matchClock.js';

export type AnalysisTeam = 'us' | 'opponent';
export type MetricStatus = 'complete' | 'partial' | 'unknown' | 'not_configured' | 'not_applicable' | 'no_sample';
export const OBSERVATION_KINDS = ['context', 'lineup', 'substitution', 'control', 'pass', 'reception', 'dribble', 'carry', 'duel', 'tackle', 'interception', 'clearance', 'shot', 'goal', 'block', 'save', 'keeper', 'distribution', 'pressure', 'loss', 'recovery', 'attack', 'restart', 'discipline', 'tactical', 'run', 'judgement', 'measurement', 'gap', 'aggregate'] as const;
export type ObservationKind = typeof OBSERVATION_KINDS[number];
export type Fact = string | number | boolean;
export type ControlState = AnalysisTeam | 'disputed' | 'out' | 'unknown';
export interface EvidenceOrigin {
  kind: 'explicit' | 'deduced' | 'judgement' | 'unknown';
  sourceId?: string;
  rule?: string;
}
export interface Observation {
  id: string;
  kind: ObservationKind;
  team: AnalysisTeam;
  actorId?: string;
  intendedReceiverId?: string;
  receiverId?: string;
  opponentId?: string;
  /** The one canonical acta event enriched by this observation, never counted a second time. */
  canonicalEventId?: string;
  order: number;
  period?: number;
  time?: { from: number; to: number; precision: 'exact' | 'interval' | 'approximate' };
  validity?: 'valid' | 'void' | 'pending';
  quantity?: number;
  /** Aggregates are permitted only with an explicit, disjoint scope. */
  aggregate?: { kind: Exclude<ObservationKind, 'aggregate'>; scopeId: string; reconciled: boolean };
  controlBefore?: ControlState;
  controlAfter?: ControlState;
  lastControlledTeam?: AnalysisTeam;
  links?: { action?: string; pass?: string; shot?: string; duel?: string; possession?: string; attack?: string; restart?: string; chain?: string; cause?: string; loss?: string; followup?: string };
  /** Typed scalar facts. Keys and their meaning are documented in the reusable narration prompt. */
  facts: Record<string, Fact>;
  provenance?: Record<string, EvidenceOrigin>;
}
export interface Coverage {
  /** Catalogue category, observation kind or '*' (only an explicitly exhaustive narration). */
  family: string;
  team: AnalysisTeam;
  state: 'complete' | 'partial' | 'unknown';
  from?: number;
  to?: number;
}
export interface AnalysisProfile {
  id: string;
  version: number;
  playersPerSide: number;
  periodMinutes: number[];
  baseMinutes: number;
  passes: { crosses: boolean; restarts: boolean; throwIns: boolean; keeperHands: boolean; deflection: 'fail' | 'retain' };
  parameters: Record<string, number | string | boolean | string[]>;
}
export interface NarratedAnalysis {
  version: 2;
  revision: number;
  profile: AnalysisProfile;
  observations: Observation[];
  coverage: Coverage[];
  /** Resolutions stay with the import instead of disappearing when the preview closes. */
  issues?: { id: string; message: string; eventIds: string[]; resolved?: string }[];
}
export interface NarratedMatch {
  date?: unknown;
  id: string;
  seasonId?: string;
  archived?: boolean;
  individuallyArchived?: boolean;
  deleting?: boolean;
  status?: string;
  duration?: number;
  durationSeconds?: number;
  clock?: MatchClock;
  goalsFor?: number;
  goalsAgainst?: number;
  starters?: string[];
  bench?: string[];
  notCalled?: string[];
  events?: MatchEvent[];
  ledger?: Record<string, Participation>;
  analysis?: NarratedAnalysis;
  analysisCoverage?: 'partial' | 'complete';
}
export interface AnalysisFilters {
  seasonIds?: string[];
  matchIds?: string[];
  playerIds?: string[];
  team?: AnalysisTeam;
  period?: number;
  fromSecond?: number;
  toSecond?: number;
  zone?: string;
  phase?: string;
  position?: string;
  partnerId?: string;
  lineupIds?: string[];
}
export interface MetricResult {
  id: string;
  unit: string;
  status: MetricStatus;
  value: number | null;
  numerator?: number;
  denominator?: number;
  observed: number;
  pending: number;
  exposureSeconds?: number;
  evidenceEventIds: string[];
  ruleId: string;
  ruleVersion: number;
  parameters: Record<string, Fact | string[]>;
  reason: string;
  groups?: { key: string; value: number }[];
}
/** Version 2 declares the club's big-chance criterion, Opta's (the one Sofascore applies). A stored analysis keeps the
 *  profile it was narrated with. */
export const DEFAULT_ANALYSIS_PROFILE: AnalysisProfile = {
  id: 'piti-narration', version: 2, playersPerSide: 7, periodMinutes: [25, 25], baseMinutes: 50,
  passes: { crosses: true, restarts: true, throwIns: false, keeperHands: false, deflection: 'fail' },
  parameters: {
    quickRecoverySeconds: 5, windowSeconds: 300, offside: false, assistPolicy: 'strict', temporalToleranceSeconds: 0,
    bigChanceCriterion: 'Ocasión clarísima (Opta) v1: situación en la que se espera razonablemente que el jugador marque, normalmente un mano a mano con el portero o un remate desde muy cerca, con el camino a la portería despejado y poca o moderada presión sobre el rematador. Los penaltis siempre lo son.',
  },
};
