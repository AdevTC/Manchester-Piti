import { describe, expect, it } from 'vitest';
import { NARRATED_METRICS, NARRATED_EXTRACTION_RULES, NARRATED_PARAMETERS, NARRATED_PROFILE_DEFAULTS } from '../../functions/src/narrated/catalog';
import { RECIPES_001_200 as recipes } from '../../functions/src/narrated/recipes001_200';
import { DEFAULT_ANALYSIS_PROFILE } from '../../functions/src/narrated/types';
import type { Observation } from '../../functions/src/narrated/types';
import type { MetricContext, ScopedObservation } from '../../functions/src/narrated/operators';
import { emptyParticipation } from '../../functions/src/matchEngine';

const event = (id: string, kind: Observation['kind'], facts: Observation['facts'] = {}, extra: Partial<Observation> = {}): ScopedObservation => ({ id, kind, team: 'us', actorId: 'p1', order: Number(id.replace(/\D/g, '')) || 1, facts, ...extra, matchId: 'm1', evidenceId: `m1:${id}` });
const context = (events: ScopedObservation[], extra: Partial<MetricContext> = {}): MetricContext => ({
  matches: [{ match: { id: 'm1', duration: 50 }, events, duration: 3000, profile: DEFAULT_ANALYSIS_PROFILE }],
  events: events.filter(e => e.team === 'us'), all: events, filters: {}, team: 'us', profile: DEFAULT_ANALYSIS_PROFILE, excludedByUncertainty: 0, ...extra,
});
const metric = (id: string, events: ScopedObservation[], extra?: Partial<MetricContext>) => recipes[id](context(events, extra));
const exact = (seconds: number): Observation['time'] => ({ from: seconds, to: seconds, precision: 'exact' });

describe('catálogo narrado y recetas 001–200', () => {
  it('conserva todos los IDs y cada receta incluida sin dar motor a los modelos excluidos', () => {
    expect(NARRATED_METRICS).toHaveLength(412);
    expect(new Set(NARRATED_METRICS.map(m => m.id)).size).toBe(412);
    expect(NARRATED_METRICS.filter(m => m.audio.viability === 'viable')).toHaveLength(98);
    expect(NARRATED_METRICS.filter(m => m.audio.viability === 'conditional')).toHaveLength(211);
    expect(NARRATED_METRICS.filter(m => m.audio.viability === 'excluded')).toHaveLength(91);
    expect(NARRATED_EXTRACTION_RULES).toHaveLength(63);
    expect(NARRATED_PARAMETERS).toHaveLength(24);
    expect(NARRATED_PROFILE_DEFAULTS).toHaveLength(78);
    for (const m of NARRATED_METRICS.filter(m => m.originalId != null && m.originalId <= 200)) {
      expect(typeof recipes[m.id], m.id).toBe(m.audio.viability === 'excluded' ? 'undefined' : 'function');
    }
  });

  it('no convierte pendientes de pase en fallos y agrega aciertos e intentos', () => {
    const passes = [event('p1', 'pass', { outcome: 'complete' }), ...Array.from({ length: 8 }, (_, i) => event(`p${i + 2}`, 'pass', { outcome: 'failed' })), event('p10', 'pass', { outcome: 'complete' }), event('p11', 'pass', { outcome: 'pending' })];
    expect(metric('067', passes).value).toBe(11);
    expect(metric('068', passes)).toMatchObject({ value: 2, pending: 1 });
    expect(metric('069', passes)).toMatchObject({ value: 8, pending: 1 });
    expect(metric('070', passes)).toMatchObject({ value: 20, numerator: 2, denominator: 10, pending: 1 });
  });

  it('el resultado de pase no bloquea dirección ni cuota de pases largos', () => {
    const e = event('p1', 'pass', { outcome: 'pending', direction: 'forward', distanceBand: 'long' });
    expect(metric('087', [e]).value).toBe(1);
    expect(metric('091', [e]).value).toBe(100);
    expect(metric('077', [e]).value).toBe(100);
    expect(metric('070', [e])).toMatchObject({ value: null, pending: 1, status: 'unknown' });
  });

  it('respeta universo de pases y el desvío rival incluso con control propio', () => {
    const events = [event('p1', 'pass', { outcome: 'complete', deflected: true }, { controlAfter: 'us' }), event('p2', 'pass', { outcome: 'complete', restart: 'throw_in' }), event('p3', 'distribution', { outcome: 'complete', bodyPart: 'hand' }), event('p4', 'pass', { outcome: 'complete', subtype: 'cross' })];
    expect(metric('067', events).value).toBe(2);
    expect(metric('069', events).value).toBe(1);
    expect(metric('070', events).value).toBe(50);
    expect(metric('114', events).value).toBe(1);
  });

  it('gol ordinario implica tiro a puerta; autogol no crea remate del atacante', () => {
    const events = [event('g1', 'goal', { penalty: false }), event('g2', 'goal', { ownGoal: true }), event('s3', 'shot', { outcome: 'saved' }), event('s4', 'shot', { outcome: 'blocked' }), event('s5', 'shot', { outcome: 'woodwork' })];
    expect(metric('015', events).value).toBe(1);
    expect(metric('016', events).value).toBe(1);
    expect(metric('029', events).value).toBe(4);
    expect(metric('030', events).value).toBe(2);
    expect(metric('033', events).value).toBe(1);
    expect(metric('034', events).value).toBe(50);
    expect(metric('035', events).value).toBe(25);
    expect(metric('036', events).value).toBe(50);
    expect(metric('020', events)).toMatchObject({ value: 0, pending: 1 });
  });

  it('conserva el significado de gol decisivo ordinal y no el último gol', () => {
    const events = [event('g1', 'goal'), event('g2', 'goal'), event('g3', 'goal', {}, { team: 'opponent' }), event('g4', 'goal', {}, { actorId: 'p2' })];
    expect(metric('027', events, { filters: { playerIds: ['p1'] }, events: events.filter(e => e.team === 'us' && e.actorId === 'p1') })).toMatchObject({ value: 1, evidenceEventIds: ['m1:g2'] });
    expect(metric('027', events, { filters: { playerIds: ['p2'] }, events: events.filter(e => e.actorId === 'p2') }).value).toBe(0);
  });

  it('asistencia requiere cadena confirmada y no duplica centros con varios remates', () => {
    const p = event('p1', 'pass', { outcome: 'complete', continuity: true, subtype: 'cross' }, { receiverId: 'p2', links: { shot: 'g2' } });
    const g = event('g2', 'goal', {}, { actorId: 'p2', links: { pass: 'p1' } });
    const s = event('s3', 'shot', { outcome: 'saved' }, { actorId: 'p3', links: { pass: 'p1' } });
    expect(metric('105', [p, g, s])).toMatchObject({ value: 1, pending: 0 });
    expect(metric('119', [p, g, s]).value).toBe(1);
    expect(metric('105', [{ ...p, facts: { ...p.facts, continuity: false } }, g])).toMatchObject({ value: 0, pending: 1 });
    expect(metric('110', [p, g]).status).toBe('not_configured');
  });

  it('conserva asistencia explícita del acta anterior sin inventar un pase', () => {
    const goal = event('g1', 'goal', { assistReviewed: true, assistPlayerId: 'p2' });
    expect(metric('105', [goal], { filters: { playerIds: ['p2'] }, events: [] })).toMatchObject({ value: 1, evidenceEventIds: ['m1:g1'] });
    expect(metric('067', [goal]).value).toBe(0);
  });

  it('resuelve relaciones directas, inversas y causales sin duplicar una acción', () => {
    for (const direction of ['direct', 'inverse', 'cause', 'all'] as const) {
      const p = event('p1', 'pass', { subtype: 'cross', phaseClosed: true }, { links: direction === 'direct' || direction === 'all' ? { shot: 's2' } : undefined });
      const s = event('s2', 'shot', {}, { links: direction === 'inverse' ? { pass: 'p1' } : direction === 'cause' ? { cause: 'p1' } : direction === 'all' ? { pass: 'p1', cause: 'p1' } : undefined });
      expect(metric('119', [p, s]), direction).toMatchObject({ value: 1, pending: 0, evidenceEventIds: ['m1:p1'] });
    }
    for (const inverse of [false, true]) {
      const carry = event('c1', 'carry', {}, { links: inverse ? { cause: 's2' } : undefined });
      const shot = event('s2', 'shot', { afterCarry: false }, { links: inverse ? undefined : { cause: 'c1' } });
      expect(metric('043', [carry, shot]).value).toBe(1);
    }
  });

  it('aísla IDs repetidos de otros partidos incluso sin un contexto preparado', () => {
    const p = event('p1', 'pass', { subtype: 'cross', phaseClosed: true }, { links: { shot: 's2' } });
    const other = { ...event('s2', 'shot', {}, { links: { pass: 'p1', cause: 'p1' } }), matchId: 'm2', evidenceId: 'm2:s2' };
    expect(metric('119', [p, other])).toMatchObject({ value: 0, pending: 0 });
    expect(metric('119', [p, other], { matches: [] })).toMatchObject({ value: 0, pending: 0 });
    const local = { ...other, matchId: 'm1', evidenceId: 'm1:s2' };
    expect(metric('119', [p, other, local], { matches: [] })).toMatchObject({ value: 1, pending: 0 });
  });

  it('mantiene el orden original de candidatos cuando coinciden relaciones distintas', () => {
    const first = event('p1', 'pressure', { counterpress: true }, { time: exact(100), links: { cause: 'r3', loss: 'loss1' } });
    const second = event('p2', 'pressure', { counterpress: true }, { time: exact(103), links: { loss: 'loss2' } });
    const recovery = event('r3', 'recovery', { continuity: true }, { time: exact(104), links: { cause: 'p2' } });
    const profile = { ...DEFAULT_ANALYSIS_PROFILE, parameters: { counterpressRecoverySeconds: 3 } };
    expect(metric('194', [first, second, recovery], { profile }).value).toBe(0);
    expect(metric('194', [second, first, recovery], { profile }).value).toBe(1);
  });

  it('goles de empate usa el marcador anterior al tramo sin incluir goles fuera del filtro', () => {
    const first = event('g1', 'goal', {}, { team: 'opponent', time: exact(10) });
    const equalizer = event('g2', 'goal', {}, { time: exact(100) });
    const ctx = context([first, equalizer]);
    ctx.all = [equalizer]; ctx.events = [equalizer]; ctx.filters.fromSecond = 50;
    expect(recipes['025'](ctx)).toMatchObject({ value: 1, evidenceEventIds: ['m1:g2'] });
    expect(recipes['024'](ctx).value).toBe(0);
  });

  it('cuenta intervención por actor y fase; gol y remate del mismo contacto son una', () => {
    const events = [event('p1', 'pass', { intervention: true, interventionId: 'touch-a' }), event('r2', 'reception', { intervention: true, interventionId: 'touch-b' }, { actorId: 'p2' }), event('s3', 'shot', { intervention: true, interventionId: 'touch-c' }, { actorId: 'p2' }), event('g4', 'goal', { intervention: true, interventionId: 'touch-c' }, { actorId: 'p2' })];
    expect(metric('121', events).value).toBe(3);
    expect(metric('123', events, { filters: { playerIds: ['p1'] }, events: [events[0]] }).value).toBeCloseTo(100 / 3);
  });

  it('pase completo y recepción dan dos intervenciones sin duplicar la recepción explícita', () => {
    const p = event('p1', 'pass', { outcome: 'complete', zone: 'own_half', destinationZone: 'opponent_area' }, { receiverId: 'p2' });
    const r = event('r2', 'reception', { zone: 'opponent_area' }, { actorId: 'p2', links: { pass: 'p1' } });
    expect(metric('121', [p]).value).toBe(2);
    expect(metric('121', [p, r]).value).toBe(2);
    expect(metric('121', [p], { filters: { playerIds: ['p2'] }, events: [] }).value).toBe(1);
    expect(metric('122', [p, r]).value).toBe(1);
  });

  it('distingue destinatario previsto y receptor accidental', () => {
    const events = [event('p1', 'pass', { outcome: 'complete' }, { intendedReceiverId: 'p2', receiverId: 'p3' }), event('p2', 'pass', { outcome: 'complete' }, { intendedReceiverId: 'p2', receiverId: 'p2' })];
    expect(metric('124', events, { filters: { playerIds: ['p2'] }, events: [] }).value).toBe(2);
    expect(metric('125', events, { filters: { playerIds: ['p2'] }, events: [] }).value).toBe(1);
    expect(metric('126', events, { filters: { playerIds: ['p2'] }, events: [] }).value).toBe(50);
  });

  it('neutral y pendiente no son derrotas; un duelo se cuenta una vez por equipo', () => {
    const events = [event('d1', 'duel', { outcome: 'won' }, { links: { duel: 'duel1' } }), event('d2', 'duel', { outcome: 'won' }, { actorId: 'p2', links: { duel: 'duel1' } }), event('d3', 'duel', { outcome: 'neutral' }), event('d4', 'duel', { outcome: 'pending' })];
    expect(metric('151', events).value).toBe(3);
    expect(metric('152', events)).toMatchObject({ value: 1, pending: 1 });
    expect(metric('153', events)).toMatchObject({ value: 0, pending: 1 });
    expect(metric('154', events)).toMatchObject({ value: 50, denominator: 2, pending: 1 });
  });

  it('entrada e intercepción no acreditan automáticamente control recuperado', () => {
    const events = [event('t1', 'tackle', {}, { controlAfter: 'opponent' }), event('t2', 'tackle', {}, { controlAfter: 'disputed' }), event('t3', 'tackle', {}, { controlAfter: 'us' }), event('i4', 'interception', {}, { controlAfter: 'disputed' })];
    expect(metric('165', events).value).toBe(3);
    expect(metric('166', events)).toMatchObject({ value: 1, pending: 1 });
    expect(metric('167', events)).toMatchObject({ value: 50, pending: 1 });
    expect(metric('169', events).value).toBe(1);
  });

  it('une presión colectiva solapada y suma actor-minutos cuando se filtran jugadores', () => {
    const events = [event('p1', 'pressure', { intervalStart: 10, intervalEnd: 20 }), event('p2', 'pressure', { intervalStart: 15, intervalEnd: 25 }, { actorId: 'p2' })];
    expect(metric('184', events).value).toBe(15);
    expect(metric('184', events, { filters: { playerIds: ['p1', 'p2'] } }).value).toBe(20);
  });

  it('el umbral de recuperación rápida no configura presión ni retención', () => {
    const profile = { ...DEFAULT_ANALYSIS_PROFILE, parameters: { quickRecoverySeconds: 5 } };
    for (const id of ['133', '185', '186', '189', '193', '194', '195', '196', '197']) expect(metric(id, [], { profile }).status, id).toBe('not_configured');
  });

  it('presión requiere vínculo; una ventana exacta no utiliza el tiempo de voz', () => {
    const p = event('p1', 'pressure', {}, { time: exact(100) });
    const r = event('r2', 'recovery', { continuity: true }, { time: exact(104), links: { cause: 'p1' } });
    const profile = { ...DEFAULT_ANALYSIS_PROFILE, parameters: { pressureRecoverySeconds: 5 } };
    expect(metric('185', [p, r], { profile }).value).toBe(1);
    expect(metric('185', [p, { ...r, time: exact(105) }], { profile })).toMatchObject({ value: 0, pending: 1 });
    expect(metric('185', [p, { ...r, time: undefined }], { profile })).toMatchObject({ value: 0, pending: 1 });
  });

  it('retención exige control continuo y no perder y recuperar antes del corte', () => {
    const reception = event('r1', 'reception', {}, { time: exact(10) });
    const ownA = event('c2', 'control', { intervalStart: 10, intervalEnd: 12 }, { controlAfter: 'us', time: exact(10) });
    const loss = event('c3', 'control', { intervalStart: 12, intervalEnd: 13 }, { controlAfter: 'opponent', time: exact(12) });
    const ownB = event('c4', 'control', { intervalStart: 13, intervalEnd: 20 }, { controlAfter: 'us', time: exact(13) });
    const profile = { ...DEFAULT_ANALYSIS_PROFILE, parameters: { retentionSeconds: 5, retentionEndPolicy: 'stop_at_interruption' } };
    expect(metric('133', [reception, ownA, loss, ownB], { profile }).value).toBe(0);
    expect(metric('133', [reception, { ...ownA, facts: { intervalStart: 10, intervalEnd: 20 } }], { profile }).value).toBe(100);
  });

  it('una contrapresión colectiva y varias menciones de recuperación no superan el 100 %', () => {
    const events = [event('p1', 'pressure', { counterpress: true }, { time: exact(100), links: { loss: 'loss1' } }), event('p2', 'pressure', { counterpress: true }, { actorId: 'p2', time: exact(101), links: { loss: 'loss1' } }), event('r3', 'recovery', { continuity: true }, { time: exact(103), links: { cause: 'p1', loss: 'loss1', possession: 'pos1' } }), event('r4', 'recovery', { continuity: true }, { time: exact(104), links: { cause: 'p2', loss: 'loss1', possession: 'pos1' } })];
    const profile = { ...DEFAULT_ANALYSIS_PROFILE, parameters: { counterpressRecoverySeconds: 5 } };
    expect(metric('192', events, { profile }).value).toBe(1);
    expect(metric('194', events, { profile }).value).toBe(1);
    expect(metric('195', events, { profile }).value).toBe(100);
  });

  it('calcula tandas, reentradas y descansos con segundos de juego y sin banquillo expulsado', () => {
    const ctx = context([]);
    ctx.filters.playerIds = ['p1'];
    ctx.matches[0].match.starters = ['p1'];
    ctx.matches[0].match.ledger = { p1: { ...emptyParticipation(), minutes: 40, started: true, played: true, subIn: 1, subOut: 1, stints: [{ from: 0, to: 15 }, { from: 25, to: 50 }] } };
    expect(recipes['001'](ctx).value).toBe(40);
    expect(recipes['002'](ctx).value).toBe(80);
    expect(recipes['004'](ctx).value).toBe(10);
    expect(recipes['006'](ctx).value).toBe(2);
    expect(recipes['008'](ctx).value).toBe(1);
    expect(recipes['009'](ctx).value).toBe(20);
    expect(recipes['010'](ctx).value).toBe(25);
    expect(recipes['011'](ctx).value).toBe(10);
  });

  it('cambio sin hora impide minutos exactos pero conserva titularidad y salida conocida', () => {
    const sub = event('s1', 'substitution', { inPlayerId: 'p2' });
    const ctx = context([sub]); ctx.filters.playerIds = ['p1']; ctx.matches[0].match.starters = ['p1'];
    expect(recipes['001'](ctx)).toMatchObject({ value: null, status: 'unknown' });
    expect(recipes['005'](ctx).value).toBe(1);
    expect(recipes['006'](ctx).value).toBe(1);
    expect(recipes['007'](ctx).value).toBe(1);
  });

  it('la duración prevista de una parte no sustituye al límite real del reloj', () => {
    const ctx = context([]); ctx.filters = { playerIds: ['p1'], period: 1 }; ctx.matches[0].match.starters = ['p1'];
    expect(recipes['001'](ctx)).toMatchObject({ value: null, status: 'unknown' });
    ctx.matches[0].events = [event('c1', 'context', { intervalStart: 0, intervalEnd: 1537 }, { period: 1 })];
    expect(recipes['001'](ctx).value).toBeCloseTo(1537 / 60);
  });

  it('pases profundos y que rompen líneas exigen entrega completada', () => {
    const events = [event('p1', 'pass', { outcome: 'complete', deepPass: true, breaksLine: true }), event('p2', 'pass', { outcome: 'failed', deepPass: true, breaksLine: true }), event('p3', 'pass', { outcome: 'pending', deepPass: true, breaksLine: true })];
    const profile = { ...DEFAULT_ANALYSIS_PROFILE, parameters: { deepPassCriterion: 'declared_zone' } };
    expect(metric('098', events, { profile })).toMatchObject({ value: 1, pending: 1 });
    expect(metric('100', events, { profile })).toMatchObject({ value: 1, pending: 1 });
  });

  it('la pared rival exige identidades del pasador y receptor, no igualdad entre ausencias', () => {
    const first = event('p1', 'pass', { outcome: 'complete', phaseClosed: true }, { team: 'opponent', actorId: undefined, time: exact(10) });
    const back = event('p2', 'pass', { outcome: 'complete', continuity: true, phaseClosed: true }, { team: 'opponent', actorId: undefined, links: { pass: 'p1' }, time: exact(12) });
    const profile = { ...DEFAULT_ANALYSIS_PROFILE, parameters: { wallSeconds: 5 } };
    expect(metric('104', [first, back], { profile, team: 'opponent', events: [first, back] })).toMatchObject({ value: 0, pending: 2 });
    first.opponentId = 'r8'; first.facts.opponentReceiverId = 'r9';
    back.opponentId = 'r9'; back.facts.opponentReceiverId = 'r8';
    expect(metric('104', [first, back], { profile, team: 'opponent', events: [first, back] })).toMatchObject({ value: 1, pending: 0 });
  });

  it('atribuye la superación al defensor del club, separado de la identidad del regateador rival', () => {
    const known = event('d1', 'dribble', { outcome: 'complete', defenderId: 'p2' }, { team: 'opponent', actorId: undefined, opponentId: 'r8' });
    const unknown = event('d2', 'dribble', { outcome: 'complete' }, { team: 'opponent', actorId: undefined, opponentId: 'r9' });
    expect(metric('176', [known, unknown], { filters: { playerIds: ['p2'] }, events: [] })).toMatchObject({ value: 1, pending: 1 });
    expect(metric('176', [known], { filters: { playerIds: ['p1'] }, events: [] })).toMatchObject({ value: 0, pending: 0 });
    expect(metric('176', [known, unknown]).value).toBe(2);
  });
});
