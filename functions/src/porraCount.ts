// «La porra del equipo: 8 ya han apostado; falta la tuya»: how many porras a match has, for the vestuario before
// the kick-off, without opening anyone's porra (the predictions stay private until the whistle). The server keeps
// the count on matchPrivate/{matchId}.porraCount (team-only reads, server-only writes): every porra created or
// deleted recounts the collection, so the number is right even for porras saved before this existed. A match
// that is gone (deleteMatch removes its porras after the tombstone) or archived gets no count: writing one would
// bring its matchPrivate doc back.
import { onDocumentWritten } from "firebase-functions/v2/firestore";
import { FieldValue } from "firebase-admin/firestore";
import { db } from "./common.js";
import { matchActive } from "./matchAccess.js";
import { porraCountChanges } from "./porraCountLogic.js";

export const porraCountOnWrite = onDocumentWritten("matchPrivate/{matchId}/predictions/{uid}", async (event) => {
  if (!porraCountChanges(!!event.data?.before.exists, !!event.data?.after.exists)) return;
  const { matchId } = event.params;
  if (!(await matchActive(matchId))) return;
  const snap = await db.collection("matchPrivate").doc(matchId).collection("predictions").count().get();
  await db.doc(`matchPrivate/${matchId}`).set({ porraCount: snap.data().count, porraCountAt: FieldValue.serverTimestamp() }, { merge: true });
});
