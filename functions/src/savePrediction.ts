import { FieldValue } from "firebase-admin/firestore";
import { onCall, HttpsError } from "firebase-functions/v2/https";
import { z } from "zod";
import { db, idSchema, memberAs, parse } from "./common.js";
import { predictionOpen } from "./predictions.js";

const schema = z.object({
  matchId: idSchema,
  goalsFor: z.number().int().min(0).max(30),
  goalsAgainst: z.number().int().min(0).max(30),
  goals: z.array(z.object({ playerId: idSchema, assistPlayerId: idSchema.nullable().optional() }).strict()).max(30),
}).strict().superRefine((p, ctx) => {
  if (p.goals.length !== p.goalsFor) ctx.addIssue({ code: "custom", message: "Elige un goleador por cada gol del Piti." });
  if (p.goals.some((g) => g.playerId === g.assistPlayerId)) ctx.addIssue({ code: "custom", message: "El goleador no puede asistirse a sí mismo." });
});

export const savePrediction = onCall(async (req) => {
  const { uid, who } = await memberAs(req);
  const { matchId, ...prediction } = parse(schema, req.data);
  await db.runTransaction(async (tx) => {
    // Reading the same match document as the clock makes a concurrent kick-off close the bet atomically.
    const match = await tx.get(db.doc(`matches/${matchId}`));
    if (!match.exists || !predictionOpen(match.data()!)) throw new HttpsError("failed-precondition", "La porra está cerrada: el partido ya ha empezado o no está disponible.");
    const ids = [...new Set(prediction.goals.flatMap((g) => [g.playerId, ...(g.assistPlayerId ? [g.assistPlayerId] : [])]))];
    const players = ids.length ? await tx.getAll(...ids.map((id) => db.doc(`players/${id}`))) : [];
    if (players.some((p) => !p.exists || p.get("active") === false || !(p.get("seasons") ?? []).includes(match.get("seasonId"))))
      throw new HttpsError("invalid-argument", "Elige jugadores activos de la plantilla de esta temporada.");
    tx.set(db.doc(`matchPrivate/${matchId}/predictions/${uid}`), { ...prediction, ...who, scoringVersion: 2, at: FieldValue.serverTimestamp() });
  });
  return { ok: true };
});
