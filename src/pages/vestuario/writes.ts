// Direct Firestore writes for the vestuario's everyday actions (votes, "voy / no puedo",
// board). The porra uses a callable to validate goals and serialize with kick-off.
// The security rules validate the other actions (firestore.rules), so there is no
// Cloud Function round trip: the SDK applies each write to the local cache first, every
// open listener (this device) updates at once and the rest of the team gets it in realtime.
// (Firebase is in by the time anyone taps; each write waits for it otherwise: lib/fb)
import { viaFirebase } from "../../lib/fb";
import { absenceFields } from "../../lib/derived/absences";
import { pollFields, voteFields, type Poll, type PollForm } from "../../lib/derived/polls";
import { ratingFields, reactionFields, type ReactionId } from "../../lib/derived/trasElPartido";
import { useAuth } from "../../context/AuthContext";
import { markTurnDone as markTurnDoneCall, savePrediction } from "../../lib/clubApi";
import { cajaClaimFields, claimProblem, type NewCajaClaim } from "../../lib/derived/cajaClaims";
import type { GoalPick } from "../../../functions/src/predictions";

/** How a member is shown to the team; the rules check it against users/{uid}. */
export interface Me {
  uid: string;
  name: string;
  playerId: string | null;
}
export function useMe(): Me | null {
  const { user, profile } = useAuth();
  if (!user || !profile) return null;
  return { uid: user.uid, name: profile.nickname, playerId: profile.playerId ?? null };
}

/** The member opened the bell's panel: everything up to now is read, on all their devices (only this
 *  field; the rules let the owner touch nothing else of users/{uid} here). */
export const markNoticesSeen = (uid: string) =>
  viaFirebase((fb) => fb.updateDoc(fb.doc(fb.db, "users", uid), { noticesSeenAt: fb.serverTimestamp() }));

export const voteMvp = (me: Me, matchId: string, playerId: string) =>
  viaFirebase((fb) => fb.setDoc(fb.doc(fb.db, "matches", matchId, "votes", me.uid), { playerId, voterName: me.name, at: fb.serverTimestamp() }));

export const setAvailability = (me: Me, matchId: string, response: "yes" | "no" | "maybe") =>
  viaFirebase((fb) =>
    fb.setDoc(fb.doc(fb.db, "matchPrivate", matchId, "availability", me.uid), { response, name: me.name, playerId: me.playerId, at: fb.serverTimestamp() }),
  );

/** Tras el partido: all of a member's reactions to this match's moments, in their one doc (none left: the
 *  doc goes). Signed like the availability; the rules check the moments and that the acta is published. */
export const setReactions = (me: Me, matchId: string, moments: Record<string, ReactionId>) =>
  viaFirebase((fb) => {
    const ref = fb.doc(fb.db, "matches", matchId, "reactions", me.uid);
    return Object.keys(moments).length ? fb.setDoc(ref, { ...reactionFields(me, moments), at: fb.serverTimestamp() }) : fb.deleteDoc(ref);
  });
/** The member's 1–5 nota of the match (changeable, or taken back, for 7 days from the acta). */
export const rateMatch = (me: Me, matchId: string, score: number) =>
  viaFirebase((fb) => fb.setDoc(fb.doc(fb.db, "matches", matchId, "ratings", me.uid), { ...ratingFields(me, score), at: fb.serverTimestamp() }));
export const unrateMatch = (me: Me, matchId: string) => viaFirebase((fb) => fb.deleteDoc(fb.doc(fb.db, "matches", matchId, "ratings", me.uid)));

export const predictScore = (_me: Me, matchId: string, goalsFor: number, goalsAgainst: number, goals: GoalPick[]) =>
  savePrediction({ matchId, goalsFor, goalsAgainst, goals });

export const voteTraining = (me: Me, trainingId: string, slotIds: string[]) =>
  viaFirebase((fb) => {
    const ref = fb.doc(fb.db, "trainings", trainingId, "votes", me.uid);
    const chosen = [...new Set(slotIds)];
    return chosen.length ? fb.setDoc(ref, { slotIds: chosen, name: me.name, playerId: me.playerId, at: fb.serverTimestamp() }) : fb.deleteDoc(ref);
  });

/** Minimum gap between two board messages; the rules enforce the same through boardRate/{uid}. */
export const BOARD_GAP_MS = 5000;
let lastPost = 0;
export class TooSoon extends Error {
  constructor() {
    super("Espera un momento antes de volver a escribir.");
  }
}
export function postBoardMessage(me: Me, text: string) {
  const clean = text.trim();
  if (Date.now() - lastPost < BOARD_GAP_MS) return Promise.reject(new TooSoon());
  lastPost = Date.now();
  return viaFirebase((fb) => {
    const batch = fb.writeBatch(fb.db);
    batch.set(fb.doc(fb.db, "boardRate", me.uid), { at: fb.serverTimestamp() });
    batch.set(fb.doc(fb.collection(fb.db, "board")), { text: clean, uid: me.uid, name: me.name, playerId: me.playerId, at: fb.serverTimestamp() });
    // Another tab or device of this member posted less than 5 s ago: the rules refuse the stamp.
    return batch.commit().catch((error: unknown) => {
      throw (error as { code?: string }).code === "permission-denied" ? new TooSoon() : error;
    });
  });
}
export const deleteBoardMessage = (id: string) => viaFirebase((fb) => fb.deleteDoc(fb.doc(fb.db, "board", id)));

/** «No puedo del 12 al 19»: absences/{auto-id}, as firestore.rules absenceOk() checks it (the backend then
 *  answers «No puedo» on the matches in those dates). */
export const addAbsence = (me: Me, from: string, to: string, note: string) =>
  viaFirebase((fb) => fb.addDoc(fb.collection(fb.db, "absences"), { ...absenceFields(me, from, to, note), createdAt: fb.serverTimestamp() }));
/** «Quitar»: the backend takes back the «No puedo» it wrote (not the answers changed by hand). */
export const deleteAbsence = (id: string) => viaFirebase((fb) => fb.deleteDoc(fb.doc(fb.db, "absences", id)));

/** «Nueva encuesta»: polls/{auto-id} with the shape firestore.rules checks (`createdAt` the server's time,
 *  `closesAt` a Timestamp `now` + the chosen time). `now` is the server's clock (lib/serverTime). */
export const createPoll = (me: Me, form: PollForm, now: number) => {
  const { closesAt, ...fields } = pollFields(me, form, now);
  return viaFirebase((fb) => fb.addDoc(fb.collection(fb.db, "polls"), { ...fields, createdAt: fb.serverTimestamp(), closesAt: fb.Timestamp.fromMillis(closesAt) }));
};
/** A member's vote (and a changed vote: the same doc, overwritten), signed like the availability. */
export const votePoll = (me: Me, poll: Pick<Poll, "id" | "options" | "multi">, optionIds: readonly string[]) =>
  viaFirebase((fb) => fb.setDoc(fb.doc(fb.db, "polls", poll.id, "votes", me.uid), { ...voteFields(me, poll, optionIds), at: fb.serverTimestamp() }));
/** «Cerrar ya» (the author or a captain): only `closedAt`, the server's time. */
export const closePoll = (id: string) => viaFirebase((fb) => fb.updateDoc(fb.doc(fb.db, "polls", id), { closedAt: fb.serverTimestamp() }));
/** «Borrar» (the author or a captain). */
export const deletePoll = (id: string) => viaFirebase((fb) => fb.deleteDoc(fb.doc(fb.db, "polls", id)));

/**
 * Turnos «Hecho»: the member marks his turn of a match done (`done: false` takes it back). `turnId` is the
 * match's id (`rotaTurns/{matchId}`). A callable (functions/src/rota.ts markTurnDone): the turn of a match
 * is computed from the rota, which the rules can't do, so the server checks the turn is his and writes
 * `rotaTurns/{matchId}.done.{uid}`. Resolves to whether it is marked now.
 */
export const markTurnDone = async (me: Me, turnId: string, done = true): Promise<boolean> => {
  if (!me.playerId) throw new Error("Necesitas tu ficha de jugador para marcar un turno.");
  return (await markTurnDoneCall({ turnId, done })).data.done;
};

/** «Ya la he pagado»: cajaClaims/{auto-id}, «pendiente», as firestore.rules cajaClaimOk() checks it (his own
 *  uid and ficha, `at` the server's time). The captains are told and confirm or reject it in La caja. */
export const claimPayment = (me: Me, claim: NewCajaClaim) => {
  const problem = claimProblem(me, claim);
  if (problem) return Promise.reject(new Error(problem));
  return viaFirebase((fb) => fb.addDoc(fb.collection(fb.db, "cajaClaims"), { ...cajaClaimFields(me, claim), at: fb.serverTimestamp() }));
};
