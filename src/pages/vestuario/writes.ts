// Direct Firestore writes for the vestuario's everyday actions (votes, "voy / no puedo",
// board). The porra uses a callable to validate goals and serialize with kick-off.
// The security rules validate the other actions (firestore.rules), so there is no
// Cloud Function round trip: the SDK applies each write to the local cache first, every
// open listener (this device) updates at once and the rest of the team gets it in realtime.
import { addDoc, collection, deleteDoc, doc, serverTimestamp, setDoc, updateDoc, writeBatch } from "firebase/firestore";
import { db } from "../../firebase";
import { absenceFields } from "../../lib/derived/absences";
import { useAuth } from "../../context/AuthContext";
import { savePrediction } from "../../lib/clubApi";
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
export const markNoticesSeen = (uid: string) => updateDoc(doc(db, "users", uid), { noticesSeenAt: serverTimestamp() });

export const voteMvp = (me: Me, matchId: string, playerId: string) =>
  setDoc(doc(db, "matches", matchId, "votes", me.uid), { playerId, voterName: me.name, at: serverTimestamp() });

export const setAvailability = (me: Me, matchId: string, response: "yes" | "no" | "maybe") =>
  setDoc(doc(db, "matchPrivate", matchId, "availability", me.uid), { response, name: me.name, playerId: me.playerId, at: serverTimestamp() });

export const predictScore = (_me: Me, matchId: string, goalsFor: number, goalsAgainst: number, goals: GoalPick[]) =>
  savePrediction({ matchId, goalsFor, goalsAgainst, goals });

export const voteTraining = (me: Me, trainingId: string, slotIds: string[]) => {
  const ref = doc(db, "trainings", trainingId, "votes", me.uid);
  const chosen = [...new Set(slotIds)];
  return chosen.length ? setDoc(ref, { slotIds: chosen, name: me.name, playerId: me.playerId, at: serverTimestamp() }) : deleteDoc(ref);
};

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
  const batch = writeBatch(db);
  batch.set(doc(db, "boardRate", me.uid), { at: serverTimestamp() });
  batch.set(doc(collection(db, "board")), { text: clean, uid: me.uid, name: me.name, playerId: me.playerId, at: serverTimestamp() });
  // Another tab or device of this member posted less than 5 s ago: the rules refuse the stamp.
  return batch.commit().catch((error: unknown) => {
    throw (error as { code?: string }).code === "permission-denied" ? new TooSoon() : error;
  });
}
export const deleteBoardMessage = (id: string) => deleteDoc(doc(db, "board", id));

/** «No puedo del 12 al 19»: absences/{auto-id}, as firestore.rules absenceOk() checks it (the backend then
 *  answers «No puedo» on the matches in those dates). */
export const addAbsence = (me: Me, from: string, to: string, note: string) =>
  addDoc(collection(db, "absences"), { ...absenceFields(me, from, to, note), createdAt: serverTimestamp() });
/** «Quitar»: the backend takes back the «No puedo» it wrote (not the answers changed by hand). */
export const deleteAbsence = (id: string) => deleteDoc(doc(db, "absences", id));
