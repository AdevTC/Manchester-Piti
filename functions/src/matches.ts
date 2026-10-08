// «Borrar partido» (admin · Encuentro): only a match nobody has played yet — a draft, or one that is
// scheduled, postponed or cancelled — can go. A finished match already feeds the season stats, the MVP
// and the porra; it is corrected (or set to «Cancelado») instead, never deleted.
import { FieldValue } from "firebase-admin/firestore";
import { HttpsError, onCall } from "firebase-functions/v2/https";
import { z } from "zod";
import { admin, db, idSchema, parse } from "./common.js";

export const PLAYED_MATCH =
  "Este partido ya se jugó y cuenta en las estadísticas: corrige el acta o pon el estado «Cancelado».";

export const deleteMatch = onCall(async (req) => {
  const by = await admin(req);
  const { id } = parse(z.object({ id: idSchema }), req.data);
  const ref = db.doc(`matches/${id}`);
  const draftRef = db.doc(`matchDrafts/${id}`);
  await db.runTransaction(async (tx) => {
    const [match, draft, mvp, votes] = await Promise.all([
      tx.get(ref),
      tx.get(draftRef),
      tx.get(db.doc(`mvpResults/${id}`)),
      tx.get(ref.collection("votes").limit(1)),
    ]);
    if (!match.exists && !draft.exists) throw new HttpsError("not-found", "Ese partido ya no existe.");
    if (match.get("status") === "finished" || mvp.exists || !votes.empty) throw new HttpsError("failed-precondition", PLAYED_MATCH);
    if (match.exists) tx.delete(ref);
    if (draft.exists) tx.delete(draftRef);
    tx.set(db.collection("matchAudit").doc(), { matchId: id, deleted: true, updatedBy: by, at: FieldValue.serverTimestamp() });
  });
  // The private side (meeting note, RSVPs) goes with it.
  await db.recursiveDelete(db.doc(`matchPrivate/${id}`));
  return { ok: true };
});
