import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { ClubMatch } from './clubData';
import { QUICK_RETENTION_MS, QUICK_RETRY_MS, quickConfirmed, quickRetryPayload, quickRetryProblem, quickStorageKey, readQuickRecord, writeQuickRecord, type QuickAttempt, type QuickRecord } from './quickMatchRecovery';

const now = 1_000_000;
const attempt: QuickAttempt = {
  operationId: 'request', createdAt: now, status: 'pending', label: 'Gol rival',
  payload: { action: 'add', matchId: 'm', requestId: 'request', clockRevision: 1, manualTime: false, event: { type: 'opponent_goal', minute: 10 } },
};
const record: QuickRecord = { version: 1, updatedAt: now, ownId: null, selection: null, attempt };
const match: ClubMatch = { id: 'm', status: 'scheduled', events: [], clock: { phase: 'first', revision: 1, firstStartedAt: 0 } };
const key = quickStorageKey('me', 'm');
beforeEach(() => { localStorage.clear(); vi.restoreAllMocks(); });

describe('local draft envelope', () => {
  it('roundtrips only the scoped match action and its receipt', () => {
    expect(writeQuickRecord(key, record, 'tab')).toBe(true);
    expect(readQuickRecord(key, now)).toEqual({ record, available: true, expired: false });
    expect(readQuickRecord(quickStorageKey('other', 'm'), now).record).toBeNull();
    expect(readQuickRecord(quickStorageKey('me', 'other'), now).record).toBeNull();
  });
  it('expires old or impossible future records without trying to send them', () => {
    writeQuickRecord(key, record, 'tab');
    expect(readQuickRecord(key, now + QUICK_RETENTION_MS + 1)).toEqual({ record: null, available: true, expired: true });
    expect(localStorage.getItem(key)).toBeNull();
    writeQuickRecord(key, { ...record, updatedAt: now + 300_001 }, 'tab');
    expect(readQuickRecord(key, now).expired).toBe(true);
  });
  it.each(['{bad', '{}', 'x'.repeat(20_001), JSON.stringify({ ...record, attempt: { ...attempt, payload: { action: 'finish', matchId: 'm' } } })])('rejects malformed/oversized records and clock controls', raw => {
    localStorage.setItem(key, raw);
    expect(readQuickRecord(key, now)).toEqual({ record: null, available: true, expired: false });
    expect(localStorage.getItem(key)).toBeNull();
  });
  it('does not throw when storage is blocked', () => {
    vi.spyOn(Storage.prototype, 'getItem').mockImplementation(() => { throw new Error('blocked'); });
    vi.spyOn(Storage.prototype, 'setItem').mockImplementation(() => { throw new Error('blocked'); });
    expect(readQuickRecord(key, now).available).toBe(false);
    expect(writeQuickRecord(key, record, 'tab')).toBe(false);
  });
});

describe('reconciliation and retry safety', () => {
  it('only a fresh snapshot confirms the original event, not another scorer’s identical goal', () => {
    const changed = { ...match, events: [{ id: 'live-other', type: 'opponent_goal' as const, minute: 10 }] };
    expect(quickConfirmed(attempt, changed, true)).toBe(false);
    changed.events.push({ id: 'live-request', type: 'opponent_goal', minute: 10 });
    expect(quickConfirmed(attempt, changed, false)).toBe(false);
    expect(quickConfirmed(attempt, changed, true)).toBe(true);
  });
  it('undo reconciliation is targeted and waits for the server snapshot', () => {
    const undo: QuickAttempt = { ...attempt, payload: { action: 'undo', matchId: 'm', eventId: 'live-request' } };
    expect(quickConfirmed(undo, match, false)).toBe(false);
    expect(quickConfirmed(undo, match, true)).toBe(true);
    expect(quickConfirmed(undo, { ...match, events: [{ id: 'live-request', type: 'goal', minute: 10 }] }, true)).toBe(false);
    expect(quickRetryPayload(undo)).toEqual(undo.payload);
  });
  it('preserves identity and minute instead of dating a recovered event at reconnection', () => {
    expect(quickRetryPayload(attempt)).toEqual({ ...attempt.payload, manualTime: true });
    expect(quickRetryProblem(attempt, match, now, now)).toBeNull();
  });
  it('blocks expired attempts, different matches, ended games and changed halves', () => {
    expect(quickRetryProblem(attempt, match, now, now + QUICK_RETRY_MS + 1)).toMatch(/dos horas/);
    expect(quickRetryProblem(attempt, { ...match, id: 'other' }, now, now)).toMatch(/otro partido/);
    expect(quickRetryProblem(attempt, { ...match, status: 'finished' }, now, now)).toMatch(/ya no admite/);
    expect(quickRetryProblem(attempt, { ...match, clock: { ...match.clock!, phase: 'second', revision: 3 } }, now, now)).toMatch(/parte ha cambiado/);
    expect(quickRetryProblem(attempt, { ...match, clock: { ...match.clock!, phase: 'halftime' } }, now, now)).toMatch(/fase actual/);
    expect(quickRetryProblem(attempt, match, 5 * 60_000, now)).toMatch(/supera el reloj/);
  });
});
