import type { EventType } from '../matchEngine.js';
import type { AnalysisEvent, Outcome } from '../matchAnalysis.js';
import { isPass, passComplete } from './operators.js';
import { mergedObservations } from './observations.js';
import { DEFAULT_ANALYSIS_PROFILE, type NarratedMatch } from './types.js';

/** The existing season totals and charts consume the same facts as Números, one match at a time. */
export function technicalEvents(match: NarratedMatch): (AnalysisEvent & { type: EventType })[] {
  if (!match.analysis) return match.events ?? [];
  const canonical = new Map((match.events ?? []).map(e => [e.id, e]));
  const profile = match.analysis.profile ?? DEFAULT_ANALYSIS_PROFILE;
  return mergedObservations(match).flatMap(o => {
    const kind = o.aggregate?.kind ?? o.kind, f = o.facts;
    const base = o.canonicalEventId ? canonical.get(o.canonicalEventId) : undefined;
    let type: EventType | undefined;
    const mappings: Record<string,EventType> = { pass: f.subtype === 'cross' ? 'cross' : 'pass', reception: 'touch', dribble: 'dribble', carry: 'carry', duel: f.subtype === 'aerial' || f.aerial === true ? 'aerial_duel' : 'duel', tackle: 'tackle', interception: 'interception', clearance: 'clearance', shot: 'shot', goal: base?.type ?? (o.team === 'opponent' ? 'opponent_goal' : 'goal'), block: 'block', save: 'save', loss: 'possession_lost', recovery: 'recovery' };
    type = mappings[kind];
    if (kind === 'context' && (f.chance === true || f.subtype === 'chance')) type = o.team === 'opponent' ? 'opponent_chance' : 'chance';
    if (kind === 'restart') {
      const subtype = String(f.subtype ?? '');
      if (['throw_in','goal_kick','kickoff','corner'].includes(subtype) && f.stage === 'executed') type = subtype as EventType;
    }
    if (kind === 'discipline') {
      const subtype = String(f.subtype ?? '');
      if (['foul','foul_received','offside'].includes(subtype)) type = subtype as EventType;
    }
    if (kind === 'distribution') type = 'pass';
    if (kind === 'control' && typeof f.durationSeconds === 'number') type = 'possession';
    if (!type) return [];
    let outcome: Outcome = 'unknown';
    if (['complete','completed','success'].includes(String(f.outcome))) outcome = ['tackle','dribble','duel','aerial_duel'].includes(type) ? 'won' : 'complete';
    if (['failed','lost'].includes(String(f.outcome))) outcome = ['tackle','dribble','duel','aerial_duel'].includes(type) ? 'lost' : 'incomplete';
    if (f.outcome === 'won') outcome = 'won';
    if (kind === 'shot' || kind === 'goal') {
      if (['on_target','saved'].includes(String(f.outcome)) || f.onTarget === true) outcome = 'on_target';
      if (f.outcome === 'off_target') outcome = 'off_target';
      if (f.outcome === 'blocked' || f.blocked === true) outcome = 'blocked';
      if (f.outcome === 'woodwork' || f.woodwork === true) outcome = 'woodwork';
    }
    if (type === 'save' && ['held','parried'].includes(String(f.subtype))) outcome = f.subtype as Outcome;
    const time = o.time?.precision === 'exact' ? { minute: Math.floor(o.time.from / 60), elapsedSeconds: o.time.from, timingUnknown: false } : { minute: base?.minute, elapsedSeconds: undefined, timingUnknown: base?.minute == null };
    const delivery = f.subtype === 'cross' ? 'cross' : f.distanceBand === 'long' ? 'long' : f.distanceBand === 'short' ? 'short' : undefined;
    if (kind === 'pass' || kind === 'distribution') {
      // A blocked delivery remains a failed pass, not the unrelated shot outcome.
      // Share the catalogue's resolved/unknown classification and deflection policy.
      const completed = passComplete(o, profile);
      outcome = completed == null ? 'unknown' : completed ? 'complete' : 'incomplete';
    }
    return [{ ...base, id: o.id, type, team: o.team, playerId: o.actorId, receiverId: o.receiverId,
      ...time, ...(o.period === 1 || o.period === 2 ? { period: o.period } : {}), outcome,
      ...(delivery ? { delivery } : {}), ...(typeof f.keyPass === 'boolean' ? { keyPass: f.keyPass } : {}),
      ...(typeof f.assistPlayerId === 'string' ? { assistPlayerId: f.assistPlayerId } : {}),
      ...(typeof f.durationSeconds === 'number' ? { possessionSeconds: f.durationSeconds } : {}),
      ...(typeof f.onTarget === 'boolean' ? { onTarget: f.onTarget } : {}), ...(typeof f.woodwork === 'boolean' ? { woodwork: f.woodwork } : {}),
      quantity: o.quantity ?? 1, countsAsPass: isPass(o, profile), source: 'narration' as const,
    }];
  });
}
