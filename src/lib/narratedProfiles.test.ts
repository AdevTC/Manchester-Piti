import { describe, expect, it } from 'vitest';
import { evaluateNarrated, prepareNarrated } from '../../functions/src/narrated/engine';
import { RECIPES_201_400 } from '../../functions/src/narrated/recipes201_400';
import { DEFAULT_ANALYSIS_PROFILE } from '../../functions/src/narrated/types';
import type { AnalysisFilters, AnalysisProfile, MetricResult, NarratedMatch, Observation } from '../../functions/src/narrated/types';

const role = (id: string, from = 0, to = 3000, name = 'GK'): Observation => ({ id, kind: 'lineup', actorId: 'keeper', team: 'us', order: from, facts: { role: name, intervalStart: from, intervalEnd: to, started: from === 0 } });
const obs = (id: string, kind: Observation['kind'], facts: Observation['facts'] = {}, extra: Partial<Observation> = {}): Observation => ({ id, kind, team: 'us', actorId: 'keeper', order: 100, facts, ...extra });
const match = (observations: Observation[] = [], parameters: AnalysisProfile['parameters'] = {}): NarratedMatch => ({ id: 'match', status: 'finished', goalsFor: 1, goalsAgainst: 0, durationSeconds: 3000, starters: ['keeper'], analysis: { version: 2, revision: 1, observations, profile: { ...structuredClone(DEFAULT_ANALYSIS_PROFILE), parameters: { ...DEFAULT_ANALYSIS_PROFILE.parameters, ...parameters } }, coverage: [{ family: '*', team: 'us', state: 'complete' }, { family: '*', team: 'opponent', state: 'complete' }] } });
const metric = (id: string, m: NarratedMatch, filters: AnalysisFilters = {}) => evaluateNarrated([m], filters).find(row => row.id === id)!;
const ratingParams: AnalysisProfile['parameters'] = { ratingWeights: '{"015":2,"201":-0.5}', ratingScaleMin: 0, ratingScaleMax: 10, ratingBaseline: 5, ratingRole: 'GK', ratingMissingPolicy: 'require_complete' };
const result = (id: string, value: number, extra: Partial<MetricResult> = {}): MetricResult => ({ id, value, status: 'complete', unit: 'acciones', observed: value, pending: 0, evidenceEventIds: [`match:${id}`], ruleId: `piti.${id}`, ruleVersion: 1, parameters: {}, reason: 'fixture completa', ...extra });

describe('perfiles de portería a cero, valoración y calidad de narración', () => {
  it('mantiene sin configurar la portería a cero individual hasta elegir su política', () => {
    expect(metric('275', match([role('role')]), { playerIds: ['keeper'] })).toMatchObject({ value: null, status: 'not_configured' });
  });

  it('full_match acredita solo portería durante todo el encuentro, no minutos de campo', () => {
    const full = match([role('all')], { keeperCleanSheetPolicy: 'full_match' });
    expect(metric('275', full, { playerIds: ['keeper'] })).toMatchObject({ value: 1, status: 'complete' });
    const split = match([role('gk', 0, 1200), role('field', 1200, 3000, 'CB')], { keeperCleanSheetPolicy: 'full_match' });
    expect(metric('275', split, { playerIds: ['keeper'] })).toMatchObject({ value: 0, status: 'complete' });
  });

  it('min_minutes une intervalos solapados y excluye minutos con otro rol', () => {
    const m = match([role('a', 0, 600), role('b', 300, 1200), role('field', 1200, 3000, 'CB')], { keeperCleanSheetPolicy: 'min_minutes', keeperCleanSheetMinMinutes: 20 });
    expect(metric('275', m, { playerIds: ['keeper'] }).value).toBe(1);
    m.analysis!.profile.parameters.keeperCleanSheetMinMinutes = 21;
    expect(metric('275', m, { playerIds: ['keeper'] }).value).toBe(0);
    m.analysis!.profile.parameters.keeperCleanSheetMinMinutes = 0;
    expect(metric('275', m, { playerIds: ['keeper'] }).status).toBe('not_configured');
  });

  it('los intervalos de portería fuera de la duración real no acreditan full_match', () => {
    const m = match([role('oversized', 1800, 4800)], { keeperCleanSheetPolicy: 'full_match' });
    expect(metric('275', m, { playerIds: ['keeper'] })).toMatchObject({ value: 0, status: 'complete' });
  });

  it('no acredita una portería a cero ante marcador y relato contradictorios', () => {
    const m = match([role('gk'), obs('goal', 'goal', {}, { team: 'opponent' })], { keeperCleanSheetPolicy: 'full_match' });
    expect(metric('275', m)).toMatchObject({ value: null, status: 'unknown' });
    expect(metric('275', m, { playerIds: ['keeper'] })).toMatchObject({ value: null, status: 'unknown' });
    m.goalsAgainst = 1;
    expect(metric('275', m, { playerIds: ['keeper'] })).toMatchObject({ value: 0, status: 'complete' });
  });

  it('el crédito es de partido completo y no se extiende a roles contradictorios o sin evidencia', () => {
    expect(metric('275', match([role('gk')], { keeperCleanSheetPolicy: 'full_match' }), { period: 1 }).status).toBe('not_applicable');
    expect(metric('275', match([], { keeperCleanSheetPolicy: 'full_match' }), { playerIds: ['keeper'] }).status).toBe('unknown');
    expect(metric('275', match([role('gk'), role('field', 0, 600, 'CB')], { keeperCleanSheetPolicy: 'full_match' }), { playerIds: ['keeper'] }).status).toBe('unknown');
  });

  it('un marcador publicado histórico conserva la portería a cero sin exigir narración retroactiva', () => {
    const m = match(); m.analysis = undefined;
    expect(metric('275', m)).toMatchObject({ value: 1, status: 'complete' });
  });

  it('la fórmula necesita escala, valor inicial, rol y política explícita sobre ausencias', () => {
    for (const missing of ['ratingScaleMin', 'ratingScaleMax', 'ratingBaseline', 'ratingRole', 'ratingMissingPolicy']) {
      const params = { ...ratingParams }; delete params[missing];
      expect(metric('378', match([role('gk')], params), { playerIds: ['keeper'] }).status, missing).toBe('not_configured');
    }
  });

  it('inyecta el evaluador completo para combinar métricas de ambos módulos sin importaciones circulares', () => {
    const ctx = prepareNarrated([match([role('gk')], ratingParams)], { playerIds: ['keeper'] });
    ctx.evaluateMetric = id => id === '015' ? result(id, 2) : result(id, 4);
    expect(RECIPES_201_400['378'](ctx)).toMatchObject({ value: 7, status: 'complete', groups: [{ key: 'base', value: 5 }, { key: '201', value: -2 }, { key: '015', value: 4 }], parameters: { unboundedRating: 7 } });
  });

  it('el motor integrado calcula la nota desde goles y pérdidas reales con cobertura suficiente', () => {
    const m = match([role('gk'), obs('goal', 'goal'), obs('loss1', 'loss'), obs('loss2', 'loss')], ratingParams);
    expect(metric('378', m, { playerIds: ['keeper'] })).toMatchObject({ value: 6, status: 'complete' });
    m.analysis!.coverage = [{ family: 'goal', team: 'us', state: 'complete' }];
    expect(metric('378', m, { playerIds: ['keeper'] })).toMatchObject({ value: null, status: 'unknown' });
  });

  it('una entrada parcial o desconocida bloquea la nota aunque tenga valor numérico', () => {
    const ctx = prepareNarrated([match([role('gk')], ratingParams)], { playerIds: ['keeper'] });
    for (const status of ['partial', 'unknown', 'no_sample'] as const) {
      ctx.evaluateMetric = id => result(id, 0, { status });
      expect(RECIPES_201_400['378'](ctx)).toMatchObject({ value: null, status: 'unknown' });
    }
  });

  it('limita la nota a la escala y preserva el desglose previo al límite', () => {
    const ctx = prepareNarrated([match([role('gk')], ratingParams)], { playerIds: ['keeper'] });
    ctx.evaluateMetric = id => result(id, id === '015' ? 10 : 0);
    expect(RECIPES_201_400['378'](ctx)).toMatchObject({ value: 10, parameters: { unboundedRating: 25 } });
  });

  it('rechaza autorreferencias, métricas excluidas y roles sin exposición verificada', () => {
    const circular = match([role('gk')], { ...ratingParams, ratingWeights: '{"378":1}' });
    expect(metric('378', circular, { playerIds: ['keeper'] }).status).toBe('not_configured');
    const ctx = prepareNarrated([match([role('gk')], { ...ratingParams, ratingWeights: '{"051":1}' })], { playerIds: ['keeper'] });
    ctx.evaluateMetric = id => result(id, 0, { status: 'not_applicable' });
    expect(RECIPES_201_400['378'](ctx).status).toBe('not_configured');
    const wrongRole = prepareNarrated([match([role('field', 0, 3000, 'CB')], ratingParams)], { playerIds: ['keeper'] });
    wrongRole.evaluateMetric = id => result(id, 1);
    expect(RECIPES_201_400['378'](wrongRole).status).toBe('unknown');
  });

  it('A11 mide resultados conocidos del registro, incluyendo gol y dejando pendiente como incompleto', () => {
    const m = match([obs('p1', 'pass', { outcome: 'complete' }), obs('p2', 'pass', { outcome: 'pending' }), obs('g3', 'goal')]);
    m.analysis!.coverage = [];
    expect(metric('A11', m)).toMatchObject({ value: 200 / 3, numerator: 2, denominator: 3, status: 'complete' });
  });

  it('A11 y A12 devuelven sin muestra para registro vacío y no afirman completitud', () => {
    const m = match(); m.analysis!.coverage = [];
    for (const id of ['A11', 'A12']) expect(metric(id, m)).toMatchObject({ value: null, status: 'no_sample', denominator: 0 });
  });

  it('A12 aplica el ancho de incertidumbre configurado al reloj del partido', () => {
    const m = match([
      obs('exact', 'pass', {}, { time: { from: 10, to: 10, precision: 'exact' } }),
      obs('bounded', 'pass', {}, { time: { from: 20, to: 22, precision: 'interval' } }),
      obs('wide', 'pass', {}, { time: { from: 30, to: 33, precision: 'interval' } }),
      obs('vague', 'pass', {}, { time: { from: 40, to: 40, precision: 'approximate' } }),
      obs('no-clock', 'pass'),
    ], { temporalToleranceSeconds: 2 });
    expect(metric('A12', m)).toMatchObject({ value: 40, numerator: 2, denominator: 5, status: 'complete', parameters: { temporalToleranceSeconds: 2 } });
    m.analysis!.profile.parameters.temporalToleranceSeconds = -1;
    expect(metric('A12', m).status).toBe('not_configured');
  });
});
