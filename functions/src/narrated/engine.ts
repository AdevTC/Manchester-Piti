import { mergedObservations, rawObservations, unsafeAggregateIds } from './observations.js';
export { legacyObservations } from './observations.js';
import { NARRATED_METRICS, NARRATED_METRIC_BY_ID } from './catalog.js';
import { DEFAULT_ANALYSIS_PROFILE, type AnalysisFilters, type MetricResult, type NarratedMatch } from './types.js';
import { type MetricContext, type PreparedMatch, type MetricCalculation, type MetricRecipe, type ScopedObservation, kindOf, periodInterval, intervalUnion, missing } from './operators.js';
import { RECIPES_001_200 } from './recipes001_200.js';
import { RECIPES_201_400 } from './recipes201_400.js';

function profileSignature(ctx: MetricContext, parameterIds: string[], index: number): string {
  const p = ctx.matches[index].profile;
  const wanted = new Set<string>();
  const sets: Record<string, string[]> = {
    P03: ['quickRecoverySeconds'], P04: ['temporalToleranceSeconds'],
    P11: ['pressureRecoverySeconds','reactionSeconds','ppdaZone','ppdaActionKinds','defensiveActionKinds','counterpressReactionSeconds','counterpressRecoverySeconds','counterpressShotSeconds','gpiEligibleKinds','gpiExceptionsReviewed'],
    P12: ['retentionSeconds','retentionEndPolicy','throwInProgressZone'], P13: ['dangerSeconds','reboundSeconds'],
    P14: ['assistPolicy','scaEligibleKinds','scaPhasePolicy'], P16: ['windowSeconds','windowKind','splitSecond','substitutionId','substitutionWindowSeconds'],
    P20: ['assistPolicy'], P21: ['scaEligibleKinds','scaPhasePolicy'], P23: ['keeperCleanSheetPolicy','keeperCleanSheetMinMinutes'],
    P24: ['ratingWeights','ratingScaleMin','ratingScaleMax','ratingBaseline','ratingRole','ratingMissingPolicy'],
  };
  for (const id of parameterIds) for (const key of sets[id] ?? []) wanted.add(key);
  const signature = { passes: parameterIds.some(id => ['P08','P09','P10','P19'].includes(id)) ? p.passes : null, baseMinutes: parameterIds.includes('P01') ? p.baseMinutes : null, parameters: Object.fromEntries([...wanted].sort().map(key => [key, p.parameters[key] ?? null])) };
  return JSON.stringify(signature);
}

export function prepareNarrated(matches: readonly NarratedMatch[], filters: AnalysisFilters = {}): MetricContext {
  const team = filters.team ?? 'us';
  const prepared: PreparedMatch[] = matches.filter(m => !m.archived && !m.individuallyArchived && !m.deleting && m.status !== 'cancelled' && (!filters.seasonIds?.length || m.seasonId && filters.seasonIds.includes(m.seasonId)) && (!filters.matchIds?.length || filters.matchIds.includes(m.id))).map(match => ({
    match, duration: match.durationSeconds ?? (match.duration != null ? match.duration * 60 : 0),
    profile: match.analysis?.profile ?? DEFAULT_ANALYSIS_PROFILE,
    events: mergedObservations(match).map(e => ({ ...e, matchId: match.id, evidenceId: `${match.id}:${e.id}` })),
  }));
  const uncertainEvents: ScopedObservation[] = prepared.flatMap(m => {
    const raw = rawObservations(m.match), unsafe = unsafeAggregateIds(raw);
    return raw.filter(e => (e.validity === 'pending' || unsafe.has(e.id) || e.aggregate && !e.aggregate.reconciled) &&
      !(filters.period != null && e.period != null && e.period !== filters.period) &&
      !(e.time && (e.time.to < (filters.fromSecond ?? 0) || e.time.from >= (filters.toSecond ?? Infinity))) &&
      !([[filters.zone, 'zone'], [filters.phase, 'phase'], [filters.position, 'role']] as const).some(([filter, key]) => filter && e.facts[key] != null && e.facts[key] !== filter)
    ).map(e => ({ ...e, matchId: m.match.id, evidenceId: `${m.match.id}:${e.id}` }));
  });
  const all = prepared.flatMap(m => m.events).filter(e => {
    if (filters.period != null && e.period !== filters.period) { if (e.period == null) uncertainEvents.push(e); return false; }
    if (filters.fromSecond != null || filters.toSecond != null) {
      if (!e.time || e.time.precision === 'approximate') { uncertainEvents.push(e); return false; }
      const start = filters.fromSecond ?? 0, end = filters.toSecond ?? Infinity;
      if (e.time.to < start || e.time.from >= end) return false;
      if (e.time.from < start || e.time.to >= end) { uncertainEvents.push(e); return false; }
    }
    for (const [filter, key] of [[filters.zone, 'zone'], [filters.phase, 'phase'], [filters.position, 'role']] as const) {
      if (filter && e.facts[key] !== filter) { if (e.facts[key] == null) uncertainEvents.push(e); return false; }
    }
    return true;
  });
  const events = all.filter(e => e.team === team && (!filters.playerIds?.length || e.actorId && filters.playerIds.includes(e.actorId)));
  return { matches: prepared, events, all, filters, team, profile: prepared[0]?.profile ?? DEFAULT_ANALYSIS_PROFILE, excludedByUncertainty: uncertainEvents.length, uncertainEvents };
}

export const NARRATED_RECIPES: Readonly<Record<string, MetricRecipe>> = { ...RECIPES_001_200, ...RECIPES_201_400 };
const LEGACY_FAMILIES = new Set(['Pases: volumen y ejecución', 'Remates y finalización', 'Disciplina e infracciones', 'pass', 'shot', 'goal', 'discipline']);
function metricFamilies(id: string): string[] {
  const n = Number(id);
  if (id === 'A01' || id === 'A02' || id === 'A03' || id === 'A04') return ['loss', 'recovery', 'control'];
  if (id >= 'A05' && id <= 'A09') return ['clearance'];
  if (id === 'A10') return ['reception', 'control'];
  if (n === 392 || n === 393) return ['shot'];
  if (n <= 14) return ['lineup', 'substitution'];
  if (n <= 28 || n >= 379 && n <= 385 || n >= 388 && n <= 396) return ['goal', ...(n >= 379 && n <= 389 ? ['lineup', 'substitution'] : [])];
  if (n <= 50) return ['shot'];
  if (n <= 104 || n === 386 || n === 399) return ['pass'];
  if (n <= 120) return ['pass', 'shot'];
  if (n <= 134) return ['reception', 'pass'];
  if (n <= 150) return ['carry', 'dribble'];
  if (n <= 164) return ['duel'];
  if (n <= 182) return ['tackle', 'interception', 'clearance', 'block'];
  if (n <= 200) return ['pressure'];
  if (n <= 205) return ['loss'];
  if (n <= 212) return ['recovery', ...(n >= 209 ? ['loss'] : [])];
  if (n <= 218) return ['attack'];
  if (n <= 236) return ['control', 'pass'];
  if (n <= 250) return ['attack'];
  if (n <= 270) return ['restart', ...(n >= 269 ? ['shot'] : [])];
  if (n <= 290) return ['keeper', 'save', 'shot'];
  if (n <= 306) return ['discipline'];
  if (n <= 324) return ['tactical'];
  if (n <= 340) return ['run'];
  if (n <= 364) return ['measurement'];
  return ['shot'];
}
function completeCoverage(ctx: MetricContext, category: string, id: string, requirements: MetricCalculation['requiredCoverage']): boolean {
  const needed = requirements?.length ? requirements : metricFamilies(id).map(family => ({ family, team: ctx.team }));
  return ctx.matches.length > 0 && ctx.matches.every(m => {
    const { match, duration } = m;
    const coverage = match.analysis?.coverage;
    if (!coverage) return match.analysisCoverage === 'complete' && (LEGACY_FAMILIES.has(category) || needed.every(n => LEGACY_FAMILIES.has(n.family)));
    if (duration <= 0 && ctx.filters.fromSecond == null && ctx.filters.toSecond == null) return needed.every(n => coverage.some(c => c.team === n.team && (c.family === '*' || c.family === category || c.family === n.family) && c.state === 'complete' && c.from == null && c.to == null));
    // A complete second half is sufficient for that half, even if the first was
    // not narrated. Without real period bounds only whole-match coverage can certify it.
    const period = periodInterval(ctx, m);
    const from = Math.max(0, ctx.filters.fromSecond ?? 0, period?.from ?? 0);
    const to = Math.min(duration, ctx.filters.toSecond ?? duration, period?.to ?? duration);
    if (to <= from) return false;
    return needed.every(n => intervalUnion(coverage.filter(c => c.team === n.team && (c.family === '*' || c.family === category || c.family === n.family) && c.state === 'complete').map(c => ({ from: c.from ?? 0, to: c.to ?? duration }))).some(interval => interval.from <= from && interval.to >= to));
  });
}
function finalize(id: string, category: string, ctx: MetricContext, raw: MetricCalculation): MetricResult {
  const families = [...metricFamilies(id), ...(raw.requiredCoverage ?? []).map(c => c.family)];
  const n = Number(id);
  // These recipes attribute their own actions to the actor. Other recipes may depend on
  // a receiver, defender, keeper or the whole team, so their context must remain available.
  const actorOnly = n === 15 || n >= 18 && n <= 23 || n >= 29 && n <= 104 || n >= 114 && n <= 119 || n >= 127 && n <= 171 || n >= 173 && n <= 175;
  const uncertain = ctx.uncertainEvents?.filter(e => (families.includes(kindOf(e)) || families.includes('shot') && kindOf(e) === 'goal' && e.facts.ownGoal !== true || families.includes('pass') && kindOf(e) === 'distribution') &&
    (e.team === ctx.team || raw.requiredCoverage?.some(c => c.team === e.team)) &&
    !(actorOnly && ctx.filters.playerIds?.length && e.actorId && !ctx.filters.playerIds.includes(e.actorId))) ?? [];
  const pending = raw.pending + uncertain.reduce((n, e) => n + (e.quantity ?? 1), 0);
  const covered = completeCoverage(ctx, category, id, raw.requiredCoverage);
  let status = raw.status ?? (pending ? 'partial' : covered ? 'complete' : raw.observed > 0 || (raw.value != null && raw.value !== 0) ? 'partial' : 'unknown');
  if (status === 'complete' && pending) status = 'partial';
  if (status === 'no_sample' && !covered && !raw.observed && !raw.exposureSeconds && id !== 'A11' && id !== 'A12') status = 'unknown';
  if (status === 'partial' && !raw.observed && pending) status = 'unknown';
  if (raw.value == null && status === 'partial') status = 'unknown';
  const value = status === 'unknown' && raw.observed === 0 ? null : raw.value;
  return { id, value, unit: raw.unit ?? 'acciones', status, observed: raw.observed, pending, evidenceEventIds: [...new Set(raw.evidenceEventIds)], ruleId: `piti.${id}`, ruleVersion: 1, parameters: { profile: ctx.profile.id, profileVersion: ctx.profile.version, ...(raw.parameters ?? {}) }, reason: raw.reason ?? (status === 'complete' ? 'Cobertura declarada completa para esta muestra.' : status === 'partial' ? 'Recuento de la muestra observada; hay cobertura incompleta o atributos pendientes.' : status === 'unknown' ? 'Faltan hechos o cobertura suficiente para calcularlo.' : status === 'no_sample' ? 'No hay oportunidades elegibles en la muestra.' : ''), ...(raw.numerator != null ? { numerator: raw.numerator } : {}), ...(raw.denominator != null ? { denominator: raw.denominator } : {}), ...(raw.groups ? { groups: raw.groups } : {}), ...(raw.exposureSeconds != null ? { exposureSeconds: raw.exposureSeconds } : {}) };
}

/** A requested subset still evaluates dependencies (for example a configured rating),
 * but returns only the requested IDs. Omission preserves the full catalogue API. */
export function evaluateNarrated(matches: readonly NarratedMatch[], filters: AnalysisFilters = {}, metricIds?: readonly string[]): MetricResult[] {
  const ctx = prepareNarrated(matches, filters);
  const cache = new Map<string, MetricResult>(), calculating = new Set<string>();
  const calculate = (id: string): MetricResult | undefined => {
    const cached = cache.get(id); if (cached) return cached;
    const metric = NARRATED_METRIC_BY_ID.get(id); if (!metric || calculating.has(id)) return undefined;
    calculating.add(id);
    const recipe = NARRATED_RECIPES[metric.id];
    let raw: MetricCalculation;
    if (metric.audio.viability === 'excluded') raw = missing(metric.audio.condition || 'Requiere medición, seguimiento o un modelo externo; no se calcula desde la narración.', 'not_applicable');
    else if (filters.team === 'opponent' && filters.playerIds?.length) raw = missing('Las fichas seleccionadas pertenecen al Piti. Quita ese filtro para consultar al rival.', 'not_applicable');
    // The match's starters, bench and ledger describe the Piti only. Opponent actions
    // do not establish the rival's roster, substitutions or combinations of seven.
    else if (ctx.team === 'opponent' && (Number(id) >= 1 && Number(id) <= 14 || id === '388' || id === '389')) raw = missing('Faltan la convocatoria y las tandas del rival. La participación del Piti no se atribuye al otro equipo.');
    else if (filters.playerIds?.length && metric.scope.trim().toLowerCase() === 'equipo') raw = missing('Esta métrica describe al equipo completo; quita el filtro de jugadores para consultarla.', 'not_applicable');
    else if (ctx.matches.some((_, i) => profileSignature(ctx, metric.parameterIds, i) !== profileSignature(ctx, metric.parameterIds, 0))) raw = missing('Los partidos usan definiciones o parámetros distintos para esta métrica. Selecciona partidos con el mismo perfil de cálculo.', 'not_configured');
    else if (filters.period != null && ['001','002','003','004','009','010','011','012','013','014','219','220','221','223','224','225','228','276','319','320','321','322','382','383','384','388','392','393','394','395','396','400'].includes(id) && ctx.matches.some(m => !periodInterval(ctx, m))) raw = missing('Falta el límite real de esta parte; no se sustituye por la duración programada.');
    else raw = recipe ? recipe(ctx) : missing('La definición todavía no tiene un cálculo implementado.', 'not_configured');
    const result = finalize(metric.id, metric.category, ctx, raw); cache.set(id, result); calculating.delete(id); return result;
  };
  ctx.evaluateMetric = calculate;
  const ids = metricIds == null ? NARRATED_METRICS.map(metric => metric.id) : [...new Set(metricIds)].filter(id => NARRATED_METRIC_BY_ID.has(id));
  return ids.map(id => calculate(id)!);
}
