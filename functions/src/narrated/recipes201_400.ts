/** Deterministic reducers for transitions, possession, set pieces and temporal/team contexts. */
import { and, before, clipIntervals, count, difference, elapsed, eq, exactTime, intervalIntersection, intervalSeconds, intervalUnion, isGoal, isKind, isPass, isShot, kindOf, knownOutcome, mean, missing, num, numericParameter, opposite, parameter, passComplete, profileForObservation, playerIntervals, quantity, quotient, ratioOf, sum, teamContext, withEvents, type MetricCalculation, type MetricContext, type MetricRecipe, type PreparedMatch, type ScopedObservation } from './operators.js';
import type { AnalysisTeam, Observation } from './types.js';
import { dateMillis } from '../matchEngine.js';

/** Fact vocabulary used by these reducers; data are observations, never precomputed metric values. */
export const NARRATED_FACT_KEYS_201_400 = [
  'zone','subtype','stage','ownGoal','followupComplete','continuity','cause','unforced','phase',
  'intervalStart','intervalEnd','durationSeconds','state','possessionComplete','transitionNeutralized',
  'buildUp','buildUpOutcome','entersFinalThird','entersArea','touchCount','lane','short','firstContactTeam',
  'disputableContact','directFreekick','delivery','endZone','direct','continuousControl','continuousControlSeconds',
  'progressZone','penalty','shootout','goal','onTarget','oneOnOne','neutralized','outcome','role','outsideArea',
  'tactical','handball','cardReviewed','playersBehindBall','localOwn','localOpponent','formation','block',
  'targeted','served','drawsDefender','value','activityMinutes','scale','keeperId','firstControl','miscontrol',
  'repairedWithoutOpponentControl','afterLoss',
] as const;

const ownHalf = (e: Observation) => e.facts.zone == null ? undefined : ['own_area', 'own_third', 'own_half'].includes(String(e.facts.zone));
const attackingHalf = (e: Observation) => e.facts.zone == null ? undefined : ['opponent_half', 'final_third', 'opponent_area'].includes(String(e.facts.zone));
const subtype = (e: Observation, kind: Parameters<typeof isKind>[1], value: string) => and(isKind(e, kind), eq(e, 'subtype', value));
const loss = (e: Observation) => isKind(e, 'loss');
const recovery = (e: Observation) => isKind(e, 'recovery');
const attack = (e: Observation) => isKind(e, 'attack') && e.facts.stage !== 'end';
const restart = (e: Observation, type: string, stage = 'executed') => and(isKind(e, 'restart'), eq(e, 'subtype', type), eq(e, 'stage', stage));
const offence = (e: Observation, type: string) => subtype(e, 'discipline', type);
const goalFor = (e: Observation): AnalysisTeam => e.facts.ownGoal === true ? opposite(e.team) : e.team;
const field = (key: string) => (e: ScopedObservation) => num(e, key);
const unit = (r: MetricCalculation, u: string): MetricCalculation => ({ ...r, unit: u });
const completed = (e: Observation): boolean | undefined => e.facts.followupComplete === true ? true : undefined;
const broken = (a: Observation, b: Observation) => isKind(b, 'gap') || b.controlAfter === 'out' || isKind(b, 'restart') || a.period != null && b.period != null && a.period !== b.period || isKind(b, 'context') && ['end', 'halftime'].includes(String(b.facts.stage));
const withinMatch = (ctx: MetricContext, e: ScopedObservation) => ctx.all.filter(x => x.matchId === e.matchId);
function related(ctx: MetricContext, e: ScopedObservation, relation: 'attack' | 'possession' | 'restart' | 'chain' | 'shot', predicate: (o: ScopedObservation) => boolean): ScopedObservation[] {
  const key = e.links?.[relation] ?? e.id;
  return withinMatch(ctx, e).filter(x => x.order >= e.order && x.team === e.team && x.links?.[relation] === key && predicate(x));
}
function hasRelated(ctx: MetricContext, e: ScopedObservation, relation: Parameters<typeof related>[2], predicate: (o: ScopedObservation) => boolean): boolean | undefined {
  return related(ctx, e, relation, predicate).length ? true : completed(e) ? false : undefined;
}
function timedFollowup(ctx: MetricContext, e: ScopedObservation, predicate: (o: ScopedObservation) => boolean, seconds: number): boolean | undefined {
  const candidates = withinMatch(ctx, e).filter(x => x.order > e.order);
  for (const x of candidates) {
    if (broken(e, x)) return false;
    if (x.links?.cause === e.id || x.links?.loss === e.id || x.links?.shot === e.links?.shot && x.links?.shot != null) {
      if (predicate(x)) return before(e, x, seconds);
    }
    if (x.controlAfter === e.team && x !== e && loss(e)) return false;
  }
  return completed(e) ? false : undefined;
}
function windowed(ctx: MetricContext, base: (e: ScopedObservation) => boolean | undefined, target: (e: ScopedObservation) => boolean, parameterKey: string) {
  const seconds = numericParameter(ctx, parameterKey);
  if (seconds == null) return missing(`Configura ${parameterKey} para delimitar la ventana.`, 'not_configured');
  return { ...count(ctx, e => and(base(e), base(e) ? timedFollowup(ctx, e, target, seconds) : false)), parameters: { [parameterKey]: seconds } };
}
function recoveryPair(ctx: MetricContext, r: ScopedObservation, rivalOnly = false): ScopedObservation | null | undefined {
  if (!recovery(r)) return null;
  const candidates = withinMatch(ctx, r).filter(x => x.order < r.order);
  const l = r.links?.loss ? candidates.find(x => x.id === r.links?.loss && loss(x)) : [...candidates].reverse().find(x => x.team === r.team && loss(x));
  if (!l) return completed(r) ? null : undefined;
  if (l.controlAfter == null || l.controlAfter === 'unknown') return undefined;
  if (l.team !== r.team || (rivalOnly ? l.controlAfter !== opposite(r.team) : ![opposite(r.team), 'disputed'].includes(l.controlAfter))) return null;
  const between = candidates.filter(x => x.order > l.order);
  if (between.some(x => broken(l, x) || recovery(x) && x.team === r.team || x.controlAfter === r.team)) return null;
  if (r.facts.continuity !== true) return undefined;
  return l;
}
function pairCount(ctx: MetricContext, rivalOnly: boolean, self: boolean, quick: boolean) {
  const seconds = numericParameter(ctx, 'quickRecoverySeconds');
  if (quick && seconds == null) return missing('Falta el umbral de recuperación rápida.', 'not_configured');
  return count(ctx, r => {
    if (!recovery(r)) return false;
    const l = recoveryPair(ctx, r, rivalOnly); if (l === undefined) return undefined; if (!l) return false;
    if (self && (!l.actorId || !r.actorId)) return undefined;
    return and(!self || l.actorId === r.actorId, quick ? before(l, r, seconds!) : true);
  });
}
interface ControlInterval { from: number; to: number; state: string; id: string; possession?: string; censored: boolean }
function controls(m: PreparedMatch): ControlInterval[] {
  const result: ControlInterval[] = [];
  const markers = m.events.filter(e => isKind(e, 'control', 'gap', 'context') || e.controlAfter != null);
  markers.forEach((e, index) => {
    const state = e.controlAfter ?? e.facts.state ?? (isKind(e, 'control') ? e.team : undefined);
    if (typeof state !== 'string' || !['us', 'opponent', 'disputed'].includes(state)) return;
    const from = num(e, 'intervalStart') ?? exactTime(e), explicitEnd = num(e, 'intervalEnd');
    const next = markers[index + 1];
    const to = explicitEnd ?? (from != null && num(e, 'durationSeconds') != null ? from + num(e, 'durationSeconds')! : next ? exactTime(next) : undefined);
    if (from != null && to != null && to >= from) result.push({ from, to, state, id: e.evidenceId, possession: e.links?.possession, censored: next != null && isKind(next, 'gap') });
  });
  return result;
}
function controlSeconds(ctx: MetricContext, state: string): MetricCalculation {
  let seconds = 0, pending = 0; const ids: string[] = [];
  for (const m of ctx.matches) {
    const rows = controls(m).filter(i => i.state === state);
    seconds += intervalSeconds(clipIntervals(ctx, rows, m.duration, m.match.id)); ids.push(...rows.map(i => i.id));
    // Older explicitly measured disjoint durations remain usable, with partial coverage.
    for (const e of m.events.filter(e => isKind(e, 'control') && (e.controlAfter ?? e.team) === state && exactTime(e) == null && !rows.some(row => row.id === e.evidenceId))) {
      const d = num(e, 'durationSeconds'); if (d != null && !ctx.filters.fromSecond && ctx.filters.toSecond == null && ctx.filters.period == null) { seconds += d; ids.push(e.evidenceId); } else pending++;
    }
  }
  return { value: seconds, unit: 's', observed: ids.length, pending, evidenceEventIds: ids };
}
interface Episode { key: string; events: ScopedObservation[]; duration?: number; complete: boolean }
function episodes(ctx: MetricContext): Episode[] {
  const map = new Map<string, Episode>();
  for (const e of ctx.all.filter(e => e.team === ctx.team && e.links?.possession)) {
    const key = `${e.matchId}:${e.links!.possession}`; const ep = map.get(key) ?? { key, events: [], complete: false }; ep.events.push(e); if (e.facts.possessionComplete === true) ep.complete = true; map.set(key, ep);
  }
  for (const m of ctx.matches) for (const ep of map.values()) {
    const segments = controls(m).filter(i => i.state === ctx.team && `${m.match.id}:${i.possession}` === ep.key);
    if (segments.length) { ep.duration = intervalSeconds(clipIntervals(ctx, segments, m.duration, m.match.id)); if (segments.some(i => i.censored)) ep.complete = false; }
  }
  return [...map.values()].filter(ep => !ctx.filters.playerIds?.length || ep.events.some(e => e.actorId && ctx.filters.playerIds!.includes(e.actorId)));
}
function episodeValue(ctx: MetricContext, read: (ep: Episode) => number | undefined, operation: 'sum' | 'mean' | 'median' | 'max' = 'sum'): MetricCalculation {
  const rows = episodes(ctx), valid = rows.map(ep => ({ ep, value: read(ep) })).filter((v): v is { ep: Episode; value: number } => v.value != null);
  const values = valid.map(v => v.value).sort((a, b) => a - b), n = values.length;
  const value = !n ? null : operation === 'mean' ? values.reduce((a, b) => a + b, 0) / n : operation === 'median' ? (values[Math.floor((n - 1) / 2)] + values[Math.floor(n / 2)]) / 2 : operation === 'max' ? values[n - 1] : values.reduce((a, b) => a + b, 0);
  return { value, observed: n, pending: rows.length - n + rows.filter(ep => !ep.complete).length, evidenceEventIds: valid.flatMap(v => v.ep.events.map(e => e.evidenceId)), ...(!n ? { status: rows.length ? 'unknown' as const : 'no_sample' as const } : {}) };
}
function possessionReached(ctx: MetricContext, predicate: (e: ScopedObservation) => boolean | undefined) { return episodeValue(ctx, ep => ep.events.some(e => predicate(e) === true) ? 1 : ep.complete && ep.events.every(e => predicate(e) !== undefined) ? 0 : undefined); }
function pairIds(ctx: MetricContext): string[] { return [...new Set([...(ctx.filters.playerIds ?? []), ...(ctx.filters.partnerId ? [ctx.filters.partnerId] : [])])]; }
function exposure(ctx: MetricContext, m: PreparedMatch, pair = false): { from: number; to: number }[] | null {
  const ids = pairIds(ctx);
  if (pair && ids.length !== 2 || !pair && ids.length !== 1) return null;
  let result = playerIntervals(m, ids[0]);
  if (pair) result = intervalIntersection(result, playerIntervals(m, ids[1]));
  return clipIntervals(ctx, result, m.duration, m.match.id);
}
function inIntervals(e: Observation, intervals: { from: number; to: number }[]): boolean | undefined {
  if (!e.time || e.time.precision === 'approximate') return undefined;
  if (intervals.some(i => e.time!.from >= i.from && e.time!.to < i.to)) return true;
  if (intervals.some(i => e.time!.to >= i.from && e.time!.from < i.to)) return undefined;
  return false;
}
function onField(ctx: MetricContext, side: AnalysisTeam | 'balance', pair = false): MetricCalculation {
  if ((pair ? pairIds(ctx).length !== 2 : pairIds(ctx).length !== 1)) return missing(pair ? 'Selecciona dos jugadores para consultar esta pareja.' : 'Selecciona un jugador para consultar su presencia.', 'not_applicable');
  let value = 0, pending = 0, seconds = 0; const ids: string[] = [];
  for (const m of ctx.matches) {
    const intervals = exposure(ctx, m, pair)!; seconds += intervalSeconds(intervals);
    for (const e of ctx.all.filter(e => e.matchId === m.match.id && isGoal(e))) {
      const inside = inIntervals(e, intervals); if (inside === undefined) { pending++; continue; }
      if (!inside) continue; const beneficiary = goalFor(e);
      if (side === 'balance') value += beneficiary === ctx.team ? quantity(e) : -quantity(e);
      else if (beneficiary === side) value += quantity(e); ids.push(e.evidenceId);
    }
  }
  return { value: seconds > 0 ? value : null, unit: 'goles', observed: ids.length, pending, exposureSeconds: seconds, evidenceEventIds: ids, ...(seconds ? {} : { status: 'no_sample' as const }) };
}
function tacticTime(ctx: MetricContext, key: string, value?: string): MetricCalculation {
  const grouped = new Map<string, { matchId: string; intervals: { from: number; to: number }[]; ids: string[] }>(); let pending = 0;
  for (const e of ctx.events.filter(e => isKind(e, 'tactical'))) {
    if (value && e.facts[key] !== value) { if (e.facts[key] == null) pending++; continue; }
    const label = e.facts[key]; if (typeof label !== 'string') { pending++; continue; }
    if (key === 'block' && e.facts.phase !== 'defence') { if (e.facts.phase == null) pending++; continue; }
    const from = num(e, 'intervalStart'), to = num(e, 'intervalEnd');
    if (from == null || to == null) { pending++; continue; }
    const groupKey = `${e.matchId}:${label}:${String(e.facts.phase ?? 'unknown')}`;
    const group = grouped.get(groupKey) ?? { matchId: e.matchId, intervals: [], ids: [] }; group.intervals.push({ from, to }); group.ids.push(e.evidenceId); grouped.set(groupKey, group);
  }
  const groups = [...grouped].map(([key, g]) => ({ key, value: intervalSeconds(clipIntervals(ctx, g.intervals, ctx.matches.find(m => m.match.id === g.matchId)?.duration ?? 0, g.matchId)) / 60 }));
  return { value: groups.reduce((s, g) => s + g.value, 0), unit: 'min', groups, observed: groups.length, pending, evidenceEventIds: [...grouped.values()].flatMap(g => g.ids) };
}
function goalkeepers(_ctx: MetricContext, m: PreparedMatch, playerId?: string) {
  return m.events.filter(e => isKind(e, 'lineup', 'tactical') && e.facts.role === 'GK' && (!playerId || e.actorId === playerId)).map(e => ({ from: num(e, 'intervalStart') ?? NaN, to: num(e, 'intervalEnd') ?? NaN, actorId: e.actorId, id: e.evidenceId }));
}
function keeperFaced(ctx: MetricContext, penaltyOnly = false): ScopedObservation[] {
  const ids = ctx.filters.playerIds ?? [];
  return ctx.all.filter(e => e.team === opposite(ctx.team) && isShot(e) && e.facts.ownGoal !== true && (!penaltyOnly || e.facts.penalty === true) && (!ids.length || typeof e.facts.keeperId === 'string' && ids.includes(e.facts.keeperId)));
}

export const RECIPES_201_400: Record<string, MetricRecipe> = {
  '201': c => count(c, loss),
  '202': c => count(c, e => and(loss(e), eq(e, 'cause', 'dispossessed'))),
  '203': c => count(c, e => and(loss(e), eq(e, 'unforced', true))),
  '204': c => count(c, e => and(loss(e), ownHalf(e))),
  '205': c => windowed(c, loss, e => isShot(e) && e.team === opposite(c.team), 'dangerSeconds'),
  '206': c => count(c, recovery),
  '207': c => count(c, e => and(recovery(e), e.facts.zone == null ? undefined : ['final_third', 'opponent_area'].includes(String(e.facts.zone)))),
  '208': c => count(c, e => and(recovery(e), ownHalf(e))),
  '209': c => difference(count(c, recovery), count(c, loss)),
  '210': c => pairCount(c, false, false, true),
  '211': c => unit(mean(c, recovery, e => { const l = recoveryPair(c, e); const d = l && elapsed(l, e); return d && d.min === d.max ? d.min : undefined; }), 's'),
  '212': c => unit(mean(c, recovery, e => { const s = related(c, e, 'possession', isShot)[0]; const d = s && elapsed(e, s); return d && d.min === d.max ? d.min : undefined; }), 's'),
  '213': c => count(c, e => and(attack(e), eq(e, 'phase', 'counterattack'))),
  '214': c => count(c, e => and(attack(e), eq(e, 'phase', 'counterattack'), attack(e) ? hasRelated(c, e, 'attack', isShot) : false)),
  '215': c => count(c, e => and(attack(e), eq(e, 'phase', 'counterattack'), attack(e) ? hasRelated(c, e, 'attack', isGoal) : false)),
  '216': c => ratioOf(c, e => hasRelated(c, e, 'attack', isShot), e => and(attack(e), eq(e, 'phase', 'counterattack'))),
  '217': c => count(withEvents(c, c.all.filter(e => e.team === opposite(c.team))), e => { if (!isShot(e)) return false; if (!e.links?.loss) return e.facts.afterLoss === false ? false : undefined; const l = withinMatch(c, e).find(x => x.id === e.links?.loss && x.team === c.team && loss(x)); return l ? e.facts.continuity === true : undefined; }),
  '218': c => count(c, e => and(attack(e), eq(e, 'transitionNeutralized', true))),
  '219': c => controlSeconds(c, c.team),
  '220': c => { const ours = controlSeconds(c, c.team), theirs = controlSeconds(c, opposite(c.team)); return quotient(ours, { ...theirs, value: (ours.value ?? 0) + (theirs.value ?? 0), observed: ours.observed + theirs.observed }, 100, '%'); },
  '221': c => controlSeconds(c, 'disputed'),
  '222': c => episodeValue(c, () => 1),
  '223': c => unit(episodeValue(c, ep => ep.complete ? ep.duration : undefined, 'mean'), 's'),
  '224': c => unit(episodeValue(c, ep => ep.complete ? ep.duration : undefined, 'median'), 's'),
  '225': c => unit(episodeValue(c, ep => ep.complete ? ep.duration : undefined, 'max'), 's'),
  '226': c => { const eps = episodes(c); const events = eps.flatMap(ep => ep.events.filter(e => isPass(e, profileForObservation(c, e)))); return quotient(count(withEvents(c, events), () => true), episodeValue(c, () => 1)); },
  '227': c => {
    let best = 0, pending = 0; const evidence: string[] = [];
    for (const m of c.matches) { let run = 0; const runIds: string[] = []; for (const e of c.all.filter(e => e.matchId === m.match.id)) {
      if (e.team !== c.team || isKind(e, 'gap', 'loss', 'shot', 'goal', 'restart') || e.controlAfter === 'disputed' || e.controlAfter === 'out') { run = 0; runIds.length = 0; continue; }
      if (!isPass(e, m.profile)) continue; const ok = passComplete(e, m.profile);
      if (ok !== true) { if (ok === undefined) pending++; run = 0; runIds.length = 0; continue; }
      if (e.facts.continuity !== true && !e.links?.chain) { pending++; run = 0; runIds.length = 0; }
      run += quantity(e); runIds.push(e.evidenceId); if (run > best) { best = run; evidence.splice(0, evidence.length, ...runIds); }
    } }
    return { value: best, observed: evidence.length, pending, evidenceEventIds: evidence };
  },
  '228': c => { const time = controlSeconds(c, c.team); return quotient(count(c, e => isPass(e, profileForObservation(c, e)) && !!e.links?.possession), { ...time, value: time.value == null ? null : time.value / 60 }, 1, 'pases/min'); },
  '229': c => possessionReached(c, attackingHalf),
  '230': c => possessionReached(c, e => eq(e, 'zone', 'opponent_area')),
  '231': c => quotient(possessionReached(c, isShot), episodeValue(c, () => 1), 100, '%'),
  '232': c => count(c, e => and(attack(e), eq(e, 'buildUp', true), eq(e, 'buildUpOutcome', 'complete'))),
  '233': c => count(c, e => and(attack(e), eq(e, 'buildUp', true), eq(e, 'buildUpOutcome', 'lost'))),
  '234': c => episodeValue(c, ep => ep.complete && ep.events.every(e => e.actorId || ['context', 'control'].includes(kindOf(e))) ? new Set(ep.events.flatMap(e => [e.actorId, e.receiverId].filter(Boolean))).size : undefined, 'mean'),
  '237': c => count(c, attack),
  '238': c => count(c, e => and(attack(e), eq(e, 'phase', 'positional'))),
  '239': c => count(c, e => and(attack(e), eq(e, 'phase', 'direct'))),
  '240': c => count(c, e => and(attack(e), attack(e) ? hasRelated(c, e, 'attack', isShot) : false)),
  '241': c => count(c, e => and(isKind(e, 'pass', 'carry'), eq(e, 'entersFinalThird', true), isKind(e, 'pass') ? passComplete(e, profileForObservation(c, e)) : true)),
  '242': c => count(c, e => and(isKind(e, 'pass', 'carry'), eq(e, 'entersArea', true), isKind(e, 'pass') ? passComplete(e, profileForObservation(c, e)) : true)),
  '243': c => quotient(sum(c, e => and(eq(e, 'zone', 'opponent_area'), !!e.links?.attack), field('touchCount')), count(c, attack)),
  '244': c => count(c, e => and(attack(e), eq(e, 'lane', 'left'))),
  '245': c => count(c, e => and(attack(e), eq(e, 'lane', 'center'))),
  '246': c => count(c, e => and(attack(e), eq(e, 'lane', 'right'))),
  '247': c => { const all = withEvents(c, c.all); return ratioOf(all, e => e.team === c.team, e => and(isPass(e, profileForObservation(c, e)), passComplete(e, profileForObservation(c, e)), e.facts.zone == null ? undefined : ['final_third', 'opponent_area'].includes(String(e.facts.zone)))); },
  '248': c => ratioOf(withEvents(c, c.all), e => e.team === c.team, isShot),
  '250': c => ratioOf(c, e => hasRelated(c, e, 'attack', x => x.facts.entersArea === true || x.facts.zone === 'opponent_area'), attack),
  '251': c => count(c, e => restart(e, 'corner', 'awarded')),
  '252': c => count(c, e => restart(e, 'corner')),
  '253': c => count(teamContext(c, opposite(c.team)), e => restart(e, 'corner', 'awarded')),
  '254': c => count(c, e => and(restart(e, 'corner'), eq(e, 'short', true))),
  '255': c => count(c, e => and(restart(e, 'corner'), isKind(e, 'restart') ? hasRelated(c, e, 'restart', isShot) : false)),
  '256': c => count(c, e => and(restart(e, 'corner'), isKind(e, 'restart') ? hasRelated(c, e, 'restart', isGoal) : false)),
  '257': c => ratioOf(c, e => hasRelated(c, e, 'restart', isShot), e => restart(e, 'corner')),
  '259': c => ratioOf(c, e => eq(e, 'firstContactTeam', c.team), e => and(restart(e, 'corner'), eq(e, 'disputableContact', true))),
  '260': c => count(c, e => restart(e, 'freekick', 'awarded')),
  '261': c => count(c, e => and(isShot(e), eq(e, 'directFreekick', true))),
  '262': c => count(c, e => and(isGoal(e), eq(e, 'directFreekick', true))),
  '263': c => count(c, e => and(restart(e, 'freekick'), eq(e, 'delivery', 'cross'), eq(e, 'endZone', 'opponent_area'))),
  '264': c => count(c, e => and(restart(e, 'freekick'), eq(e, 'direct', false), isKind(e, 'restart') ? hasRelated(c, e, 'restart', isShot) : false)),
  '265': c => count(c, e => restart(e, 'throw_in')),
  '266': c => retainedRestart(c),
  '267': c => { const zone = parameter(c, 'throwInProgressZone'); if (typeof zone !== 'string') return missing('Configura la zona mínima de progresión tras saque de banda.', 'not_configured'); return ratioOf(c, e => { if (e.facts.continuousControl === false) return false; return and(eq(e, 'continuousControl', true), eq(e, 'progressZone', zone)); }, e => restart(e, 'throw_in')); },
  '268': c => count(c, e => offence(e, 'penalty_received')),
  '269': c => count(c, e => and(isShot(e), eq(e, 'penalty', true), e.facts.shootout !== true)),
  '270': c => ratioOf(c, e => e.facts.goal === true || isKind(e, 'goal') ? true : knownOutcome(e) ? false : undefined, e => and(isShot(e), eq(e, 'penalty', true), e.facts.shootout !== true)),
  '271': c => count(withEvents(c, keeperFaced(c)), e => e.facts.goal === true || isKind(e, 'goal') ? true : eq(e, 'onTarget', true)),
  '272': c => count(c, e => isKind(e, 'save')),
  '273': c => { const saves = count(c, e => isKind(e, 'save')); const goals = count(withEvents(c, keeperFaced(c)), isGoal); return quotient(saves, { ...goals, value: (saves.value ?? 0) + (goals.value ?? 0), observed: saves.observed + goals.observed }, 100, '%'); },
  '274': c => keeperGoals(c),
  '275': c => cleanSheets(c),
  '276': c => keeperStreak(c),
  '277': c => count(c, e => and(isKind(e, 'save'), eq(e, 'subtype', 'held'))),
  '278': c => count(c, e => and(isKind(e, 'save'), eq(e, 'subtype', 'parried'))),
  '279': c => windowed(c, e => and(isKind(e, 'save'), eq(e, 'subtype', 'parried')), e => isShot(e) && e.team === opposite(c.team), 'reboundSeconds'),
  '280': c => count(c, e => and(isKind(e, 'save'), eq(e, 'oneOnOne', true))),
  '281': c => ratioOf(c, e => eq(e, 'neutralized', true), e => and(isKind(e, 'keeper'), eq(e, 'oneOnOne', true))),
  '282': c => count(c, e => and(isKind(e, 'save'), eq(e, 'penalty', true))),
  '283': c => { const faced = keeperFaced(c, true); return ratioOf(withEvents(c, faced), e => eq(e, 'outcome', 'saved'), e => e.facts.shootout !== true); },
  '284': c => count(c, e => subtype(e, 'keeper', 'cross_caught')),
  '285': c => count(c, e => subtype(e, 'keeper', 'punch')),
  '286': c => count(c, e => and(subtype(e, 'keeper', 'cross_exit'), eq(e, 'outcome', 'failed'))),
  '287': c => count(c, e => and(isKind(e, 'keeper', 'save', 'tackle', 'interception', 'clearance'), eq(e, 'role', 'GK'), eq(e, 'outsideArea', true))),
  '289': c => ratioOf(c, e => passComplete(e, profileForObservation(c, e)), e => isKind(e, 'distribution')),
  '290': c => count(c, e => and(isKind(e, 'distribution'), isKind(e, 'distribution') ? hasRelated(c, e, 'possession', attack) : false)),
  '295': c => count(c, e => offence(e, 'foul')),
  '296': c => count(c, e => offence(e, 'foul_received')),
  '297': c => difference(count(c, e => offence(e, 'foul_received')), count(c, e => offence(e, 'foul'))),
  '298': c => count(c, e => and(offence(e, 'foul'), eq(e, 'tactical', true))),
  '299': c => count(c, e => and(isKind(e, 'discipline'), eq(e, 'handball', true))),
  '300': c => count(c, e => and(isKind(e, 'discipline'), e.facts.subtype == null ? undefined : ['yellow_card', 'double_yellow'].includes(String(e.facts.subtype)))),
  '301': c => count(c, e => offence(e, 'double_yellow')),
  '302': c => count(c, e => offence(e, 'red_card')),
  '303': c => ratioOf(c, e => { const card = c.all.find(x => x.matchId === e.matchId && x.links?.cause === e.id && isKind(x, 'discipline') && ['yellow_card', 'double_yellow', 'red_card'].includes(String(x.facts.subtype))); return card ? true : e.facts.cardReviewed === true ? false : undefined; }, e => offence(e, 'foul')),
  '304': c => count(c, e => offence(e, 'penalty_committed')),
  '305': c => parameter(c, 'offside') === false ? missing('Este perfil no aplica la regla de fuera de juego.', 'not_applicable') : parameter(c, 'offside') !== true ? missing('Confirma si se aplica fuera de juego.', 'not_configured') : count(c, e => offence(e, 'offside')),
  '306': c => parameter(c, 'offside') !== true ? missing('La regla de fuera de juego no está activada en este perfil.', 'not_applicable') : c.filters.playerIds?.length ? missing('El fuera de juego provocado pertenece al bloque, sin atribución individual automática.', 'not_applicable') : count(teamContext(c, opposite(c.team)), e => offence(e, 'offside')),
  '317': c => mean(c, e => isKind(e, 'tactical'), field('playersBehindBall')),
  '318': c => mean(c, e => isKind(e, 'tactical'), e => { const own = num(e, 'localOwn'), opp = num(e, 'localOpponent'); return own != null && opp != null ? own - opp : undefined; }),
  '319': c => tacticTime(c, 'formation'),
  '320': c => tacticTime(c, 'block', 'high'),
  '321': c => tacticTime(c, 'block', 'medium'),
  '322': c => tacticTime(c, 'block', 'low'),
  '325': c => count(c, e => isKind(e, 'run')),
  '326': c => count(c, e => subtype(e, 'run', 'short_support')),
  '327': c => count(c, e => subtype(e, 'run', 'backward')),
  '328': c => count(c, e => subtype(e, 'run', 'wide')),
  '329': c => count(c, e => subtype(e, 'run', 'half_space')),
  '330': c => count(c, e => subtype(e, 'run', 'ahead')),
  '331': c => count(c, e => subtype(e, 'run', 'overlap')),
  '332': c => count(c, e => subtype(e, 'run', 'underlap')),
  '333': c => count(c, e => subtype(e, 'run', 'behind')),
  '334': c => count(c, e => subtype(e, 'run', 'cross')),
  '335': c => count(c, e => and(isKind(e, 'run'), eq(e, 'targeted', true))),
  '336': c => count(c, e => and(isKind(e, 'run'), eq(e, 'served', true))),
  '337': c => ratioOf(c, e => eq(e, 'targeted', true), e => isKind(e, 'run')),
  '338': c => ratioOf(c, e => eq(e, 'served', true), e => and(isKind(e, 'run'), eq(e, 'targeted', true))),
  '339': c => count(c, e => and(isKind(e, 'run'), eq(e, 'served', true), e.links?.shot ? c.all.some(s => s.matchId === e.matchId && s.id === e.links?.shot && isShot(s)) : completed(e) ? false : undefined)),
  '340': c => count(c, e => and(isKind(e, 'run'), eq(e, 'drawsDefender', true))),
  '363': c => unit(mean(c, e => subtype(e, 'measurement', 'rpe'), field('value')), 'RPE declarado'),
  '364': c => unit(sum(c, e => subtype(e, 'measurement', 'rpe'), e => { const rpe = num(e, 'value'), minutes = num(e, 'activityMinutes'); return rpe != null && minutes != null && e.facts.scale != null ? rpe * minutes : undefined; }), 'RPE·min'),
  '378': c => customRating(c),
  '379': c => onField(c, c.team),
  '380': c => onField(c, opposite(c.team)),
  '381': c => onField(c, 'balance'),
  '382': c => { const r = onField(c, 'balance'); return { ...r, value: r.value != null && r.exposureSeconds ? r.value * c.profile.baseMinutes * 60 / r.exposureSeconds : null, unit: `goles/${c.profile.baseMinutes} min` }; },
  '383': c => onOff(c),
  '384': c => sharedMinutes(c),
  '385': c => onField(c, 'balance', true),
  '386': c => { const ids = pairIds(c); return ids.length === 2 ? count(withEvents(c, c.all), e => and(e.team === c.team, isPass(e, profileForObservation(c, e)), e.actorId === ids[0], e.receiverId === ids[1], passComplete(e, profileForObservation(c, e)))) : missing('Selecciona emisor y receptor: se cuentan pases dirigidos A → B.', 'not_applicable'); },
  '388': c => combinations(c, false),
  '389': c => combinations(c, true),
  '391': c => goalRun(c),
  '392': c => shotDrought(c, c.team),
  '393': c => shotDrought(c, opposite(c.team)),
  '394': c => scoreTime(c, 1),
  '395': c => scoreTime(c, 0),
  '396': c => scoreTime(c, -1),
  '397': c => responseTime(c),
  '398': c => movingPeak(c),
  '399': c => accuracyChange(c),
  '400': c => substitutionChange(c),
  'A01': c => pairCount(c, true, false, false),
  'A02': c => pairCount(c, true, true, false),
  'A03': c => pairCount(c, true, true, true),
  'A04': c => ratioOf(c, e => { const r = c.all.find(r => r.matchId === e.matchId && recovery(r) && recoveryPair(c, r, true)?.id === e.id); return r ? r.actorId && e.actorId ? r.actorId === e.actorId : undefined : completed(e) ? false : undefined; }, e => and(loss(e), e.controlAfter == null ? undefined : e.controlAfter === opposite(c.team))),
  'A05': c => count(c, e => and(isKind(e, 'clearance'), eq(e, 'firstControl', c.team))),
  'A06': c => count(c, e => and(isKind(e, 'clearance'), eq(e, 'firstControl', opposite(c.team)))),
  'A07': c => count(c, e => and(isKind(e, 'clearance'), eq(e, 'firstControl', 'out'))),
  'A08': c => count(c, e => isKind(e, 'clearance') && !['us', 'opponent', 'out'].includes(String(e.facts.firstControl))),
  'A09': c => ratioOf(c, e => e.facts.firstControl == null || !['us', 'opponent', 'out'].includes(String(e.facts.firstControl)) ? undefined : e.facts.firstControl === c.team, e => isKind(e, 'clearance')),
  'A10': c => count(c, e => and(isKind(e, 'reception'), eq(e, 'miscontrol', true), eq(e, 'repairedWithoutOpponentControl', true))),
  'A11': c => {
    const r = ratioOf(c, e => isGoal(e) || knownOutcome(e), e => ['pass', 'dribble', 'duel', 'tackle', 'shot', 'goal', 'save', 'distribution', 'clearance'].includes(kindOf(e)));
    return { ...r, status: r.denominator ? 'complete' : 'no_sample', reason: r.denominator ? 'Completitud de los eventos registrados; no mide cuántas jugadas del partido se narraron.' : 'No hay acciones registradas elegibles para medir su completitud.' };
  },
  'A12': c => {
    const tolerance = numericParameter(c, 'temporalToleranceSeconds');
    if (tolerance == null || tolerance < 0) return missing('Configura una tolerancia temporal no negativa para evaluar el registro.', 'not_configured');
    const r = ratioOf(c, e => !!e.time && e.time.precision !== 'approximate' && e.time.to >= e.time.from && e.time.to - e.time.from <= tolerance, () => true);
    return { ...r, status: r.denominator ? 'complete' : 'no_sample', parameters: { temporalToleranceSeconds: tolerance }, reason: r.denominator ? `Eventos registrados con reloj de partido y un intervalo de incertidumbre de hasta ${tolerance} s; no mide cobertura del partido.` : 'No hay eventos registrados para evaluar su precisión temporal.' };
  },
};

function retainedRestart(c: MetricContext): MetricCalculation {
  const seconds = numericParameter(c, 'retentionSeconds'); if (seconds == null) return missing('Configura los segundos de retención continua tras el saque.', 'not_configured');
  return ratioOf(c, e => {
    if (e.facts.continuousControl === false) return false;
    const until = num(e, 'continuousControlSeconds'); return until == null ? undefined : until >= seconds;
  }, e => restart(e, 'throw_in'));
}
function keeperGoals(c: MetricContext): MetricCalculation {
  if (!c.filters.playerIds?.length) return count(withEvents(c, c.all), e => isGoal(e) && goalFor(e) === opposite(c.team));
  const ids = c.filters.playerIds;
  return count(withEvents(c, c.all), e => { if (!isGoal(e) || goalFor(e) !== opposite(c.team)) return false; if (e.facts.keeperId != null) return ids.includes(String(e.facts.keeperId)); const m = c.matches.find(m => m.match.id === e.matchId)!; const intervals = ids.flatMap(id => goalkeepers(c, m, id)); return intervals.length ? inIntervals(e, intervals) : undefined; });
}
function cleanSheets(c: MetricContext): MetricCalculation {
  if (c.filters.period != null || c.filters.fromSecond != null && c.filters.fromSecond !== 0 || c.filters.toSecond != null && c.matches.some(m => c.filters.toSecond! < m.duration) || c.filters.zone || c.filters.phase || c.filters.position) return missing('La portería a cero se determina sobre el partido completo; retira los filtros de tramo o contexto.', 'not_applicable');
  const players = c.filters.playerIds;
  const policy = parameter(c, 'keeperCleanSheetPolicy');
  const minMinutes = numericParameter(c, 'keeperCleanSheetMinMinutes');
  if (players?.length && !['full_match', 'min_minutes'].includes(String(policy))) return missing('Configura la participación del portero: full_match o min_minutes.', 'not_configured');
  if (players?.length && policy === 'min_minutes' && (minMinutes == null || minMinutes <= 0)) return missing('Configura un mínimo positivo de minutos en portería.', 'not_configured');
  let total = 0, known = 0, pending = 0;
  const evidence: string[] = [];
  for (const m of c.matches) {
    const { match } = m;
    const score = c.team === 'us' ? match.goalsAgainst : match.goalsFor;
    const conceded = m.events.filter(e => isGoal(e) && goalFor(e) === opposite(c.team) && e.facts.shootout !== true);
    const narrated = conceded.reduce((sum, e) => sum + quantity(e), 0);
    const exhaustive = (match.analysis?.coverage ?? []).some(row => row.team === opposite(c.team) && row.state === 'complete' && ['*', 'goal', 'Goles y marcador'].includes(row.family) && (row.from ?? 0) <= 0 && (row.to ?? m.duration) >= m.duration);
    if (match.status !== 'finished' || score == null || !Number.isInteger(score) || score < 0 || narrated > score || exhaustive && narrated !== score) { pending += players?.length ?? 1; continue; }
    if (!players?.length) { known++; if (score === 0) total++; evidence.push(...conceded.map(e => e.evidenceId)); continue; }
    for (const id of players) {
      const roles = m.events.filter(e => e.team === c.team && e.actorId === id && isKind(e, 'lineup', 'tactical') && typeof e.facts.role === 'string');
      const roleIntervals = roles.map(e => ({ from: num(e, 'intervalStart') ?? NaN, to: num(e, 'intervalEnd') ?? NaN }));
      const bounds = [{ from: 0, to: m.duration }];
      const field = intervalIntersection(playerIntervals(m, id), bounds);
      const keeper = intervalIntersection(goalkeepers(c, m, id).filter(i => Number.isFinite(i.from) && Number.isFinite(i.to) && i.to >= i.from), bounds);
      const keeperSeconds = intervalSeconds(intervalIntersection(keeper, field));
      const completeRoles = roles.length > 0 && intervalSeconds(intervalIntersection(roleIntervals, field)) >= intervalSeconds(field) && intervalSeconds(field) > 0;
      const contradictoryRoles = intervalSeconds(intervalIntersection(keeper, roles.filter(e => e.facts.role !== 'GK').map(e => ({ from: num(e, 'intervalStart') ?? NaN, to: num(e, 'intervalEnd') ?? NaN })))) > 0;
      if (m.duration <= 0 || !field.length || contradictoryRoles || !completeRoles && !(policy === 'min_minutes' && keeperSeconds >= minMinutes! * 60)) { pending++; continue; }
      const qualifies = policy === 'full_match' ? keeperSeconds >= m.duration : keeperSeconds >= minMinutes! * 60;
      known++; if (qualifies && score === 0) total++;
      evidence.push(...roles.map(e => e.evidenceId), ...conceded.map(e => e.evidenceId));
    }
  }
  return { value: known ? total : null, unit: players?.length ? 'porterías a cero del portero' : 'partidos', observed: known, pending, evidenceEventIds: [...new Set(evidence)], status: known ? pending ? 'partial' : 'complete' : 'unknown', reason: players?.length ? 'Partidos completos con cero goles recibidos por el equipo y la participación en portería exigida por el perfil.' : 'Marcador final publicado coherente con los goles registrados.', ...(players?.length ? { parameters: { keeperCleanSheetPolicy: String(policy), ...(policy === 'min_minutes' ? { keeperCleanSheetMinMinutes: minMinutes! } : {}) } } : {}) };
}
function keeperStreak(c: MetricContext): MetricCalculation {
  const ids = c.filters.playerIds; if (ids?.length !== 1) return missing('Selecciona un portero.', 'not_applicable');
  if (c.matches.length > 1 && (c.matches.some(m => !Number.isFinite(dateMillis(m.match.date))) || new Set(c.matches.map(m => dateMillis(m.match.date))).size !== c.matches.length)) return missing('La racha entre partidos necesita fechas distintas y una cronología conocida.');
  if (c.matches.some(m => !goalTimelineKnown(c, m))) return missing('La racha necesita el registro completo de goles recibidos.');
  let seconds = 0, pending = 0; const evidence: string[] = [];
  for (const m of [...c.matches].sort((a, b) => dateMillis(a.match.date) - dateMillis(b.match.date))) {
    const intervals = clipIntervals(c, intervalIntersection(goalkeepers(c, m, ids[0]), playerIntervals(m, ids[0])), m.duration, m.match.id); if (!intervals.length) { pending++; continue; }
    const possible = c.all.filter(e => e.matchId === m.match.id && isGoal(e) && goalFor(e) === opposite(c.team));
    if (possible.some(e => inIntervals(e, intervals) === undefined || inIntervals(e, intervals) === true && exactTime(e) == null)) return missing('Falta el tiempo exacto de un gol para reconstruir la racha del portero.');
    const conceded = possible.filter(e => inIntervals(e, intervals) === true).sort((a, b) => exactTime(a)! - exactTime(b)!);
    const last = conceded.at(-1); if (last) { const t = exactTime(last); if (t == null) { pending++; continue; } seconds = intervalSeconds(intervalIntersection(intervals, [{ from: t, to: m.duration }])); evidence.push(last.evidenceId); }
    else seconds += intervalSeconds(intervals); evidence.push(...goalkeepers(c, m, ids[0]).map(i => i.id));
  }
  return { value: evidence.length ? seconds / 60 : null, unit: 'min', observed: evidence.length, pending, evidenceEventIds: evidence };
}
function customRating(c: MetricContext): MetricCalculation {
  const configured = parameter(c, 'ratingWeights');
  const scaleMin = numericParameter(c, 'ratingScaleMin'), scaleMax = numericParameter(c, 'ratingScaleMax'), baseline = numericParameter(c, 'ratingBaseline'), role = parameter(c, 'ratingRole');
  if (typeof configured !== 'string' || scaleMin == null || scaleMax == null || scaleMax <= scaleMin || baseline == null || typeof role !== 'string' || !role.trim() || parameter(c, 'ratingMissingPolicy') !== 'require_complete') return missing('Configura pesos, escala, valor inicial, rol y política require_complete para la valoración propia.', 'not_configured');
  let weights: Record<string, number>; try { weights = JSON.parse(configured); } catch { return missing('La configuración de pesos no es válida.', 'not_configured'); }
  if (!weights || typeof weights !== 'object' || Array.isArray(weights) || !Object.keys(weights).length || Object.entries(weights).some(([id, weight]) => !/^\d{3}$/.test(id) || Number(id) < 1 || Number(id) > 400 || id === '378' || typeof weight !== 'number' || !Number.isFinite(weight))) return missing('Los pesos requieren IDs 001–400 disponibles, valores finitos y ninguna referencia circular a 378.', 'not_configured');
  if (!c.evaluateMetric) return missing('Falta el evaluador completo de las métricas de la fórmula.', 'not_configured');
  if (c.filters.playerIds?.length !== 1) return missing('Selecciona un jugador para aplicar la fórmula del rol.', 'not_applicable');
  const id = c.filters.playerIds[0]; let exposureSeconds = 0;
  const roleEvidence: string[] = [];
  for (const m of c.matches) {
    const participation = clipIntervals(c, playerIntervals(m, id), m.duration, m.match.id);
    const seconds = intervalSeconds(participation);
    if (!seconds) {
      if (m.match.notCalled?.includes(id) || m.match.ledger?.[id]?.notCalled || m.match.ledger?.[id]?.played === false) continue;
      return missing('Falta participación fiable del jugador para valorar su rol.');
    }
    const roles = m.events.filter(e => e.team === c.team && e.actorId === id && isKind(e, 'lineup', 'tactical') && e.facts.role === role);
    const intervals = roles.map(e => ({ from: num(e, 'intervalStart') ?? NaN, to: num(e, 'intervalEnd') ?? NaN }));
    const otherRoles = m.events.filter(e => e.team === c.team && e.actorId === id && isKind(e, 'lineup', 'tactical') && typeof e.facts.role === 'string' && e.facts.role !== role).map(e => ({ from: num(e, 'intervalStart') ?? NaN, to: num(e, 'intervalEnd') ?? NaN }));
    if (intervalSeconds(intervalIntersection(participation, intervals)) < seconds || intervalSeconds(intervalIntersection(participation, otherRoles)) > 0) return missing('El rol configurado no está acreditado de forma coherente durante toda la exposición valorada.');
    exposureSeconds += seconds; roleEvidence.push(...roles.map(e => e.evidenceId));
  }
  if (!exposureSeconds) return missing('No hay minutos de participación en el rol configurado.', 'no_sample');
  const rows = Object.entries(weights).map(([metricId, weight]) => ({ metricId, r: c.evaluateMetric!(metricId), weight }));
  if (rows.some(({ r }) => !r || r.status === 'not_configured' || r.status === 'not_applicable')) return missing('La fórmula contiene una métrica no disponible o sin configurar.', 'not_configured');
  if (rows.some(({ r }) => r!.status !== 'complete' || r!.value == null || !Number.isFinite(r!.value) || r!.pending > 0)) return missing('Faltan entradas completas de la fórmula; no se imputan ceros ni se valora una muestra parcial.');
  const groups = rows.map(({ metricId, r, weight }) => ({ key: metricId, value: r!.value! * weight }));
  const unbounded = baseline + groups.reduce((sum, row) => sum + row.value, 0);
  if (!Number.isFinite(unbounded) || groups.some(row => !Number.isFinite(row.value))) return missing('Los pesos configurados desbordan la escala numérica; revisa la fórmula.', 'not_configured');
  return { value: Math.max(scaleMin, Math.min(scaleMax, unbounded)), unit: 'puntos propios', observed: rows.length, pending: 0, exposureSeconds, status: 'complete', groups: [{ key: 'base', value: baseline }, ...groups], evidenceEventIds: [...new Set([...roleEvidence, ...rows.flatMap(({ r }) => r!.evidenceEventIds)])], parameters: { ratingWeights: configured, ratingScaleMin: scaleMin, ratingScaleMax: scaleMax, ratingBaseline: baseline, ratingRole: role, ratingMissingPolicy: 'require_complete', unboundedRating: unbounded }, reason: 'Valoración propia del rol declarado, con entradas de cobertura completa y límite explícito a la escala configurada.' };
}
function onOff(c: MetricContext): MetricCalculation {
  const on = onField(c, 'balance'); if (!on.exposureSeconds) return on;
  let totalSeconds = 0, balance = 0;
  for (const m of c.matches) { totalSeconds += intervalSeconds(clipIntervals(c, [{ from: 0, to: m.duration }], m.duration, m.match.id)); for (const e of c.all.filter(e => e.matchId === m.match.id && isGoal(e))) balance += goalFor(e) === c.team ? quantity(e) : -quantity(e); }
  const offSeconds = totalSeconds - on.exposureSeconds;
  if (offSeconds <= 0 || on.value == null) return missing('Se necesitan minutos positivos tanto dentro como fuera del campo.', 'no_sample');
  return { ...on, value: c.profile.baseMinutes * 60 * (on.value / on.exposureSeconds - (balance - on.value) / offSeconds), unit: `goles/${c.profile.baseMinutes} min`, parameters: { onSeconds: on.exposureSeconds, offSeconds } };
}
function sharedMinutes(c: MetricContext): MetricCalculation {
  if (pairIds(c).length !== 2) return missing('Selecciona dos jugadores.', 'not_applicable');
  let seconds = 0, known = 0; for (const m of c.matches) { const intervals = exposure(c, m, true); if (intervals) { seconds += intervalSeconds(intervals); known++; } }
  return { value: known ? seconds / 60 : null, unit: 'min', observed: known, pending: c.matches.length - known, evidenceEventIds: c.all.filter(e => isKind(e, 'substitution', 'lineup')).map(e => e.evidenceId), exposureSeconds: seconds };
}
function combinations(c: MetricContext, balance: boolean): MetricCalculation {
  const groups = new Map<string, number>(); const ids: string[] = []; let pending = 0;
  for (const m of c.matches) {
    const players = Object.keys(m.match.ledger ?? {}), intervals = new Map(players.map(id => [id, playerIntervals(m, id)]));
    const boundaries = [...new Set([0, m.duration, ...[...intervals.values()].flatMap(list => list.flatMap(i => [i.from, i.to])), ...goalkeepers(c, m).flatMap(i => [i.from, i.to])])].filter(Number.isFinite).sort((a, b) => a - b);
    if (!players.length) { pending++; continue; }
    for (let i = 0; i < boundaries.length - 1; i++) {
      const from = boundaries[i], to = boundaries[i + 1]; if (to <= from) continue;
      const active = players.filter(id => intervals.get(id)!.some(s => s.from <= from && s.to >= to)).sort();
      if (c.filters.lineupIds?.length && active.join('|') !== [...c.filters.lineupIds].sort().join('|')) continue;
      const keeper = goalkeepers(c, m).find(k => k.from <= from && k.to >= to)?.actorId;
      const key = `${active.join(' · ')} / GK:${keeper ?? '?'}`; if (!keeper) pending++;
      if (!balance) groups.set(key, (groups.get(key) ?? 0) + intervalSeconds(clipIntervals(c, [{ from, to }], m.duration, m.match.id)) / 60);
      else for (const e of c.all.filter(e => e.matchId === m.match.id && isGoal(e))) { const belongs = inIntervals(e, [{ from, to }]); if (belongs === undefined) pending++; if (belongs) { groups.set(key, (groups.get(key) ?? 0) + (goalFor(e) === c.team ? quantity(e) : -quantity(e))); ids.push(e.evidenceId); } }
    }
  }
  return { value: groups.size ? [...groups.values()].reduce((a, b) => a + b, 0) : null, unit: balance ? 'goles' : 'min', observed: groups.size, pending, groups: [...groups].map(([key, value]) => ({ key, value })), evidenceEventIds: ids };
}
function goalRun(c: MetricContext): MetricCalculation {
  let best = 0, current = 0; const evidence: string[] = [];
  for (const m of c.matches) { current = 0; for (const e of c.all.filter(e => e.matchId === m.match.id && isGoal(e))) { current = goalFor(e) === c.team ? current + quantity(e) : 0; best = Math.max(best, current); evidence.push(e.evidenceId); } }
  return { value: best, observed: evidence.length, pending: 0, evidenceEventIds: evidence };
}
function shotDrought(c: MetricContext, team: AnalysisTeam): MetricCalculation {
  let best = 0, pending = 0, segments = 0, exposureSeconds = 0; const evidence: string[] = [];
  for (const m of c.matches) {
    const ids = c.filters.playerIds; const intervals = ids?.length ? intervalUnion(ids.flatMap(id => playerIntervals(m, id))) : [{ from: 0, to: m.duration }];
    const covered = completeIntervals(m, 'shot', team);
    if (!covered.length) { pending++; continue; }
    const shots = c.all.filter(e => e.matchId === m.match.id && e.team === team && isShot(e) && (team !== c.team || !ids?.length || e.actorId && ids.includes(e.actorId)));
    const unresolved = (c.uncertainEvents ?? []).filter(e => e.matchId === m.match.id && e.team === team && isShot(e));
    for (const interval of intervalIntersection(clipIntervals(c, intervals, m.duration, m.match.id), covered)) {
      const uncertainShots = [...shots.filter(e => exactTime(e) == null), ...unresolved].filter(e => !e.time || e.time.to >= interval.from && e.time.from < interval.to);
      if (uncertainShots.length) { pending += uncertainShots.length; continue; }
      segments++; exposureSeconds += interval.to - interval.from;
      let last = interval.from;
      for (const e of [...shots].sort((a, b) => exactTime(a)! - exactTime(b)!)) {
        const t = exactTime(e); if (t == null) { pending++; continue; } if (t < interval.from || t >= interval.to) continue;
        best = Math.max(best, t - last); last = t; evidence.push(e.evidenceId);
      }
      best = Math.max(best, interval.to - last);
    }
  }
  return { value: segments ? best / 60 : null, unit: 'min', observed: segments, pending, evidenceEventIds: evidence, exposureSeconds, reason: 'Máximo en tramos con cobertura completa de remates y tiempo conocido; no enlaza banquillos ni lagunas.', requiredCoverage: [{ family: 'shot', team }] };
}
function completeIntervals(m: PreparedMatch, family: 'shot' | 'goal', team: AnalysisTeam): { from: number; to: number }[] {
  const category = family === 'shot' ? 'Remates y finalización' : 'Goles y marcador';
  if (!m.match.analysis && m.match.analysisCoverage === 'complete') return [{ from: 0, to: m.duration }];
  return intervalUnion((m.match.analysis?.coverage ?? []).filter(row => row.team === team && row.state === 'complete' && ['*', family, category].includes(row.family)).map(row => ({ from: row.from ?? 0, to: row.to ?? m.duration })));
}
function goalTimelineKnown(c: MetricContext, m: PreparedMatch): boolean {
  if ((c.uncertainEvents ?? []).some(e => e.matchId === m.match.id && isGoal(e))) return false;
  return (['us', 'opponent'] as const).every(team => {
    const score = team === 'us' ? m.match.goalsFor : m.match.goalsAgainst;
    const narrated = m.events.filter(e => isGoal(e) && e.facts.shootout !== true && goalFor(e) === team).reduce((sum, e) => sum + quantity(e), 0);
    if (score != null && score !== narrated) return false;
    return m.match.status === 'finished' && score != null || intervalSeconds(intervalIntersection(completeIntervals(m, 'goal', team), [{ from: 0, to: m.duration }])) >= m.duration;
  });
}
function scoreTime(c: MetricContext, direction: -1 | 0 | 1): MetricCalculation {
  let seconds = 0, pending = 0, known = 0; const evidence: string[] = [];
  for (const m of c.matches) {
    if (!goalTimelineKnown(c, m) || m.events.some(e => isGoal(e) && exactTime(e) == null)) { pending++; continue; }
    known++;
    let balance = 0, from = 0, uncertain = false;
    for (const e of m.events.filter(e => isGoal(e) && e.facts.shootout !== true).sort((a, b) => exactTime(a)! - exactTime(b)! || a.order - b.order)) {
      const t = exactTime(e); if (t == null) { uncertain = true; pending++; continue; }
      if (!uncertain && Math.sign(balance) === direction) seconds += intervalSeconds(clipIntervals(c, [{ from, to: t }], m.duration, m.match.id));
      balance += goalFor(e) === c.team ? quantity(e) : -quantity(e); from = t; evidence.push(e.evidenceId);
    }
    if (!uncertain && Math.sign(balance) === direction) seconds += intervalSeconds(clipIntervals(c, [{ from, to: m.duration }], m.duration, m.match.id));
  }
  return { value: known ? seconds / 60 : null, unit: 'min', observed: known, pending, evidenceEventIds: evidence, reason: 'Tiempo de los partidos con secuencia completa de goles y reloj exacto; no se presupone un 0–0 cuando faltan goles.', requiredCoverage: [{ family: 'goal', team: 'us' }, { family: 'goal', team: 'opponent' }] };
}
function responseTime(c: MetricContext): MetricCalculation {
  let total = 0, n = 0, pending = 0, noResponse = 0; const ids: string[] = [];
  for (const m of c.matches) for (const goal of c.all.filter(e => e.matchId === m.match.id && isGoal(e) && goalFor(e) === opposite(c.team))) {
    const shot = c.all.find(e => e.matchId === m.match.id && e.order > goal.order && isShot(e) && e.team === c.team && (e.period == null || goal.period == null || e.period === goal.period)); if (!shot) { noResponse++; continue; }
    const d = elapsed(goal, shot); if (!d || d.min !== d.max) { pending++; continue; } total += d.min; n++; ids.push(goal.evidenceId, shot.evidenceId);
  }
  return { value: n ? total / n : null, numerator: total, denominator: n, unit: 's', observed: n, pending, evidenceEventIds: ids, parameters: { episodesWithoutResponse: noResponse }, ...(!n ? { status: pending ? 'unknown' as const : 'no_sample' as const } : {}) };
}
function movingPeak(c: MetricContext): MetricCalculation {
  const width = numericParameter(c, 'windowSeconds'); if (!width || width <= 0) return missing('Configura una ventana positiva.', 'not_configured');
  const selectedKind = parameter(c, 'windowKind') ?? 'shot'; let best = 0, pending = 0; const evidence: string[] = [];
  for (const m of c.matches) {
    const events = c.events.filter(e => e.matchId === m.match.id && (selectedKind === 'shot' ? isShot(e) : kindOf(e) === selectedKind));
    const timed = events.filter(e => exactTime(e) != null).sort((a, b) => exactTime(a)! - exactTime(b)!); pending += events.length - timed.length;
    let left = 0, value = 0;
    for (let right = 0; right < timed.length; right++) { value += quantity(timed[right]); while (exactTime(timed[right])! - exactTime(timed[left])! >= width) value -= quantity(timed[left++]); if (value > best) { best = value; evidence.splice(0, evidence.length, ...timed.slice(left, right + 1).map(e => e.evidenceId)); } }
  }
  return { value: best, observed: evidence.length, pending, evidenceEventIds: evidence, parameters: { windowSeconds: width, windowKind: String(selectedKind) } };
}
function accuracyChange(c: MetricContext): MetricCalculation {
  const split = numericParameter(c, 'splitSecond'); if (split == null) return missing('Configura el segundo que separa los tramos A y B.', 'not_configured');
  const a = ratioOf(withEvents(c, c.events.filter(e => exactTime(e) != null && exactTime(e)! < split)), e => passComplete(e, profileForObservation(c, e)), e => isPass(e, profileForObservation(c, e)));
  const b = ratioOf(withEvents(c, c.events.filter(e => exactTime(e) != null && exactTime(e)! >= split)), e => passComplete(e, profileForObservation(c, e)), e => isPass(e, profileForObservation(c, e)));
  return { ...difference(b, a), unit: 'pp', pending: a.pending + b.pending + c.events.filter(e => isPass(e, profileForObservation(c, e)) && exactTime(e) == null).length, parameters: { splitSecond: split, attemptsA: a.denominator ?? 0, attemptsB: b.denominator ?? 0, completedA: a.numerator ?? 0, completedB: b.numerator ?? 0 }, reason: 'Diferencia en puntos porcentuales entre muestras resueltas; los pases pendientes se muestran aparte.' };
}
function substitutionChange(c: MetricContext): MetricCalculation {
  const width = numericParameter(c, 'substitutionWindowSeconds'), target = parameter(c, 'substitutionId');
  if (!width || typeof target !== 'string') return missing('Selecciona el cambio y una ventana previa/posterior positiva en el perfil.', 'not_configured');
  const subs = c.all.filter(e => isKind(e, 'substitution') && e.id === target); if (subs.length !== 1) return missing('El cambio seleccionado no identifica una sola acción en la muestra.', 'not_applicable');
  const sub = subs[0], t = exactTime(sub); if (t == null) return missing('El cambio necesita tiempo exacto de partido.');
  const m = c.matches.find(m => m.match.id === sub.matchId)!;
  const preStart = Math.max(0, t - width, c.filters.fromSecond ?? 0), postEnd = Math.min(m.duration, t + width, c.filters.toSecond ?? Infinity);
  const preSeconds = t - preStart, postSeconds = postEnd - t;
  if (preSeconds <= 0 || postSeconds <= 0) return missing('Ambas ventanas necesitan exposición positiva.', 'no_sample');
  const coverage = m.match.analysis?.coverage ?? [];
  if (!coverage.some(x => x.team === c.team && ['*', 'Remates', 'shot'].includes(x.family) && x.state === 'complete' && (x.from ?? 0) <= preStart && (x.to ?? m.duration) >= postEnd)) return missing('Se necesita cobertura comparable y completa de remates en ambas ventanas.');
  let pre = 0, post = 0, pending = 0; const ids = [sub.evidenceId];
  for (const e of c.events.filter(e => e.matchId === sub.matchId && isShot(e))) { const at = exactTime(e); if (at == null) { pending++; continue; } if (at >= preStart && at < t) { pre += quantity(e); ids.push(e.evidenceId); } if (at >= t && at < postEnd) { post += quantity(e); ids.push(e.evidenceId); } }
  return { value: post * 60 / postSeconds - pre * 60 / preSeconds, unit: 'remates/min', observed: pre + post, pending, evidenceEventIds: ids, parameters: { preSeconds, postSeconds, preCount: pre, postCount: post }, status: pending ? 'partial' : 'complete', reason: 'Tasa posterior menos tasa previa con exposiciones reales. Es una asociación, no una atribución causal.' };
}
