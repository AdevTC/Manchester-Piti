import { describe, expect, it } from 'vitest';
import { analysisProblem, narratedAnalysisSchema, narrationSourcesSchema, observationSchema } from '../../functions/src/narrated/schema';
import { DEFAULT_ANALYSIS_PROFILE, type NarratedAnalysis, type Observation } from '../../functions/src/narrated/types';
import { narrationSnapshot, publicNarrationEvents } from '../../functions/src/narrated/privateSources';
import { previewNarration, correctNarrationObservation, resolveNarrationQuestion, narrationContext } from './narration';
import { defaultSheet, fromMatch, toPayload } from '../pages/admin/acta/sheetModel';
import { calculateLedger } from '../../functions/src/matchEngine';

const pass: Observation = { id: 'o1', kind: 'pass', team: 'us', actorId: 'a', receiverId: 'b', canonicalEventId: 'p1', order: 1, facts: { outcome: 'complete', underPressure: true }, provenance: { underPressure: { kind: 'explicit', sourceId: 's1' } } };
const analysis = (observations: Observation[] = [pass]): NarratedAnalysis => ({ version: 2, revision: 0, profile: DEFAULT_ANALYSIS_PROFILE, observations, coverage: [{ family: '*', team: 'us', state: 'partial' }] });
const sheet = defaultSheet('season', { rival: 'Rival', date: 1, starters: ['a','b','c','d','e','f','g'], events: [{ id: 'p1', type: 'pass', playerId: 'a', receiverId: 'b', outcome: 'complete', minute: 2 }] });
const bundle = (over = {}) => JSON.stringify({ format: 'piti-actions/v2', matchId: 'match', baseRevision: 0, events: [], analysis: analysis(), sources: [{ id: 's1', quote: 'Le presionan al pasar' }], ...over });

describe('narrated v2 validation and privacy', () => {
  it('merges enrichments by stable id while preserving canonical actions and private sources', () => {
    const first = previewNarration(bundle(), 'match', sheet);
    expect(first.errors).toEqual([]);
    expect(first.sheet.events).toEqual(sheet.events);
    expect(first.sheet.analysis?.observations).toHaveLength(1);
    const repeated = previewNarration(bundle(), 'match', first.sheet);
    expect(repeated.sheet.analysis?.observations).toHaveLength(1);
    expect(repeated.observationChanges[0].kind).toBe('unchanged');
    expect(repeated.sheet.narrationSources).toEqual([{ id: 's1', quote: 'Le presionan al pasar' }]);
  });
  it('preserves rich analysis through editing and payload but sends sources separately', () => {
    const edited = fromMatch({ ...sheet, analysis: analysis(), narrationSources: [{ id: 's1', quote: 'Private' }] });
    expect(edited.analysis).toEqual(analysis());
    const payload = toPayload(edited, true, id => id ?? '?');
    expect(payload.ok && payload.sheet.analysis).toEqual(analysis());
    expect(payload.ok && payload.sheet.narrationSources).toBeUndefined();
  });
  it('retains uncertainty without blocking independent canonical facts and requires correction to validate it', () => {
    const text = bundle({ analysis: { ...analysis(), issues: [{ id: 'q1', message: '¿Hubo presión?', eventIds: ['o1'] }] } });
    const pending = previewNarration(text, 'match', sheet);
    expect(pending.errors).toEqual([]);
    expect(pending.sheet.analysis?.observations[0].validity).toBe('pending');
    expect(pending.sheet.analysis?.issues).toHaveLength(1);
    const resolved = resolveNarrationQuestion(text, 0, 'Presión confirmada');
    expect(previewNarration(resolved, 'match', sheet).sheet.analysis?.issues?.[0].resolved).toBe('Presión confirmada');
    const corrected = correctNarrationObservation(resolved, { ...pass, facts: { outcome: 'complete', underPressure: false } });
    expect(previewNarration(corrected, 'match', sheet).sheet.analysis?.observations[0].facts.underPressure).toBe(false);
  });
  it('rejects duplicate, orphan, wrong-team and mismatched canonical references', () => {
    for (const observations of [[pass,pass], [{ ...pass, canonicalEventId: 'missing' }], [{ ...pass, actorId: 'intruder' }], [{ ...pass, kind: 'shot' as const }], [{ ...pass, actorId: undefined, receiverId: undefined, team: 'opponent' as const }]]) {
      expect(analysisProblem(analysis(observations), sheet.events, sheet.starters, 3000)).toBeTruthy();
    }
    expect(() => previewNarration(bundle({ analysis: analysis([pass, pass]) }), 'match', sheet)).toThrow(/repetidos/);
  });
  it('rejects claimed reconciliation when an aggregate overlaps individual plays', () => {
    const aggregate: Observation = { id:'sum',kind:'aggregate',team:'us',actorId:'a',order:3,quantity:8,aggregate:{kind:'pass',scopeId:'first-five',reconciled:true},time:{from:0,to:300,precision:'interval'},facts:{outcome:'complete'} };
    expect(analysisProblem(analysis([aggregate]), sheet.events, sheet.starters, 3000)).toMatch(/solapa/);
    expect(analysisProblem(analysis([{...aggregate,aggregate:{...aggregate.aggregate!,reconciled:false}}]), sheet.events, sheet.starters, 3000)).toBeNull();
    expect(observationSchema.safeParse({...aggregate,aggregate:{...aggregate.aggregate,kind:'goal'}}).success).toBe(false);
    expect(observationSchema.safeParse({...aggregate,aggregate:{...aggregate.aggregate,kind:'substitution'}}).success).toBe(false);
  });
  it('rejects invented exact intervals, invalid quantities and unbounded/private facts', () => {
    expect(observationSchema.safeParse({ ...pass, time: { from: 120, to: 180, precision: 'exact' } }).success).toBe(false);
    expect(observationSchema.safeParse({ ...pass, quantity: 8 }).success).toBe(false);
    expect(observationSchema.safeParse({ ...pass, facts: { sourceQuote: 'Private' } }).success).toBe(false);
    expect(observationSchema.safeParse({ ...pass, provenance: { underPressure: { kind: 'deduced' } } }).success).toBe(false);
    expect(narratedAnalysisSchema.safeParse({ ...analysis(), transcript: 'Private' }).success).toBe(false);
    expect(narrationSourcesSchema.safeParse([{ id: 's', quote: 'x'.repeat(1001) }]).success).toBe(false);
    expect(observationSchema.safeParse({ ...pass, facts: { underPressure: 'false' } }).success).toBe(false);
    expect(observationSchema.safeParse({ ...pass, facts: { madeUpMetric: 3 } }).success).toBe(false);
    expect(observationSchema.safeParse({ ...pass, facts: { intervalStart: 10 } }).success).toBe(false);
    expect(observationSchema.safeParse({ ...pass, facts: { goal: true } }).success).toBe(false);
  });
  it('requires goals and substitutions to agree with the actual acta and preserves a void correction', () => {
    const phantom = { ...pass, kind: 'goal' as const, receiverId: undefined, canonicalEventId: undefined, provenance: undefined, facts: { goal: true } };
    expect(analysisProblem(analysis([phantom]), sheet.events, sheet.starters, 3000)).toMatch(/acta/);
    expect(analysisProblem(analysis([{ ...pass, receiverId: 'c' }]), sheet.events, sheet.starters, 3000)).toMatch(/receptor/);
    expect(analysisProblem(analysis([{ ...phantom, canonicalEventId: 'deleted-goal', validity: 'void' }]), sheet.events, sheet.starters, 3000)).toBeNull();
  });
  it('bounds role intervals by real duration and validates separate rival identities', () => {
    const role: Observation = { id:'role',kind:'lineup',team:'us',actorId:'a',order:0,facts:{ role:'GK',intervalStart:1800,intervalEnd:4800 } };
    expect(analysisProblem(analysis([role]), sheet.events, sheet.starters,3000)).toMatch(/duración/);
    const duel: Observation = { id:'rival-dribble',kind:'dribble',team:'opponent',opponentId:'rival-1',order:1,facts:{ outcome:'won',defenderId:'a' } };
    expect(analysisProblem(analysis([duel]), sheet.events, sheet.starters,3000)).toBeNull();
    expect(analysisProblem(analysis([{...duel,facts:{outcome:'won',defenderId:'other-team'}}]), sheet.events,sheet.starters,3000)).toMatch(/jugador/);
  });
  it('requires canonical cards and rejects card aggregates without fabricating a dismissal', () => {
    for (const subtype of ['yellow_card','double_yellow','red_card','opponent_yellow','opponent_red']) {
      const card: Observation = { id:'card',kind:'discipline',team:'us',actorId:'a',order:1,facts:{subtype} };
      expect(analysisProblem(analysis([card]),sheet.events,sheet.starters,3000)).toMatch(/tarjetas/);
      expect(observationSchema.safeParse({...card,kind:'aggregate',quantity:2,time:{from:0,to:300,precision:'interval'},aggregate:{kind:'discipline',scopeId:'cards',reconciled:true}}).success).toBe(false);
      const ledger=calculateLedger({...sheet,analysis:analysis([card])});
      expect(ledger.players.a.dismissed).toBe(false);
      expect(ledger.players.a.redCards).toBe(0);
    }
    const foul: Observation={id:'foul',kind:'discipline',team:'us',actorId:'a',order:1,facts:{subtype:'foul'}};
    expect(analysisProblem(analysis([foul]),sheet.events,sheet.starters,3000)).toBeNull();
    const red={id:'red',type:'red_card' as const,playerId:'a',minute:10};
    expect(analysisProblem(analysis([{...foul,id:'red-detail',canonicalEventId:'red',facts:{subtype:'red_card'}}]),[red],sheet.starters,3000)).toBeNull();
  });
  it('preserves evidence privately while stripping legacy source quotes from public events', () => {
    const events = [{ ...sheet.events[0], sourceRef: 'Private original narration' }];
    expect(publicNarrationEvents(events)[0]).not.toHaveProperty('sourceRef');
    expect(narrationSnapshot({ events, analysis: analysis() })?.sources).toEqual([{ id: 'event-p1', quote: 'Private original narration' }]);
    expect(events[0].sourceRef).toBe('Private original narration');
  });
  it('exports a complete reusable prompt without private quotations or web audio instructions', () => {
    const context = JSON.parse(narrationContext('match', { ...sheet, events: [{ ...sheet.events[0], sourceRef: 'DO_NOT_EXPORT' }], narrationSources: [{ id: 's', quote: 'DO_NOT_EXPORT' }] }, []));
    expect(context.format).toBe('piti-context/v2');
    expect(context.catalogue.metrics.length).toBeGreaterThan(300);
    expect(context.contract.analysis.profile.playersPerSide).toBe(7);
    expect(JSON.stringify(context)).not.toContain('DO_NOT_EXPORT');
    expect(context.instructions).toContain('no graba');
    expect(context.factEnums.phase).toContain('defence');
    expect(context.subtypesByKind.run).toContain('overlap');
    expect(context.optionalParameters).toHaveProperty('keeperCleanSheetPolicy');
    expect(JSON.stringify(context).length).toBeLessThan(90000);
  });
});
