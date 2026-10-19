import { NARRATION_CARD_SUBTYPES } from './contract.js';
import type { Fact, NarratedMatch, Observation, ObservationKind } from './types.js';
import { kindOf } from './operators.js';
const isPendingDup = (e: { dupOf?: string; dupOk?: boolean }) => !!e.dupOf && !e.dupOk;
const eventSide = (e: { type: string; team?: 'us' | 'opponent' }) => e.type.startsWith('opponent_') || e.team === 'opponent' ? 'opponent' as const : 'us' as const;
/** Every old event remains a fact with its actual precision; a typed minute is not an exact second. */
export function legacyObservations(match: NarratedMatch): Observation[] {
  const mapping: Record<string, ObservationKind> = { pass: 'pass', cross: 'pass', shot: 'shot', goal: 'goal', goal_penalty: 'goal', goal_freekick: 'goal', opponent_goal: 'goal', own_goal: 'goal', opponent_own_goal: 'goal', recovery: 'recovery', possession_lost: 'loss', interception: 'interception', clearance: 'clearance', block: 'block', save: 'save', penalty_saved: 'save', dribble: 'dribble', tackle: 'tackle', duel: 'duel', aerial_duel: 'duel', carry: 'carry', touch: 'reception', possession: 'control', substitution: 'substitution', corner: 'restart', opponent_corner: 'restart', throw_in: 'restart', goal_kick: 'restart', kickoff: 'restart', penalty_missed: 'shot', opponent_penalty_missed: 'shot', woodwork: 'shot', opponent_woodwork: 'shot' };
  return (match.events ?? []).filter(e => !isPendingDup(e)).map((e, order) => {
    const discipline = /foul|card|yellow|red|penalty_committed|penalty_received|offside/.test(e.type);
    const kind = mapping[e.type] ?? (discipline ? 'discipline' : 'context');
    const facts: Record<string, Fact> = { legacyType: e.type };
    if (e.outcome) facts.outcome = e.outcome === 'incomplete' ? 'failed' : e.outcome === 'unknown' ? 'pending' : e.outcome;
    if (e.bodyPart) facts.bodyPart = e.bodyPart;
    if (e.zone) facts.lane = e.zone;
    if (e.delivery === 'short' || e.delivery === 'long') facts.distanceBand = e.delivery;
    if (e.delivery === 'cross' || e.type === 'cross') facts.subtype = 'cross';
    if (e.delivery === 'through') facts.throughBall = true;
    if (e.keyPass != null) facts.keyPass = e.keyPass;
    if (e.type === 'chance' || e.type === 'opponent_chance') { facts.chance = true; facts.subtype = 'chance'; }
    if (kind === 'goal') { facts.goal = true; facts.ownGoal = e.type.includes('own_goal'); facts.outcome = 'goal'; facts.onTarget = !facts.ownGoal; facts.penalty = e.type === 'goal_penalty'; if (e.type === 'goal_freekick') facts.directFreekick = true; }
    if (e.assistPlayerId) { facts.assistPlayerId = e.assistPlayerId; facts.assistReviewed = true; }
    if (e.assistReviewed != null) facts.assistReviewed = e.assistReviewed;
    if (e.outcome === 'on_target') facts.onTarget = true;
    if (['off_target', 'blocked'].includes(e.outcome ?? '')) facts.onTarget = false;
    if (e.outcome === 'woodwork' || e.type.endsWith('woodwork')) facts.woodwork = true;
    if (kind === 'restart') { facts.subtype = e.type.replace('opponent_', ''); facts.stage = 'executed'; }
    if (kind === 'discipline') {
      facts.subtype = e.type.replace('opponent_', '');
      if (e.type === 'foul' || e.type === 'opponent_foul') facts.subtype = 'foul';
      if (e.type === 'opponent_yellow') facts.subtype = 'yellow_card';
      if (e.type === 'opponent_red') facts.subtype = 'red_card';
    }
    if (e.type === 'aerial_duel') facts.subtype = 'aerial';
    if (kind === 'save') { facts.penalty = e.type === 'penalty_saved'; if (e.outcome === 'held') facts.subtype = 'held'; if (e.outcome === 'parried') facts.subtype = 'parried'; }
    if (e.type.includes('penalty_missed')) { facts.penalty = true; facts.goal = false; }
    if (e.inPlayerId) facts.inPlayerId = e.inPlayerId;
    if (e.possessionSeconds != null) facts.durationSeconds = e.possessionSeconds;
    const time = e.timingUnknown ? undefined : e.elapsedSeconds != null ? { from: e.elapsedSeconds, to: e.elapsedSeconds, precision: 'exact' as const } : e.minute != null ? { from: e.minute * 60, to: e.minute * 60 + 59.999, precision: 'interval' as const } : undefined;
    return { id: e.id, canonicalEventId: e.id, kind, team: eventSide(e), actorId: e.playerId, receiverId: e.receiverId, ...(e.outcome === 'complete' && e.receiverId ? { intendedReceiverId: e.receiverId } : {}), order, period: e.period, time, facts, validity: 'valid' as const };
  });
}

export function rawObservations(match: NarratedMatch): Observation[] {
  const pendingCanonical = new Set((match.events ?? []).filter(isPendingDup).map(e => e.id));
  const enriched = (match.analysis?.observations ?? []).filter(e => !e.canonicalEventId || !pendingCanonical.has(e.canonicalEventId));
  const base = legacyObservations(match);
  const byId = new Map(base.map(e => [e.id, e]));
  const replaced = new Set(enriched.map(e => e.canonicalEventId).filter(Boolean));
  return [...base.filter(e => !replaced.has(e.id)), ...enriched.map(e => {
    const original = e.canonicalEventId ? byId.get(e.canonicalEventId) : undefined;
    return original ? { ...original, ...e, facts: { ...original.facts, ...e.facts } } : e;
  })];
}

/** A summary cannot also count the same timed actions. Unknown overlap is not confirmation. */
export function unsafeAggregateIds(records: readonly Observation[]): Set<string> {
  const unsafe = new Set<string>();
  const family = (e: Observation) => kindOf(e) === 'goal' ? 'shot' : kindOf(e);
  for (const a of records) {
    if (!a.aggregate || !a.aggregate.reconciled || a.validity === 'void' || a.validity === 'pending') continue;
    if (a.aggregate.kind === 'goal' || a.aggregate.kind === 'substitution' || a.aggregate.kind === 'discipline' && NARRATION_CARD_SUBTYPES.includes(String(a.facts.subtype))) { unsafe.add(a.id); continue; }
    if (!a.time || a.time.to <= a.time.from || a.time.precision !== 'interval') { unsafe.add(a.id); continue; }
    for (const b of records) {
      if (a.id === b.id || b.validity === 'void' || b.validity === 'pending' || a.team !== b.team || family(a) !== family(b) || a.actorId && b.actorId && a.actorId !== b.actorId || a.period && b.period && a.period !== b.period) continue;
      const overlaps = !b.time || b.time.precision === 'approximate' || (b.time.from === b.time.to ? b.time.from >= a.time.from && b.time.from < a.time.to : b.time.from < a.time.to && b.time.to > a.time.from);
      if (overlaps) { unsafe.add(a.id); break; }
    }
  }
  return unsafe;
}

export function mergedObservations(match: NarratedMatch): Observation[] {
  const records = rawObservations(match);
  const unsafe = unsafeAggregateIds(records);
  const unique = new Map<string, Observation>();
  for (const e of records) {
    if (e.validity === 'void' || e.validity === 'pending' || unsafe.has(e.id) || e.aggregate && !e.aggregate.reconciled) continue;
    const actionKey = e.links?.action ? `${kindOf(e) === 'goal' ? 'shot' : kindOf(e)}:${e.links.action}` : e.id;
    const previous = unique.get(actionKey);
    // One shot can also be a goal: preserve its goal label rather than counting both interventions.
    if (!previous || kindOf(e) === 'goal') unique.set(actionKey, e);
  }
  return [...unique.values()].sort((a, b) => a.order - b.order || a.id.localeCompare(b.id));
}
