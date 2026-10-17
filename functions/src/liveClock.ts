import { onCall, HttpsError } from "firebase-functions/v2/https";
import { FieldValue } from "firebase-admin/firestore";
import { z } from "zod";
import { admin, db, idSchema, memberAs, parse } from "./common.js";
import { CLOCK_ACTIONS, clockReading, transitionClock, type MatchClock } from "./matchClock.js";
import type { MatchEvent } from "./matchEngine.js";
import { requireActiveMatch, runMatchTransaction } from './matchAccess.js';

export async function requireScorer(tx: FirebaseFirestore.Transaction, matchId: string, actor: Awaited<ReturnType<typeof memberAs>>) {
  if (actor.isAdmin) return;
  const access = await tx.get(db.doc(`matchPrivate/${matchId}`));
  if (!(access.get("scorerUids") ?? []).includes(actor.uid)) throw new HttpsError("permission-denied", "Solo administradores y anotadores designados para este partido.");
}
export const setMatchScorers = onCall(async req => {
  const uid = await admin(req);
  const data = parse(z.object({ matchId: idSchema, uids: z.array(idSchema).max(12) }), req.data);
  const ids = [...new Set(data.uids)];
  await runMatchTransaction(data.matchId, async (tx, { match }) => {
    if (!match.exists) throw new HttpsError("not-found", "Publica primero el encuentro.");
    await requireActiveMatch(tx, data.matchId, match);
    const members = ids.length ? await tx.getAll(...ids.map(id => db.doc(`teamMembers/${id}`))) : [];
    if (members.some(m => !m.exists || (m.get("expiresAt")?.toMillis() ?? 0) <= Date.now())) throw new HttpsError("invalid-argument", "Todos los anotadores deben tener acceso vigente al vestuario.");
    tx.set(db.doc(`matchPrivate/${data.matchId}`), { scorerUids: ids }, { merge: true });
    tx.set(db.collection("matchAudit").doc(), { matchId: data.matchId, updatedBy: uid, at: FieldValue.serverTimestamp(), scorerUids: ids });
  });
  return { ok: true };
});
export const controlMatchClock = onCall(async req => {
  const actor = await memberAs(req);
  const data = parse(z.object({ matchId: idSchema, action: z.enum(CLOCK_ACTIONS), revision: z.number().int().min(0), value: z.number().int("El añadido va de 0 a 15 minutos.").min(0, "El añadido va de 0 a 15 minutos.").max(15, "El añadido va de 0 a 15 minutos.").optional() }), req.data);
  const saved = await runMatchTransaction(data.matchId, async (tx, { match: snap }) => {
    await requireScorer(tx, data.matchId, actor);
    const ref = db.doc(`matches/${data.matchId}`);
    if (!snap.exists) throw new HttpsError("not-found", "El partido no existe.");
    await requireActiveMatch(tx, data.matchId, snap);
    if (["finished", "cancelled", "postponed"].includes(snap.get("status"))) throw new HttpsError("failed-precondition", "El reloj solo se controla en un partido pendiente de publicar.");
    const old = snap.get("clock") as MatchClock | undefined;
    // The stoppage time is an absolute value (a label): the last one set wins, whatever the revision.
    if (data.action !== "added" && (old?.revision ?? 0) !== data.revision) throw new HttpsError("aborted", "Otra persona ha cambiado el reloj. Ya se está sincronizando; revisa el estado antes de continuar.");
    if (data.action === "start" && (snap.get("starters") ?? []).length !== 7) throw new HttpsError("failed-precondition", "Confirma los siete titulares antes de iniciar.");
    let clock: MatchClock;
    const now = Date.now();
    try { clock = transitionClock(old, data.action, now, (snap.get("events") ?? []) as MatchEvent[], data.value); }
    catch (error) { throw new HttpsError("failed-precondition", (error as Error).message); }
    const elapsed = clockReading(clock, now).elapsedSeconds;
    if (elapsed > 9000 && data.action !== "finish") throw new HttpsError("failed-precondition", "El reloj supera 150 minutos. Revisa el encuentro desde el acta.");
    tx.update(ref, { clock, liveEndedAt: clock.phase === "ended" ? now : FieldValue.delete(), ...(clock.phase === "ended" ? { durationSeconds: Math.max(1, elapsed), duration: Math.max(1, Math.ceil(elapsed / 60)) } : { durationSeconds: FieldValue.delete() }), revision: (snap.get("revision") ?? 0) + 1, updatedAt: FieldValue.serverTimestamp() });
    tx.set(db.collection("matchAudit").doc(), { matchId: data.matchId, updatedBy: actor.uid, at: FieldValue.serverTimestamp(), clockAction: data.action, before: old ?? null, after: clock });
    return clock;
  });
  // The server's clock at the answer (not the transaction's `now`, which a retry can leave behind):
  // the phone estimates its offset from it (src/lib/serverTime.ts).
  return { clock: saved, serverNow: Date.now() };
});
