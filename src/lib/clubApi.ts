import { httpsCallable } from "firebase/functions";
import { functions } from "../firebase";
import type { MatchSheet } from "./clubData";
export const enterTeam = httpsCallable<
  { password: string },
  { expiresAt: number }
>(functions, "enterTeam");
export const leaveTeam = httpsCallable(functions, "leaveTeam");
export const registerTeamProfile = httpsCallable<
  { nickname: string },
  { nickname: string; role: "admin" | "superadmin" | "user" }
>(functions, "registerTeamProfile");
export const saveMatchSheet = httpsCallable<
  { id: string; sheet: MatchSheet; draft: boolean },
  { id: string }
>(functions, "saveMatchSheet");
export const voteMvp = httpsCallable<{ matchId: string; playerId: string }>(
  functions,
  "voteMvp",
);
export const setAvailability = httpsCallable<{
  matchId: string;
  response: string;
}>(functions, "setAvailability");
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
  { slots: { at: number; place: string }[]; note: string },
  { id: string }
>(functions, "proposeTraining");
export const voteTraining = httpsCallable<{
  trainingId: string;
  slotIds: string[];
}>(functions, "voteTraining");
export const deleteTraining = httpsCallable<{ trainingId: string }>(
  functions,
  "deleteTraining",
);
export const predictScore = httpsCallable<{
  matchId: string;
  goalsFor: number;
  goalsAgainst: number;
}>(functions, "predictScore");
export const postBoardMessage = httpsCallable<{ text: string }, { id: string }>(
  functions,
  "postBoardMessage",
);
export const deleteBoardMessage = httpsCallable<{ id: string }>(
  functions,
  "deleteBoardMessage",
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
  return e.message || "No se ha podido guardar. Vuelve a intentarlo.";
}
