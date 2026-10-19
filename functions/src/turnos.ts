// Turnos «Hecho»: a member marks his own turn of a match done (or takes it back). Whose turn it is is
// computed from the rota (rotaLogic.ts turnsFor, the same the web and «Te toca…» use), which the rules
// can't do, so it is a callable: the server checks the turn is his and writes the doc-level
// `rotaTurns/{matchId}.done.{uid}` (ms). The captains are told once per match and member. Its own module
// (not rota.ts): rota.ts and push.ts import each other, and this one needs push.ts's secret when loaded.
import { FieldValue } from "firebase-admin/firestore";
import { HttpsError, onCall } from "firebase-functions/v2/https";
import { z } from "zod";
import { db, idSchema, memberAs, parse } from "./common.js";
import { sendTo, vapidPrivate } from "./push.js";
import { turnDoneNotice } from "./pushLogic.js";
import { nameFor } from "./names.js";
import { asRotaMatch, freezeRota, outsOf } from "./rota.js";
import { myTurns, parseRotaTurns, turnsFor } from "./rotaLogic.js";

export const markTurnDone = onCall({ secrets: [vapidPrivate] }, async (req) => {
  const me = await memberAs(req);
  const input = parse(z.object({ turnId: idSchema, done: z.boolean().default(true) }), req.data);
  const playerId = me.profile.get("playerId");
  if (typeof playerId !== "string" || !playerId) throw new HttpsError("failed-precondition", "Necesitas tu ficha de jugador para marcar un turno.");
  const snap = await db.doc(`matches/${input.turnId}`).get();
  if (!snap.exists || snap.get("archived") === true) throw new HttpsError("not-found", "Ese partido no existe.");
  const match = asRotaMatch(snap.id, snap.data());
  if (!match.seasonId || match.status === "cancelled") throw new HttpsError("failed-precondition", "Ese partido no tiene turnos.");
  const now = Date.now();
  const season = await freezeRota(match, now, true);
  if (!season.rota?.jobs.length) throw new HttpsError("failed-precondition", "Este equipo aún no tiene turnos.");
  const ref = db.doc(`rotaTurns/${match.id}`);
  const [outs, own] = await Promise.all([outsOf(match), ref.get()]);
  const mine = myTurns(turnsFor(match, season.rota, season.history, outs.answers, outs.absences, parseRotaTurns(own.data())), playerId);
  if (!mine.length) throw new HttpsError("permission-denied", "Ese turno no es tuyo.");
  await ref.set({ seasonId: match.seasonId, done: { [me.uid]: input.done ? now : FieldValue.delete() } }, { merge: true });
  if (input.done) {
    try {
      const notice = turnDoneNotice(match.id, me.uid, nameFor((await db.doc(`players/${playerId}`).get()).data(), match.seasonId), mine.map((t) => t.job.name), typeof snap.get("rival") === "string" ? snap.get("rival") : undefined);
      await db.doc(`pushLog/${notice.log}`).create({ at: FieldValue.serverTimestamp(), matchId: match.id });
      const captains = await db.collection("users").where("role", "in", ["admin", "superadmin"]).get();
      for (const c of captains.docs) if (c.id !== me.uid) await sendTo(notice, c.id);
    } catch {
      /* (already told, or the notice failed: the tick is written either way) */
    }
  }
  return { done: input.done };
});
