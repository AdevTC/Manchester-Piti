// A wave of changes in one liveEvent call (`addMany`, functions/src/live.ts): Descanso's «Arrancar con N
// cambios», En juego's change with its «Recolocar» (both through la mesa's queue) and the pizarra's live
// «Hacer el cambio» write every change of the wave at once, all or none, idempotent by requestId (event ids
// `live-<requestId>-<i>`). A wave holds changes (substitution) and swaps of place (position_swap).
import { httpsCallable } from "firebase/functions";
import { functions } from "../../firebase";
import { withServerTime } from "../../lib/serverTime";
import { lazyCallable } from "../../lib/fb";

/** The most plays in one wave (the server's MAX_MANY): 7 changes and 7 swaps. */
export const MAX_WAVE = 14;

/** What a wave can carry. */
export type WaveType = "substitution" | "position_swap";

export interface WaveSub {
  /** A change (the default) or a swap of place. */
  type?: WaveType;
  /** Who goes off (a swap: the one, «a»). */
  playerId: string;
  /** Who comes on (a swap: the other one, «b»). */
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
  items: { clockRevision?: number; tappedElapsed?: number; period?: 1 | 2; event: { type: WaveType; minute: number; playerId: string; inPlayerId: string } }[];
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
      event: { type: s.type ?? "substitution", minute: s.minute, playerId: s.playerId, inPlayerId: s.inPlayerId },
    })),
  };
}

/** Writes a wave of changes (and swaps) in one operation. */
export const addSubs = (matchId: string, requestId: string, subs: readonly WaveSub[]) => call(addManyRequest(matchId, requestId, subs));

// ---------- r12 (D/src/admin/impl/API.md): la mesa's own wrappers, so it doesn't wait on clubApi's r12 block.
/** «+ Invitado» from the touchline (a captain or the match's anotador): on the bench and, with a roll call, in it.
 *  A name already there returns that guest (`created: false`). */
export const addMatchGuest = lazyCallable<{ matchId: string; name: string }, { guest: { id: string; name: string }; ref: string; created: boolean }>("addMatchGuest");
/** «Duración» from the clock sheet (10–150 minutes): the suggested end and the progress follow it. */
export const setMatchDuration = lazyCallable<{ matchId: string; minutes: number }, { duration: number; revision: number }>("setMatchDuration");
/** «Escribe dos líneas para la crónica» after the acta is published (the anotador: up to 220 letters). */
export const saveMatchReport = lazyCallable<{ matchId: string; report: string }, { ok: boolean; revision: number }>("saveMatchReport");
/** The rival's goal push leaves this long after the play (the server holds it 10 s; 2 s are left for the network):
 *  «Deshacer» inside it and nobody hears of it (M-33). */
export const RIVAL_GOAL_HOLD_MS = 8_000;
