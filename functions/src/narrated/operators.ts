import type { AnalysisFilters, AnalysisProfile, AnalysisTeam, Fact, MetricResult, MetricStatus, NarratedMatch, Observation, ObservationKind } from './types.js';
import { clockReading } from '../matchClock.js';

export interface ScopedObservation extends Observation { matchId: string; evidenceId: string }
export interface PreparedMatch { match: NarratedMatch; events: ScopedObservation[]; duration: number; profile: AnalysisProfile }
export interface MetricContext {
  matches: PreparedMatch[];
  events: ScopedObservation[];
  all: ScopedObservation[];
  filters: AnalysisFilters;
  team: AnalysisTeam;
  profile: AnalysisProfile;
  profilesByMatch?: ReadonlyMap<string, AnalysisProfile>;
  excludedByUncertainty: number;
  uncertainEvents?: ScopedObservation[];
  evaluateMetric?: (id: string) => MetricResult | undefined;
}
export interface MetricCalculation {
  value: number | null;
  unit?: string;
  numerator?: number;
  denominator?: number;
  observed: number;
  pending: number;
  evidenceEventIds: string[];
  status?: MetricStatus;
  reason?: string;
  groups?: { key: string; value: number }[];
  exposureSeconds?: number;
  parameters?: Record<string, Fact | string[]>;
  requiredCoverage?: { family: string; team: AnalysisTeam }[];
}
export type MetricRecipe = (ctx: MetricContext) => MetricCalculation;
export type Predicate = (e: ScopedObservation) => boolean | undefined;
export const quantity = (e: Observation): number => e.quantity ?? 1;
export const kindOf = (e: Observation): ObservationKind => e.aggregate?.kind ?? e.kind;
export const isKind = (e: Observation, ...kinds: ObservationKind[]): boolean => kinds.includes(kindOf(e));
export const fact = (e: Observation, key: string): Fact | undefined => e.facts[key];
export const num = (e: Observation, key: string): number | undefined => typeof e.facts[key] === 'number' ? e.facts[key] as number : undefined;
export const eq = (e: Observation, key: string, value: Fact): boolean | undefined => e.facts[key] == null ? undefined : e.facts[key] === value;
export const and = (...values: (boolean | undefined)[]): boolean | undefined => values.includes(false) ? false : values.includes(undefined) ? undefined : true;
export const knownOutcome = (e: Observation): boolean => typeof e.facts.outcome === 'string' && !['unknown', 'pending'].includes(e.facts.outcome);
export function missing(reason: string, status: MetricStatus = 'unknown'): MetricCalculation {
  return { value: null, observed: 0, pending: 0, evidenceEventIds: [], status, reason };
}
export function parameter(ctx: MetricContext, key: string): number | string | boolean | string[] | undefined { return ctx.profile.parameters[key]; }
export function numericParameter(ctx: MetricContext, key: string): number | undefined { const p = parameter(ctx, key); return typeof p === 'number' && Number.isFinite(p) ? p : undefined; }
/** Rules belong to the recorded match, never to the first item in a selection. */
export function profileForObservation(ctx: MetricContext, e: ScopedObservation): AnalysisProfile {
  return ctx.profilesByMatch?.get(e.matchId) ?? ctx.matches.find(m => m.match.id === e.matchId)?.profile ?? ctx.profile;
}
export function count(ctx: MetricContext, predicate: Predicate, _family?: string, requiredFacts: string[] = []): MetricCalculation {
  let value = 0, pending = 0;
  const evidenceEventIds: string[] = [];
  for (const e of ctx.events) {
    const qualifies = predicate(e);
    if (qualifies === false) continue;
    if (qualifies === undefined || requiredFacts.some(key => e.facts[key] == null)) { pending += quantity(e); continue; }
    value += quantity(e); evidenceEventIds.push(e.evidenceId);
  }
  return { value, unit: 'acciones', observed: value, pending, evidenceEventIds, ...(_family ? { requiredCoverage: [{ family: _family, team: ctx.team }] } : {}) };
}
/** Unknown outcomes are retained as pending and never subtracted from attempts to invent failures. */
export function ratioOf(ctx: MetricContext, numerator: Predicate, denominator: Predicate, _family?: string, requiredFacts: string[] = []): MetricCalculation {
  let n = 0, d = 0, pending = 0;
  const evidenceEventIds: string[] = [];
  for (const e of ctx.events) {
    const eligible = denominator(e);
    if (eligible === false) continue;
    const success = numerator(e);
    if (eligible === undefined || success === undefined || requiredFacts.some(key => e.facts[key] == null)) { pending += quantity(e); continue; }
    d += quantity(e); if (success) n += quantity(e); evidenceEventIds.push(e.evidenceId);
  }
  return { value: d ? 100 * n / d : null, unit: '%', numerator: n, denominator: d, observed: d, pending, evidenceEventIds, ...(_family ? { requiredCoverage: [{ family: _family, team: ctx.team }] } : {}), ...(d ? {} : { status: pending ? 'unknown' as const : 'no_sample' as const, reason: pending ? 'Hay acciones pendientes de clasificar.' : 'No hay oportunidades registradas en esta muestra.' }) };
}
function values(ctx: MetricContext, predicate: Predicate, read: (e: ScopedObservation) => number | undefined) {
  const result: { value: number; weight: number; id: string }[] = []; let pending = 0;
  for (const e of ctx.events) {
    const eligible = predicate(e); if (eligible === false) continue;
    const v = read(e);
    if (eligible === undefined || v == null || !Number.isFinite(v)) { pending += quantity(e); continue; }
    result.push({ value: v, weight: quantity(e), id: e.evidenceId });
  }
  return { result, pending };
}
export function sum(ctx: MetricContext, predicate: Predicate, read: (e: ScopedObservation) => number | undefined, _family?: string): MetricCalculation {
  const { result, pending } = values(ctx, predicate, read);
  return { value: result.reduce((s, v) => s + v.value * v.weight, 0), observed: result.reduce((s, v) => s + v.weight, 0), pending, evidenceEventIds: result.map(v => v.id), ...(_family ? { requiredCoverage: [{ family: _family, team: ctx.team }] } : {}) };
}
export function mean(ctx: MetricContext, predicate: Predicate, read: (e: ScopedObservation) => number | undefined, family?: string): MetricCalculation {
  const r = sum(ctx, predicate, read, family);
  return { ...r, numerator: r.value ?? 0, denominator: r.observed, value: r.observed ? (r.value ?? 0) / r.observed : null, ...(r.observed ? {} : { status: r.pending ? 'unknown' as const : 'no_sample' as const }) };
}
export function max(ctx: MetricContext, predicate: Predicate, read: (e: ScopedObservation) => number | undefined, _family?: string): MetricCalculation {
  const { result, pending } = values(ctx, predicate, read);
  return { value: result.length ? Math.max(...result.map(v => v.value)) : null, observed: result.reduce((s, v) => s + v.weight, 0), pending, evidenceEventIds: result.map(v => v.id), ...(result.length ? {} : { status: pending ? 'unknown' as const : 'no_sample' as const }) };
}
export function difference(a: MetricCalculation, b: MetricCalculation): MetricCalculation {
  return { value: a.value == null || b.value == null ? null : a.value - b.value, unit: a.unit, observed: a.observed + b.observed, pending: a.pending + b.pending, evidenceEventIds: [...new Set([...a.evidenceEventIds, ...b.evidenceEventIds])], requiredCoverage: [...(a.requiredCoverage ?? []), ...(b.requiredCoverage ?? [])] };
}
export function quotient(a: MetricCalculation, b: MetricCalculation, multiplier = 1, unit = ''): MetricCalculation {
  const d = b.value, n = a.value;
  return { value: n != null && d != null && d > 0 ? multiplier * n / d : null, numerator: n ?? undefined, denominator: d ?? undefined, unit, observed: b.observed, pending: a.pending + b.pending, evidenceEventIds: [...new Set([...a.evidenceEventIds, ...b.evidenceEventIds])], requiredCoverage: [...(a.requiredCoverage ?? []), ...(b.requiredCoverage ?? [])], ...(d === 0 ? { status: 'no_sample' as const, reason: 'El denominador de esta muestra es cero.' } : {}) };
}
export function withEvents(ctx: MetricContext, events: ScopedObservation[]): MetricContext { return { ...ctx, events }; }
export function opposite(team: AnalysisTeam): AnalysisTeam { return team === 'us' ? 'opponent' : 'us'; }
export function teamContext(ctx: MetricContext, team: AnalysisTeam): MetricContext { return { ...ctx, team, events: ctx.all.filter(e => e.team === team && (!ctx.filters.playerIds?.length || e.actorId && ctx.filters.playerIds.includes(e.actorId))) }; }
export function exactTime(e: Observation): number | undefined { return e.time?.precision === 'exact' && e.time.from === e.time.to ? e.time.from : undefined; }
export function elapsed(a: Observation, b: Observation): { min: number; max: number } | null {
  if (!a.time || !b.time || a.time.precision === 'approximate' || b.time.precision === 'approximate') return null;
  return { min: b.time.from - a.time.to, max: b.time.to - a.time.from };
}
/** Strict comparisons preserve uncertainty when an interval straddles the threshold. */
export function before(a: Observation, b: Observation, seconds: number): boolean | undefined {
  const d = elapsed(a, b); if (!d || d.min < 0) return undefined;
  if (d.max < seconds) return true; if (d.min >= seconds) return false; return undefined;
}
export function isPass(e: Observation, profile: AnalysisProfile): boolean {
  if (isKind(e, 'distribution')) return e.facts.bodyPart === 'hand' ? profile.passes.keeperHands : true;
  if (!isKind(e, 'pass')) return false;
  if (e.facts.subtype === 'cross' && !profile.passes.crosses) return false;
  if (e.facts.restart === 'throw_in') return profile.passes.throwIns;
  if (e.links?.restart && !profile.passes.restarts) return false;
  return true;
}
export function passComplete(e: Observation, profile: AnalysisProfile): boolean | undefined {
  if (!knownOutcome(e)) return undefined;
  if (e.facts.deflected === true && profile.passes.deflection === 'fail') return false;
  return ['complete', 'completed', 'success'].includes(String(e.facts.outcome));
}
export function isShot(e: Observation): boolean { return isKind(e, 'shot') || isKind(e, 'goal') && e.facts.ownGoal !== true; }
export function isGoal(e: Observation): boolean { return isKind(e, 'goal') || isShot(e) && e.facts.goal === true; }
export function intervalUnion(intervals: readonly { from: number; to: number }[]): { from: number; to: number }[] {
  const sorted = intervals.filter(i => Number.isFinite(i.from) && Number.isFinite(i.to) && i.to > i.from).map(i => ({ ...i })).sort((a, b) => a.from - b.from); const result: { from: number; to: number }[] = [];
  for (const i of sorted) { const last = result.at(-1); if (last && i.from <= last.to) last.to = Math.max(last.to, i.to); else result.push(i); } return result;
}
export function intervalIntersection(a: readonly { from: number; to: number }[], b: readonly { from: number; to: number }[]): { from: number; to: number }[] {
  return intervalUnion(a.flatMap(x => b.map(y => ({ from: Math.max(x.from, y.from), to: Math.min(x.to, y.to) })).filter(i => i.to > i.from)));
}
export function intervalSeconds(intervals: readonly { from: number; to: number }[]): number { return intervalUnion(intervals).reduce((s, i) => s + i.to - i.from, 0); }
export function hasKnownParticipation(m: PreparedMatch, id: string): boolean {
  if (m.match.ledger?.[id]) return true;
  const relevant = m.events.filter(e => isKind(e, 'substitution') && (e.actorId === id || e.facts.inPlayerId === id));
  if (relevant.some(e => exactTime(e) == null)) return false;
  return !!(m.match.starters?.includes(id) || m.match.bench?.includes(id) || m.events.some(e => isKind(e, 'lineup') && e.actorId === id && (typeof e.facts.started === 'boolean' || num(e, 'intervalStart') != null && num(e, 'intervalEnd') != null)));
}
export function playerIntervals(m: PreparedMatch, id: string): { from: number; to: number }[] {
  const ledger = m.match.ledger?.[id];
  if (ledger) return intervalUnion(ledger.stints.map(s => ({ from: s.from * 60, to: s.to * 60 })));
  if (!hasKnownParticipation(m, id)) return [];
  const declared = m.events.filter(e => isKind(e, 'lineup') && e.actorId === id && num(e, 'intervalStart') != null && num(e, 'intervalEnd') != null).map(e => ({ from: num(e, 'intervalStart')!, to: num(e, 'intervalEnd')! }));
  if (declared.length) return intervalUnion(declared);
  let from: number | null = m.match.starters?.includes(id) || m.events.some(e => isKind(e, 'lineup') && e.actorId === id && e.facts.started === true) ? 0 : null;
  const intervals: { from: number; to: number }[] = [];
  for (const e of m.events) {
    const t = exactTime(e); if (t == null) continue;
    if (isKind(e, 'substitution') && e.facts.inPlayerId === id && from == null) from = t;
    if (e.actorId !== id) continue;
    if (isKind(e, 'substitution') && e.facts.direction === 'in' && from == null) from = t;
    if (isKind(e, 'substitution') && e.facts.direction !== 'in' || isKind(e, 'discipline') && ['red_card', 'double_yellow', 'red', 'second_yellow'].includes(String(e.facts.subtype))) {
      if (from != null) { intervals.push({ from, to: t }); from = null; }
    }
  }
  if (from != null && m.duration > from) intervals.push({ from, to: m.duration });
  return intervalUnion(intervals);
}
export function periodInterval(ctx: MetricContext, m: PreparedMatch): { from: number; to: number } | null {
  const period = ctx.filters.period; if (period == null) return { from: 0, to: m.duration };
  const declared = m.events.find(e => isKind(e, 'context') && e.period === period && num(e, 'intervalStart') != null && num(e, 'intervalEnd') != null);
  if (declared) return { from: num(declared, 'intervalStart')!, to: num(declared, 'intervalEnd')! };
  const clock = m.match.clock;
  if (clock?.firstStartedAt != null && clock.firstEndedAt != null) {
    const first = clockReading(clock, clock.endedAt ?? clock.firstEndedAt).firstSeconds;
    if (period === 1) return { from: 0, to: first };
    if (period === 2 && clock.endedAt != null) return { from: first, to: m.duration };
  }
  return null;
}
export function clipIntervals(ctx: MetricContext, intervals: { from: number; to: number }[], duration: number, matchId?: string): { from: number; to: number }[] {
  let period = { from: 0, to: duration };
  if (ctx.filters.period != null) {
    const m = ctx.matches.find(m => matchId ? m.match.id === matchId : ctx.matches.length === 1);
    const bounds = m ? periodInterval(ctx, m) : null; if (!bounds) return []; period = bounds;
  }
  return intervalIntersection(intervals, [{ from: Math.max(period.from, ctx.filters.fromSecond ?? 0), to: Math.min(period.to, ctx.filters.toSecond ?? duration) }]);
}
