// «Ya la he pagado»: a member's payment notice (cajaClaims/{id}, written by him, firestore.rules
// cajaClaimOk) tells the captains — once per claim, to each captain's devices and centro de avisos (not to
// the member himself if he is a captain). The captains confirm or reject it in La caja (the web's batch).
import { onDocumentCreated } from "firebase-functions/v2/firestore";
import { FieldValue } from "firebase-admin/firestore";
import { db } from "./common.js";
import { sendTo, vapidPrivate } from "./push.js";
import { cajaClaimNotice } from "./pushLogic.js";
import { nameFor } from "./names.js";

export const onCajaClaimCreated = onDocumentCreated({ document: "cajaClaims/{claimId}", secrets: [vapidPrivate] }, async (event) => {
  const { claimId } = event.params;
  const d = event.data?.data();
  if (!d || d.status !== "pendiente" || typeof d.amount !== "number") return;
  try {
    const player = typeof d.playerId === "string" && d.playerId ? await db.doc(`players/${d.playerId}`).get() : null;
    const who = player?.exists ? nameFor(player.data(), typeof d.seasonId === "string" ? d.seasonId : undefined) : "Un jugador";
    const notice = cajaClaimNotice(claimId, { amount: d.amount, concept: d.concept, seasonId: d.seasonId }, who);
    try {
      await db.doc(`pushLog/${notice.log}`).create({ at: FieldValue.serverTimestamp() });
    } catch {
      return; // (already told: a retry of the trigger)
    }
    const captains = await db.collection("users").where("role", "in", ["admin", "superadmin"]).get();
    for (const c of captains.docs) if (c.id !== d.uid) await sendTo(notice, c.id);
  } catch (e) {
    console.error("onCajaClaimCreated", claimId, e);
  }
});
