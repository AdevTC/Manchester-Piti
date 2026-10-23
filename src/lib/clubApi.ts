// (each callable loads Firebase on its first call: lib/fb)
import { lazyCallable } from "./fb";
import type { MatchSheet } from "./clubData";
import { withServerTime } from "./serverTime";
import type { MatchGuest } from "./derived/guests";
import type { LiveEventType } from "./liveActions";
// ---------- the vestuario door (functions/src/door.ts)
export interface Who {
  playerId?: string;
  name?: string;
}
export type InviteInfo =
  | { state: "valid"; by: string; expiresAt: number; playerId: string | null; playerName: string | null }
  | { state: "missing" | "expired" | "used" | "revoked"; problem: string };
export const inviteInfo = lazyCallable<{ code: string }, InviteInfo>("inviteInfo");
export const joinWithInvite = lazyCallable<Who & { code: string }, { nickname: string; linked: boolean }>("joinWithInvite");
export const requestAccess = lazyCallable<Who, { status: "member" | "pending" }>("requestAccess");
export const cancelAccessRequest = lazyCallable<void, { ok: boolean }>("cancelAccessRequest");
export const createInvite = lazyCallable<{ playerId?: string; maxUses?: 0 | 1; days?: number }, { code: string; expiresAt: number }>("createInvite");
export const revokeInvite = lazyCallable<{ code: string }, { ok: boolean }>("revokeInvite");
export const resolveAccess = lazyCallable<{ uid: string; approve: boolean; playerId?: string }, { ok: boolean }>("resolveAccess");
export const revokeMember = lazyCallable<{ uid: string }, { ok: boolean }>("revokeMember");
export const doorShirts = lazyCallable<void, { taken: string[]; inside: number }>("doorShirts");
// Match/season cascades may use the backend's full nine-minute execution window.
const lifecycleOptions = { timeout: 540_000 };
/** Permanently removes a match, its drafts, events and associated participation/votes. Admin only. */
export const deleteMatch = lazyCallable<{ id: string }, { ok: boolean }>("deleteMatch", lifecycleOptions);
/** Reversible exclusion from the calendar and statistics. Admin only. */
export const setMatchArchived = lazyCallable<{ id: string; archived: boolean }, { ok: boolean }>("setMatchArchived", lifecycleOptions);
/** Turnos «Hecho» (functions/src/rota.ts): the member's own turn of a match done (or taken back). */
export const markTurnDone = lazyCallable<{ turnId: string; done: boolean }, { done: boolean }>("markTurnDone");
export const savePrediction = lazyCallable<{ matchId: string; goalsFor: number; goalsAgainst: number; goals: import("../../functions/src/predictions").GoalPick[] }, { ok: boolean }>("savePrediction");
/** The one convocatoria (functions/src/convocatoria.ts): el siete + banquillo of a match; `notify` sends its push
 *  («Ya está la convocatoria» / once «Cambios en la convocatoria»). `at` = the `convocatoriaAt` it stamped. */
export interface SetConvocatoriaInput {
  matchId: string;
  starters: string[];
  bench: string[];
  notify: boolean;
  /** The pizarra's official just published for this match, whose seven this is: its «Ya está el siete»
   *  tells the team, so the convocatoria's own notice stays quiet (one «siete» per match). */
  fromBoard?: string;
  /** Invitados en el acta: the match's guest list (replaces it); absent keeps the stored one. */
  guests?: MatchGuest[];
}
export interface SetConvocatoriaResult {
  at: number;
  revision: number;
  /** The notice that went (null = none: not asked, already sent, covered, or the match has started). */
  notice: "first" | "changes" | null;
  /** «Ya está el siete» told (or is telling) the team this seven: announced without a second notice.
   *  (Absent from a server older than this field.) */
  covered?: boolean;
}
export const setConvocatoria = lazyCallable<SetConvocatoriaInput, SetConvocatoriaResult>("setConvocatoria");
export const saveMatchSheet = lazyCallable<
  { id: string; sheet: MatchSheet; draft: boolean; sources?: MatchSheet["narrationSources"] },
  { id: string }
>("saveMatchSheet");
export const requestPlayerClaim = lazyCallable<{ playerId: string }, { ok: boolean; linked: boolean }>("requestPlayerClaim",
);
export const setSeasonArchived = lazyCallable<
  { seasonId: string; archived: boolean },
  { matches: number; players: number }
>("setSeasonArchived", lifecycleOptions);
export const resolvePlayerClaim = lazyCallable<{
  uid: string;
  approve: boolean;
}>("resolvePlayerClaim");
export const proposeTraining = lazyCallable<
  { slots: { at: number; end?: number; place: string }[]; note: string },
  { id: string }
>("proposeTraining");
export const confirmTraining = lazyCallable<{ trainingId: string; slotId: string | null }>("confirmTraining");
export const deleteTraining = lazyCallable<{ trainingId: string }>("deleteTraining",
);
export function apiError(error: unknown) {
  const e = error as { code?: string; message?: string };
  if (
    e.code === "auth/popup-closed-by-user" ||
    e.code === "auth/cancelled-popup-request"
  )
    return "No se ha completado el acceso con Google. Puedes volver a intentarlo.";
  if (e.code === "auth/popup-blocked")
    return "El navegador ha bloqueado la ventana de Google. Permite las ventanas emergentes para esta web y vuelve a intentarlo.";
  if (e.code === "auth/unauthorized-domain")
    return "Esta dirección no está autorizada para iniciar sesión. Contacta con el administrador del club.";
  if (e.code === "auth/network-request-failed")
    return "No se ha podido conectar con Google. Comprueba tu conexión y vuelve a intentarlo.";
  if (
    e.code === "functions/internal" ||
    e.code === "functions/unavailable" ||
    e.code === "functions/not-found"
  )
    return "No se puede conectar con el servicio del club. Inténtalo de nuevo en unos instantes.";
  // Direct Firestore writes refused by the rules (closed vote, expired access, too fast…).
  if (e.code === "permission-denied")
    return "No se ha podido guardar: puede que ya esté cerrado o que tu acceso al vestuario haya caducado.";
  // Any other Google sign-in hiccup: never show the raw SDK text.
  if (e.code?.startsWith("auth/")) return "No se ha podido entrar con Google. Vuelve a intentarlo.";
  return e.message || "No se ha podido guardar. Vuelve a intentarlo.";
}
/** Modo banda: an admin adds an event to the match being played (or undoes the last one written live).
 *  Its answer's `serverNow` keeps this phone's live minute on the server's clock (lib/serverTime). */
export type LiveEventRequest =
  | { action: "add"; matchId: string; requestId?: string; clockRevision?: number; manualTime?: boolean; tappedElapsed?: number; period?: 1 | 2; event: { type: LiveEventType; minute: number; playerId?: string; assistPlayerId?: string; assistReviewed?: boolean; inPlayerId?: string } }
  | { action: "edit"; matchId: string; eventId: string; patch: { type?: LiveEventType; playerId?: string; assistPlayerId?: string; inPlayerId?: string; elapsedSeconds?: number; dupOk?: boolean } }
  | { action: "delete"; matchId: string; eventId: string }
  | { action: "undo" | "finish" | "reopen"; matchId: string; eventId?: string };
const liveEventCall = withServerTime(lazyCallable<LiveEventRequest, { events: number; serverNow?: number }>("liveEvent"));
/** An object without its `undefined` keys (same type: those keys are optional). */
const defined = <T extends object>(o: T): T => Object.fromEntries(Object.entries(o).filter(([, v]) => v !== undefined)) as T;
/** The Firebase SDK sends an `undefined` value as `null`, and the callable's zod `.optional()` refuses `null`
 *  (e.g. `clockRevision` on a match without a clock): absent keys are dropped here, in the envelope and in `event`. */
export const liveEvent = (data: LiveEventRequest) => liveEventCall(data.action === "add" ? { ...defined(data), event: defined(data.event) } : defined(data));

/** La mesa's own envelope for the same liveEvent callable: the whole mesa catalogue (MESA_TYPES, which the
 *  server's LIVE_TYPES becomes), the tapped time of a queued play, edits and deletes of any play. */
type MesaType = import("../../functions/src/liveRules").MesaType;
export interface MesaEventFields {
  type: MesaType;
  minute: number;
  playerId?: string;
  assistPlayerId?: string;
  assistReviewed?: boolean;
  inPlayerId?: string;
}
export interface MesaEventPatch {
  type?: MesaType;
  playerId?: string;
  assistPlayerId?: string;
  inPlayerId?: string;
  elapsedSeconds?: number;
  dupOk?: boolean;
}
export type MesaEventRequest =
  | { action: "add"; matchId: string; requestId: string; clockRevision?: number; tappedElapsed?: number; period?: 1 | 2; event: MesaEventFields }
  | { action: "edit"; matchId: string; eventId: string; patch: MesaEventPatch }
  | { action: "delete"; matchId: string; eventId: string }
  | { action: "undo"; matchId: string; eventId: string };
const mesaEventCall = withServerTime(lazyCallable<MesaEventRequest, { events: number; serverNow?: number }>("liveEvent"));
/** La mesa → liveEvent, with the undefined keys dropped (in the envelope, `event` and `patch`). */
export const mesaEvent = (data: MesaEventRequest) =>
  mesaEventCall(data.action === "add" ? { ...defined(data), event: defined(data.event) } : data.action === "edit" ? { ...data, patch: defined(data.patch) } : data);

/** La mesa: an admin or one of the match's scorers publishes the acta from the live record (assists answered inline). */
export const publishLive = lazyCallable<{ matchId: string; assists?: Record<string, string> }, { ok: boolean }>("publishLive");
export const controlMatchClock = withServerTime(lazyCallable<{ matchId: string; action: import("../../functions/src/matchClock").ClockAction; revision: number; value?: number },{ clock: import("../../functions/src/matchClock").MatchClock; serverNow?: number }>("controlMatchClock"));
export const setMatchScorers = lazyCallable<{ matchId: string; uids: string[] }, { ok: boolean }>("setMatchScorers");
/** La alineación del partido: the pizarra sends a board's seven to the match (admin or scorer, until kick-off). */
export const setMatchLineup = lazyCallable<import("../../functions/src/matchLineup").SetMatchLineupInput, import("../../functions/src/matchLineup").SetMatchLineupResult>("setMatchLineup");
/** La mesa's «¿Quién ha venido?» (admin or scorer, until kick-off). */
export const setMatchPresent = lazyCallable<import("../../functions/src/matchLineup").SetMatchPresentInput, { ok: boolean }>("setMatchPresent");
