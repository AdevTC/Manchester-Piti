// "Modo banda": an admin writes the acta live from the touchline. Each call appends one event (or
// undoes the last one written live) to a match that is being played; the public page counts the
// score from the events, so every visitor sees it at once. The full acta (ledger, MVP, porra) is
// still published from the editor when the match ends; the revision bump makes that editor reload
// first, so nothing written live is overwritten.
import { onCall, HttpsError } from "firebase-functions/v2/https";
import { FieldValue } from "firebase-admin/firestore";
import { z } from "zod";
import { db, idSchema, parse, admin } from "./common.js";
import { LIVE_TYPES, liveProblem } from "./liveLogic.js";

const input = z.discriminatedUnion("action", [
  z.object({
    action: z.literal("add"),
    matchId: idSchema,
    event: z.object({
      type: z.enum(LIVE_TYPES),
      minute: z.number().int().min(0).max(150),
      playerId: idSchema.optional(),
      assistPlayerId: idSchema.optional(),
      inPlayerId: idSchema.optional(),
    }),
  }),
  z.object({ action: z.literal("undo"), matchId: idSchema }),
]);

/** Live events get time-ordered ids, so "the last one written live" is the greatest. */
const liveId = (now: number) => `live-${now.toString(36).padStart(9, "0")}`;

export const liveEvent = onCall(async (req) => {
  const uid = await admin(req);
  const data = parse(input, req.data);
  const ref = db.doc(`matches/${data.matchId}`);
  const now = Date.now();
  return db.runTransaction(async (tx) => {
    const snap = await tx.get(ref);
    if (!snap.exists) throw new HttpsError("not-found", "Ese partido no existe.");
    const m = snap.data() as { status?: string; date?: { toMillis(): number }; duration?: number; starters?: string[]; bench?: string[]; events?: { id: string }[]; revision?: number };
    const match = { ...m, date: m.date?.toMillis() };
    const events = m.events ?? [];
    let next: typeof events;
    if (data.action === "add") {
      const problem = liveProblem(match, data.event, now);
      if (problem) throw new HttpsError("failed-precondition", problem);
      const event = Object.fromEntries(Object.entries({ id: liveId(now), ...data.event }).filter(([, v]) => v !== undefined));
      next = [...events, event as { id: string }];
    } else {
      const problem = liveProblem(match, { type: "opponent_goal", minute: 0 }, now);
      if (problem) throw new HttpsError("failed-precondition", problem);
      const last = events.filter((e) => e.id.startsWith("live-")).map((e) => e.id).sort().at(-1);
      if (!last) throw new HttpsError("failed-precondition", "No hay nada apuntado en directo que deshacer.");
      next = events.filter((e) => e.id !== last);
    }
    tx.update(ref, { events: next, revision: (m.revision ?? 0) + 1, updatedAt: FieldValue.serverTimestamp() });
    tx.set(db.collection("matchAudit").doc(), { matchId: data.matchId, revision: (m.revision ?? 0) + 1, updatedBy: uid, at: FieldValue.serverTimestamp(), live: data.action, ...(data.action === "add" ? { type: data.event.type, minute: data.event.minute } : {}) });
    return { events: next.length };
  });
});
