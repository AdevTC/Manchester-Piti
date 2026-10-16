import { z } from 'zod';
import { allowedAtBreak } from '../../functions/src/liveRules';
import { clockReading } from '../../functions/src/matchClock';
import type { ClubMatch } from './clubData';

export const QUICK_ACTIONS = [
  ['goal', 'Gol del Piti'], ['chance', 'Ocasión del Piti'], ['corner', 'Córner del Piti'],
  ['yellow_card', 'Amarilla'], ['substitution', 'Cambio'], ['opponent_goal', 'Gol rival'],
  ['opponent_chance', 'Ocasión rival'], ['opponent_corner', 'Córner rival'],
  ['woodwork', 'Al palo'], ['penalty_saved', 'Penalti parado'], ['red_card', 'Roja'], ['double_yellow', 'Segunda amarilla'],
] as const;
export type QuickAction = typeof QUICK_ACTIONS[number][0];
const action = z.enum(QUICK_ACTIONS.map(([type]) => type));
const id = z.string().min(1).max(200);
const revision = z.number().int().nonnegative().optional();
const selectionSchema = z.object({
  action: action.nullable(), out: id.nullable(), manual: z.string().max(10),
  minute: z.number().int().min(0).max(150), clockRevision: revision,
});
const payloadSchema = z.discriminatedUnion('action', [
  z.object({
    action: z.literal('add'), matchId: id, requestId: id, clockRevision: revision, manualTime: z.boolean(),
    event: z.object({
      type: action, minute: z.number().int().min(0).max(150),
      playerId: id.optional(), inPlayerId: id.optional(), assistReviewed: z.boolean().optional(),
    }),
  }),
  z.object({ action: z.literal('undo'), matchId: id, eventId: id }),
]);
const attemptSchema = z.object({
  operationId: id, payload: payloadSchema, label: z.string().max(500),
  createdAt: z.number().finite(), status: z.enum(['pending', 'sent', 'confirmed']),
});
const recordSchema = z.object({
  version: z.literal(1), updatedAt: z.number().finite(),
  selection: selectionSchema.nullable(), attempt: attemptSchema.nullable(), ownId: id.nullable(),
});
export type QuickSelection = z.infer<typeof selectionSchema>;
export type QuickAttempt = z.infer<typeof attemptSchema>;
export type QuickRecord = z.infer<typeof recordSchema>;
export const QUICK_RETENTION_MS = 24 * 60 * 60 * 1000;
export const QUICK_RETRY_MS = 2 * 60 * 60 * 1000;
export const QUICK_STORAGE_EVENT = 'mp:quick-match-draft';

/** Called from the tap handler; both the original request and its persisted receipt share an ID. */
export function createQuickAttempt(payload: QuickAttempt['payload'], label: string, createdAt = Date.now()): QuickAttempt {
  return { payload, label, createdAt, operationId: payload.action === 'add' ? payload.requestId : crypto.randomUUID(), status: 'pending' };
}

/** Only match actions and identifiers: never auth tokens, profile details, or clock commands. */
export const quickStorageKey = (uid: string, matchId: string) =>
  `mp:quick-match:v1:${import.meta.env.VITE_FIREBASE_PROJECT_ID ?? 'club'}:${encodeURIComponent(uid)}:${encodeURIComponent(matchId)}`;

export function readQuickRecord(key: string, now = Date.now()): { record: QuickRecord | null; available: boolean; expired: boolean } {
  try {
    const raw = localStorage.getItem(key);
    if (!raw) return { record: null, available: true, expired: false };
    let value: unknown;
    try { value = raw.length < 20_000 ? JSON.parse(raw) : null; }
    catch { localStorage.removeItem(key); return { record: null, available: true, expired: false }; }
    const parsed = recordSchema.safeParse(value);
    if (!parsed.success) { localStorage.removeItem(key); return { record: null, available: true, expired: false }; }
    const expired = now - parsed.data.updatedAt > QUICK_RETENTION_MS || parsed.data.updatedAt > now + 300_000;
    if (expired) localStorage.removeItem(key);
    return { record: expired ? null : parsed.data, available: true, expired };
  } catch { return { record: null, available: false, expired: false }; }
}

export function writeQuickRecord(key: string, record: QuickRecord, source: string): boolean {
  try {
    localStorage.setItem(key, JSON.stringify(record));
    window.dispatchEvent(new CustomEvent(QUICK_STORAGE_EVENT, { detail: { key, source } }));
    return true;
  } catch { return false; }
}

export function quickConfirmed(attempt: QuickAttempt, match: ClubMatch, fresh: boolean): boolean {
  if (!fresh) return false;
  const payload = attempt.payload;
  return payload.action === 'add'
    ? !!match.events?.some(event => event.id === `live-${payload.requestId}`)
    : !(match.events ?? []).some(event => event.id === payload.eventId);
}

/** Replays never adopt a newer clock revision. A changed half must be reviewed in the acta. */
export function quickRetryProblem(attempt: QuickAttempt, match: ClubMatch, now: number, localNow = Date.now()): string | null {
  if (attempt.payload.matchId !== match.id) return 'Esta jugada pertenece a otro partido.';
  if (localNow - attempt.createdAt > QUICK_RETRY_MS || attempt.createdAt > localNow + 300_000)
    return 'La jugada lleva más de dos horas pendiente. Revísala en el acta antes de incorporarla.';
  if (match.status === 'finished' || match.status === 'cancelled' || match.status === 'postponed' || match.liveEndedAt)
    return 'El partido ya no admite jugadas en directo. Revisa esta jugada en el acta.';
  const reading = clockReading(match.clock, now);
  if (attempt.payload.action === 'undo')
    return reading.phase === 'ready' || reading.phase === 'ended' ? 'El reloj ha cambiado. Revisa esta jugada en el acta.' : null;
  if (attempt.payload.clockRevision !== match.clock?.revision)
    return 'La parte ha cambiado desde que apuntaste la jugada. Revísala en el acta para conservar su momento original.';
  if (!reading.playing && !(reading.phase === 'halftime' && allowedAtBreak(attempt.payload.event.type)))
    return 'Esta jugada no se puede enviar en la fase actual. Revísala en el acta.';
  if (attempt.payload.event.minute > Math.floor(reading.elapsedSeconds / 60))
    return 'El minuto guardado supera el reloj actual. Revisa la jugada en el acta.';
  return null;
}

/** The server deduplicates the same ID before validating its time. If it never arrived, preserve
 * the original minute rather than stamping it at the time the connection came back. */
export function quickRetryPayload(attempt: QuickAttempt): QuickAttempt['payload'] {
  return attempt.payload.action === 'add' ? { ...attempt.payload, manualTime: true } : attempt.payload;
}
