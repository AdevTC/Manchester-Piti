/** Deterministic reductions of recorded facts. Missing attributes remain pending, never inferred as failures. */
import {
  and, before, clipIntervals, count, difference, eq, exactTime, hasKnownParticipation, intervalIntersection,
  intervalSeconds, isGoal, isKind, isPass, isShot, kindOf, mean,
  missing, num, numericParameter, opposite, parameter, passComplete, playerIntervals,
  periodInterval, quantity, quotient, ratioOf, sum, withEvents,
} from './operators.js';
import type { MetricCalculation, MetricContext, MetricRecipe, Predicate, PreparedMatch, ScopedObservation } from './operators.js';
import type { AnalysisTeam, Observation, ObservationKind } from './types.js';

type Interval = { from: number; to: number };
const K = (...kinds: ObservationKind[]): Predicate => e => isKind(e, ...kinds);
const attr = (base: Predicate, key: string, value: string | number | boolean): Predicate => e => and(base(e), eq(e, key, value));
const flag = (base: Predicate, key: string): Predicate => attr(base, key, true);
const subtype = (base: Predicate, value: string): Predicate => attr(base, 'subtype', value);
const complete: Predicate = e => e.facts.outcome == null || ['pending', 'unknown'].includes(String(e.facts.outcome)) ? undefined : ['complete', 'completed', 'success', 'won'].includes(String(e.facts.outcome));
const failed: Predicate = e => e.facts.outcome == null || ['pending', 'unknown'].includes(String(e.facts.outcome)) ? undefined : ['failed', 'lost'].includes(String(e.facts.outcome));
const pass = (ctx: MetricContext): Predicate => e => isPass(e, ctx.profile);
const cross: Predicate = subtype(K('pass'), 'cross');
const normalGoal: Predicate = e => isGoal(e) && e.facts.ownGoal !== true && e.facts.shootout !== true;
const shot: Predicate = e => isShot(e) && e.facts.ownGoal !== true && e.facts.shootout !== true;
const onTarget: Predicate = e => {
  if (!shot(e)) return false;
  if (normalGoal(e) || e.facts.outcome === 'saved' || e.facts.goalLineSave === true) return true;
  if (typeof e.facts.onTarget === 'boolean') return e.facts.onTarget;
  if (['off_target', 'blocked', 'woodwork'].includes(String(e.facts.outcome))) return false;
  return undefined;
};
const shotMiss: Predicate = e => and(shot(e), normalGoal(e) ? false : e.facts.outcome != null && !['unknown', 'pending'].includes(String(e.facts.outcome)) ? true : undefined);
const value = (v: number | null, observed = 0, pending = 0, ids: string[] = [], unit = 'acciones'): MetricCalculation => ({ value: v, observed, pending, evidenceEventIds: [...new Set(ids)], unit });
const fullTeam = (ctx: MetricContext, team = ctx.team): MetricContext => ({ ...ctx, team, filters: { ...ctx.filters, playerIds: undefined }, events: ctx.all.filter(e => e.team === team) });
const playerSelected = (ctx: MetricContext, id?: string): boolean => !ctx.filters.playerIds?.length || !!id && ctx.filters.playerIds.includes(id);
const units = (recipe: MetricRecipe, unit: string): MetricRecipe => ctx => ({ ...recipe(ctx), unit });
const configured = (key: string, recipe: MetricRecipe): MetricRecipe => ctx => parameter(ctx, key) == null ? missing(`Configura ${key} antes de calcular esta métrica.`, 'not_configured') : recipe(ctx);
const eventInterval = (e: ScopedObservation): Interval | undefined => {
  const from = num(e, 'intervalStart'), to = num(e, 'intervalEnd');
  return from != null && to != null && from >= 0 && to >= from ? { from, to } : undefined;
};
const eligibleIds = (ctx: MetricContext, m: PreparedMatch): string[] => ctx.filters.playerIds?.length ? ctx.filters.playerIds : [...new Set([...Object.keys(m.match.ledger ?? {}), ...(m.match.starters ?? []), ...(m.match.bench ?? []), ...m.events.filter(e => e.team === ctx.team && isKind(e, 'lineup')).map(e => e.actorId).filter((id): id is string => !!id)])];
function participation(ctx: MetricContext, mode: 'minutes' | 'bench' | 'starts' | 'stints' | 'exits' | 'reentries' | 'mean' | 'max' | 'rest'): MetricCalculation {
  const durations: number[] = [], rests: number[] = []; let seconds = 0, benchmark = 0, starts = 0, exits = 0, reentries = 0, stintCount = 0, pending = 0, players = 0, historicalTotals = 0;
  const ids: string[] = [];
  for (const m of ctx.matches) for (const id of eligibleIds(ctx, m)) {
    const ledger = m.match.ledger?.[id];
    const temporal = ctx.filters.period != null || ctx.filters.fromSecond != null || ctx.filters.toSecond != null;
    const stints = clipIntervals(ctx, playerIntervals(m, id), m.duration, m.match.id);
    const knownLineup = m.match.starters?.includes(id) || m.match.bench?.includes(id) || ledger || m.events.some(e => e.actorId === id && isKind(e, 'lineup'));
    if (!knownLineup) { pending++; continue; }
    if (ledger?.notCalled || m.match.notCalled?.includes(id)) continue;
    // Old official actas can certify total minutes without retaining their stints.
    // Preserve that total; never place those minutes in an invented half or interval.
    if (ledger && !ledger.stints.length && Number.isFinite(ledger.minutes) && ledger.minutes > 0) {
      const wholeMatch = ctx.filters.period == null && ctx.filters.fromSecond == null && ctx.filters.toSecond == null;
      if (mode === 'minutes' && wholeMatch) { seconds += ledger.minutes * 60; players++; historicalTotals++; continue; }
      if (['minutes', 'bench', 'mean', 'max', 'rest'].includes(mode) || temporal && mode === 'stints') { pending++; continue; }
    }
    if ((!hasKnownParticipation(m, id) || !periodInterval(ctx, m)) && (temporal || !['starts', 'stints', 'exits', 'reentries'].includes(mode))) { pending++; continue; }
    const exposure = clipIntervals(ctx, [{ from: 0, to: m.duration }], m.duration, m.match.id);
    const initially = ledger?.started ?? (m.match.starters ? m.match.starters.includes(id) : m.events.some(e => e.actorId === id && isKind(e, 'lineup') && e.facts.started === true));
    const incoming = m.events.filter(e => isKind(e, 'substitution') && (e.facts.inPlayerId === id || e.actorId === id && e.facts.direction === 'in'));
    const outgoing = m.events.filter(e => isKind(e, 'substitution') && e.actorId === id && e.facts.direction !== 'in');
    const entries = ledger?.subIn ?? incoming.length;
    const exitCount = ledger?.subOut ?? outgoing.length;
    const inScope = (second: number) => exposure.some(interval => second >= interval.from && second < interval.to);
    const movements = (direction: 'in' | 'out') => {
      const recorded = ledger?.exchanges?.filter(e => e.direction === direction) ?? [];
      return recorded.length ? recorded.map(e => e.minute * 60) : (direction === 'in' ? incoming : outgoing).map(exactTime);
    };
    let selectedExits = exitCount, selectedReentries = Math.max(0, entries - (initially ? 0 : 1));
    if (temporal && (mode === 'exits' || mode === 'reentries')) {
      const times = movements(mode === 'exits' ? 'out' : 'in');
      const expected = mode === 'exits' ? exitCount : entries;
      // Whole-match counters cannot locate a change in one half. Keep it unknown
      // when its individual timestamps were not retained by a historical acta.
      if (times.length !== expected || times.some(t => t == null || !Number.isFinite(t))) { pending++; continue; }
      const ordered = (times as number[]).sort((a, b) => a - b);
      if (mode === 'exits') selectedExits = ordered.filter(inScope).length;
      else selectedReentries = ordered.filter((t, index) => (initially || index > 0) && inScope(t)).length;
    }
    players++;
    seconds += intervalSeconds(stints);
    const dismissed = m.events.find(e => e.actorId === id && isKind(e, 'discipline') && ['red', 'red_card', 'second_yellow', 'double_yellow'].includes(String(e.facts.subtype)));
    const dismissalTime = dismissed && exactTime(dismissed);
    if (dismissed && dismissalTime == null) pending++;
    else benchmark += intervalSeconds(intervalIntersection(exposure, [{ from: 0, to: dismissalTime ?? m.duration }])) - intervalSeconds(stints);
    starts += initially && (!temporal || inScope(0)) ? 1 : 0;
    stintCount += temporal ? stints.length : ledger?.stints.length ?? entries + (initially ? 1 : 0);
    durations.push(...stints.map(s => s.to - s.from));
    for (let i = 1; i < stints.length; i++) rests.push(stints[i].from - stints[i - 1].to);
    exits += selectedExits;
    reentries += selectedReentries;
    ids.push(...m.events.filter(e => (e.actorId === id || e.facts.inPlayerId === id) && isKind(e, 'lineup', 'substitution', 'discipline') && (!temporal || exactTime(e) != null && inScope(exactTime(e)!))).map(e => e.evidenceId));
    if (m.duration <= 0) pending++;
  }
  if (!players) return { ...missing('Faltan alineación y tandas conocidas para los jugadores seleccionados.'), pending };
  const result = mode === 'minutes' ? seconds / 60 : mode === 'bench' ? Math.max(0, benchmark) / 60 : mode === 'starts' ? starts : mode === 'stints' ? stintCount : mode === 'exits' ? exits : mode === 'reentries' ? reentries : mode === 'mean' ? durations.length ? seconds / durations.length / 60 : null : mode === 'max' ? durations.length ? Math.max(...durations) / 60 : null : rests.length ? rests.reduce((a, b) => a + b, 0) / rests.length / 60 : null;
  return { ...value(result, mode === 'rest' ? rests.length : players, pending, ids, ['starts', 'stints', 'exits', 'reentries'].includes(mode) ? 'veces' : 'min'), exposureSeconds: seconds, ...(result == null ? { status: 'no_sample' as const } : {}), ...(historicalTotals === players && !pending ? { status: 'complete' as const } : {}), reason: historicalTotals ? 'Minutos certificados por el acta histórica, sin inventar la ubicación temporal de las tandas ausentes.' : ctx.filters.playerIds?.length ? 'Tandas conocidas de los jugadores seleccionados.' : 'Suma de participación de jugadores; los minutos son persona-minutos.' };
}
function intervalParticipation(ctx: MetricContext, qualify: Predicate, roleGroups = false): MetricCalculation {
  let total = 0, pending = 0, observed = 0; const ids: string[] = [], groups = new Map<string, number>();
  for (const m of ctx.matches) for (const id of eligibleIds(ctx, m)) {
    if (!hasKnownParticipation(m, id) || !periodInterval(ctx, m)) { pending++; continue; }
    const stints = clipIntervals(ctx, playerIntervals(m, id), m.duration, m.match.id);
    const byGroup = new Map<string, Interval[]>();
    for (const e of m.events.filter(e => (!e.actorId || e.actorId === id) && e.team === ctx.team)) {
      const eligible = qualify(e); if (eligible === false) continue;
      const interval = eventInterval(e);
      if (eligible == null || !interval) { pending++; continue; }
      const key = roleGroups ? String(e.facts.role ?? 'unknown') : 'all';
      byGroup.set(key, [...(byGroup.get(key) ?? []), interval]); ids.push(e.evidenceId); observed++;
    }
    for (const [key, intervals] of byGroup) {
      const n = intervalSeconds(intervalIntersection(stints, intervals)) / 60;
      total += n; groups.set(key, (groups.get(key) ?? 0) + n);
    }
  }
  if (!observed) return { ...missing('Faltan intervalos de partido y presencia para esta condición.'), pending };
  return { ...value(total, observed, pending, ids, 'min'), ...(roleGroups ? { groups: [...groups].map(([key, v]) => ({ key, value: v })) } : {}) };
}
const goalTeam = (e: ScopedObservation): AnalysisTeam => e.facts.ownGoal === true ? opposite(e.team) : e.team;
function goals(ctx: MetricContext, target: AnalysisTeam, playerCredit = true): MetricCalculation {
  return count(withEvents(ctx, ctx.all), e => isGoal(e) && e.facts.shootout !== true && goalTeam(e) === target && (!playerCredit || !ctx.filters.playerIds?.length || e.facts.ownGoal !== true && playerSelected(ctx, e.actorId)), 'goal');
}
function scoreMoment(ctx: MetricContext, mode: 'opening' | 'equalizing' | 'lead' | 'winner'): MetricCalculation {
  let n = 0, pending = 0; const ids: string[] = [];
  const included = new Set(ctx.all.map(e => e.evidenceId));
  for (const m of ctx.matches) {
    const list = m.events.filter(e => isGoal(e) && e.facts.shootout !== true).sort((a, b) => a.order - b.order);
    const finalAgainst = list.filter(e => goalTeam(e) !== ctx.team).reduce((s, e) => s + quantity(e), 0);
    const finalFor = list.filter(e => goalTeam(e) === ctx.team).reduce((s, e) => s + quantity(e), 0);
    let own = 0, rival = 0;
    for (const [index, e] of list.entries()) {
      if (quantity(e) !== 1 || (index && list[index - 1].order === e.order)) { pending++; continue; }
      const beforeOwn = own, beforeRival = rival;
      if (goalTeam(e) === ctx.team) own++; else rival++;
      if (!included.has(e.evidenceId) || goalTeam(e) !== ctx.team || e.facts.ownGoal === true && ctx.filters.playerIds?.length || !playerSelected(ctx, e.actorId)) continue;
      if (mode === 'opening' && index === 0 || mode === 'equalizing' && beforeOwn < beforeRival && own === rival || mode === 'lead' && beforeOwn === beforeRival && own > rival || mode === 'winner' && finalFor > finalAgainst && own === finalAgainst + 1) { n++; ids.push(e.evidenceId); }
    }
  }
  return value(n, n, pending, ids, 'goles');
}
type Relation = 'shot' | 'pass' | 'followup' | 'cause';
interface IndexedObservation { event: ScopedObservation; position: number }
interface RelationIndex {
  byId: Map<string, IndexedObservation[]>;
  incoming: Map<Relation, Map<string, IndexedObservation[]>>;
}
const relationIndexes = new WeakMap<readonly ScopedObservation[], Map<string, RelationIndex>>();
function relationsFor(events: readonly ScopedObservation[], matchId: string): RelationIndex | undefined {
  let matches = relationIndexes.get(events);
  if (!matches) {
    matches = new Map();
    const append = (map: Map<string, IndexedObservation[]>, key: string, entry: IndexedObservation) => {
      const entries = map.get(key);
      if (entries) entries.push(entry); else map.set(key, [entry]);
    };
    events.forEach((event, position) => {
      let index = matches!.get(event.matchId);
      if (!index) { index = { byId: new Map(), incoming: new Map() }; matches!.set(event.matchId, index); }
      const entry = { event, position };
      append(index.byId, event.id, entry);
      for (const relation of ['shot', 'pass', 'followup', 'cause'] as const) {
        const linked = event.links?.[relation]; if (!linked) continue;
        let incoming = index.incoming.get(relation);
        if (!incoming) { incoming = new Map(); index.incoming.set(relation, incoming); }
        append(incoming, linked, entry);
      }
    });
    relationIndexes.set(events, matches);
  }
  return matches.get(matchId);
}
function related(ctx: MetricContext, e: ScopedObservation, target: Predicate, relation: Relation = 'shot'): ScopedObservation[] {
  const events = ctx.matches.find(m => m.match.id === e.matchId)?.events ?? ctx.all;
  const index = relationsFor(events, e.matchId); if (!index) return [];
  const candidates = new Map<number, ScopedObservation>();
  const add = (entries?: IndexedObservation[]) => { for (const entry of entries ?? []) candidates.set(entry.position, entry.event); };
  const direct = e.links?.[relation]; if (direct) add(index.byId.get(direct));
  add(index.incoming.get(relation === 'shot' ? 'pass' : relation)?.get(e.id));
  add(index.incoming.get('cause')?.get(e.id));
  return [...candidates].sort(([a], [b]) => a - b).map(([, event]) => event).filter(event => target(event) === true);
}
function leadsTo(ctx: MetricContext, e: ScopedObservation, target: Predicate): boolean | undefined {
  if (related(ctx, e, target).length) return true;
  return e.facts.phaseClosed === true ? false : undefined;
}
function assists(ctx: MetricContext, depth = 1): MetricCalculation {
  if (parameter(ctx, 'assistPolicy') == null) return missing('Configura el criterio de asistencia.', 'not_configured');
  const credited = new Map<string, ScopedObservation>(); let pending = 0;
  const goals = ctx.all.filter(e => e.team === ctx.team && normalGoal(e));
  const reviewed = depth === 1 && goals.every(goal => goal.facts.assistReviewed === true);
  for (const goal of goals) {
    // An explicitly reviewed assist in a historical acta is already a fact; do not fabricate a pass.
    if (depth === 1 && goal.facts.assistReviewed === true) {
      if (typeof goal.facts.assistPlayerId === 'string' && playerSelected(ctx, goal.facts.assistPlayerId)) credited.set(`${goal.matchId}:${goal.id}:${depth}`, goal);
      continue;
    }
    let previous = goal; let last: ScopedObservation | undefined;
    for (let step = 0; step < depth; step++) {
      const candidates = (ctx.matches.find(m => m.match.id === goal.matchId)?.events ?? ctx.all).filter(e => e.matchId === goal.matchId && e.team === goal.team && isPass(e, ctx.profile) && (previous.links?.pass === e.id || step === 0 && e.links?.shot === goal.id));
      last = candidates.length === 1 ? candidates[0] : undefined;
      if (!last || passComplete(last, ctx.profile) !== true || last.facts.continuity !== true || last.facts.deflected === true || last.facts.rebound === true || last.receiverId !== previous.actorId) { last = undefined; break; }
      previous = last;
    }
    if (last && playerSelected(ctx, last.actorId)) credited.set(`${goal.matchId}:${goal.id}:${depth}`, last);
    else if (goal.facts.assistReviewed !== true) pending++;
  }
  return {
    ...value(credited.size, credited.size, pending, [...credited.values()].map(e => e.evidenceId), 'asistencias'),
    // Reviewing every goal (including «sin asistencia») resolves the direct attribution.
    // Unknown passes or unrelated shots cannot undo those decisions; goal coverage still
    // prevents an incomplete list of goals from being certified as a complete total.
    ...(reviewed ? { requiredCoverage: [{ family: 'goal', team: ctx.team }] } : {}),
  };
}
function creation(ctx: MetricContext, goalOnly: boolean): MetricCalculation {
  const taxonomy = parameter(ctx, 'scaEligibleKinds'), phasePolicy = parameter(ctx, 'scaPhasePolicy');
  if (!Array.isArray(taxonomy) || !phasePolicy) return missing('Configura taxonomía de acciones elegibles y cierre de fase para SCA/GCA.', 'not_configured');
  let n = 0, pending = 0; const ids: string[] = [];
  for (const target of ctx.all.filter(e => e.team === ctx.team && (goalOnly ? normalGoal(e) : shot(e)))) {
    if (!target.links?.chain || target.facts.chainComplete !== true) { pending++; continue; }
    const eligible = ctx.all.filter(e => e.matchId === target.matchId && e.team === target.team && e.links?.chain === target.links?.chain && e.order < target.order && taxonomy.includes(kindOf(e)) && e.facts.eligibleCreation === true).sort((a, b) => b.order - a.order).slice(0, 2);
    for (const e of eligible) if (playerSelected(ctx, e.actorId)) { n++; ids.push(e.evidenceId, target.evidenceId); }
  }
  return value(n, n, pending, ids);
}
function unique(ctx: MetricContext, predicate: Predicate, key: (e: ScopedObservation) => string | undefined): MetricCalculation {
  const groups = new Map<string, ScopedObservation>(); let pending = 0;
  for (const e of ctx.events) {
    const eligible = predicate(e); if (eligible === false) continue;
    const identity = key(e); if (!eligible || !identity) { pending += quantity(e); continue; }
    groups.set(`${e.matchId}:${identity}`, e);
  }
  return value(groups.size, groups.size, pending, [...groups.values()].map(e => e.evidenceId));
}
function interventions(ctx: MetricContext, inArea = false): MetricCalculation {
  const contacts: ScopedObservation[] = [];
  for (const e of ctx.all.filter(e => e.team === ctx.team)) {
    const certainContact = e.facts.intervention === true || e.facts.intervention !== false && isKind(e, 'pass', 'reception', 'carry', 'shot', 'goal', 'distribution', 'clearance', 'interception', 'save');
    if (certainContact && playerSelected(ctx, e.actorId)) contacts.push(e);
    // A known completed delivery to B certifies B's reception even when there is no separate event.
    if (isPass(e, ctx.profile) && passComplete(e, ctx.profile) === true && e.receiverId && playerSelected(ctx, e.receiverId)) {
      const facts: Observation['facts'] = { ...e.facts, intervention: true };
      delete facts.interventionId; delete facts.zone;
      if (typeof e.facts.destinationZone === 'string') facts.zone = e.facts.destinationZone;
      contacts.push({ ...e, actorId: e.receiverId, kind: 'reception', links: { ...e.links, pass: e.id }, facts });
    }
  }
  return unique(withEvents(ctx, contacts), e => inArea ? eq(e, 'zone', 'opponent_area') : true,
    e => typeof e.facts.interventionId === 'string' ? e.facts.interventionId : `${e.links?.action ?? (isKind(e, 'reception') ? e.links?.pass : undefined) ?? e.id}:${e.actorId ?? 'team'}`);
}
function receiverContext(ctx: MetricContext, intended: boolean): MetricContext {
  return withEvents(ctx, ctx.all.filter(e => e.team === ctx.team && isPass(e, ctx.profile) && playerSelected(ctx, intended ? e.intendedReceiverId : e.receiverId)));
}
function retention(ctx: MetricContext, base: Predicate): MetricCalculation {
  const window = numericParameter(ctx, 'retentionSeconds');
  if (window == null || window <= 0 || parameter(ctx, 'retentionEndPolicy') == null) return missing('Configura duración y tratamiento de interrupción, tiro y final para retención continua.', 'not_configured');
  return ratioOf(ctx, e => {
    const start = exactTime(e); if (start == null) return undefined;
    const intervals = ctx.all.filter(c => c.matchId === e.matchId && isKind(c, 'control') && c.controlAfter === ctx.team).map(eventInterval).filter((i): i is Interval => !!i);
    if (intervalSeconds(intervalIntersection(intervals, [{ from: start, to: start + window }])) >= window) return true;
    const loss = ctx.all.find(c => c.matchId === e.matchId && isKind(c, 'control') && c.controlAfter != null && c.controlAfter !== 'unknown' && c.controlAfter !== ctx.team && exactTime(c) != null && exactTime(c)! >= start && exactTime(c)! < start + window);
    return loss ? false : undefined;
  }, base, 'reception');
}
function nextActionTime(ctx: MetricContext): MetricCalculation {
  return units(c => mean(c, K('reception'), e => {
    const next = c.all.filter(x => x.matchId === e.matchId && x.actorId === e.actorId && x.order > e.order && isKind(x, 'pass', 'shot', 'goal', 'carry', 'loss') && x.links?.cause === e.id).sort((a, b) => a.order - b.order)[0];
    const a = exactTime(e), b = next && exactTime(next);
    return a != null && b != null && b >= a ? b - a : undefined;
  }, 'reception'), 's')(ctx);
}
const duel: Predicate = K('duel');
function duelContext(ctx: MetricContext): MetricContext {
  const seen = new Set<string>();
  return withEvents(ctx, ctx.events.filter(e => {
    if (!duel(e)) return true;
    const key = `${e.matchId}:${e.links?.duel ?? e.id}`;
    if (seen.has(key)) return false; seen.add(key); return true;
  }));
}
const duelCount = (predicate: Predicate): MetricRecipe => ctx => count(duelContext(ctx), predicate, 'duel');
const duelRatio = (denominator: Predicate): MetricRecipe => ctx => ratioOf(duelContext(ctx), complete, denominator, 'duel');
function durationOf(ctx: MetricContext, predicate: Predicate): MetricCalculation {
  let seconds = 0, pending = 0, observed = 0; const ids: string[] = [];
  for (const m of ctx.matches) {
    const intervals = new Map<string, Interval[]>();
    for (const e of ctx.events.filter(e => e.matchId === m.match.id)) {
      const eligible = predicate(e); if (eligible === false) continue;
      const interval = eventInterval(e); if (!eligible || !interval) { pending += quantity(e); continue; }
      const key = ctx.filters.playerIds?.length ? e.actorId ?? 'unknown' : 'team';
      intervals.set(key, [...(intervals.get(key) ?? []), interval]); ids.push(e.evidenceId); observed++;
    }
    for (const group of intervals.values()) seconds += intervalSeconds(clipIntervals(ctx, group, m.duration, m.match.id));
  }
  return { ...value(observed ? seconds : null, observed, pending, ids, 's'), ...(observed ? {} : { status: 'unknown' as const, reason: 'No hay intervalos completos registrados.' }) };
}
function defensiveExposure(ctx: MetricContext): MetricCalculation {
  let seconds = 0, observed = 0, pending = 0; const ids: string[] = [];
  for (const m of ctx.matches) {
    const intervals: Interval[] = [];
    for (const e of m.events.filter(e => isKind(e, 'control') && e.controlAfter === opposite(ctx.team))) {
      const span = eventInterval(e); if (!span) { pending++; continue; }
      intervals.push(span); ids.push(e.evidenceId); observed++;
    }
    const exposure = ctx.filters.playerIds?.length ? ctx.filters.playerIds.flatMap(id => playerIntervals(m, id)) : [{ from: 0, to: m.duration }];
    seconds += intervalSeconds(clipIntervals(ctx, intervalIntersection(intervals, exposure), m.duration, m.match.id));
  }
  return value(observed ? seconds / 60 : null, observed, pending, ids, 'min');
}
function pressureRecovery(ctx: MetricContext, e: ScopedObservation): boolean | undefined {
  const window = numericParameter(ctx, 'pressureRecoverySeconds'); if (window == null) return undefined;
  const candidates = ctx.all.filter(r => r.matchId === e.matchId && r.team === ctx.team && isKind(r, 'recovery') && r.links?.cause === e.id && r.facts.continuity === true);
  if (candidates.some(r => before(e, r, window) === true)) return true;
  return e.facts.followupComplete === true ? false : undefined;
}
function pressureOutcome(ctx: MetricContext, key: string, target: Predicate): MetricCalculation {
  return count(ctx, e => {
    if (!isKind(e, 'pressure')) return false;
    const declared = eq(e, key, true); if (!declared) return declared;
    return related(ctx, e, target, 'followup').length ? true : undefined;
  }, 'pressure');
}

export const recipes001_200: Record<string, MetricRecipe> = {
  '001': ctx => participation(ctx, 'minutes'),
  '002': ctx => {
    const played = participation(ctx, 'minutes');
    const duration = ctx.matches.reduce((total, m) => total + intervalSeconds(clipIntervals(ctx, [{ from: 0, to: m.duration }], m.duration, m.match.id)) / 60 * eligibleIds(ctx, m).filter(id => !m.match.notCalled?.includes(id) && !m.match.ledger?.[id]?.notCalled).length, 0);
    return quotient(played, value(duration, ctx.matches.length), 100, '%');
  },
  '003': ctx => intervalParticipation(ctx, flag(K('context', 'control'), 'inPlay')),
  '004': ctx => participation(ctx, 'bench'),
  '005': ctx => participation(ctx, 'starts'),
  '006': ctx => participation(ctx, 'stints'),
  '007': ctx => participation(ctx, 'exits'),
  '008': ctx => participation(ctx, 'reentries'),
  '009': ctx => participation(ctx, 'mean'),
  '010': ctx => participation(ctx, 'max'),
  '011': ctx => participation(ctx, 'rest'),
  '012': ctx => intervalParticipation(ctx, e => isKind(e, 'lineup', 'context') && e.facts.role != null, true),
  '013': ctx => intervalParticipation(ctx, e => isKind(e, 'lineup', 'context') ? num(e, 'ownCount') == null || num(e, 'opponentCount') == null ? undefined : num(e, 'ownCount')! > num(e, 'opponentCount')! : false),
  '014': ctx => intervalParticipation(ctx, e => isKind(e, 'lineup', 'context') ? num(e, 'ownCount') == null || num(e, 'opponentCount') == null ? undefined : num(e, 'ownCount')! < num(e, 'opponentCount')! : false),
  '015': ctx => goals(ctx, ctx.team),
  '016': ctx => goals(ctx, opposite(ctx.team), false),
  '017': ctx => difference(goals(ctx, ctx.team, false), goals(ctx, opposite(ctx.team), false)),
  '018': ctx => count(ctx, e => and(normalGoal(e), eq(e, 'penalty', false)), 'goal'),
  '019': ctx => count(ctx, flag(normalGoal, 'penalty'), 'goal'),
  '020': ctx => count(ctx, attr(normalGoal, 'bodyPart', 'head'), 'goal'),
  '021': ctx => count(ctx, attr(normalGoal, 'bodyPart', 'right'), 'goal'),
  '022': ctx => count(ctx, attr(normalGoal, 'bodyPart', 'left'), 'goal'),
  '023': ctx => count(ctx, flag(isGoal, 'ownGoal'), 'goal'),
  '024': ctx => scoreMoment(ctx, 'opening'),
  '025': ctx => scoreMoment(ctx, 'equalizing'),
  '026': ctx => scoreMoment(ctx, 'lead'),
  '027': ctx => scoreMoment(ctx, 'winner'),
  '028': ctx => {
    const g = count(ctx, normalGoal, 'goal'), a = assists(ctx);
    return { ...value(g.value == null || a.value == null ? null : g.value + a.value, g.observed + a.observed, g.pending + a.pending, [...g.evidenceEventIds, ...a.evidenceEventIds]), reason: 'Participaciones de jugadores; no equivale al número de goles del equipo.' };
  },
  '029': ctx => count(ctx, shot, 'shot'),
  '030': ctx => count(ctx, onTarget, 'shot'),
  '031': ctx => count(ctx, attr(shot, 'outcome', 'off_target'), 'shot'),
  '032': ctx => count(ctx, e => and(shot(e), e.facts.goalLineSave === true ? false : eq(e, 'outcome', 'blocked')), 'shot'),
  '033': ctx => count(ctx, e => and(shot(e), e.facts.outcome === 'woodwork' ? true : eq(e, 'woodwork', true)), 'shot'),
  '034': ctx => ratioOf(ctx, onTarget, shot, 'shot'),
  '035': ctx => ratioOf(ctx, e => normalGoal(e) ? true : shotMiss(e) ? false : undefined, shot, 'shot'),
  '036': ctx => ratioOf(ctx, e => normalGoal(e) ? true : e.facts.outcome === 'saved' || e.facts.goalLineSave === true ? false : undefined, onTarget, 'shot'),
  '037': ctx => count(ctx, attr(shot, 'zone', 'opponent_area'), 'shot'),
  '038': ctx => count(ctx, e => and(shot(e), e.facts.zone == null ? undefined : e.facts.zone !== 'opponent_area'), 'shot'),
  '039': ctx => count(ctx, attr(shot, 'bodyPart', 'head'), 'shot'),
  '040': ctx => count(ctx, attr(shot, 'bodyPart', 'right'), 'shot'),
  '041': ctx => count(ctx, attr(shot, 'bodyPart', 'left'), 'shot'),
  '042': ctx => count(ctx, flag(shot, 'firstTouch'), 'shot'),
  '043': ctx => count(ctx, e => shot(e) ? related(ctx, e, c => isKind(c, 'carry') && c.actorId === e.actorId, 'cause').length ? true : eq(e, 'afterCarry', true) : false, 'shot'),
  '044': ctx => count(ctx, attr(shot, 'phase', 'counterattack'), 'shot'),
  '045': ctx => count(ctx, attr(shot, 'phase', 'positional'), 'shot'),
  '046': ctx => count(ctx, flag(shot, 'bigChance'), 'shot'),
  '047': ctx => count(ctx, e => and(shotMiss(e), eq(e, 'bigChance', true)), 'shot'),
  '067': ctx => count(ctx, pass(ctx), 'pass'),
  '068': ctx => count(ctx, e => and(isPass(e, ctx.profile), passComplete(e, ctx.profile)), 'pass'),
  '069': ctx => count(ctx, e => and(isPass(e, ctx.profile), passComplete(e, ctx.profile) == null ? undefined : !passComplete(e, ctx.profile)), 'pass'),
  '070': ctx => ratioOf(ctx, e => passComplete(e, ctx.profile), pass(ctx), 'pass'),
  '071': ctx => count(ctx, attr(pass(ctx), 'distanceBand', 'short'), 'pass'),
  '072': ctx => count(ctx, attr(pass(ctx), 'distanceBand', 'medium'), 'pass'),
  '073': ctx => count(ctx, attr(pass(ctx), 'distanceBand', 'long'), 'pass'),
  '074': ctx => ratioOf(ctx, e => passComplete(e, ctx.profile), attr(pass(ctx), 'distanceBand', 'short'), 'pass'),
  '075': ctx => ratioOf(ctx, e => passComplete(e, ctx.profile), attr(pass(ctx), 'distanceBand', 'medium'), 'pass'),
  '076': ctx => ratioOf(ctx, e => passComplete(e, ctx.profile), attr(pass(ctx), 'distanceBand', 'long'), 'pass'),
  '077': ctx => ratioOf(ctx, e => eq(e, 'distanceBand', 'long'), pass(ctx), 'pass'),
  '078': ctx => count(ctx, attr(pass(ctx), 'height', 'ground'), 'pass'),
  '079': ctx => count(ctx, attr(pass(ctx), 'height', 'high'), 'pass'),
  '080': ctx => count(ctx, attr(pass(ctx), 'bodyPart', 'head'), 'pass'),
  '081': ctx => count(ctx, flag(pass(ctx), 'firstTouch'), 'pass'),
  '082': ctx => count(ctx, flag(pass(ctx), 'weakFoot'), 'pass'),
  '083': ctx => count(ctx, flag(pass(ctx), 'underPressure'), 'pass'),
  '084': ctx => ratioOf(ctx, e => passComplete(e, ctx.profile), flag(pass(ctx), 'underPressure'), 'pass'),
  '087': ctx => count(ctx, attr(pass(ctx), 'direction', 'forward'), 'pass'),
  '088': ctx => count(ctx, attr(pass(ctx), 'direction', 'backward'), 'pass'),
  '089': ctx => count(ctx, attr(pass(ctx), 'direction', 'lateral'), 'pass'),
  '090': ctx => count(ctx, flag(pass(ctx), 'intendedReceiverGoalkeeper'), 'pass'),
  '091': ctx => ratioOf(ctx, e => eq(e, 'direction', 'forward'), pass(ctx), 'pass'),
  '092': ctx => count(ctx, flag(pass(ctx), 'progressive'), 'pass'),
  '093': ctx => ratioOf(ctx, e => passComplete(e, ctx.profile), flag(pass(ctx), 'progressive'), 'pass'),
  '095': ctx => count(ctx, e => and(isPass(e, ctx.profile), passComplete(e, ctx.profile), eq(e, 'exitsOwnThird', true)), 'pass'),
  '096': ctx => count(ctx, e => and(isPass(e, ctx.profile), passComplete(e, ctx.profile), eq(e, 'entersFinalThird', true)), 'pass'),
  '097': ctx => count(ctx, e => and(isPass(e, ctx.profile), passComplete(e, ctx.profile), eq(e, 'entersArea', true)), 'pass'),
  '098': configured('deepPassCriterion', ctx => count(ctx, e => and(isPass(e, ctx.profile), passComplete(e, ctx.profile), eq(e, 'deepPass', true)), 'pass')),
  '099': ctx => count(ctx, flag(pass(ctx), 'behindDefence'), 'pass'),
  '100': ctx => count(ctx, e => and(isPass(e, ctx.profile), passComplete(e, ctx.profile), eq(e, 'breaksLine', true)), 'pass'),
  '101': ctx => sum(ctx, pass(ctx), e => num(e, 'opponentsBypassed'), 'pass'),
  '102': ctx => count(ctx, flag(pass(ctx), 'switchOfPlay'), 'pass'),
  '103': ctx => count(ctx, flag(pass(ctx), 'halfspace'), 'pass'),
  '104': configured('wallSeconds', ctx => count(ctx, e => {
    if (!isPass(e, ctx.profile)) return false;
    const actor = (p: ScopedObservation) => p.team === 'us' ? p.actorId : p.opponentId;
    const receiver = (p: ScopedObservation) => p.team === 'us' ? p.receiverId : typeof p.facts.opponentReceiverId === 'string' ? p.facts.opponentReceiverId : undefined;
    if (!actor(e) || !receiver(e)) return undefined;
    const candidates = ctx.all.filter(p => p.matchId === e.matchId && p.team === e.team && isPass(p, ctx.profile) && p.links?.pass === e.id);
    const returns = candidates.filter(p => actor(p) === receiver(e) && receiver(p) === actor(e) && p.facts.continuity === true && passComplete(p, ctx.profile) === true);
    if (!returns.length && candidates.some(p => !actor(p) || !receiver(p))) return undefined;
    if (!returns.length) return e.facts.phaseClosed === true ? false : undefined;
    return and(passComplete(e, ctx.profile), before(e, returns[0], numericParameter(ctx, 'wallSeconds') ?? 0));
  }, 'pass')),
  '105': ctx => assists(ctx),
  '106': ctx => count(ctx, e => and(isPass(e, ctx.profile), passComplete(e, ctx.profile), eq(e, 'continuity', true), leadsTo(ctx, e, shot)), 'pass'),
  '107': configured('bigChanceCriterion', ctx => count(ctx, e => and(isPass(e, ctx.profile), passComplete(e, ctx.profile), eq(e, 'continuity', true), leadsTo(ctx, e, flag(shot, 'bigChance'))), 'pass')),
  '108': ctx => assists(ctx, 2),
  '109': ctx => assists(ctx, 3),
  '110': ctx => creation(ctx, false),
  '111': ctx => creation(ctx, true),
  '114': ctx => count(ctx, cross, 'pass'),
  '115': ctx => count(ctx, e => and(cross(e), passComplete(e, ctx.profile)), 'pass'),
  '116': ctx => ratioOf(ctx, e => passComplete(e, ctx.profile), cross, 'pass'),
  '117': ctx => count(ctx, flag(cross, 'blocked'), 'pass'),
  '118': ctx => count(ctx, flag(pass(ctx), 'cutback'), 'pass'),
  '119': ctx => count(ctx, e => { const eligible = cross(e); return eligible === false ? false : and(eligible, leadsTo(ctx, e, shot)); }, 'pass'),
  '121': ctx => interventions(ctx),
  '122': ctx => interventions(ctx, true),
  '123': ctx => quotient(recipes001_200['121'](ctx), recipes001_200['121'](fullTeam(ctx)), 100, '%'),
  '124': ctx => count(receiverContext(ctx, true), pass(ctx), 'pass'),
  '125': ctx => count(receiverContext(ctx, false), e => and(isPass(e, ctx.profile), passComplete(e, ctx.profile)), 'pass'),
  '126': ctx => ratioOf(receiverContext(ctx, true), e => and(passComplete(e, ctx.profile), e.intendedReceiverId == null || e.receiverId == null ? undefined : e.intendedReceiverId === e.receiverId), pass(ctx), 'pass'),
  '127': ctx => count(ctx, flag(K('reception'), 'betweenLines'), 'reception'),
  '128': ctx => count(ctx, flag(K('reception'), 'behindDefence'), 'reception'),
  '129': ctx => count(ctx, flag(K('reception'), 'underPressure'), 'reception'),
  '130': ctx => count(ctx, flag(K('reception'), 'freeSpace'), 'reception'),
  '132': ctx => count(ctx, flag(K('reception'), 'miscontrol'), 'reception'),
  '133': ctx => retention(ctx, K('reception')),
  '134': nextActionTime,
  '135': ctx => count(ctx, K('dribble'), 'dribble'),
  '136': ctx => count(ctx, e => and(isKind(e, 'dribble'), complete(e)), 'dribble'),
  '137': ctx => count(ctx, e => and(isKind(e, 'dribble'), failed(e)), 'dribble'),
  '138': ctx => ratioOf(ctx, complete, K('dribble'), 'dribble'),
  '139': ctx => sum(ctx, K('dribble'), e => num(e, 'opponentsBypassed'), 'dribble'),
  '140': ctx => count(ctx, K('carry'), 'carry'),
  '143': ctx => count(ctx, flag(K('carry'), 'progressive'), 'carry'),
  '145': ctx => count(ctx, flag(K('carry'), 'entersFinalThird'), 'carry'),
  '146': ctx => count(ctx, flag(K('carry'), 'entersArea'), 'carry'),
  '147': ctx => count(ctx, e => isKind(e, 'carry') ? leadsTo(ctx, e, s => and(shot(s), s.actorId === e.actorId)) : false, 'carry'),
  '148': ctx => count(ctx, e => isKind(e, 'carry') ? and(eq(e, 'createsShot', true), leadsTo(ctx, e, s => and(shot(s), s.actorId != null && s.actorId !== e.actorId))) : false, 'carry'),
  '149': ctx => count(ctx, e => isKind(e, 'loss') ? related(ctx, e, K('carry'), 'cause').length ? true : eq(e, 'duringCarry', true) : false, 'loss'),
  '150': ctx => count(ctx, e => and(isKind(e, 'discipline'), eq(e, 'subtype', 'foul_received'), eq(e, 'duringDribble', true)), 'discipline'),
  '151': duelCount(duel),
  '152': duelCount(e => and(duel(e), complete(e))),
  '153': duelCount(e => and(duel(e), failed(e))),
  '154': duelRatio(duel),
  '155': duelCount(attr(duel, 'role', 'offensive')),
  '156': duelRatio(attr(duel, 'role', 'offensive')),
  '157': duelCount(attr(duel, 'role', 'defensive')),
  '158': duelRatio(attr(duel, 'role', 'defensive')),
  '159': duelCount(flag(duel, 'aerial')),
  '160': duelCount(e => and(duel(e), eq(e, 'aerial', true), complete(e))),
  '161': duelRatio(flag(duel, 'aerial')),
  '162': duelCount(flag(duel, 'looseBall')),
  '163': ctx => unique(ctx, e => and(isKind(e, 'duel', 'recovery'), eq(e, 'secondBall', true), complete(e)), e => e.links?.duel ?? e.links?.action ?? e.id),
  '164': ctx => count(ctx, e => and(isKind(e, 'duel'), eq(e, 'shielding', true), complete(e)), 'duel'),
  '165': ctx => count(ctx, K('tackle'), 'tackle'),
  '166': ctx => count(ctx, e => and(isKind(e, 'tackle'), e.controlAfter === ctx.team ? true : e.controlAfter == null || e.controlAfter === 'unknown' || e.controlAfter === 'disputed' ? undefined : false), 'tackle'),
  '167': ctx => ratioOf(ctx, e => e.controlAfter === ctx.team ? true : e.controlAfter == null || e.controlAfter === 'unknown' || e.controlAfter === 'disputed' ? undefined : false, K('tackle'), 'tackle'),
  '168': ctx => count(ctx, flag(K('tackle'), 'sliding'), 'tackle'),
  '169': ctx => count(ctx, K('interception'), 'interception'),
  '170': ctx => count(ctx, subtype(K('block'), 'pass'), 'block'),
  '171': ctx => count(ctx, e => and(isKind(e, 'block'), eq(e, 'subtype', 'shot'), e.facts.goalLineSave === true ? false : true), 'block'),
  '172': ctx => ({ ...quotient(count(ctx, subtype(K('block'), 'shot'), 'block'), count(fullTeam(ctx, opposite(ctx.team)), shot, 'shot'), 100, '%'), requiredCoverage: [{ family: 'block', team: ctx.team }, { family: 'shot', team: opposite(ctx.team) }] }),
  '173': ctx => count(ctx, K('clearance'), 'clearance'),
  '174': ctx => count(ctx, attr(K('clearance'), 'bodyPart', 'head'), 'clearance'),
  '175': ctx => count(ctx, flag(K('block'), 'goalLineSave'), 'block'),
  '176': ctx => count(withEvents(ctx, ctx.all.filter(e => e.team !== ctx.team)), e => and(isKind(e, 'dribble'), complete(e), !ctx.filters.playerIds?.length ? true : typeof e.facts.defenderId === 'string' ? playerSelected(ctx, e.facts.defenderId) : undefined), 'dribble'),
  '177': configured('containmentCriterion', ctx => ratioOf(duelContext(ctx), e => and(eq(e, 'contained', true), eq(e, 'foul', false)), flag(attr(duel, 'role', 'defensive'), 'oneOnOne'), 'duel')),
  '178': ctx => count(ctx, e => isKind(e, 'judgement') ? and(eq(e, 'subtype', 'error'), leadsTo(ctx, e, shot)) : false, 'judgement'),
  '179': ctx => count(ctx, e => isKind(e, 'judgement') ? and(eq(e, 'subtype', 'error'), leadsTo(ctx, e, normalGoal)) : false, 'judgement'),
  '180': configured('defensiveCoverCriterion', ctx => count(ctx, e => and(isKind(e, 'tactical', 'judgement'), eq(e, 'subtype', 'defensive_cover'), complete(e)), 'tactical')),
  '182': configured('defensiveActionKinds', ctx => {
    const kinds = parameter(ctx, 'defensiveActionKinds');
    if (!Array.isArray(kinds)) return missing('Selecciona las acciones defensivas elegibles.', 'not_configured');
    return { ...quotient(count(ctx, e => kinds.includes(kindOf(e))), defensiveExposure(ctx), ctx.profile.baseMinutes, `acciones/${ctx.profile.baseMinutes} min de posesión rival`), reason: 'Acciones durante exposición a control rival registrado; no usa posesión global del partido.' };
  }),
  '183': ctx => count(ctx, K('pressure'), 'pressure'),
  '184': ctx => durationOf(ctx, K('pressure')),
  '185': configured('pressureRecoverySeconds', ctx => count(ctx, e => and(isKind(e, 'pressure'), pressureRecovery(ctx, e)), 'pressure')),
  '186': configured('pressureRecoverySeconds', ctx => ratioOf(ctx, e => pressureRecovery(ctx, e), K('pressure'), 'pressure')),
  '187': ctx => pressureOutcome(ctx, 'forcesBackwardPass', attr(K('pass'), 'direction', 'backward')),
  '188': ctx => pressureOutcome(ctx, 'forcesError', subtype(K('judgement'), 'error')),
  '189': configured('reactionSeconds', ctx => ({ ...ratioOf(fullTeam(ctx, opposite(ctx.team)), e => {
    const p = ctx.all.find(p => p.matchId === e.matchId && p.team === ctx.team && isKind(p, 'pressure') && p.links?.cause === e.id);
    return p ? before(e, p, numericParameter(ctx, 'reactionSeconds') ?? 0) : e.facts.followupComplete === true ? false : undefined;
  }, K('reception'), 'reception'), requiredCoverage: [{ family: 'pressure', team: ctx.team }, { family: 'reception', team: opposite(ctx.team) }] })),
  '190': configured('ppdaZone', configured('ppdaActionKinds', ctx => {
    const zone = parameter(ctx, 'ppdaZone'), kinds = parameter(ctx, 'ppdaActionKinds');
    if (typeof zone !== 'string' || !Array.isArray(kinds)) return missing('Configura zona y acciones PPDA.', 'not_configured');
    return { ...quotient(count(fullTeam(ctx, opposite(ctx.team)), attr(pass(ctx), 'zone', zone), 'pass'), count(ctx, e => and(kinds.includes(kindOf(e)), eq(e, 'zone', zone))), 1, 'pases/acción defensiva'), requiredCoverage: [{ family: 'pass', team: opposite(ctx.team) }, ...kinds.map(family => ({ family, team: ctx.team }))] };
  })),
  '191': configured('defensiveActionKinds', ctx => {
    const kinds = parameter(ctx, 'defensiveActionKinds');
    return quotient(count(ctx, e => Array.isArray(kinds) && kinds.includes(kindOf(e))), defensiveExposure(ctx), 1, 'acciones/min de posesión rival');
  }),
  '192': ctx => unique(ctx, flag(K('pressure'), 'counterpress'), e => e.links?.loss),
  '193': configured('counterpressReactionSeconds', ctx => ratioOf(ctx, e => {
    const p = ctx.all.find(p => p.matchId === e.matchId && p.team === ctx.team && isKind(p, 'pressure') && p.facts.counterpress === true && p.links?.loss === e.id);
    return p ? before(e, p, numericParameter(ctx, 'counterpressReactionSeconds') ?? 0) : e.facts.followupComplete === true ? false : undefined;
  }, flag(K('loss'), 'counterpressEligible'), 'loss')),
  '194': configured('counterpressRecoverySeconds', ctx => unique(ctx, e => {
    if (!isKind(e, 'recovery')) return false;
    const p = related(ctx, e, flag(K('pressure'), 'counterpress'), 'cause')[0];
    return p ? and(eq(e, 'continuity', true), before(p, e, numericParameter(ctx, 'counterpressRecoverySeconds') ?? 0)) : e.facts.counterpressReviewed === true ? false : undefined;
  }, e => e.links?.loss ?? related(ctx, e, flag(K('pressure'), 'counterpress'), 'cause')[0]?.links?.loss)),
  '195': configured('counterpressRecoverySeconds', ctx => {
    const episodes = unique(ctx, flag(K('pressure'), 'counterpress'), e => e.links?.loss);
    return quotient(recipes001_200['194'](ctx), episodes, 100, '%');
  }),
  '196': configured('counterpressShotSeconds', ctx => count(fullTeam(ctx, opposite(ctx.team)), e => {
    if (!shot(e)) return false;
    const p = related(ctx, e, e => and(isKind(e, 'pressure'), eq(e, 'counterpress', true), eq(e, 'beaten', true)), 'cause')[0];
    return p ? and(eq(e, 'continuity', true), before(p, e, numericParameter(ctx, 'counterpressShotSeconds') ?? 0)) : e.facts.counterpressReviewed === true ? false : undefined;
  }, 'shot')),
  '197': configured('gpiMethodVersion', configured('gpiEligibleKinds', ctx => {
    const eligibleKinds = parameter(ctx, 'gpiEligibleKinds');
    if (!Array.isArray(eligibleKinds) || parameter(ctx, 'gpiExceptionsReviewed') !== true) return missing('GPI requiere taxonomía, zonas y excepciones del método completas.', 'not_configured');
    return ratioOf(ctx, loss => {
      const actions = ctx.all.filter(e => e.matchId === loss.matchId && e.team === ctx.team && eligibleKinds.includes(kindOf(e)) && e.links?.loss === loss.id && e.facts.inOpponentHalf === true);
      if (actions.some(e => before(loss, e, 6) === true)) return true;
      return loss.facts.followupComplete === true ? false : undefined;
    }, e => and(isKind(e, 'loss'), eq(e, 'inOffensiveFortyPercent', true), eq(e, 'gpiEligible', true)), 'loss');
  })),
};

export const RECIPES_001_200 = recipes001_200;

// Excluded IDs intentionally have no recipe: models and spatial/physical measurements are not guessed.
export const NARRATED_FACT_KEYS_001_200 = [
  'outcome', 'subtype', 'bodyPart', 'zone', 'direction', 'distanceBand', 'height', 'firstTouch', 'weakFoot',
  'underPressure', 'progressive', 'bigChance', 'phase', 'intervention', 'interventionId', 'intervalStart',
  'intervalEnd', 'role', 'inPlay', 'ownCount', 'opponentCount', 'started', 'goal', 'ownGoal', 'shootout',
  'penalty', 'onTarget', 'goalLineSave', 'woodwork', 'afterCarry', 'deflected', 'rebound', 'continuity',
  'phaseClosed', 'assistReviewed', 'assistPlayerId', 'chainComplete', 'eligibleCreation', 'intendedReceiverGoalkeeper',
  'exitsOwnThird', 'entersFinalThird', 'entersArea', 'deepPass', 'behindDefence', 'breaksLine',
  'opponentsBypassed', 'switchOfPlay', 'halfspace', 'blocked', 'cutback', 'betweenLines', 'freeSpace',
  'miscontrol', 'createsShot', 'duringCarry', 'duringDribble', 'aerial', 'looseBall', 'secondBall', 'destinationZone', 'defenderId', 'opponentReceiverId',
  'shielding', 'sliding', 'contained', 'foul', 'oneOnOne', 'followupComplete', 'forcesBackwardPass',
  'forcesError', 'counterpress', 'counterpressEligible', 'counterpressReviewed', 'beaten',
  'inOpponentHalf', 'inOffensiveFortyPercent', 'gpiEligible',
] as const;
