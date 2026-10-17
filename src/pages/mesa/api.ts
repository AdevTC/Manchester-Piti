// A wave of changes in one liveEvent call (`addMany`, functions/src/live.ts): Descanso's «Arrancar con N
// cambios» (through la mesa's queue) and the pizarra's live «Hacer el cambio» write every change of the wave
// at once, all or none, idempotent by requestId (event ids `live-<requestId>-<i>`).
import { httpsCallable } from "firebase/functions";
import { functions } from "../../firebase";
import { withServerTime } from "../../lib/serverTime";

/** The most changes in one wave (the server's MAX_MANY). */
export const MAX_WAVE = 7;

export interface WaveSub {
  /** Who goes off. */
  playerId: string;
  /** Who comes on. */
  inPlayerId: string;
  minute: number;
  clockRevision?: number;
  /** Tapped without signal (la mesa's queue): the seconds of play at the tap, and its half. */
  tappedElapsed?: number;
  period?: 1 | 2;
}
export interface AddManyRequest {
  action: "addMany";
  matchId: string;
  requestId: string;
  items: { clockRevision?: number; tappedElapsed?: number; period?: 1 | 2; event: { type: "substitution"; minute: number; playerId: string; inPlayerId: string } }[];
}
const call = withServerTime(httpsCallable<AddManyRequest, { events: number; eventIds?: string[]; serverNow?: number }>(functions, "liveEvent"));

/** The ids the server gives a wave's changes. */
export const waveIds = (requestId: string, n: number): string[] => Array.from({ length: n }, (_, i) => `live-${requestId}-${i}`);

/** The callable's body for a wave (absent keys dropped: the SDK would send `undefined` as `null`). */
export function addManyRequest(matchId: string, requestId: string, subs: readonly WaveSub[]): AddManyRequest {
  return {
    action: "addMany",
    matchId,
    requestId,
    items: subs.map((s) => ({
      ...(s.clockRevision !== undefined ? { clockRevision: s.clockRevision } : {}),
      ...(s.tappedElapsed !== undefined ? { tappedElapsed: s.tappedElapsed } : {}),
      ...(s.period !== undefined ? { period: s.period } : {}),
      event: { type: "substitution" as const, minute: s.minute, playerId: s.playerId, inPlayerId: s.inPlayerId },
    })),
  };
}

/** Writes a wave of changes in one operation. */
export const addSubs = (matchId: string, requestId: string, subs: readonly WaveSub[]) => call(addManyRequest(matchId, requestId, subs));
