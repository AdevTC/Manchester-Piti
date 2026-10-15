// "Modo banda": an admin writes the acta live from the touchline. Each call appends one event (or
// undoes the last one written live) to a match that is being played; the public page counts the
// score from the events, so every visitor sees it at once. The full acta (ledger, MVP, porra) is
// still published from the editor when the match ends; the revision bump makes that editor reload
// first, so nothing written live is overwritten.
import { onCall, HttpsError } from "firebase-functions/v2/https";
import { FieldValue } from "firebase-admin/firestore";
import { z } from "zod";
import { randomUUID } from "node:crypto";
import type { MatchEvent } from "./matchEngine.js";
import { db, idSchema, parse, memberAs } from "./common.js";
import { requireScorer } from "./liveClock.js";
import { clockReading, type MatchClock } from "./matchClock.js";
import { LIVE_TYPES, liveProblem, liveSequenceProblem } from "./liveLogic.js";
import { allowedAtBreak } from "./liveRules.js";

const input = z.discriminatedUnion("action", [
  z.object({
    action: z.literal("add"),
    matchId: idSchema,
    requestId: idSchema.optional(),
    clockRevision: z.number().int().min(0).optional(),
    manualTime: z.boolean().optional(),
    event: z.object({
      type: z.enum(LIVE_TYPES),
      minute: z.number().int().min(0).max(150),
      playerId: idSchema.optional(),
      assistPlayerId: idSchema.optional(),
      assistReviewed: z.boolean().optional(),
      inPlayerId: idSchema.optional(),
    }),
  }),
  z.object({ action: z.literal("undo"), matchId: idSchema, eventId: idSchema.optional() }),
  z.object({ action: z.enum(["finish", "reopen"]), matchId: idSchema }),
]);

/** A stored date (a Timestamp, or ms) in ms; NaN when missing or malformed (liveProblem refuses it). */
const millis = (v: unknown): number => {
  if (typeof v === "number") return v;
  const t = v as { toMillis?: () => number } | undefined;
  return typeof t?.toMillis === "function" ? t.toMillis() : NaN;
};

/** Unique live ids; undo uses append order, including events recorded in the same millisecond. */
const liveId = (now: number) => `live-${now.toString(36).padStart(9, "0")}-${randomUUID()}`;

export const liveEvent = onCall(async (req) => {
  const actor = await memberAs(req);
  const uid = actor.uid;
  const data = parse(input, req.data);
  const ref = db.doc(`matches/${data.matchId}`);
  const now = Date.now();
  const result = await db.runTransaction(async (tx) => {
    await requireScorer(tx, data.matchId, actor);
    const snap = await tx.get(ref);
    if (!snap.exists) throw new HttpsError("not-found", "Ese partido no existe.");
    const m = snap.data() as { version?: number; clock?: MatchClock; status?: string; date?: unknown; duration?: number; starters?: string[]; bench?: string[]; events?: MatchEvent[]; revision?: number; liveEndedAt?: number };
    const match = { ...m, date: millis(m.date) };
    const events = m.events ?? [];
    const reading = m.clock ? clockReading(m.clock, now) : null;
    if (data.action === "finish" || data.action === "reopen") {
      if (m.clock) throw new HttpsError("failed-precondition", "Utiliza los controles compartidos de las partes del partido.");
      const problem = liveProblem(match, { type: "opponent_goal", minute: 0 }, now);
      if (problem) throw new HttpsError("failed-precondition", problem);
      if (!(now >= match.date)) throw new HttpsError("failed-precondition", "El partido todavía no ha comenzado.");
      tx.update(ref, { liveEndedAt: data.action === "finish" ? now : FieldValue.delete(), revision: (m.revision ?? 0) + 1, updatedAt: FieldValue.serverTimestamp() });
      tx.set(db.collection("matchAudit").doc(), { matchId: data.matchId, updatedBy: uid, at: FieldValue.serverTimestamp(), live: data.action });
      return { events: events.length };
    }
    if (m.liveEndedAt) throw new HttpsError("failed-precondition", "Ya se ha pitado el final. Repasa las jugadas desde el acta.");
    let next: typeof events;
    if (data.action === "add") {
      if (data.requestId && events.some(e => e.id === `live-${data.requestId}`)) return { events: events.length };
      const atBreak = reading?.phase === "halftime" && allowedAtBreak(data.event.type);
      if ((m.version === 2 && !m.clock) || (reading && !reading.playing && !atBreak)) throw new HttpsError("failed-precondition", "Inicia la parte antes de registrar jugadas en directo. En el descanso solo se anotan cambios y tarjetas.");
      if (m.clock && data.clockRevision !== m.clock.revision) throw new HttpsError("aborted", "La parte ha cambiado. Revisa el reloj antes de apuntar la jugada.");
      const elapsed = reading && !data.manualTime ? reading.elapsedSeconds : data.event.minute * 60;
      if (reading && elapsed > reading.elapsedSeconds) throw new HttpsError("invalid-argument", "La jugada no puede estar en el futuro.");
      const stamped = { ...data.event, ...(["goal", "goal_penalty", "goal_freekick"].includes(data.event.type) ? { assistReviewed: data.event.assistReviewed ?? !!data.event.assistPlayerId } : {}), ...(reading ? { minute: Math.floor(elapsed / 60), elapsedSeconds: elapsed, period: reading.period, source: "live" as const } : {}) };
      const problem = liveProblem(reading ? { ...match, date: now, duration: 150 } : match, stamped, now);
      if (problem) throw new HttpsError("failed-precondition", problem);
      const event = Object.fromEntries(Object.entries({ id: data.requestId ? `live-${data.requestId}` : liveId(now), ...stamped }).filter(([, v]) => v !== undefined));
      if (events.length >= 2500) throw new HttpsError("failed-precondition", "El acta ya tiene 2500 eventos. Repásala desde el editor.");
      next = [...events, event as unknown as MatchEvent];
    } else {
      const problem = liveProblem(m.clock ? { ...match, date: now } : match, { type: "opponent_goal", minute: 0 }, now);
      if (problem) throw new HttpsError("failed-precondition", problem);
      const last = ("eventId" in data ? data.eventId : undefined) ?? events.filter((e) => e.id.startsWith("live-")).at(-1)?.id;
      if (!last) throw new HttpsError("failed-precondition", "No hay nada apuntado en directo que deshacer.");
      if (!events.some(e => e.id === last && e.id.startsWith("live-"))) throw new HttpsError("aborted", "Esa jugada ya se ha deshecho. No se ha eliminado ninguna otra.");
      next = events.filter((e) => e.id !== last);
    }
    const invalid = liveSequenceProblem(match, next);
    if (invalid) throw new HttpsError("failed-precondition", invalid);
    tx.update(ref, { events: next, revision: (m.revision ?? 0) + 1, updatedAt: FieldValue.serverTimestamp() });
    tx.set(db.collection("matchAudit").doc(), { matchId: data.matchId, revision: (m.revision ?? 0) + 1, updatedBy: uid, at: FieldValue.serverTimestamp(), live: data.action, ...(data.action === "add" ? { type: data.event.type, minute: data.event.minute } : {}) });
    return { events: next.length };
  });
  // The server's clock at the answer: the phone estimates its offset from it (src/lib/serverTime.ts).
  return { ...result, serverNow: Date.now() };
});
