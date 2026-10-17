// La mesa (and the old "modo banda"): the match's admins and scorers write the acta live from the
// touchline. Each call adds one play, fixes or deletes any play, or undoes the last one written live,
// on a match that is being played; the public page counts the score from the events, so every visitor
// sees it at once. The full acta (ledger, MVP, porra) is published at the end (publishLive from la
// mesa, saveMatchSheet from the editor); the revision bump makes the editor reload first, so nothing
// written live is overwritten. Every play carries who wrote it (`byUid`) and who last fixed it.
import { onCall, HttpsError } from "firebase-functions/v2/https";
import { FieldValue } from "firebase-admin/firestore";
import { z } from "zod";
import { randomUUID } from "node:crypto";
import { isPendingDup, minuteOfPlay, type MatchEvent } from "./matchEngine.js";
import { eventSeconds } from "./matchAnalysis.js";
import { db, idSchema, parse, memberAs } from "./common.js";
import { playerRefSchema } from "./eventSchema.js";
import type { MatchGuest } from "./guests.js";
import { requireScorer } from "./liveClock.js";
import { clockReading, type MatchClock } from "./matchClock.js";
import { LIVE_TYPES, isRivalType, liveProblem, liveSequenceProblem } from "./liveLogic.js";
import { allowedAtBreak } from "./liveRules.js";
import { requireActiveMatch, runMatchTransaction } from './matchAccess.js';

/** An event's id: a live one is `live-<requestId>`, longer than a plain id. */
const eventIdSchema = z.string().min(1).max(200).regex(/^[a-zA-Z0-9_-]+$/);
/** A player field in a fix: a player, or "" to clear it. */
const patchRef = z.union([playerRefSchema, z.literal("")]);
const seconds = z.number().int().min(0).max(9000);
const input = z.discriminatedUnion("action", [
  z.object({
    action: z.literal("add"),
    matchId: idSchema,
    requestId: idSchema.optional(),
    clockRevision: z.number().int().min(0).optional(),
    manualTime: z.boolean().optional(),
    /** A play tapped without signal: the seconds of play at the tap, and its half. */
    tappedElapsed: seconds.optional(),
    period: z.union([z.literal(1), z.literal(2)]).optional(),
    event: z.object({
      type: z.enum(LIVE_TYPES),
      minute: z.number().int().min(0).max(150),
      playerId: playerRefSchema.optional(),
      assistPlayerId: playerRefSchema.optional(),
      assistReviewed: z.boolean().optional(),
      inPlayerId: playerRefSchema.optional(),
    }),
  }),
  z.object({
    action: z.literal("edit"),
    matchId: idSchema,
    eventId: eventIdSchema,
    patch: z.object({
      type: z.enum(LIVE_TYPES).optional(),
      playerId: patchRef.optional(),
      assistPlayerId: patchRef.optional(),
      inPlayerId: patchRef.optional(),
      elapsedSeconds: seconds.optional(),
      dupOk: z.boolean().optional(),
    }).refine((p) => Object.values(p).some((v) => v !== undefined), { message: "Indica qué cambia en la jugada." }),
  }),
  z.object({ action: z.literal("delete"), matchId: idSchema, eventId: eventIdSchema }),
  z.object({ action: z.literal("undo"), matchId: idSchema, eventId: eventIdSchema.optional() }),
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
const GOALS = new Set<string>(["goal", "goal_penalty", "goal_freekick"]);
/** How far (seconds of play) two scorers' same play can be and still be asked «¿Es la misma jugada?». */
export const DUP_WINDOW_SECONDS = 30;
/** A queued play's tapped time may run this far past its half's end (the phone's clock estimate). */
const TAP_SLACK_SECONDS = 5;
/** The object without its `undefined` keys: Firestore refuses them. */
const compact = <T extends object>(o: T): T => Object.fromEntries(Object.entries(o).filter(([, v]) => v !== undefined)) as T;
/** Clearing a fix's twin: once the earlier play is gone, the later one stands on its own. */
const withoutTwin = (events: MatchEvent[], goneId: string): MatchEvent[] =>
  events.filter((e) => e.id !== goneId).map((e) => {
    if (e.dupOf !== goneId) return e;
    const { dupOf: _dupOf, dupOk: _dupOk, ...rest } = e;
    return rest;
  });

/**
 * The earlier play a new one may duplicate: same type, same player (or both without one), written by
 * another scorer, not already declared «Son dos», within DUP_WINDOW_SECONDS of play. The closest wins.
 */
export function duplicateOf(events: readonly MatchEvent[], play: Pick<MatchEvent, "type" | "playerId" | "elapsedSeconds" | "minute">, byUid: string): string | undefined {
  const at = eventSeconds(play);
  return events
    .filter((e) => e.type === play.type && (e.playerId ?? "") === (play.playerId ?? "") && typeof e.byUid === "string" && e.byUid !== byUid && e.dupOk !== true && !isPendingDup(e) && Math.abs(eventSeconds(e) - at) <= DUP_WINDOW_SECONDS)
    .sort((a, b) => Math.abs(eventSeconds(a) - at) - Math.abs(eventSeconds(b) - at))[0]?.id;
}

/** A queued play's seconds of play, checked against its half's window on the clock (holds excluded). */
export function queuedElapsed(clock: MatchClock, now: number, tapped: number, asked?: 1 | 2): { elapsed: number; period: 1 | 2 } | string {
  const r = clockReading(clock, now);
  if (clock.phase === "ready" || clock.firstStartedAt == null) return "El partido aún no había empezado cuando se apuntó esa jugada.";
  const period = asked ?? (clock.secondStartedAt != null && tapped > r.firstSeconds ? 2 : 1);
  if (period === 2 && clock.secondStartedAt == null) return "La 2ª parte aún no ha empezado: revisa la parte de esa jugada.";
  const lo = period === 1 ? 0 : r.firstSeconds;
  const hi = period === 1 ? r.firstSeconds : r.elapsedSeconds;
  if (tapped < lo - TAP_SLACK_SECONDS || tapped > hi + TAP_SLACK_SECONDS)
    return `Esa jugada (minuto ${minuteOfPlay(tapped)}) cae fuera del tiempo de juego de la ${period}ª parte.`;
  return { elapsed: Math.min(Math.max(tapped, lo), hi), period };
}

export const liveEvent = onCall(async (req) => {
  const actor = await memberAs(req);
  const uid = actor.uid;
  const data = parse(input, req.data);
  const ref = db.doc(`matches/${data.matchId}`);
  const now = Date.now();
  const result = await runMatchTransaction(data.matchId, async (tx, { match: snap }) => {
    await requireScorer(tx, data.matchId, actor);
    if (!snap.exists) throw new HttpsError("not-found", "Ese partido no existe.");
    await requireActiveMatch(tx, data.matchId, snap);
    const m = snap.data() as { version?: number; clock?: MatchClock; status?: string; date?: unknown; duration?: number; starters?: string[]; bench?: string[]; guests?: MatchGuest[]; events?: MatchEvent[]; revision?: number; liveEndedAt?: number };
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
    if (["finished", "cancelled", "postponed"].includes(m.status ?? ""))
      throw new HttpsError("failed-precondition", m.status === "finished" ? "El acta ya está publicada: ya no se cambian jugadas desde la mesa." : "Este partido no se está jugando.");
    let next: MatchEvent[];
    let audit: Record<string, unknown>;
    let answer: { eventId?: string; dupOf?: string } = {};
    if (data.action === "add") {
      if (data.requestId && events.some(e => e.id === `live-${data.requestId}`)) return { events: events.length, eventId: `live-${data.requestId}` };
      // A play tapped without signal keeps the time it was tapped: it is checked against that half's
      // window, not against the clock now (a pause or a whistle since then doesn't invalidate it).
      const queued = data.tappedElapsed != null && !!m.clock;
      let elapsed: number | undefined;
      let period: 1 | 2 | undefined;
      if (queued) {
        const fit = queuedElapsed(m.clock!, now, data.tappedElapsed!, data.period);
        if (typeof fit === "string") throw new HttpsError("failed-precondition", fit);
        ({ elapsed, period } = fit);
      } else {
        if (m.liveEndedAt) throw new HttpsError("failed-precondition", "Ya se ha pitado el final. Repasa las jugadas desde el acta.");
        // At the break and during a pause only changes, cards and knocks.
        const atBreak = (reading?.phase === "halftime" || !!reading?.held) && allowedAtBreak(data.event.type);
        if ((m.version === 2 && !m.clock) || (reading && !reading.playing && !atBreak)) throw new HttpsError("failed-precondition", reading?.held ? "El partido está en pausa: solo se anotan cambios, tarjetas y tocados. Pulsa «Seguir» para apuntar el resto." : "Inicia la parte antes de registrar jugadas en directo. En el descanso solo se anotan cambios y tarjetas.");
        if (m.clock && data.clockRevision !== m.clock.revision) throw new HttpsError("aborted", "La parte ha cambiado. Revisa el reloj antes de apuntar la jugada.");
        if (reading) {
          elapsed = !data.manualTime ? reading.elapsedSeconds : data.event.minute * 60;
          if (elapsed > reading.elapsedSeconds) throw new HttpsError("invalid-argument", "La jugada no puede estar en el futuro.");
          period = reading.period;
        }
      }
      const type = data.event.type;
      const stamped = compact({
        ...data.event,
        ...(GOALS.has(type) ? { assistReviewed: data.event.assistReviewed ?? !!data.event.assistPlayerId } : {}),
        // A save's outcome isn't asked live.
        ...(type === "save" ? { outcome: "unknown" as const } : {}),
        ...(elapsed != null ? { minute: Math.floor(elapsed / 60), elapsedSeconds: elapsed, period, source: "live" as const } : {}),
        byUid: uid,
        ...(queued ? { queued: true } : {}),
      });
      const problem = liveProblem(reading ? { ...match, date: now, duration: 150 } : match, stamped, now);
      if (problem) throw new HttpsError("failed-precondition", problem);
      const id = data.requestId ? `live-${data.requestId}` : liveId(now);
      const dupOf = duplicateOf(events, stamped, uid);
      const event = { id, ...stamped, ...(dupOf ? { dupOf } : {}) } as MatchEvent;
      if (events.length >= 2500) throw new HttpsError("failed-precondition", "El acta ya tiene 2500 eventos. Repásala desde el editor.");
      next = [...events, event];
      answer = { eventId: id, ...(dupOf ? { dupOf } : {}) };
      audit = { type, minute: event.minute ?? null, eventId: id, ...(queued ? { queued: true } : {}), ...(dupOf ? { dupOf } : {}) };
    } else if (data.action === "edit") {
      const at = events.findIndex((e) => e.id === data.eventId);
      if (at < 0) throw new HttpsError("aborted", "Esa jugada ya no está: alguien la ha borrado.");
      const old = events[at];
      const p = data.patch;
      const edited: MatchEvent = { ...old, ...(p.type ? { type: p.type } : {}) };
      for (const k of ["playerId", "assistPlayerId", "inPlayerId"] as const) {
        if (p[k] === "") delete edited[k];
        else if (p[k] !== undefined) edited[k] = p[k];
      }
      // What the new type can't carry goes: a rival play names nobody, only a change has who comes in,
      // only a goal has an assist, only a save has an outcome.
      if (isRivalType(edited.type)) { delete edited.playerId; delete edited.assistPlayerId; delete edited.inPlayerId; }
      if (edited.type !== "substitution") delete edited.inPlayerId;
      if (!GOALS.has(edited.type)) { delete edited.assistPlayerId; delete edited.assistReviewed; }
      else if (p.assistPlayerId !== undefined) edited.assistReviewed = true;
      else if (!GOALS.has(old.type)) edited.assistReviewed = !!edited.assistPlayerId;
      if (edited.type === "save") edited.outcome = edited.outcome ?? "unknown";
      else if (old.type === "save") delete edited.outcome;
      if (p.elapsedSeconds !== undefined) {
        if (reading && p.elapsedSeconds > reading.elapsedSeconds) throw new HttpsError("invalid-argument", "La jugada no puede estar en el futuro.");
        edited.elapsedSeconds = p.elapsedSeconds;
        edited.minute = Math.floor(p.elapsedSeconds / 60);
        if (m.clock && reading) edited.period = m.clock.secondStartedAt != null && p.elapsedSeconds > reading.firstSeconds ? 2 : 1;
      }
      if (p.dupOk === true) edited.dupOk = true;
      else if (p.dupOk === false) delete edited.dupOk;
      edited.editedByUid = uid;
      edited.editedAt = now;
      // The play's own shape (a live type: the editor's analysis actions are checked by the sequence).
      if ((LIVE_TYPES as readonly string[]).includes(edited.type)) {
        const problem = liveProblem({ ...match, date: now, duration: 150 }, { ...edited, minute: edited.minute ?? 0 }, now);
        if (problem) throw new HttpsError("failed-precondition", problem);
      }
      next = events.map((e, i) => (i === at ? edited : e));
      answer = { eventId: edited.id };
      audit = { eventId: edited.id, patch: compact(p), before: old, after: edited };
    } else if (data.action === "delete") {
      const gone = events.find((e) => e.id === data.eventId);
      if (!gone) throw new HttpsError("aborted", "Esa jugada ya se ha borrado. No se ha borrado ninguna otra.");
      next = withoutTwin(events, gone.id);
      audit = { eventId: gone.id, before: gone };
    } else {
      if (m.liveEndedAt) throw new HttpsError("failed-precondition", "Ya se ha pitado el final. Repasa las jugadas desde el acta.");
      const problem = liveProblem(m.clock ? { ...match, date: now } : match, { type: "opponent_goal", minute: 0 }, now);
      if (problem) throw new HttpsError("failed-precondition", problem);
      const last = ("eventId" in data ? data.eventId : undefined) ?? events.filter((e) => e.id.startsWith("live-")).at(-1)?.id;
      if (!last) throw new HttpsError("failed-precondition", "No hay nada apuntado en directo que deshacer.");
      if (!events.some(e => e.id === last && e.id.startsWith("live-"))) throw new HttpsError("aborted", "Esa jugada ya se ha deshecho. No se ha eliminado ninguna otra.");
      next = withoutTwin(events, last);
      audit = { eventId: last };
    }
    // The whole sequence must still hold (who is on the pitch, cards, changes), whatever changed.
    const invalid = liveSequenceProblem(match, next);
    if (invalid) throw new HttpsError("failed-precondition", invalid);
    tx.update(ref, { events: next, revision: (m.revision ?? 0) + 1, updatedAt: FieldValue.serverTimestamp() });
    tx.set(db.collection("matchAudit").doc(), { matchId: data.matchId, revision: (m.revision ?? 0) + 1, updatedBy: uid, at: FieldValue.serverTimestamp(), live: data.action, ...audit });
    return { events: next.length, ...answer };
  });
  // The server's clock at the answer: the phone estimates its offset from it (src/lib/serverTime.ts).
  return { ...result, serverNow: Date.now() };
});
