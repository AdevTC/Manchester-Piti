// r12 · the match's small callables for la Sala de control and la mesa (rules in matchExtrasLogic.ts): the MVP
// closed or reopened by hand (M-11), the crónica corta from la mesa (M-38), the notas rated again (M-42), the draft
// discarded (M-44), the video marks of each goal (M-43), a guest added from the touchline and the match's duration
// (M-48). Each one writes the published match (and its draft, when it is in step: B-ACTA-01) in one transaction.
import { FieldValue } from "firebase-admin/firestore";
import { HttpsError, onCall } from "firebase-functions/v2/https";
import { z } from "zod";
import { admin, db, idSchema, memberAs, parse } from "./common.js";
import { requireActiveMatch, runMatchTransaction } from "./matchAccess.js";
import { requireScorer } from "./liveClock.js";
import { activeMemberCount } from "./mvp.js";
import { mvpDoc, tallyVotes } from "./mvpLogic.js";
import { dateMillis, isCompleted } from "./matchEngine.js";
import { notasDoc, parseStoredNotas } from "./rating/frozen.js";
import { standingsLike } from "./rating/rival.js";
import { frozenNotas } from "./rating/season.js";
import { shotTally } from "./rating/values.js";
import type { RatingMatch, StandingsLike } from "./rating/types.js";
import { actaPublishedAt, addGuestPlan, draftFollows, DURATION_MAX, DURATION_MIN, mvpWindow, pruneVideoMarks, REPORT_MAX, reportProblem, stillOpen, videoMarksSchema } from "./matchExtrasLogic.js";

type Snap = FirebaseFirestore.DocumentSnapshot;
const num = (v: unknown) => (typeof v === "number" ? v : 0);
const ms = (v: unknown): number => {
  const t = v as { toMillis?: () => number } | undefined;
  return typeof t?.toMillis === "function" ? t.toMillis() : dateMillis(v);
};
const NOT_PUBLISHED = "El acta aún no está publicada.";

/** The published match's new revision, and the same fields on its draft (with the revision when it was in step). */
function writeBoth(tx: FirebaseFirestore.Transaction, pub: Snap, draft: Snap, fields: Record<string, unknown>, bump = true): number {
  const revision = num(pub.get("revision")) + (bump ? 1 : 0);
  tx.update(pub.ref, { ...fields, ...(bump ? { revision } : {}), updatedAt: FieldValue.serverTimestamp() });
  if (draft.exists) tx.update(draft.ref, { ...fields, ...(bump && draftFollows(pub.get("revision"), draft.get("revision")) ? { revision } : {}) });
  return revision;
}
const audit = (tx: FirebaseFirestore.Transaction, matchId: string, uid: string, what: Record<string, unknown>) =>
  tx.set(db.collection("matchAudit").doc(), { matchId, updatedBy: uid, at: FieldValue.serverTimestamp(), ...what });

// ── M-11 · «Cerrar ya» / «Reabrir 24 h» ──
export const setMvpVote = onCall(async (req) => {
  const uid = await admin(req);
  const { matchId, action } = parse(z.object({ matchId: idSchema, action: z.enum(["close", "reopen"]) }), req.data);
  const eligible = await activeMemberCount(Date.now());
  return runMatchTransaction(matchId, async (tx, { match }) => {
    if (!match.exists) throw new HttpsError("not-found", "Ese partido no existe.");
    await requireActiveMatch(tx, matchId, match);
    const votes = await tx.get(match.ref.collection("votes"));
    const now = Date.now();
    const next = mvpWindow(action, { status: match.get("status"), voteClosesAt: match.get("voteClosesAt"), actaPublishedAt: match.get("actaPublishedAt") }, now);
    if ("problem" in next) throw new HttpsError("failed-precondition", next.problem);
    const resultRef = db.doc(`mvpResults/${matchId}`);
    const stored = await tx.get(resultRef);
    // (the publication time stays: the ratings' 7 days never move with the MVP)
    const published = actaPublishedAt({ actaPublishedAt: match.get("actaPublishedAt"), voteClosesAt: match.get("voteClosesAt") }, now);
    tx.update(match.ref, { voteClosesAt: next.voteClosesAt, actaPublishedAt: published, mvpManual: { action, by: uid, at: now }, updatedAt: FieldValue.serverTimestamp() });
    const keep = stored.get("eligible");
    tx.set(resultRef, mvpDoc(tallyVotes(match.get("ledger"), votes.docs.map((v) => v.data())), next.voteClosesAt, now, typeof keep === "number" && keep > 0 ? keep : eligible));
    audit(tx, matchId, uid, { mvp: action, voteClosesAt: next.voteClosesAt });
    return { voteClosesAt: next.voteClosesAt };
  });
});

// ── M-38 · la crónica corta ──
export const saveMatchReport = onCall(async (req) => {
  const actor = await memberAs(req);
  const data = parse(z.object({ matchId: idSchema, report: z.string().max(REPORT_MAX) }), req.data);
  const report = data.report.trim();
  return runMatchTransaction(data.matchId, async (tx, { match, draft }) => {
    await requireScorer(tx, data.matchId, actor);
    if (!match.exists) throw new HttpsError("not-found", "Ese partido no existe.");
    await requireActiveMatch(tx, data.matchId, match);
    if (match.get("status") !== "finished") throw new HttpsError("failed-precondition", NOT_PUBLISHED);
    const privRef = db.doc(`matchPrivate/${data.matchId}`);
    const priv = await tx.get(privRef);
    const now = Date.now();
    const problem = reportProblem({
      isAdmin: actor.isAdmin,
      report,
      current: match.get("report"),
      currentBy: priv.get("reportBy"),
      // (the exact text he saved: a captain who rewrites it in the acta takes it from him)
      mine: priv.get("reportText"),
      uid: actor.uid,
      publishedAt: actaPublishedAt({ actaPublishedAt: match.get("actaPublishedAt"), voteClosesAt: match.get("voteClosesAt") }, now),
      now,
    });
    if (problem) throw new HttpsError(problem.startsWith("La crónica corta cabe") ? "invalid-argument" : "failed-precondition", problem);
    const revision = writeBoth(tx, match, draft, { report });
    tx.set(privRef, { reportBy: actor.uid, reportText: report, reportAt: FieldValue.serverTimestamp() }, { merge: true });
    audit(tx, data.matchId, actor.uid, { revision, report: "mesa" });
    return { ok: true as const, revision };
  });
});

// ── M-42 · «Recalcular las notas» ──
/** The acta's notas rated again from what is stored, as publishSheet rates them (its season up to it, the table;
 *  a correction keeps the rival factor of the notas it had). Kept with the match; the failure goes to notasError. */
export async function rateStoredActa(matchId: string): Promise<{ players: number; mean: number | null }> {
  const snap = await db.doc(`matches/${matchId}`).get();
  if (!snap.exists) throw new HttpsError("not-found", "Ese partido no existe.");
  if (snap.get("status") !== "finished") throw new HttpsError("failed-precondition", NOT_PUBLISHED);
  const data = snap.data() as Record<string, unknown>;
  const seasonId = data.seasonId as string;
  const date = ms(data.date);
  let notas: ReturnType<typeof notasDoc>;
  try {
    const [games, standings] = await Promise.all([
      db.collection("matches").where("seasonId", "==", seasonId).where("status", "==", "finished").get(),
      db.doc(`standings/${seasonId}`).get(),
    ]);
    const seasonGames = games.docs.filter((d) => d.id !== matchId).map((d) => ({ ...d.data(), id: d.id }) as RatingMatch).filter((m) => isCompleted(m) && dateMillis(m.date) <= date);
    for (const m of seasonGames) shotTally(m);
    const t = standingsLike(seasonId, standings.data());
    const table: StandingsLike[] = t ? [t] : [];
    const self = { ...data, id: matchId, date, status: "finished", events: data.events ?? [], ledger: data.ledger ?? {} } as RatingMatch;
    const kept = parseStoredNotas(data.notas);
    notas = notasDoc(frozenNotas(self, seasonGames, table, kept?.rival ?? null, kept?.normal ?? null), Date.now());
  } catch (error) {
    const message = error instanceof Error && error.message ? error.message.slice(0, 200) : "error al calcular";
    await db.doc(`matchPrivate/${matchId}`).set({ notasError: { at: Date.now(), message } }, { merge: true });
    throw new HttpsError("internal", `No se han podido calcular las notas: ${message}.`);
  }
  await runMatchTransaction(matchId, async (tx, { match }) => {
    if (!match.exists || match.get("status") !== "finished") throw new HttpsError("failed-precondition", NOT_PUBLISHED);
    await requireActiveMatch(tx, matchId, match);
    // (the acta changed meanwhile: rated from another version, so not kept)
    if (num(match.get("revision")) !== num(data.revision)) throw new HttpsError("aborted", "El acta ha cambiado mientras se calculaban las notas. Vuelve a intentarlo.");
    tx.update(match.ref, { notas });
    tx.set(db.doc(`matchPrivate/${matchId}`), { notasError: FieldValue.delete() }, { merge: true });
  });
  const values = Object.values(notas.players).map((p) => p.nota);
  return { players: values.length, mean: values.length ? Math.round((values.reduce((a, b) => a + b, 0) / values.length) * 100) / 100 : null };
}
export const recalcMatchNotas = onCall({ timeoutSeconds: 120, memory: "512MiB" }, async (req) => {
  const uid = await admin(req);
  const { matchId } = parse(z.object({ matchId: idSchema }), req.data);
  const out = await rateStoredActa(matchId);
  await db.collection("matchAudit").add({ matchId, updatedBy: uid, at: FieldValue.serverTimestamp(), notas: "recalc" });
  return out;
});

// ── M-44 · «Descartar el borrador» ──
export const discardMatchDraft = onCall(async (req) => {
  const uid = await admin(req);
  const { matchId } = parse(z.object({ matchId: idSchema }), req.data);
  return runMatchTransaction(matchId, async (tx, { match, draft }) => {
    if (!draft.exists) throw new HttpsError("not-found", "Ese partido no tiene borrador.");
    if (!match.exists) throw new HttpsError("failed-precondition", "Este partido solo existe como borrador: archívalo o elimínalo.");
    await requireActiveMatch(tx, matchId, match);
    tx.delete(draft.ref);
    audit(tx, matchId, uid, { draft: "discarded", draftRevision: num(draft.get("revision")) });
    return { ok: true as const };
  });
});

// ── M-43 · las marcas del vídeo ──
export const setVideoMarks = onCall(async (req) => {
  const uid = await admin(req);
  const data = parse(z.object({ matchId: idSchema, marks: videoMarksSchema }), req.data);
  return runMatchTransaction(data.matchId, async (tx, { match, draft }) => {
    if (!match.exists) throw new HttpsError("failed-precondition", NOT_PUBLISHED);
    await requireActiveMatch(tx, data.matchId, match);
    if (!match.get("videoUrl")) throw new HttpsError("failed-precondition", "Pon antes el vídeo del partido.");
    const marks = pruneVideoMarks(data.marks, match.get("events"));
    const revision = writeBoth(tx, match, draft, { videoMarks: Object.keys(marks).length ? marks : FieldValue.delete() });
    audit(tx, data.matchId, uid, { revision, videoMarks: Object.keys(marks).length });
    return { ok: true as const, revision, marks };
  });
});

// ── M-48 · «+ Invitado» y «Duración» desde la mesa ──
export const addMatchGuest = onCall(async (req) => {
  const actor = await memberAs(req);
  const data = parse(z.object({ matchId: idSchema, name: z.string().max(60) }), req.data);
  return runMatchTransaction(data.matchId, async (tx, { match, draft }) => {
    await requireScorer(tx, data.matchId, actor);
    if (!match.exists) throw new HttpsError("not-found", "Publica primero el encuentro.");
    await requireActiveMatch(tx, data.matchId, match);
    if (!stillOpen({ status: match.get("status"), clock: match.get("clock"), liveEndedAt: match.get("liveEndedAt") })) throw new HttpsError("failed-precondition", "El partido ya ha terminado: los invitados se añaden en el acta.");
    const plan = addGuestPlan({ guests: match.get("guests"), starters: match.get("starters"), bench: match.get("bench"), present: match.get("present") }, data.name);
    if ("problem" in plan) throw new HttpsError(plan.problem.startsWith("Como mucho") ? "failed-precondition" : "invalid-argument", plan.problem);
    const revision = num(match.get("revision")) + 1;
    tx.update(match.ref, { guests: plan.guests, bench: plan.bench, ...(plan.present ? { present: plan.present } : {}), revision, updatedAt: FieldValue.serverTimestamp() });
    // (the draft gets the guest too, on its own banquillo)
    if (draft.exists) {
      const ref = `guest:${plan.guest.id}`;
      const ids = (v: unknown) => (Array.isArray(v) ? (v as string[]) : []);
      const listed = ids(draft.get("starters")).includes(ref) || ids(draft.get("bench")).includes(ref);
      tx.update(draft.ref, { guests: plan.guests, ...(listed ? {} : { bench: [...ids(draft.get("bench")), ref] }), ...(draftFollows(match.get("revision"), draft.get("revision")) ? { revision } : {}) });
    }
    audit(tx, data.matchId, actor.uid, { guest: plan.guest.id, created: plan.created });
    return { guest: plan.guest, ref: `guest:${plan.guest.id}`, created: plan.created };
  });
});

export const setMatchDuration = onCall(async (req) => {
  const actor = await memberAs(req);
  const data = parse(
    z.object({ matchId: idSchema, minutes: z.number().int("La duración va de 10 a 150 minutos.").min(DURATION_MIN, "La duración va de 10 a 150 minutos.").max(DURATION_MAX, "La duración va de 10 a 150 minutos.") }),
    req.data,
  );
  return runMatchTransaction(data.matchId, async (tx, { match, draft }) => {
    await requireScorer(tx, data.matchId, actor);
    if (!match.exists) throw new HttpsError("not-found", "Publica primero el encuentro.");
    await requireActiveMatch(tx, data.matchId, match);
    if (!stillOpen({ status: match.get("status"), clock: match.get("clock"), liveEndedAt: match.get("liveEndedAt") })) throw new HttpsError("failed-precondition", "El partido ya ha terminado: la duración se corrige en el acta.");
    const revision = writeBoth(tx, match, draft, { duration: data.minutes });
    audit(tx, data.matchId, actor.uid, { revision, duration: data.minutes });
    return { duration: data.minutes, revision };
  });
});
