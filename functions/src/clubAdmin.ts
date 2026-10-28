// r12 · captains' callables of la Sala de control: correcting a member's porra and recounting the season's (M-46),
// and deleting a ficha nobody cites (B-CLUB-05: the rules no longer let a client delete one).
import { FieldValue } from "firebase-admin/firestore";
import { HttpsError, onCall } from "firebase-functions/v2/https";
import { z } from "zod";
import { admin, db, idSchema, parse } from "./common.js";
import { requireActiveMatch, runMatchTransaction } from "./matchAccess.js";
import { recomputePorra } from "./vestuario.js";
import { citedIn, type MatchRefs } from "./matchExtrasLogic.js";
import { jornadaOf } from "./jornada.js";

const pick = z.object({ playerId: idSchema, assistPlayerId: idSchema.nullable().optional() }).strict();
const correction = z.union([
  z.object({ matchId: idSchema, uid: z.string().min(1).max(128), remove: z.literal(true) }).strict(),
  z
    .object({ matchId: idSchema, uid: z.string().min(1).max(128), goalsFor: z.number().int().min(0).max(30), goalsAgainst: z.number().int().min(0).max(30), goals: z.array(pick).max(30) })
    .strict()
    .superRefine((p, ctx) => {
      if (p.goals.length !== p.goalsFor) ctx.addIssue({ code: "custom", message: "Elige un goleador por cada gol del Piti." });
      if (p.goals.some((g) => g.playerId === g.assistPlayerId)) ctx.addIssue({ code: "custom", message: "El goleador no puede asistirse a sí mismo." });
    }),
]);

// ── M-46 · corregir la porra de un socio (a prediction saved late, a wrong one) ──
export const correctPrediction = onCall(async (req) => {
  const by = await admin(req);
  const data = parse(correction, req.data);
  const seasonId = await runMatchTransaction(data.matchId, async (tx, { match }) => {
    if (!match.exists) throw new HttpsError("not-found", "Ese partido no existe.");
    await requireActiveMatch(tx, data.matchId, match);
    const user = await tx.get(db.doc(`users/${data.uid}`));
    if (!user.exists) throw new HttpsError("not-found", "Ese socio no tiene perfil en el vestuario.");
    const ref = db.doc(`matchPrivate/${data.matchId}/predictions/${data.uid}`);
    if ("remove" in data) {
      tx.delete(ref);
    } else {
      const ids = [...new Set(data.goals.flatMap((g) => [g.playerId, ...(g.assistPlayerId ? [g.assistPlayerId] : [])]))];
      const players = ids.length ? await tx.getAll(...ids.map((id) => db.doc(`players/${id}`))) : [];
      if (players.some((p) => !p.exists || !(p.get("seasons") ?? []).includes(match.get("seasonId"))))
        throw new HttpsError("invalid-argument", "Elige jugadores activos de la plantilla de esta temporada.");
      const { matchId: _m, uid: _u, ...prediction } = data;
      tx.set(ref, {
        ...prediction,
        // (signed as that member, like savePrediction's `who`)
        name: (user.get("nickname") as string | undefined) || "Miembro",
        playerId: (user.get("playerId") as string | undefined) ?? null,
        scoringVersion: 2,
        at: FieldValue.serverTimestamp(),
        correctedBy: by,
        correctedAt: FieldValue.serverTimestamp(),
      });
    }
    tx.set(db.collection("matchAudit").doc(), { matchId: data.matchId, updatedBy: by, at: FieldValue.serverTimestamp(), porra: "remove" in data ? "removed" : "corrected", member: data.uid });
    return match.get("status") === "finished" ? (match.get("seasonId") as string | undefined) : undefined;
  });
  if (seasonId) await recomputePorra(seasonId);
  return { ok: true as const };
});

// ── «Recalcular» la porra de la temporada (El vestuario) ──
export const recomputeSeasonPorra = onCall({ timeoutSeconds: 120 }, async (req) => {
  await admin(req);
  const { seasonId } = parse(z.object({ seasonId: idSchema }), req.data);
  if (!(await db.doc(`seasons/${seasonId}`).get()).exists) throw new HttpsError("not-found", "La temporada no existe.");
  await recomputePorra(seasonId);
  return { ok: true as const };
});

// ── B-CLUB-05 · borrar una ficha: only one nobody cites ──
export const deletePlayer = onCall(async (req) => {
  const by = await admin(req);
  const { playerId } = parse(z.object({ playerId: idSchema }), req.data);
  const [matches, drafts] = await Promise.all([db.collection("matches").get(), db.collection("matchDrafts").get()]);
  // «la J1» when the match has a jornada in its season, else the rival
  const label = (d: FirebaseFirestore.QueryDocumentSnapshot): string => {
    const seasonId = d.get("seasonId") as string | undefined;
    const j = seasonId ? jornadaOf(matches.docs.filter((m) => m.get("seasonId") === seasonId && m.get("archived") !== true).map((m) => ({ id: m.id, seasonId, date: m.get("date") as unknown, status: m.get("status") as string | undefined })), d.id) : null;
    return j ? `la J${j}` : `el partido contra ${d.get("rival") ?? "el rival"}`;
  };
  const refs = (d: FirebaseFirestore.QueryDocumentSnapshot): MatchRefs => ({ id: d.id, label: label(d), starters: d.get("starters"), bench: d.get("bench"), notCalled: d.get("notCalled"), events: d.get("events"), ledger: d.get("ledger") });
  const cited = citedIn(playerId, [...matches.docs, ...drafts.docs].map(refs));
  if (cited) throw new HttpsError("failed-precondition", `No se puede borrar: sale en el acta de ${cited}. Dale de baja: sus actas se quedan.`);
  await db.runTransaction(async (tx) => {
    const ref = db.doc(`players/${playerId}`);
    const [player, link] = await tx.getAll(ref, db.doc(`playerLinks/${playerId}`));
    if (!player.exists) throw new HttpsError("not-found", "Esa ficha no existe.");
    if (link.exists) {
      const holder = await tx.get(db.doc(`users/${link.get("uid")}`));
      if (holder.exists && !holder.get("removedAt")) throw new HttpsError("failed-precondition", `No se puede borrar: tiene una cuenta vinculada (@${holder.get("nickname") ?? "socio"}). Quítale antes el acceso.`);
      tx.delete(link.ref);
    }
    tx.delete(ref);
    tx.set(db.collection("matchAudit").doc(), { matchId: null, updatedBy: by, at: FieldValue.serverTimestamp(), playerDeleted: playerId });
  });
  return { ok: true as const };
});
