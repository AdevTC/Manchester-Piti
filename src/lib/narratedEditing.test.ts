import { describe, expect, it } from 'vitest';
import { addNarratedObservation, editNarratedObservation, removeNarratedObservation, synchronizeCanonicalAnalysis } from '../../functions/src/narrated/editing';
import { DEFAULT_ANALYSIS_PROFILE, type Observation, type NarratedAnalysis } from '../../functions/src/narrated/types';
import { analysisProblem } from '../../functions/src/narrated/schema';
import { calculateLedger, type MatchEvent } from '../../functions/src/matchEngine';
import { liveSequenceProblem } from '../../functions/src/liveLogic';
import { defaultSheet, removeEvent, setMinute, setAssist, upsertEvent } from '../pages/admin/acta/sheetModel';
import { mergeLive } from '../pages/admin/acta/liveMerge';
import { correctNarrationEvent, correctNarrationObservation, previewNarration } from './narration';

const event: MatchEvent = { id: 'sub', type: 'substitution', minute: 2, elapsedSeconds: 120, period: 1, playerId: 'a', inPlayerId: 'h', source: 'narration' };
const observation: Observation = { id: 'detail', canonicalEventId: 'sub', kind: 'substitution', team: 'us', actorId: 'a', order: 1, period: 1, time: { from: 120, to: 120, precision: 'exact' }, facts: { inPlayerId: 'h' }, provenance: { time: { kind: 'explicit', sourceId: 'quote' }, inPlayerId: { kind: 'explicit', sourceId: 'quote' } } };
const analysis = (observations = [observation]): NarratedAnalysis => ({ version: 2, revision: 0, profile: DEFAULT_ANALYSIS_PROFILE, observations, coverage: [{ family: 'substitution', team: 'us', state: 'complete', from: 0, to: 3000 }] });
const sheet = () => defaultSheet('season', { rival: 'Rival', date: 1, duration: 50, durationSeconds: 3000, starters: ['a','b','c','d','e','f','g'], bench: ['h','i'], events: [event], analysis: analysis(), narrationSources: [{ id: 'quote', quote: 'En el minuto dos sale a y entra h.' }] });
const problem = (s: ReturnType<typeof sheet>) => analysisProblem(s.analysis, s.events, [...s.starters, ...s.bench], 3000);
const bundle = (s = sheet(), events = s.events) => JSON.stringify({ format: 'piti-actions/v2', matchId: 'match', baseRevision: 0, events, analysis: s.analysis });

describe('one editable action in the acta, narration and live ledger', () => {
  it('creates, edits and removes details, canonical substitutions and their references without erasing sources', () => {
    const initial: ReturnType<typeof sheet> = { ...sheet(), events: [], analysis: undefined };
    const created = addNarratedObservation(initial, { ...observation, canonicalEventId: undefined });
    expect(created.events[0]).toMatchObject({ id: 'n-detail', type: 'substitution', playerId: 'a', inPlayerId: 'h', elapsedSeconds: 120 });
    expect(calculateLedger(created).players.a.minutes).toBe(2);
    expect(problem(created)).toBeNull();
    const withPass = addNarratedObservation(created, { id: 'pass', kind: 'pass', team: 'us', actorId: 'h', receiverId: 'b', order: 2, time: { from: 180, to: 180, precision: 'exact' }, facts: { outcome: 'complete' }, links: { cause: 'detail' } });
    expect(calculateLedger(withPass).players.h.passesCompleted).toBe(1);
    const removedPass = removeNarratedObservation(withPass, 'pass');
    expect(calculateLedger(removedPass).players.h.passesCompleted ?? 0).toBe(0);
    const removed = removeNarratedObservation(withPass, 'detail');
    expect(removed.events).toEqual([]);
    expect(removed.analysis!.observations[0].links).toEqual({});
    expect(removed.narrationSources).toEqual(initial.narrationSources);
    expect(calculateLedger(removed).players.a.minutes).toBe(50);
    expect(() => addNarratedObservation(created, { ...observation, canonicalEventId: undefined })).toThrow(/identificador/);
  });
  it('restores a void canonical action by changing only its status and does not confirm pending changes', () => {
    const voided = editNarratedObservation(sheet(), { ...observation, validity: 'void' });
    const restored = editNarratedObservation(voided, { ...voided.analysis!.observations[0], validity: 'valid' });
    expect(restored.events[0]).toMatchObject({ type: 'substitution', playerId: 'a', inPlayerId: 'h', elapsedSeconds: 120 });
    expect(problem(restored)).toBeNull();
    expect(() => editNarratedObservation(sheet(), { ...observation, validity: 'pending', actorId: 'b' })).toThrow(/Confirma/);
    const pendingDetail = editNarratedObservation(sheet(), { ...observation, validity: 'pending' });
    expect(pendingDetail.events).toEqual(sheet().events);
  });
  it('corrects a narrated substitution from minute 2 to 3 and recomputes minutes without losing the source', () => {
    const edited = setMinute(sheet(), 'sub', '3');
    expect(edited.events[0]).toMatchObject({ minute: 3, inPlayerId: 'h' });
    expect(edited.events[0].elapsedSeconds).toBeUndefined();
    expect(edited.analysis?.observations[0]).toMatchObject({ actorId: 'a', period: 1, time: { from: 180, to: 239.999, precision: 'interval' } });
    expect(edited.analysis?.observations[0].provenance?.time).toEqual({ kind: 'explicit', rule: 'manual-correction' });
    expect(edited.narrationSources).toEqual(sheet().narrationSources);
    expect(problem(edited)).toBeNull();
    const result = calculateLedger(edited);
    expect(result.errors).toEqual([]);
    expect(result.players.a.minutes).toBe(3);
    expect(result.players.h.minutes).toBe(47);
    expect(liveSequenceProblem(edited, [...edited.events, { id: 'goal', type: 'goal', minute: 4, playerId: 'h' }])).toBeNull();
    expect(liveSequenceProblem(edited, [...edited.events, { id: 'early', type: 'goal', minute: 2, playerId: 'h' }])).toBeTruthy();
  });
  it('changes the exiting and entering players from the acta and the detail in either direction', () => {
    const canonical = upsertEvent(sheet(), { ...event, playerId: 'b', inPlayerId: 'i', minute: 3, elapsedSeconds: 185 });
    expect(canonical.analysis?.observations[0]).toMatchObject({ actorId: 'b', facts: { inPlayerId: 'i' }, time: { from: 185, to: 185 } });
    const rich = editNarratedObservation(canonical, { ...canonical.analysis!.observations[0], actorId: 'c', facts: { inPlayerId: 'h' }, time: { from: 240, to: 240, precision: 'exact' } });
    expect(rich.events[0]).toMatchObject({ playerId: 'c', inPlayerId: 'h', minute: 4, elapsedSeconds: 240 });
    expect(problem(rich)).toBeNull();
    expect(calculateLedger(rich).players.c.minutes).toBe(4);
    expect(calculateLedger(rich).players.h.minutes).toBe(46);
    expect(rich.analysis!.observations[0].provenance?.inPlayerId).toMatchObject({ kind: 'explicit', rule: 'manual-correction' });
  });
  it('deletes, voids and restores a linked substitution, including its question references', () => {
    const initial = sheet(); initial.analysis!.issues = [{ id: 'question', message: 'Cambio revisado', eventIds: ['sub'], resolved: 'Confirmado' }];
    const removed = removeEvent(initial, 'sub');
    expect(removed.analysis!.observations[0].validity).toBe('void');
    expect(removed.analysis!.issues![0].eventIds).toEqual(['detail']);
    expect(problem(removed)).toBeNull();
    expect(calculateLedger(removed).players.a.minutes).toBe(50);
    const restored = upsertEvent(removed, event);
    expect(restored.analysis!.observations[0].validity).toBe('valid');
    expect(problem(restored)).toBeNull();
    const voided = editNarratedObservation(initial, { ...observation, validity: 'void' });
    expect(voided.events).toEqual([]);
    expect(problem(voided)).toBeNull();
  });
  it('updates both representations in import corrections, including enrichments of existing acta events', () => {
    const corrected = correctNarrationEvent(bundle(), { ...event, minute: 3, elapsedSeconds: 180 });
    const first = previewNarration(corrected, 'match', sheet()).sheet;
    expect(first.analysis!.observations[0].time?.from).toBe(180);
    const rich = correctNarrationObservation(bundle(sheet(), []), { ...observation, facts: { inPlayerId: 'i' } }, sheet().events);
    expect(previewNarration(rich, 'match', sheet()).sheet.events[0].inPlayerId).toBe('i');
    const voided = correctNarrationObservation(bundle(sheet(), []), { ...observation, validity: 'void' }, sheet().events);
    expect(previewNarration(voided, 'match', sheet()).sheet.events).toEqual([]);
  });
  it('updates old rich details when importing a legacy correction and when catching up with the live mesa', () => {
    const text = JSON.stringify({ format: 'piti-actions/v1', matchId: 'match', baseRevision: 0, events: [{ ...event, minute: 3, elapsedSeconds: 180 }] });
    expect(previewNarration(text, 'match', sheet()).sheet.analysis!.observations[0].time?.from).toBe(180);
    const base = sheet(), local = { ...base, report: 'Mi crónica pendiente' };
    const server = { ...upsertEvent(base, { ...event, minute: 3, elapsedSeconds: 180 }), revision: 2 };
    const merged = mergeLive(local, base, server, new Set());
    expect(merged.report).toBe(local.report); expect(merged.revision).toBe(2);
    expect(problem(merged)).toBeNull(); expect(calculateLedger(merged).players.a.minutes).toBe(3);
  });
  it('removes an old assist from both sources instead of letting enrichment resurrect it', () => {
    const goal: MatchEvent = { id: 'goal', type: 'goal', minute: 2, playerId: 'a', assistPlayerId: 'b', assistReviewed: true };
    const goalDetail: Observation = { ...observation, id: 'gdetail', canonicalEventId: 'goal', kind: 'goal', facts: { goal: true, assistPlayerId: 'b', assistReviewed: true } };
    const initial = { ...sheet(), events: [goal], analysis: analysis([goalDetail]) };
    const corrected = setAssist(initial, 'goal', null);
    expect(corrected.analysis!.observations[0].facts.assistPlayerId).toBeUndefined();
    expect(calculateLedger(corrected).players.b.assists).toBe(0);
    expect(problem(corrected)).toBeNull();
  });
  it('rejects relinking and invented exact seconds', () => {
    expect(() => editNarratedObservation(sheet(), { ...observation, canonicalEventId: 'other' })).toThrow(/vínculo/);
    expect(() => editNarratedObservation(sheet(), { ...observation, time: { from: 100, to: 250, precision: 'approximate' } })).toThrow(/inventada/);
  });
  it('preserves an explicitly narrated period when canonical time is corrected and uses actual period bounds when known', () => {
    const before = [{ ...event, period: undefined }];
    const next = [{ ...before[0], elapsedSeconds: 180, minute: 3 }];
    expect(synchronizeCanonicalAnalysis(analysis(), before, next)!.observations[0].period).toBe(1);
    const bounds: Observation = { id: 'half', kind: 'context', team: 'us', order: 0, period: 2, facts: { intervalStart: 1400, intervalEnd: 3000 } };
    expect(synchronizeCanonicalAnalysis(analysis([observation, bounds]), before, [{ ...before[0], elapsedSeconds: 1450, minute: 24 }])!.observations[0].period).toBe(2);
    const timed = { ...sheet(), clock: { revision: 2, phase: 'ended' as const, firstStartedAt: 1000, firstEndedAt: 1401000, secondStartedAt: 1601000, endedAt: 3201000 } };
    const changed = upsertEvent(timed, { ...event, minute: 24, elapsedSeconds: 1450 });
    expect(changed.events[0].period).toBe(2); expect(changed.analysis!.observations[0].period).toBe(2);
    const rich = editNarratedObservation(timed, { ...observation, time: { from: 1450, to: 1450, precision: 'exact' } });
    expect(rich.events[0].period).toBe(2); expect(rich.analysis!.observations[0].period).toBe(2);
    const ambiguous = setMinute(timed, 'sub', '23');
    expect(ambiguous.events[0].period).toBeUndefined(); expect(ambiguous.analysis!.observations[0].period).toBeUndefined();
  });
});
