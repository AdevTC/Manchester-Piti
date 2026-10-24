import { describe, expect, it } from 'vitest';
import { evaluateNarrated, NARRATED_RECIPES, prepareNarrated } from '../../functions/src/narrated/engine';
import { NARRATED_METRICS } from '../../functions/src/narrated/catalog';
import { DEFAULT_ANALYSIS_PROFILE, type AnalysisFilters, type NarratedMatch, type Observation } from '../../functions/src/narrated/types';
import { before } from '../../functions/src/narrated/operators';
import { emptyParticipation } from '../../functions/src/matchEngine';

const obs = (id: string, kind: Observation['kind'], second: number, facts: Observation['facts'] = {}, extra: Partial<Observation> = {}): Observation => ({ id, kind, team: 'us', order: second, time: { from: second, to: second, precision: 'exact' }, facts, ...extra });
const match = (observations: Observation[] = [], extra: Partial<NarratedMatch> = {}): NarratedMatch => ({ id: 'm1', seasonId: 's1', status: 'finished', durationSeconds: 3000, analysis: { version: 2, revision: 1, profile: structuredClone(DEFAULT_ANALYSIS_PROFILE), coverage: [{ family: '*', team: 'us', state: 'complete' }, { family: '*', team: 'opponent', state: 'complete' }], observations }, ...extra });
const metric = (id: string, matches: NarratedMatch[], filters: AnalysisFilters = {}) => evaluateNarrated(matches, filters).find(m => m.id === id)!;

describe('narrated catalogue engine', () => {
  it('implements every viable ID and extension; excluded entries are explicitly unavailable', () => {
    const viable = NARRATED_METRICS.filter(m => m.audio.viability !== 'excluded');
    expect(viable).toHaveLength(321);
    expect(viable.filter(m => !NARRATED_RECIPES[m.id]).map(m => m.id)).toEqual([]);
    expect(evaluateNarrated([])).toHaveLength(412);
    expect(metric('051', []).status).toBe('not_applicable');
  });
  it('distinguishes lack of narration, a known zero and no eligible sample', () => {
    expect(metric('067', [match([], { analysis: undefined })])).toMatchObject({ value: null, status: 'unknown' });
    expect(metric('067', [match()])).toMatchObject({ value: 0, status: 'complete' });
    expect(metric('070', [match()])).toMatchObject({ value: null, status: 'no_sample' });
    expect(metric('070', [match([], { analysis: undefined })]).status).toBe('unknown');
  });
  it('accepts coverage by observation family and never assumes other families covered', () => {
    const m = match(); m.analysis!.coverage = [{ family: 'pass', team: 'us', state: 'complete' }];
    expect(metric('067', [m]).status).toBe('complete');
    expect(metric('206', [m])).toMatchObject({ value: null, status: 'unknown' });
  });
  it('certifies reviewed direct assists from goal coverage without requiring every pass or shot', () => {
    const m = match([
      obs('goal', 'goal', 2500, { assistReviewed: true }, { actorId: 'scorer', period: 2, links: { pass: 'previous' } }),
      obs('previous', 'pass', 2499, { outcome: 'complete', continuity: true }, { actorId: 'passer', receiverId: 'scorer', period: 2 }),
      obs('pending-pass', 'pass', 100, {}, { validity: 'pending', actorId: 'passer', period: 1 }),
    ]);
    m.analysis!.coverage = [{ family: 'goal', team: 'us', state: 'complete' }];
    // An explicit «sin asistencia» overrides a pass that happens to precede the goal.
    expect(metric('105', [m])).toMatchObject({ value: 0, status: 'complete', pending: 0 });
    expect(metric('105', [m], { playerIds: ['passer'], period: 2 })).toMatchObject({ value: 0, status: 'complete' });
    m.analysis!.observations[0].facts.assistPlayerId = 'passer';
    expect(metric('105', [m], { playerIds: ['passer'] })).toMatchObject({ value: 1, status: 'complete', pending: 0 });
    expect(metric('105', [m], { playerIds: ['scorer'] })).toMatchObject({ value: 0, status: 'complete' });
    expect(metric('105', [m], { period: 1 })).toMatchObject({ value: 0, status: 'complete' });
    expect(metric('108', [m]).status).not.toBe('complete');
    expect(metric('109', [m]).status).not.toBe('complete');
    m.analysis!.coverage = [{ family: 'goal', team: 'us', state: 'partial' }];
    expect(metric('105', [m])).toMatchObject({ value: 1, status: 'partial' });
  });
  it('does not certify an unresolved or pending goal merely because the goal list is covered', () => {
    const m = match([obs('goal', 'goal', 10)]);
    m.analysis!.coverage = [{ family: 'goal', team: 'us', state: 'complete' }];
    expect(metric('105', [m])).toMatchObject({ value: null, status: 'unknown', pending: 1 });
    m.analysis!.observations = [obs('pending-goal', 'goal', 10, { assistReviewed: true }, { validity: 'pending' })];
    expect(metric('105', [m])).toMatchObject({ value: null, status: 'unknown', pending: 1 });
    m.analysis!.observations = [];
    expect(metric('105', [m])).toMatchObject({ value: 0, status: 'complete', pending: 0 });
    m.analysis!.coverage = [];
    expect(metric('105', [m])).toMatchObject({ value: null, status: 'unknown' });
  });
  it('certifies only the requested real half and time range, joining contiguous coverage', () => {
    const m = match([
      obs('half1', 'context', 0, { intervalStart: 0, intervalEnd: 1537 }, { period: 1 }),
      obs('half2', 'context', 1537, { intervalStart: 1537, intervalEnd: 3000 }, { period: 2 }),
    ]);
    m.analysis!.coverage = [{ family: 'duel', team: 'us', state: 'complete', from: 1537, to: 2000 }, { family: 'duel', team: 'us', state: 'complete', from: 2000, to: 3000 }];
    expect(metric('151', [m], { period: 2 })).toMatchObject({ value: 0, status: 'complete' });
    expect(metric('151', [m], { period: 2, fromSecond: 1800, toSecond: 2200 })).toMatchObject({ value: 0, status: 'complete' });
    expect(metric('151', [m], { period: 1 })).toMatchObject({ value: null, status: 'unknown' });
    expect(metric('151', [m])).toMatchObject({ value: null, status: 'unknown' });
    m.analysis!.coverage[1].from = 2001;
    expect(metric('151', [m], { period: 2 })).toMatchObject({ value: null, status: 'unknown' });
    m.analysis!.observations = [];
    expect(metric('151', [m], { period: 2 })).toMatchObject({ value: null, status: 'unknown' });
    m.analysis!.coverage = [{ family: 'duel', team: 'us', state: 'complete' }];
    expect(metric('151', [m], { period: 2 })).toMatchObject({ value: 0, status: 'complete' });
  });
  it('keeps completed, failed and unresolved passes separate and pools numerators', () => {
    const a = match([obs('a', 'pass', 1, { outcome: 'complete' }), obs('b', 'pass', 2, { outcome: 'pending' })]);
    const b = match([obs('c', 'pass', 1, { outcome: 'complete' }), obs('d', 'pass', 2, { outcome: 'failed' }), obs('e', 'pass', 3, { outcome: 'failed' })], { id: 'm2' });
    expect(metric('067', [a, b]).value).toBe(5);
    expect(metric('069', [a, b]).value).toBe(2);
    expect(metric('070', [a, b])).toMatchObject({ value: 50, numerator: 2, denominator: 4, pending: 1, status: 'partial' });
    expect(metric('201', [a, b]).value).toBe(0);
  });
  it('excludes archived matches and applies match, season and player scope together', () => {
    const a = match([obs('a', 'pass', 1, { outcome: 'complete' }, { actorId: 'p1' })]);
    const b = match([obs('b', 'pass', 1, { outcome: 'failed' }, { actorId: 'p2' })], { id: 'm2', seasonId: 's2' });
    const archived = match([obs('x', 'pass', 1)], { id: 'arch', archived: true });
    expect(metric('067', [a, b, archived], { matchIds: ['m1', 'm2'], seasonIds: ['s1'], playerIds: ['p1'] }).value).toBe(1);
    expect(prepareNarrated([a, b, archived]).matches).toHaveLength(2);
    const individual = { ...a, id: 'individual', individuallyArchived: true };
    const deleting = { ...a, id: 'deleting', deleting: true };
    expect(prepareNarrated([individual, deleting]).matches).toEqual([]);
    expect(metric('067', [individual, deleting])).toMatchObject({ value: null, status: 'unknown' });
  });
  it('does not identify an opponent with a home-roster player filter', () => {
    const m = match([obs('r', 'pass', 100, { outcome: 'complete', opponentReceiverId: 'r2' }, { team: 'opponent', opponentId: 'r1' })]);
    expect(metric('067', [m], { team: 'opponent' })).toMatchObject({ value: 1, status: 'complete' });
    expect(metric('067', [m], { team: 'opponent', playerIds: ['r1'] })).toMatchObject({ value: null, status: 'not_applicable' });
    expect(metric('070', [m], { team: 'opponent', playerIds: ['p1'] })).toMatchObject({ value: null, status: 'not_applicable' });
  });
  it('never reuses our lineup for opponent participation or combinations of seven', () => {
    const m = match([obs('r', 'pass', 100, { outcome: 'complete' }, { team: 'opponent', opponentId: 'r1' })], { starters: ['a','b','c','d','e','f','g'], bench: ['h'] });
    m.ledger = Object.fromEntries(m.starters!.map(id => [id, { ...emptyParticipation(), started: true, played: true, minutes: 50, stints: [{ from: 0, to: 50 }] }]));
    const ids = [...Array.from({ length: 14 }, (_, i) => String(i + 1).padStart(3, '0')), '388', '389'];
    const rival = evaluateNarrated([m], { team: 'opponent' }, ids);
    for (const result of rival) {
      expect(result, result.id).toMatchObject({ value: null, status: 'unknown', observed: 0, evidenceEventIds: [] });
      expect(result.reason).toContain('convocatoria y las tandas del rival');
    }
    expect(metric('001', [m])).toMatchObject({ value: 350, status: 'complete' });
    expect(metric('005', [m])).toMatchObject({ value: 7, status: 'complete' });
    expect(metric('388', [m])).toMatchObject({ value: 50 });
    expect(metric('067', [m], { team: 'opponent' })).toMatchObject({ value: 1, status: 'complete' });
  });
  it('preserves declared complete counts even when a historical acta omitted duration', () => {
    expect(metric('067', [match([], { durationSeconds: undefined })])).toMatchObject({ value: 0, status: 'complete' });
  });
  it('enriches the canonical action without losing known facts or counting it twice', () => {
    const m = match([obs('r1', 'pass', 10, { underPressure: true }, { canonicalEventId: 'a' })], { events: [{ id: 'a', type: 'pass', elapsedSeconds: 10, minute: 0, playerId: 'p1', receiverId: 'p2', outcome: 'complete' }] });
    expect(metric('067', [m]).value).toBe(1);
    expect(metric('068', [m]).value).toBe(1);
    expect(prepareNarrated([m]).events[0]).toMatchObject({ actorId: 'p1', receiverId: 'p2', facts: { outcome: 'complete', underPressure: true } });
  });
  it('does not resurrect a retracted canonical action or count an unreconciled aggregate', () => {
    const m = match([obs('r1', 'pass', 10, {}, { canonicalEventId: 'a', validity: 'void' }), obs('agg', 'aggregate', 20, {}, { quantity: 10, aggregate: { kind: 'pass', scopeId: 'batch', reconciled: false } })], { events: [{ id: 'a', type: 'pass', minute: 1, outcome: 'complete' }] });
    expect(metric('067', [m])).toMatchObject({ value: null, status: 'unknown', pending: 10 });
  });
  it('treats the recording clock as evidence, not exact match time', () => {
    const m = match([], { events: [{ id: 'a', type: 'pass', minute: 1, outcome: 'complete' }] });
    expect(prepareNarrated([m]).events[0].time?.precision).toBe('interval');
    expect(metric('067', [m], { fromSecond: 70, toSecond: 80 })).toMatchObject({ value: null, status: 'unknown', pending: 1 });
  });
  it('uses half-open ranges: an action at the endpoint belongs to the next range', () => {
    const m = match([obs('a', 'pass', 60, { outcome: 'complete' }), obs('b', 'pass', 120, { outcome: 'complete' })]);
    expect(metric('067', [m], { fromSecond: 60, toSecond: 120 }).value).toBe(1);
  });
  it('does not turn a chance into a shot or an interception into a recovery', () => {
    const m = match([], { events: [{ id: 'c', type: 'chance', minute: 1 }, { id: 'i', type: 'interception', minute: 2 }] });
    expect(metric('029', [m]).value).toBe(0);
    expect(metric('206', [m]).value).toBe(0);
  });
  it('keeps a goal, shot and on-target tag as one shooting intervention', () => {
    const m = match([obs('s', 'shot', 10, { onTarget: true }, { links: { action: 'kick' } }), obs('g', 'goal', 10, { goal: true }, { links: { action: 'kick' } })]);
    expect(metric('029', [m]).value).toBe(1);
    expect(metric('030', [m]).value).toBe(1);
    expect(metric('015', [m]).value).toBe(1);
  });
  it('respects strict recovery thresholds and uncertainty crossing them', () => {
    const a = obs('loss', 'loss', 10, {}, { actorId: 'p1', controlAfter: 'opponent' });
    const b = obs('rec', 'recovery', 15, { continuity: true }, { actorId: 'p1', controlBefore: 'opponent', links: { loss: 'loss' } });
    expect(metric('A01', [match([a, b])]).value).toBe(1);
    expect(metric('A02', [match([a, b])]).value).toBe(1);
    expect(metric('A03', [match([a, b])]).value).toBe(0);
    b.time = { from: 14, to: 15, precision: 'interval' };
    expect(before(a, b, 5)).toBeUndefined();
    expect(metric('A03', [match([a, b])]).pending).toBe(1);
  });
  it('never links recoveries across matches, stoppages, gaps or an earlier recovery', () => {
    const a = obs('loss', 'loss', 10, {}, { actorId: 'p1', controlAfter: 'opponent' });
    const b = obs('rec', 'recovery', 14, { continuity: true }, { actorId: 'p1', links: { loss: 'loss' } });
    expect(metric('A01', [match([a]), match([b], { id: 'm2' })]).value ?? 0).toBe(0);
    for (const obstacle of [obs('gap', 'gap', 12), obs('stop', 'control', 12, {}, { controlAfter: 'out' }), obs('earlier', 'recovery', 12)]) {
      expect(metric('A01', [match([a, obstacle, b])]).value ?? 0).toBe(0);
    }
  });
  it('permits a quick disputed-ball recovery without claiming opponent possession', () => {
    const l = obs('l', 'loss', 10, {}, { actorId: 'p1', controlAfter: 'disputed' });
    const r = obs('r', 'recovery', 13, { continuity: true }, { actorId: 'p1', controlBefore: 'disputed', links: { loss: 'l' } });
    expect(metric('210', [match([l, r])]).value).toBe(1);
    expect(metric('A02', [match([l, r])]).value).toBe(0);
  });
  it('separates clearance outcomes without crediting the defender with a recovery', () => {
    const m = match([obs('a', 'clearance', 1, { firstControl: 'us' }), obs('b', 'clearance', 2, { firstControl: 'opponent' }), obs('c', 'clearance', 3, { firstControl: 'out' }), obs('d', 'clearance', 4)]);
    expect(metric('A05', [m]).value).toBe(1); expect(metric('A08', [m]).value).toBe(1);
    expect(metric('A09', [m])).toMatchObject({ numerator: 1, denominator: 3, pending: 1, status: 'partial' });
    expect(metric('206', [m]).value).toBe(0);
  });
  it('counts awarded and taken corners separately and deduplicates attacks with multiple shots', () => {
    const m = match([obs('c', 'restart', 1, { subtype: 'corner', stage: 'awarded' }), obs('a', 'attack', 2, { followupComplete: true }, { links: { attack: 'phase' } }), obs('s1', 'shot', 3, {}, { links: { attack: 'phase' } }), obs('s2', 'shot', 4, {}, { links: { attack: 'phase' } })]);
    expect(metric('251', [m]).value).toBe(1); expect(metric('252', [m]).value).toBe(0);
    expect(metric('240', [m]).value).toBe(1);
  });
  it('merges overlapping control intervals and excludes disputed time from possession percentage', () => {
    const m = match([obs('a', 'control', 0, { intervalStart: 0, intervalEnd: 10 }, { controlAfter: 'us' }), obs('b', 'control', 5, { intervalStart: 5, intervalEnd: 15 }, { controlAfter: 'us' }), obs('c', 'control', 15, { intervalStart: 15, intervalEnd: 20 }, { team: 'opponent', controlAfter: 'opponent' }), obs('d', 'control', 20, { intervalStart: 20, intervalEnd: 40 }, { controlAfter: 'disputed' })]);
    expect(metric('219', [m]).value).toBe(15);
    expect(metric('220', [m]).value).toBe(75);
    expect(metric('221', [m]).value).toBe(20);
  });
  it('does not treat loss followed by recovery as uninterrupted retention', () => {
    const m = match([obs('t', 'restart', 10, { subtype: 'throw_in', stage: 'executed', continuousControl: false, continuousControlSeconds: 5 })]); m.analysis!.profile.parameters.retentionSeconds = 5;
    expect(metric('266', [m]).value).toBe(0);
  });
  it('separates a keeper catching a cross from saving a shot', () => {
    const m = match([obs('a', 'keeper', 10, { subtype: 'cross_caught' })]);
    expect(metric('284', [m]).value).toBe(1); expect(metric('272', [m]).value).toBe(0);
  });
  it('computes ID400 as rate difference with unequal observed exposures', () => {
    const m = match([obs('sub', 'substitution', 60), obs('a', 'shot', 10), obs('b', 'shot', 70), obs('c', 'shot', 100), obs('d', 'shot', 150)], { durationSeconds: 180 });
    m.analysis!.profile.parameters.substitutionId = 'sub'; m.analysis!.profile.parameters.substitutionWindowSeconds = 120;
    expect(metric('400', [m])).toMatchObject({ value: 0.5, parameters: { preSeconds: 60, postSeconds: 120, preCount: 1, postCount: 3 } });
  });
  it('does not invent tactical configuration, physical measurements or proprietary models', () => {
    const rows = evaluateNarrated([match()]);
    expect(rows.find(r => r.id === '110')?.status).toBe('not_configured');
    expect(rows.find(r => r.id === '343')?.status).toBe('not_applicable');
    expect(rows.find(r => r.id === '378')?.status).toBe('not_configured');
  });
  it('keeps period exposure per match and cannot link goals or response shots into another half', () => {
    const a = match([obs('half', 'context', 0, { intervalStart: 0, intervalEnd: 1500 }, { period: 1 }), obs('pos', 'control', 0, { intervalStart: 0, intervalEnd: 100 }, { period: 1, controlAfter: 'us' }), obs('g1', 'goal', 50, { goal: true }, { period: 1 }), obs('opp', 'goal', 100, { goal: true }, { team: 'opponent', period: 1 }), obs('g2', 'goal', 1600, { goal: true }, { period: 2 })]);
    const b = { ...structuredClone(a), id: 'm2' };
    expect(metric('219', [a, b], { period: 1 }).value).toBe(200);
    expect(metric('391', [a], { period: 1 }).value).toBe(1);
    expect(metric('397', [a], { period: 1 }).value).toBeNull();
    expect(metric('391', [a], { period: 1 }).evidenceEventIds).not.toContain('m1:g2');
  });
  it('does not use scheduled half duration as the actual time played', () => {
    const m = match([obs('p', 'control', 0, { intervalStart: 0, intervalEnd: 1500 }, { period: 1 })]);
    expect(metric('219', [m], { period: 1 })).toMatchObject({ value: null, status: 'unknown' });
  });
  it('an unresolved pass does not prevent counting fully documented goals', () => {
    const m = match([obs('p', 'pass', 10, {}, { validity: 'pending' }), obs('g', 'goal', 20, { goal: true })]);
    expect(metric('015', [m])).toMatchObject({ value: 1, status: 'complete', pending: 0 });
    expect(metric('067', [m])).toMatchObject({ value: null, status: 'unknown', pending: 1 });
  });
  it('does not apply the first match pass policy silently to other seasons', () => {
    const a = match([obs('a', 'pass', 1, { subtype: 'cross', outcome: 'complete' })]);
    const b = match([obs('b', 'pass', 1, { subtype: 'cross', outcome: 'complete' })], { id: 'm2' }); b.analysis!.profile.passes.crosses = false;
    expect(metric('067', [a, b])).toMatchObject({ value: null, status: 'not_configured' });
    expect(metric('067', [b, a])).toMatchObject({ value: null, status: 'not_configured' });
    expect(metric('015', [a, b]).value).toBe(0);
  });
  it('does not attach known out-of-scope doubts to another player or half', () => {
    const m = match([
      obs('a', 'pass', 10, { outcome: 'complete' }, { actorId: 'p1', period: 1 }),
      obs('b', 'pass', 20, {}, { actorId: 'p2', period: 1, validity: 'pending' }),
      obs('c', 'pass', 1600, {}, { actorId: 'p1', period: 2, validity: 'pending' }),
    ]);
    expect(metric('067', [m], { playerIds: ['p1'], period: 1 })).toMatchObject({ value: 1, status: 'complete', pending: 0 });
  });
  it('counts an explicit possession interval only once when its duration is also recorded', () => {
    const c = obs('c', 'control', 0, { intervalStart: 0, intervalEnd: 30, durationSeconds: 30 }); delete c.time;
    expect(metric('219', [match([c])]).value).toBe(30);
  });
  it('cannot infer shot droughts or time drawing from an unobserved match', () => {
    const m = match([], { analysis: undefined, goalsFor: 5, goalsAgainst: 3 });
    expect(metric('392', [m])).toMatchObject({ value: null, status: 'unknown' });
    expect(metric('395', [m])).toMatchObject({ value: null, status: 'unknown' });
    const covered = match();
    covered.analysis!.coverage = [{ family: 'shot', team: 'us', state: 'complete', from: 600, to: 900 }];
    expect(metric('392', [covered])).toMatchObject({ value: 5, status: 'partial', exposureSeconds: 300 });
    const ambiguous = match([obs('s', 'shot', 600, {}, { time: { from: 600, to: 660, precision: 'interval' } })]);
    expect(metric('392', [ambiguous])).toMatchObject({ value: null, status: 'unknown' });
  });
  it('orders a keeper streak by actual match dates, never input order', () => {
    const role = obs('role', 'lineup', 0, { role: 'GK', intervalStart: 0, intervalEnd: 3000 }, { actorId: 'p1' });
    const a = match([role, obs('goal', 'goal', 2400, { goal: true }, { team: 'opponent' })], { date: '2026-09-01', starters: ['p1'] });
    const b = match([role], { id: 'm2', date: '2026-09-08', starters: ['p1'] });
    expect(metric('276', [a, b], { playerIds: ['p1'] }).value).toBe(60);
    expect(metric('276', [b, a], { playerIds: ['p1'] }).value).toBe(60);
    delete b.date;
    expect(metric('276', [a, b], { playerIds: ['p1'] })).toMatchObject({ value: null, status: 'unknown' });
  });
});
