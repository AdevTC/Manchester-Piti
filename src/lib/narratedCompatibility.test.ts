import { describe, expect, it } from 'vitest';
import { evaluateNarrated, prepareNarrated } from '../../functions/src/narrated/engine';
import { compatibleMetricProfiles } from '../../functions/src/narrated/profileCompatibility';
import { DEFAULT_ANALYSIS_PROFILE, type AnalysisFilters, type AnalysisProfile, type NarratedMatch } from '../../functions/src/narrated/types';

function game(id: string, parameters: AnalysisProfile['parameters'] = {}): NarratedMatch {
  return { id, duration: 50, analysis: { version: 2, revision: 1, observations: [], coverage: [], profile: { ...structuredClone(DEFAULT_ANALYSIS_PROFILE), parameters: { ...DEFAULT_ANALYSIS_PROFILE.parameters, ...parameters } } } };
}
function compatible(matches: NarratedMatch[], id: string, filters: AnalysisFilters = {}): boolean {
  return compatibleMetricProfiles(prepareNarrated(matches, filters), id);
}
function expectBothOrders(matches: [NarratedMatch, NarratedMatch], id: string, expected: boolean, filters: AnalysisFilters = {}) {
  expect(compatible(matches, id, filters)).toBe(expected);
  expect(compatible([...matches].reverse(), id, filters)).toBe(expected);
}

describe('multi-match metric profile compatibility', () => {
  it('allows recorded pass policies to coexist without blocking unrelated metrics', () => {
    const a = game('a'), b = game('b');
    b.analysis!.profile.passes = { crosses: false, restarts: false, throwIns: true, keeperHands: true, deflection: 'retain' };
    for (const id of ['001', '015', '028', '067', '068', '069', '070', '074', '115', '116', '125', '190', '226', '247', '289', '386', '399']) expectBothOrders([a, b], id, true);
  });

  it('does not invalidate observations because an unrelated parameter changed', () => {
    const a = game('a'), b = game('b', { pressureRecoverySeconds: 5, retentionSeconds: 10, windowKind: 'pass', splitSecond: 1500, defensiveActionKinds: ['tackle'], temporalToleranceSeconds: 30 });
    for (const id of ['001', '015', '067', '070', '135', '151', '169', '183', '201', '206', '265', '276', '300', '391']) expectBothOrders([a, b], id, true);
  });

  it.each([
    ['028', 'assistPolicy', 'different'], ['098', 'deepPassCriterion', 'deep-v2'], ['104', 'wallSeconds', 5],
    ['107', 'bigChanceCriterion', 'big-v2'], ['110', 'scaPhasePolicy', 'phase-v2'], ['133', 'retentionEndPolicy', 'end-v2'],
    ['177', 'containmentCriterion', 'contain-v2'], ['180', 'defensiveCoverCriterion', 'cover-v2'],
    ['182', 'defensiveActionKinds', ['tackle']], ['185', 'pressureRecoverySeconds', 5], ['189', 'reactionSeconds', 3],
    ['190', 'ppdaZone', 'own_half'], ['191', 'defensiveActionKinds', ['tackle']],
    ['193', 'counterpressReactionSeconds', 5], ['194', 'counterpressRecoverySeconds', 5], ['195', 'counterpressRecoverySeconds', 5],
    ['196', 'counterpressShotSeconds', 10], ['197', 'gpiMethodVersion', 'gpi-v2'],
    ['205', 'dangerSeconds', 10], ['210', 'quickRecoverySeconds', 10], ['266', 'retentionSeconds', 10],
    ['267', 'throwInProgressZone', 'final_third'], ['279', 'reboundSeconds', 5], ['305', 'offside', true], ['306', 'offside', true],
    ['378', 'ratingBaseline', 5], ['398', 'windowSeconds', 600], ['399', 'splitSecond', 1500], ['400', 'substitutionId', 'sub-1'],
    ['A03', 'quickRecoverySeconds', 10], ['A12', 'temporalToleranceSeconds', 30],
  ] as const)('keeps the required %s rule explicit when %s differs or is absent', (id, key, value) => {
    expectBothOrders([game('a'), game('b', { [key]: typeof value === 'object' ? [...value] : value })], id, false);
  });

  it('only compares the normalization duration for rates that use it', () => {
    const a = game('a'), b = game('b'); b.analysis!.profile.baseMinutes = 90;
    for (const id of ['001', '002', '004', '005', '009', '010', '011', '384']) expectBothOrders([a, b], id, true);
    for (const id of ['182', '382', '383']) expectBothOrders([a, b], id, false);
  });

  it('compares only the effective clean-sheet policy for a selected goalkeeper', () => {
    const a = game('a'), b = game('b', { keeperCleanSheetPolicy: 'min_minutes', keeperCleanSheetMinMinutes: 20 });
    expectBothOrders([a, b], '275', true);
    expectBothOrders([a, b], '275', false, { playerIds: ['keeper'] });
    a.analysis!.profile.parameters.keeperCleanSheetPolicy = 'full_match';
    b.analysis!.profile.parameters.keeperCleanSheetPolicy = 'full_match';
    expectBothOrders([a, b], '275', true, { playerIds: ['keeper'] });
    a.analysis!.profile.parameters.keeperCleanSheetPolicy = 'min_minutes';
    b.analysis!.profile.parameters.keeperCleanSheetPolicy = 'min_minutes';
    expectBothOrders([a, b], '275', false, { playerIds: ['keeper'] });
  });

  it('recognizes the moving-window default but does not invent required settings', () => {
    const a = game('a'), b = game('b', { windowKind: 'shot' });
    expectBothOrders([a, b], '398', true);
    b.analysis!.profile.parameters.windowKind = 'pass';
    expectBothOrders([a, b], '398', false);
    delete b.analysis!.profile.parameters.windowSeconds;
    expectBothOrders([a, b], '398', false);
  });

  it('treats taxonomy order and JSON property order as equivalent configurations', () => {
    const a = game('a', { ppdaActionKinds: ['tackle', 'interception'], ratingWeights: '{"015":2,"201":-0.5}' });
    const b = game('b', { ppdaActionKinds: ['interception', 'tackle', 'tackle'], ratingWeights: '{ "201": -0.5, "015": 2 }' });
    expectBothOrders([a, b], '190', true);
    expectBothOrders([a, b], '378', true);
  });

  it('does not lend one match its big-chance criterion while evaluating pooled creation', () => {
    const a = game('a'), b = game('b');
    delete a.analysis!.profile.parameters.bigChanceCriterion;
    for (const m of [a, b]) {
      m.analysis!.coverage = [{ family: '*', team: 'us', state: 'complete' }];
      m.analysis!.observations = [
        { id: 'pass', kind: 'pass', team: 'us', order: 1, actorId: 'p1', receiverId: 'p2', links: { shot: 'shot' }, facts: { outcome: 'complete', continuity: true } },
        { id: 'shot', kind: 'shot', team: 'us', order: 2, actorId: 'p2', links: { pass: 'pass' }, facts: { outcome: 'off_target', bigChance: true } },
      ];
    }
    for (const sample of [[a, b], [b, a]]) {
      const rows = new Map(evaluateNarrated(sample, {}, ['106', '107']).map(row => [row.id, row]));
      expect(rows.get('106')).toMatchObject({ value: 2, status: 'complete' });
      expect(rows.get('107')).toMatchObject({ value: null, status: 'not_configured' });
    }
  });
});
