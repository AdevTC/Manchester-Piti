// /profile: the callables of functions/src/profile.ts (typed), the handle lookup for «Tu apodo» and
// the one direct write a member makes: his «Tus posiciones» proposal.
import { httpsCallable } from "firebase/functions";
import { doc, getDoc, serverTimestamp, updateDoc } from "firebase/firestore";
import { db, functions } from "../../firebase";
import type { PositionSet } from "../../lib/positions";
import { proposalPayload } from "../../lib/positionsEdit";

export { apiError, requestPlayerClaim } from "../../lib/clubApi";

export interface SetNicknameResult {
  nickname: string;
  previous: string;
  changed: boolean;
}
export interface SetShirtNameResult {
  shirtName: string;
  /** What was printed before: «Deshacer» calls setShirtName with it (accepted for 10 minutes). */
  previous: string;
  changed: boolean;
}

export const setNickname = httpsCallable<{ nickname: string }, SetNicknameResult>(functions, "setNickname");
export const setShirtName = httpsCallable<{ name: string }, SetShirtNameResult>(functions, "setShirtName");
export const cancelPlayerClaim = httpsCallable<Record<string, never>, { ok: boolean }>(functions, "cancelPlayerClaim");
export const leaveVestuario = httpsCallable<{ confirm: true }, { ok: boolean }>(functions, "leaveVestuario");

/** Whether another member already has this handle (nicknames/{nick}; members can read it). */
export async function nicknameTaken(nick: string, myUid: string): Promise<boolean> {
  const snap = await getDoc(doc(db, "nicknames", nick));
  if (!snap.exists()) return false;
  const owner: unknown = snap.get("uid");
  return owner !== myUid;
}

/** «Enviar al capitán» (a set) / «Retirar propuesta» (null). firestore.rules let a member touch only
 *  `positionsProposal` of his own ficha, dated by the server, and clear `positionsReview` with it. */
export async function proposePositions(playerId: string, set: PositionSet | null): Promise<void> {
  await updateDoc(doc(db, "players", playerId), proposalPayload(set, serverTimestamp()));
}
