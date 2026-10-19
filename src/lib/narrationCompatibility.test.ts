import { describe, expect, it } from 'vitest';
import { technicalEvents } from '../../functions/src/narrated/compatibility';
import { DEFAULT_ANALYSIS_PROFILE, type NarratedMatch, type Observation } from '../../functions/src/narrated/types';
import { analyseActions } from '../../functions/src/matchAnalysis';
import { calculateLedger } from '../../functions/src/matchEngine';
import { technicalAnalysis, hasAnalysisActions } from './technicalAnalysis';
import { defaultSheet } from '../pages/admin/acta/sheetModel';
import type { ClubMatch } from './clubData';

const pass: Observation = { id: 'p', kind: 'pass', team: 'us', actorId: 'a', receiverId: 'b', order: 0, time: { from: 20, to: 20, precision: 'exact' }, facts: { outcome: 'complete' } };
const match = (observations: Observation[]): NarratedMatch => ({ id: 'm', status: 'finished', duration: 50, analysis: { version: 2, revision: 0, profile: DEFAULT_ANALYSIS_PROFILE, observations, coverage: [] } });

describe('rich facts feed the existing football stats', () => {
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
