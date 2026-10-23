import { describe, expect, it } from 'vitest';
import { technicalEvents } from '../../functions/src/narrated/compatibility';
import { DEFAULT_ANALYSIS_PROFILE, type NarratedMatch, type Observation } from '../../functions/src/narrated/types';
import { analyseActions } from '../../functions/src/matchAnalysis';
import { calculateLedger } from '../../functions/src/matchEngine';
import { technicalAnalysis, hasAnalysisActions } from './technicalAnalysis';
import { defaultSheet } from '../pages/admin/acta/sheetModel';
import { evaluateNarrated } from '../../functions/src/narrated/engine';
import type { ClubMatch } from './clubData';

const pass: Observation = { id: 'p', kind: 'pass', team: 'us', actorId: 'a', receiverId: 'b', order: 0, time: { from: 20, to: 20, precision: 'exact' }, facts: { outcome: 'complete' } };
const match = (observations: Observation[]): NarratedMatch => ({ id: 'm', status: 'finished', duration: 50, analysis: { version: 2, revision: 0, profile: DEFAULT_ANALYSIS_PROFILE, observations, coverage: [] } });

describe('rich facts feed the existing football stats', () => {
  it.each(['us', 'opponent'] as const)('keeps a goal off the post as one shot with overlapping goal, target and woodwork counts for %s', team => {
    const m: NarratedMatch = {
      ...match([{ id: 'detail-goal', canonicalEventId: 'goal', kind: 'goal', team, actorId: team === 'us' ? 'a' : undefined, order: 1, facts: { woodwork: true } }]),
      events: [{ id: 'goal', type: team === 'us' ? 'goal' : 'opponent_goal', playerId: team === 'us' ? 'a' : undefined, minute: 2 }],
    };
    const projected = technicalEvents(m);
    const stats = analyseActions(projected);
    expect(projected).toHaveLength(1);
    expect(stats.shots).toHaveLength(1);
    expect(stats.teams[team]).toMatchObject({ shots: 1, shotGoals: 1, shotsOnTarget: 1, shotsWoodwork: 1, shotsOffTarget: 0, shotsBlocked: 0 });
    if (team === 'us') expect(stats.players.a).toMatchObject({ shots: 1, shotGoals: 1, shotsOnTarget: 1, shotsWoodwork: 1 });
    const metrics = evaluateNarrated([m], { team }, ['015','029','030','033']);
    expect(metrics.map(r => r.value)).toEqual([1, 1, 1, 1]);
  });
  it.each(['throw_in', 'goal_kick', 'kickoff', 'corner'] as const)('counts only confirmed executions of %s, preserving unknown and awarded restarts as evidence', subtype => {
    const rows: Observation[] = [
      { id: 'unknown', kind: 'restart', team: 'opponent', order: 1, facts: { subtype, outcome: 'unknown' } },
      { id: 'awarded', kind: 'restart', team: 'opponent', order: 2, facts: { subtype, stage: 'awarded' } },
      { id: 'executed', kind: 'restart', team: 'opponent', order: 3, facts: { subtype, stage: 'executed', outcome: 'unknown' } },
    ];
    const m = match(rows);
    expect(technicalEvents(m).map(e => e.id)).toEqual(['executed']);
    const key = { throw_in: 'throwIns', goal_kick: 'goalKicks', kickoff: 'kickoffs', corner: 'cornersTaken' }[subtype] as 'throwIns' | 'goalKicks' | 'kickoffs' | 'cornersTaken';
    expect(analyseActions(technicalEvents(m)).teams.opponent[key]).toBe(1);
    if (subtype === 'throw_in' || subtype === 'corner') {
      const metric = evaluateNarrated([m], { team: 'opponent' }, [subtype === 'throw_in' ? '265' : '252'])[0];
      expect(metric).toMatchObject({ value: 1, pending: 1, evidenceEventIds: ['m:executed'] });
    }
    expect(m.analysis!.observations).toEqual(rows);
  });
  it('keeps the execution certified by a canonical restart when its enrichment omits stage', () => {
    const m: NarratedMatch = { ...match([{ id: 'detail', canonicalEventId: 'old', kind: 'restart', team: 'us', order: 1, facts: { underPressure: true } }]), events: [{ id: 'old', type: 'throw_in', minute: 1, playerId: 'a' }] };
    expect(technicalEvents(m)).toMatchObject([{ id: 'detail', type: 'throw_in' }]);
    expect(analyseActions(technicalEvents(m)).teams.us.throwIns).toBe(1);
  });
  it('keeps blocked delivery outcomes aligned with the catalogue without turning them into shot outcomes', () => {
    const m = match([
      { ...pass, id: 'cross-blocked', receiverId: undefined, facts: { subtype: 'cross', outcome: 'failed', blocked: true } },
      { ...pass, id: 'pass-complete', facts: { outcome: 'complete' } },
      { ...pass, id: 'cross-pending', receiverId: undefined, facts: { subtype: 'cross', outcome: 'pending', blocked: true } },
      { ...pass, id: 'shot-blocked', kind: 'shot', receiverId: undefined, facts: { outcome: 'blocked' } },
      { ...pass, id: 'shot-saved', kind: 'shot', receiverId: undefined, facts: { outcome: 'saved' } },
    ]);
    const projected = technicalEvents(m);
    expect(projected.find(e => e.id === 'cross-blocked')).toMatchObject({ type: 'cross', outcome: 'incomplete' });
    expect(projected.find(e => e.id === 'cross-pending')).toMatchObject({ type: 'cross', outcome: 'unknown' });
    const stats = analyseActions(projected).players.a;
    expect(stats).toMatchObject({ passes: 3, passesCompleted: 1, passesFailed: 1, passesUnknown: 1, crosses: 2, shots: 2, shotsBlocked: 1, shotsOnTarget: 1 });
    const metrics = new Map(evaluateNarrated([m], {}, ['067','068','069','070']).map(r => [r.id, r]));
    expect([metrics.get('067')?.value, metrics.get('068')?.value, metrics.get('069')?.value]).toEqual([stats.passes, stats.passesCompleted, stats.passesFailed]);
    expect(metrics.get('070')).toMatchObject({ numerator: 1, denominator: 2, pending: stats.passesUnknown, value: 50 });
    const ledger = calculateLedger(defaultSheet('s', { starters: ['a','b','c','d','e','f','g'], analysis: m.analysis }));
    expect(ledger.players.a).toMatchObject({ passes: 3, passesCompleted: 1, passesFailed: 1, passesUnknown: 1 });
    expect(m.analysis!.observations[0].facts.blocked).toBe(true);
  });
  it('counts passes, recipients and links once without fabricating loss or recovery', () => {
    const result = analyseActions(technicalEvents(match([pass, { ...pass, id:'f',receiverId:undefined,facts:{ outcome:'failed' } }, { id:'i',kind:'interception',team:'us',actorId:'a',order:2,facts:{} }])));
    expect(result.players.a).toMatchObject({ passes: 2, passesCompleted: 1, passesFailed: 1, turnovers: 0, recoveries: 0, interceptions: 1 });
    expect(result.players.b.passesReceived).toBe(1);
    expect(result.links).toEqual([{ from:'a',to:'b',count:1,crosses:0 }]);
  });
  it('handles aggregate weights without allocating invented events', () => {
    const events = technicalEvents(match([{ ...pass, id:'aggregate',kind:'aggregate',time:{from:10,to:100,precision:'interval'},quantity:120,aggregate:{kind:'pass',scopeId:'isolated',reconciled:true} }]));
    expect(events).toHaveLength(1);
    expect(analyseActions(events).players.a.passesCompleted).toBe(120);
    expect(analyseActions(events).links[0].count).toBe(120);
  });
  it('inherits known canonical details while an enrichment adds evidence', () => {
    const m = { ...match([{ ...pass, id:'enriched',canonicalEventId:'old',receiverId:undefined,facts:{underPressure:true} }]), events:[{id:'old',type:'pass' as const,minute:0,elapsedSeconds:20,playerId:'a',receiverId:'b',outcome:'complete' as const}] };
    // Missing fields must really be absent in JSON, not present with JavaScript undefined.
    delete m.analysis!.observations[0].receiverId;
    const projected = technicalEvents(m);
    expect(projected).toHaveLength(1);
    expect(projected[0]).toMatchObject({outcome:'complete',receiverId:'b'});
    expect(analyseActions(projected).players.a.passesCompleted).toBe(1);
  });
  it('excludes uncertain or void observations including their replaced canonical event', () => {
    const m = { ...match([{...pass,canonicalEventId:'old',validity:'pending'}]),events:[{id:'old',type:'pass' as const,minute:1,outcome:'complete' as const}] };
    expect(technicalEvents(m)).toEqual([]);
    expect(technicalEvents(match([{...pass,validity:'void'}]))).toEqual([]);
  });
  it('feeds the published player ledger and aggregates repeated ids separately for each match', () => {
    const s = defaultSheet('s',{starters:['a','b','c','d','e','f','g'],analysis:match([pass]).analysis});
    expect(calculateLedger(s).players.a.passesCompleted).toBe(1);
    const matches = [match([pass]),{...match([pass]),id:'m2'}] as ClubMatch[];
    expect(technicalAnalysis(matches).players.a.passesCompleted).toBe(2);
    expect(hasAnalysisActions(matches,'a')).toBe(true);
  });
  it('keeps chance separate from shot and respects the pass universe and deflection policy', () => {
    const m = match([{...pass,id:'c',kind:'context',receiverId:undefined,facts:{chance:true}}, {...pass,id:'cross',facts:{subtype:'cross',outcome:'complete'}}, {...pass,id:'deflection',receiverId:undefined,facts:{outcome:'complete',deflected:true}}]);
    m.analysis!.profile={...DEFAULT_ANALYSIS_PROFILE,passes:{...DEFAULT_ANALYSIS_PROFILE.passes,crosses:false}};
    expect(analyseActions(technicalEvents(m)).players.a).toMatchObject({shots:0,chancesCreated:1,crosses:1,passes:1,passesFailed:1,turnovers:0});
  });
});
