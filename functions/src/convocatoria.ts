// The one convocatoria: «el siete» (titulares) + the banquillo of a match, written by the admin's Hoy and
// Convocar (and read by the match tab, the pizarra and the acta). setConvocatoria validates the lineup
// (≤ 7 titulares, nobody twice, players of the match's season), writes it to the published match (and to
// its draft, when there is one, so the admin's merged view agrees) with a revision bump, the rest of the
// season as «no convocados» and the `convocatoriaAt` stamp. With `notify` it sends the convocatoria's push:
// «Ya está la convocatoria» the first time, «Cambios en la convocatoria» once when an already-notified one
// changed (pushLog keeps both to once per match), and stamps `convocatoriaNotifiedAt`.
import { onCall, HttpsError } from "firebase-functions/v2/https";
import { FieldValue } from "firebase-admin/firestore";
import { z } from "zod";
import { admin, db, idSchema, parse } from "./common.js";
import { convocatoriaNoticeKind, convocatoriaProblem, MAX_STARTERS, notCalledOf, sameLineup, type ConvocatoriaNoticeKind } from "./convocatoriaLogic.js";
import { jornadaOf, sendTo, vapidPrivate } from "./push.js";
import { convocatoriaMessage } from "./pushLogic.js";

const input = z.object({
  matchId: idSchema,
  starters: z.array(idSchema).max(MAX_STARTERS),
  bench: z.array(idSchema).max(30),
  notify: z.boolean().default(false),
});

const millis = (v: unknown): number => {
  if (typeof v === "number") return v;
  const t = v as { toMillis?: () => number } | undefined;
  return typeof t?.toMillis === "function" ? t.toMillis() : NaN;
};
const num = (v: unknown) => (typeof v === "number" ? v : 0);
const ids = (v: unknown) => (Array.isArray(v) ? v.filter((x): x is string => typeof x === "string") : []);

export const setConvocatoria = onCall({ secrets: [vapidPrivate] }, async (req) => {
  const uid = await admin(req);
  const data = parse(input, req.data);
  const pubRef = db.doc(`matches/${data.matchId}`);
  const draftRef = db.doc(`matchDrafts/${data.matchId}`);
  const lineup = { starters: data.starters, bench: data.bench };
  const written = await db.runTransaction(async (tx) => {
    const [pub, draft] = await Promise.all([tx.get(pubRef), tx.get(draftRef)]);
    if (!pub.exists && !draft.exists) throw new HttpsError("not-found", "Ese partido no existe.");
    // The admin shows the draft's fields over the published ones: read them the same way.
    const shown = draft.exists ? draft : pub;
    if (data.notify && !pub.exists) throw new HttpsError("failed-precondition", "El partido aún no está en el calendario: publícalo antes de avisar.");
    if (pub.get("archived") === true) throw new HttpsError("failed-precondition", "Ese partido está archivado.");
    const seasonId = shown.get("seasonId") as string | undefined;
    if (!seasonId) throw new HttpsError("failed-precondition", "El partido no tiene temporada.");
    const season = await tx.get(db.doc(`seasons/${seasonId}`));
    if (!season.exists) throw new HttpsError("invalid-argument", "La temporada no existe.");
    if (season.get("archived") === true) throw new HttpsError("failed-precondition", "Esa temporada está archivada. Restáurala para cambiar sus partidos.");
    const players = await tx.get(db.collection("players").where("seasons", "array-contains", seasonId));
    const roster = players.docs.map((p) => p.id);
    const problem = convocatoriaProblem(lineup, { roster, status: shown.get("status") as string | undefined });
    if (problem) throw new HttpsError(problem.startsWith("Ese partido") ? "failed-precondition" : "invalid-argument", problem);

    const now = Date.now();
    const before = { starters: ids(shown.get("starters")), bench: ids(shown.get("bench")) };
    const stamps = { convocatoriaAt: now, ...(data.notify ? { convocatoriaNotifiedAt: now } : {}) };
    const fields = { starters: data.starters, bench: data.bench, notCalled: notCalledOf(roster, lineup), ...stamps };
    const revision = num((pub.exists ? pub : draft).get("revision")) + 1;
    // Changed since the last notice: a quiet change after it, or this very call.
    const changed = !sameLineup(before, lineup) || num(pub.get("convocatoriaAt")) > num(pub.get("convocatoriaNotifiedAt"));
    if (pub.exists) tx.update(pubRef, { ...fields, revision, updatedAt: FieldValue.serverTimestamp() });
    // The draft keeps its own revision (the acta editor's base): only the lineup follows.
    if (draft.exists) tx.update(draftRef, fields);
    tx.set(db.collection("matchAudit").doc(), { matchId: data.matchId, revision, updatedBy: uid, at: FieldValue.serverTimestamp(), convocatoria: data.notify ? "notify" : "save" });
    return { now, revision, changed, seasonId, date: millis(shown.get("date")), rival: (shown.get("rival") as string | undefined) ?? "el rival" };
  });

  let notice: ConvocatoriaNoticeKind | null = null;
  if (data.notify) {
    const notifiedBefore = (await db.doc(`pushLog/conv-${data.matchId}`).get()).exists;
    const kind = convocatoriaNoticeKind({ notify: true, upcoming: Number.isFinite(written.date) && written.date > written.now, notifiedBefore, changed: written.changed });
    if (kind) {
      // Once per match and kind, whatever the double taps or retries.
      const log = kind === "first" ? `conv-${data.matchId}` : `conv-${data.matchId}-cambios`;
      try {
        await db.doc(`pushLog/${log}`).create({ at: FieldValue.serverTimestamp(), by: uid });
        notice = kind;
      } catch {
        notice = null;
      }
      if (notice) {
        const jornada = await jornadaOf(written.seasonId, written.date);
        await sendTo(convocatoriaMessage(data.matchId, notice, { rival: written.rival, date: written.date }, jornada));
      }
    }
  }
  return { at: written.now, revision: written.revision, notice };
});
