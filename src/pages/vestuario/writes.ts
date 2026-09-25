// Direct Firestore writes for the vestuario's everyday actions (votes, "voy / no puedo",
// porra, board). The security rules validate them (firestore.rules), so there is no
// Cloud Function round trip: the SDK applies each write to the local cache first, every
// open listener (this device) updates at once and the rest of the team gets it in realtime.
import { collection, deleteDoc, doc, serverTimestamp, setDoc, writeBatch } from "firebase/firestore";
import { db } from "../../firebase";
import { useAuth } from "../../context/AuthContext";

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

export const voteMvp = (me: Me, matchId: string, playerId: string) =>
  setDoc(doc(db, "matches", matchId, "votes", me.uid), { playerId, voterName: me.name, at: serverTimestamp() });

export const setAvailability = (me: Me, matchId: string, response: "yes" | "no" | "maybe") =>
  setDoc(doc(db, "matchPrivate", matchId, "availability", me.uid), { response, name: me.name, playerId: me.playerId, at: serverTimestamp() });

export const predictScore = (me: Me, matchId: string, goalsFor: number, goalsAgainst: number) =>
  setDoc(doc(db, "matchPrivate", matchId, "predictions", me.uid), { goalsFor, goalsAgainst, name: me.name, playerId: me.playerId, at: serverTimestamp() });

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
  return batch.commit();
}
export const deleteBoardMessage = (id: string) => deleteDoc(doc(db, "board", id));
