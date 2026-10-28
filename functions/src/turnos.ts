// Turnos «Hecho»: a member marks his own turn of a match done (or takes it back). Whose turn it is is
// computed from the rota (rotaLogic.ts turnsFor, the same the web and «Te toca…» use), which the rules
// can't do, so it is a callable: the server checks the turn is his and writes the doc-level
// `rotaTurns/{matchId}.done.{uid}` (ms). The captains are told once per match and member. Its own module
// (not rota.ts): rota.ts and push.ts import each other, and this one needs push.ts's secret when loaded.
// r12 (the Sala's «Después»): a captain marks another player's turn with `playerId` — the key is that player's
// member uid (users with that ficha, not removed) or, without an account, `p:<playerId>`; nobody is told.
import { FieldValue } from "firebase-admin/firestore";
import { HttpsError, onCall } from "firebase-functions/v2/https";
import { z } from "zod";
import { db, idSchema, memberAs, parse } from "./common.js";
import { sendTo, vapidPrivate } from "./push.js";
import { turnDoneNotice } from "./pushLogic.js";
import { nameFor } from "./names.js";
import { asRotaMatch, freezeRota, outsOf } from "./rota.js";
import { doneKeyOf, myTurns, parseRotaTurns, turnsFor } from "./rotaLogic.js";

export const markTurnDone = onCall({ secrets: [vapidPrivate] }, async (req) => {
  const me = await memberAs(req);
  const input = parse(z.object({ turnId: idSchema, done: z.boolean().default(true), playerId: idSchema.optional() }), req.data);
  const own = me.profile.get("playerId");
  const ownId = typeof own === "string" && own ? own : null;
  // (a captain marking someone else's: «Hecho» from the Sala de control)
  const forOther = !!input.playerId && input.playerId !== ownId;
  if (forOther && !me.isAdmin) throw new HttpsError("permission-denied", "Solo un capitán puede marcar el turno de otro.");
  const playerId = forOther ? input.playerId! : ownId;
  if (!playerId) throw new HttpsError("failed-precondition", "Necesitas tu ficha de jugador para marcar un turno.");
  const snap = await db.doc(`matches/${input.turnId}`).get();
  if (!snap.exists || snap.get("archived") === true) throw new HttpsError("not-found", "Ese partido no existe.");
  const match = asRotaMatch(snap.id, snap.data());
  if (!match.seasonId || match.status === "cancelled") throw new HttpsError("failed-precondition", "Ese partido no tiene turnos.");
  const now = Date.now();
  const season = await freezeRota(match, now, true);
  if (!season.rota?.jobs.length) throw new HttpsError("failed-precondition", "Este equipo aún no tiene turnos.");
  const ref = db.doc(`rotaTurns/${match.id}`);
  const [outs, stored] = await Promise.all([outsOf(match), ref.get()]);
  const mine = myTurns(turnsFor(match, season.rota, season.history, outs.answers, outs.absences, parseRotaTurns(stored.data())), playerId);
  if (!mine.length) throw forOther ? new HttpsError("failed-precondition", "Ese turno no es suyo.") : new HttpsError("permission-denied", "Ese turno no es tuyo.");
  let key = me.uid;
  if (forOther) {
    const owners = await db.collection("users").where("playerId", "==", playerId).get();
    key = doneKeyOf(owners.docs.filter((u) => !u.get("removedAt")).map((u) => u.id)[0] ?? null, playerId);
  }
  await ref.set({ seasonId: match.seasonId, done: { [key]: input.done ? now : FieldValue.delete() } }, { merge: true });
  if (input.done && !forOther) {
    try {
      const notice = turnDoneNotice(match.id, me.uid, nameFor((await db.doc(`players/${playerId}`).get()).data(), match.seasonId), mine.map((t) => t.job.name), typeof snap.get("rival") === "string" ? snap.get("rival") : undefined);
      await db.doc(`pushLog/${notice.log}`).create({ at: FieldValue.serverTimestamp(), matchId: match.id });
      const captains = await db.collection("users").where("role", "in", ["admin", "superadmin"]).get();
      for (const c of captains.docs) if (c.id !== me.uid) await sendTo(notice, c.id);
    } catch {
      /* (already told, or the notice failed: the tick is written either way) */
    }
  }
  return { done: input.done, key };
});
