import { onCall, HttpsError } from "firebase-functions/v2/https";
import { FieldValue } from "firebase-admin/firestore";
import { z } from "zod";
import { admin, db, idSchema, memberAs, parse } from "./common.js";
import { CLOCK_ACTIONS, clockReading, transitionClock, type MatchClock } from "./matchClock.js";
import type { MatchEvent } from "./matchEngine.js";

export async function requireScorer(tx: FirebaseFirestore.Transaction, matchId: string, actor: Awaited<ReturnType<typeof memberAs>>) {
  if (actor.isAdmin) return;
  const access = await tx.get(db.doc(`matchPrivate/${matchId}`));
  if (!(access.get("scorerUids") ?? []).includes(actor.uid)) throw new HttpsError("permission-denied", "Solo administradores y anotadores designados para este partido.");
}
export const setMatchScorers = onCall(async req => {
  const uid = await admin(req);
  const data = parse(z.object({ matchId: idSchema, uids: z.array(idSchema).max(12) }), req.data);
  const ids = [...new Set(data.uids)];
  await db.runTransaction(async tx => {
    const match = await tx.get(db.doc(`matches/${data.matchId}`));
    if (!match.exists) throw new HttpsError("not-found", "Publica primero el encuentro.");
    const members = ids.length ? await tx.getAll(...ids.map(id => db.doc(`teamMembers/${id}`))) : [];
    if (members.some(m => !m.exists || (m.get("expiresAt")?.toMillis() ?? 0) <= Date.now())) throw new HttpsError("invalid-argument", "Todos los anotadores deben tener acceso vigente al vestuario.");
    tx.set(db.doc(`matchPrivate/${data.matchId}`), { scorerUids: ids }, { merge: true });
    tx.set(db.collection("matchAudit").doc(), { matchId: data.matchId, updatedBy: uid, at: FieldValue.serverTimestamp(), scorerUids: ids });
  });
  return { ok: true };
});
export const controlMatchClock = onCall(async req => {
  const actor = await memberAs(req);
  const data = parse(z.object({ matchId: idSchema, action: z.enum(CLOCK_ACTIONS), revision: z.number().int().min(0) }), req.data);
  return db.runTransaction(async tx => {
    await requireScorer(tx, data.matchId, actor);
    const ref = db.doc(`matches/${data.matchId}`);
    const snap = await tx.get(ref);
    if (!snap.exists) throw new HttpsError("not-found", "El partido no existe.");
    if (["finished", "cancelled", "postponed"].includes(snap.get("status"))) throw new HttpsError("failed-precondition", "El reloj solo se controla en un partido pendiente de publicar.");
    const old = snap.get("clock") as MatchClock | undefined;
    if ((old?.revision ?? 0) !== data.revision) throw new HttpsError("aborted", "Otra persona ha cambiado el reloj. Ya se está sincronizando; revisa el estado antes de continuar.");
    if (data.action === "start" && (snap.get("starters") ?? []).length !== 7) throw new HttpsError("failed-precondition", "Confirma los siete titulares antes de iniciar.");
    let clock: MatchClock;
    const now = Date.now();
    try { clock = transitionClock(old, data.action, now, (snap.get("events") ?? []) as MatchEvent[]); }
    catch (error) { throw new HttpsError("failed-precondition", (error as Error).message); }
    const elapsed = clockReading(clock, now).elapsedSeconds;
    if (elapsed > 9000 && data.action !== "finish") throw new HttpsError("failed-precondition", "El reloj supera 150 minutos. Revisa el encuentro desde el acta.");
    tx.update(ref, { clock, liveEndedAt: clock.phase === "ended" ? now : FieldValue.delete(), ...(clock.phase === "ended" ? { durationSeconds: Math.max(1, elapsed), duration: Math.max(1, Math.ceil(elapsed / 60)) } : { durationSeconds: FieldValue.delete() }), revision: (snap.get("revision") ?? 0) + 1, updatedAt: FieldValue.serverTimestamp() });
    tx.set(db.collection("matchAudit").doc(), { matchId: data.matchId, updatedBy: actor.uid, at: FieldValue.serverTimestamp(), clockAction: data.action, before: old ?? null, after: clock });
    return { clock, serverNow: now };
  });
});
