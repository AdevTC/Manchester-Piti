import { httpsCallable } from "firebase/functions";
import { functions } from "../firebase";
import type { MatchSheet } from "./clubData";
// ---------- the vestuario door (functions/src/door.ts)
export interface Who {
  playerId?: string;
  name?: string;
}
export type InviteInfo =
  | { state: "valid"; by: string; expiresAt: number; playerId: string | null; playerName: string | null }
  | { state: "missing" | "expired" | "used" | "revoked"; problem: string };
export const inviteInfo = httpsCallable<{ code: string }, InviteInfo>(functions, "inviteInfo");
export const joinWithInvite = httpsCallable<Who & { code: string }, { nickname: string; linked: boolean }>(functions, "joinWithInvite");
export const requestAccess = httpsCallable<Who, { status: "member" | "pending" }>(functions, "requestAccess");
export const cancelAccessRequest = httpsCallable<void, { ok: boolean }>(functions, "cancelAccessRequest");
export const createInvite = httpsCallable<{ playerId?: string; maxUses?: 0 | 1; days?: number }, { code: string; expiresAt: number }>(functions, "createInvite");
export const revokeInvite = httpsCallable<{ code: string }, { ok: boolean }>(functions, "revokeInvite");
export const resolveAccess = httpsCallable<{ uid: string; approve: boolean; playerId?: string }, { ok: boolean }>(functions, "resolveAccess");
export const revokeMember = httpsCallable<{ uid: string }, { ok: boolean }>(functions, "revokeMember");
export const doorShirts = httpsCallable<void, { taken: string[]; inside: number }>(functions, "doorShirts");
/** «Borrar partido»: only a match nobody has played yet (the server refuses a finished one). */
export const deleteMatch = httpsCallable<{ id: string }, { ok: boolean }>(functions, "deleteMatch");
/** The one convocatoria (functions/src/convocatoria.ts): el siete + banquillo of a match; `notify` sends its push
 *  («Ya está la convocatoria» / once «Cambios en la convocatoria»). `at` = the `convocatoriaAt` it stamped. */
export interface SetConvocatoriaInput {
  matchId: string;
  starters: string[];
  bench: string[];
  notify: boolean;
}
export interface SetConvocatoriaResult {
  at: number;
  revision: number;
  /** The notice that went (null = none: not asked, already sent, or the match has started). */
  notice: "first" | "changes" | null;
}
export const setConvocatoria = httpsCallable<SetConvocatoriaInput, SetConvocatoriaResult>(functions, "setConvocatoria");
export const saveMatchSheet = httpsCallable<
  { id: string; sheet: MatchSheet; draft: boolean },
  { id: string }
>(functions, "saveMatchSheet");
export const requestPlayerClaim = httpsCallable<{ playerId: string }, { ok: boolean; linked: boolean }>(
  functions,
  "requestPlayerClaim",
);
export const setSeasonArchived = httpsCallable<
  { seasonId: string; archived: boolean },
  { matches: number; players: number }
>(functions, "setSeasonArchived");
export const resolvePlayerClaim = httpsCallable<{
  uid: string;
  approve: boolean;
}>(functions, "resolvePlayerClaim");
export const proposeTraining = httpsCallable<
  { slots: { at: number; end?: number; place: string }[]; note: string },
  { id: string }
>(functions, "proposeTraining");
export const confirmTraining = httpsCallable<{ trainingId: string; slotId: string | null }>(functions, "confirmTraining");
export const deleteTraining = httpsCallable<{ trainingId: string }>(
  functions,
  "deleteTraining",
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
/** Modo banda: an admin adds an event to the match being played (or undoes the last one written live). */
export const liveEvent = httpsCallable<
  | { action: "add"; matchId: string; event: { type: string; minute: number; playerId?: string; assistPlayerId?: string; inPlayerId?: string } }
  | { action: "undo"; matchId: string },
  { events: number }
>(functions, "liveEvent");
