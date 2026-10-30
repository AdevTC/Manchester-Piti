import { describe, expect, it } from 'vitest';
import { evaluateNarrated } from '../../functions/src/narrated/engine';
import { DEFAULT_ANALYSIS_PROFILE, type AnalysisFilters, type NarratedMatch, type Observation } from '../../functions/src/narrated/types';

function pass(id: string, outcome: string, period: 1 | 2, extra: Partial<Observation> = {}): Observation {
  return { id, kind: 'pass', team: 'us', actorId: 'a', receiverId: 'b', order: period * 100, period, facts: { outcome }, ...extra };
}
function game(id: string, observations: Observation[], retain = false): NarratedMatch {
  const profile = structuredClone(DEFAULT_ANALYSIS_PROFILE);
  profile.passes.deflection = retain ? 'retain' : 'fail';
  return { id, seasonId: 's', duration: 50, analysis: { version: 2, revision: 0, profile, observations, coverage: [{ family: '*', team: 'us', state: 'complete' }] } };
}
function results(matches: NarratedMatch[], filters: AnalysisFilters = {}, ids = ['067', '068', '069', '070']) {
  return Object.fromEntries(evaluateNarrated(matches, filters, ids).map(r => [r.id, r]));
}

describe('narrated statistics across matches', () => {
  const a = game('j1', [
    pass('same-id', 'complete', 1),
    pass('deflection', 'complete', 1, { facts: { outcome: 'complete', deflected: true } }),
  ]);
  const b = game('j2', [
    pass('same-id', 'complete', 1, { facts: { outcome: 'complete', deflected: true } }),
    pass('other', 'failed', 2),
    pass('third', 'complete', 2),
  ], true);

  it('pools classified outcomes, preserves match evidence and weights percentages by attempts', () => {
    for (const matches of [[a, b], [b, a]]) {
      const r = results(matches);
      expect(r['067']).toMatchObject({ value: 5, status: 'complete' });
      expect(r['068'].value).toBe(3);
      expect(r['069'].value).toBe(2);
      expect(r['070']).toMatchObject({ value: 60, numerator: 3, denominator: 5 });
      expect(r['070'].evidenceEventIds).toEqual(expect.arrayContaining(['j1:same-id', 'j2:same-id']));
    }
    expect(results([a])['070'].value).toBe(50);
    expect(results([b])['070'].value).toBeCloseTo(200 / 3);
  });

  it('keeps period, player, season and match filters coherent', () => {
    const selected = { playerIds: ['a'], seasonIds: ['s'], matchIds: ['j1', 'j2'] };
    expect(results([a, b], { ...selected, period: 1 })['070']).toMatchObject({ numerator: 2, denominator: 3 });
    expect(results([a, b], { ...selected, period: 2 })['070']).toMatchObject({ numerator: 1, denominator: 2 });
    expect(results([a, b], { matchIds: ['j1'] })['067'].value).toBe(2);
    expect(results([a, b], { seasonIds: ['another'] })['067'].value).toBeNull();
    expect(results([a, b], { playerIds: ['not-involved'] })['067'].value).toBe(0);
  });

  it('does not erase known samples or invent failures when another match has unresolved actions', () => {
    const unknown = game('unreviewed', [pass('pending', 'pending', 1)], true);
    unknown.analysis!.coverage = [];
    const r = results([a, unknown]);
    expect(r['067']).toMatchObject({ value: 3, status: 'partial' });
    expect(r['068']).toMatchObject({ value: 1, pending: 1, status: 'partial' });
    expect(r['069']).toMatchObject({ value: 1, pending: 1 });
    expect(r['070']).toMatchObject({ value: 50, numerator: 1, denominator: 2, pending: 1 });
  });

  it('applies inclusion rules independently for crosses, restarts, throw-ins and keeper hands', () => {
    const actions = [
      pass('cross', 'complete', 1, { facts: { outcome: 'complete', subtype: 'cross' } }),
      pass('restart', 'complete', 1, { links: { restart: 'kickoff' } }),
      pass('throw', 'complete', 1, { facts: { outcome: 'complete', restart: 'throw_in' } }),
      pass('hand', 'complete', 1, { kind: 'distribution', facts: { outcome: 'complete', bodyPart: 'hand' } }),
    ];
    const one = game('one', actions), two = game('two', actions, true);
    two.analysis!.profile.passes = { crosses: false, restarts: false, throwIns: true, keeperHands: true, deflection: 'retain' };
    for (const matches of [[one, two], [two, one]]) {
      expect(results(matches)['067'].value).toBe(4);
      expect(results(matches)['070']).toMatchObject({ value: 100, numerator: 4, denominator: 4 });
    }
  });

  it('uses each match completion policy for subcategories, receiving and pair metrics', () => {
    const facts = { outcome: 'complete', deflected: true, subtype: 'cross', distanceBand: 'short', underPressure: true, progressive: true, entersArea: true, entersFinalThird: true, exitsOwnThird: true, breaksLine: true };
    const one = game('one', [pass('p', 'complete', 1, { facts })]);
    const two = game('two', [pass('p', 'complete', 1, { facts })], true);
    const ids = ['074', '084', '093', '095', '096', '097', '100', '115', '116', '125', '241', '242', '386'];
    for (const matches of [[one, two], [two, one]]) {
      const r = results(matches, {}, ids);
      for (const id of ['074', '084', '093', '116']) expect(r[id].value, id).toBe(50);
      for (const id of ['095', '096', '097', '100', '115', '125', '241', '242']) expect(r[id].value, id).toBe(1);
      expect(results(matches, { playerIds: ['a', 'b'] }, ['386'])['386'].value).toBe(1);
      expect(results(matches, { playerIds: ['b'] }, ['125'])['125'].value).toBe(1);
    }
  });
});
