// «La convocatoria que persigue sola»: 48 h and 24 h before kick-off, a push to each convocado (titulares and
// banquillo) who hasn't answered yet — once per player, match and reminder (pushLog) — unless a captain
// turned off «Recordatorios automáticos» for that match (convocatoriaReminders/{matchId}.auto == false).
// To the member's own devices (personal topic «convocatoria»: playerLinks gives the member of a player).
// The same 5-minute job sends the «Cambio en el siete» held by its 10-minute window (seven.ts).
// And when someone changes their answer in the last 24 h, the captains get a notice (debounced per player)
// — never for the «No puedo» an absence writes (its one notice is absences.ts's). Any «No puedo» (by hand
// or an absence's) of a member whose turn it was passes the turn on, and the next one is told (rota.ts).
// Cloud Scheduler has no Madrid location: the job lives in Belgium, like pushKickoff.
import { onSchedule } from "firebase-functions/v2/scheduler";
import { onDocumentWritten } from "firebase-functions/v2/firestore";
import { FieldValue, Timestamp } from "firebase-admin/firestore";
import { HttpsError, onCall } from "firebase-functions/v2/https";
import { z } from "zod";
import { admin, db, idSchema, parse } from "./common.js";
import { matchActiveTx, runMatchTransaction } from './matchAccess.js';
import { logSent, sendTo, vapidPrivate } from "./push.js";
import { flushSevens } from "./seven.js";
import { notifyRotaHandover } from "./rota.js";
import { nameFor } from "./names.js";
import { byAbsence } from "./absencesLogic.js";
import { HOUR, LATE_DEBOUNCE_MS, lateChangeNotice, REMIND_NOW_GAP_MS, remindNowKind, remindNowProblem, REMINDER_MIN_LEAD, reminderDue, reminderNotice, unanswered } from "./remindersLogic.js";

const strs = (v: unknown): string[] => (Array.isArray(v) ? v.filter((x): x is string => typeof x === "string" && !!x) : []);
const millis = (v: unknown): number | null => {
  if (typeof v === "number") return v;
  const t = v as { toMillis?: () => number } | undefined;
  return typeof t?.toMillis === "function" ? t.toMillis() : null;
};

/** Claims a pushLog entry (false = it was already there: someone else did it). */
async function once(id: string, matchId: string, data: Record<string, unknown> = {}): Promise<boolean> {
  return runMatchTransaction(matchId, async tx => {
    const ref = db.doc(`pushLog/${id}`);
    const old = await tx.get(ref);
    if (old.exists || !(await matchActiveTx(tx, matchId))) return false;
    tx.create(ref, { at: FieldValue.serverTimestamp(), matchId, ...data });
    return true;
  });
}

export async function remindConvocados(now: number): Promise<void> {
  // Date range only (single-field index); the rest is checked here.
  const due = await db.collection("matches").where("date", ">=", Timestamp.fromMillis(now + REMINDER_MIN_LEAD)).where("date", "<=", Timestamp.fromMillis(now + 48 * HOUR)).get();
  for (const m of due.docs) {
    if (m.get("archived") || m.get("status") !== "scheduled") continue;
    const date = millis(m.get("date"));
    const kind = date == null ? null : reminderDue(date, now);
    if (!kind || date == null) continue;
    const starters = strs(m.get("starters"));
    const bench = strs(m.get("bench"));
    // (no convocatoria yet: nobody to chase, and the window stays open for when there is one)
    if (!starters.length && !bench.length) continue;
    if ((await db.doc(`convocatoriaReminders/${m.id}`).get()).get("auto") === false) continue;
    if (!(await once(`remind-${kind}-${m.id}`, m.id))) continue;
    const answers = await db.collection(`matchPrivate/${m.id}/availability`).get();
    const answered = new Set(answers.docs.map((a) => a.get("playerId")).filter((x): x is string => typeof x === "string"));
    const notice = reminderNotice(m.id, kind, { rival: m.get("rival") ?? "el rival", date });
    // (members only: unanswered leaves out the guests, who have no playerLinks to read)
    const sent = { devices: 0, members: 0 };
    for (const pid of unanswered(starters, bench, answered)) {
      const uid = (await db.doc(`playerLinks/${pid}`).get()).get("uid");
      if (typeof uid !== "string" || !uid) continue;
      if (!(await once(`remind-${kind}-${m.id}-${pid}`, m.id, { uid }))) continue;
      sent.devices += (await sendTo(notice, uid)).devices;
      sent.members++;
    }
    if (sent.members) await logSent(notice, sent, { kind: "recordatorio", audience: "convocados" });
  }
}

/** M-07 «Recordar ahora a los que faltan»: the reminder, now, to each convocado who hasn't answered (whatever the
 *  «Recordatorios automáticos» switch says: it is by hand). Once every REMIND_NOW_GAP_MS per match. */
export const remindNow = onCall({ secrets: [vapidPrivate] }, async (req) => {
  const by = await admin(req);
  const { matchId } = parse(z.object({ matchId: idSchema }), req.data);
  const m = await db.doc(`matches/${matchId}`).get();
  if (!m.exists) throw new HttpsError("failed-precondition", "El partido aún no está en el calendario: publícalo antes de avisar.");
  const now = Date.now();
  const date = millis(m.get("date"));
  const starters = strs(m.get("starters"));
  const bench = strs(m.get("bench"));
  const answers = await db.collection(`matchPrivate/${matchId}/availability`).get();
  const answered = new Set(answers.docs.map((a) => a.get("playerId")).filter((x): x is string => typeof x === "string"));
  const missing = unanswered(starters, bench, answered);
  const problem = remindNowProblem({ status: m.get("status"), date, starters, bench }, missing.length, now);
  if (problem) throw new HttpsError("failed-precondition", problem);
  // (one at a time per match, whoever asks)
  const gate = db.doc(`pushLog/remind-now-${matchId}`);
  const wait = await runMatchTransaction(matchId, async (tx) => {
    if (!(await matchActiveTx(tx, matchId))) throw new HttpsError("failed-precondition", "El partido está archivado o ya no existe. Recarga antes de continuar.");
    const last = millis((await tx.get(gate)).get("sentAt"));
    if (last != null && now - last < REMIND_NOW_GAP_MS) return Math.ceil((REMIND_NOW_GAP_MS - (now - last)) / 60_000);
    tx.set(gate, { sentAt: now, matchId, by });
    return 0;
  });
  if (wait) throw new HttpsError("resource-exhausted", `Ya se ha recordado hace un momento: vuelve a intentarlo en ${wait} min.`);
  const notice = reminderNotice(matchId, remindNowKind(date!, now), { rival: m.get("rival") ?? "el rival", date: date! });
  const sent = { devices: 0, members: 0 };
  for (const pid of missing) {
    const uid = (await db.doc(`playerLinks/${pid}`).get()).get("uid");
    if (typeof uid !== "string" || !uid) continue;
    sent.devices += (await sendTo(notice, uid)).devices;
    sent.members++;
  }
  await logSent(notice, sent, { kind: "manual", audience: "convocados", by });
  return { sent: sent.members, missing: missing.length };
});

export const pushReminders = onSchedule({ schedule: "every 5 minutes", timeZone: "Europe/Madrid", region: "europe-west1", secrets: [vapidPrivate] }, async () => {
  const now = Date.now();
  await remindConvocados(now);
  await flushSevens(now, (n) => sendTo(n));
});

// A member changes their answer (Voy / Duda / No puedo) within 24 h of kick-off: the captains are told.
export const pushOnAnswer = onDocumentWritten({ document: "matchPrivate/{matchId}/availability/{uid}", secrets: [vapidPrivate] }, async (event) => {
  const before = event.data?.before.data();
  const after = event.data?.after.data();
  // Turnos: whoever had a turn of this match can't make it (by hand or by an absence, a new answer or a
  // changed one): the next member is told, once the convocatoria is out (rota.ts).
  if (after?.response === "no" && before?.response !== "no" && typeof after.playerId === "string" && after.playerId) await notifyRotaHandover(event.params.matchId, after.playerId);
  if (!before || !after || before.response === after.response) return;
  // (an absence's «No puedo» is not a change of mind: the captains get its own one notice, absences.ts)
  if (byAbsence(after)) return;
  const { matchId, uid } = event.params;
  const match = await db.doc(`matches/${matchId}`).get();
  if (!match.exists || match.get("archived") || match.get("status") !== "scheduled") return;
  const pid = typeof after.playerId === "string" ? after.playerId : null;
  const player = pid ? await db.doc(`players/${pid}`).get() : null;
  // (the player by his shirt name in the match's season, like the web; without a ficha, the member's @apodo)
  const who = player?.exists ? nameFor(player.data(), match.get("seasonId") as string | undefined) : typeof after.name === "string" && after.name ? "@" + after.name : "Alguien";
  const now = Date.now();
  const notice = lateChangeNotice(matchId, who, before.response, after.response, { rival: match.get("rival") ?? "el rival", date: millis(match.get("date")) ?? undefined }, now);
  if (!notice) return;
  // (one every 10 minutes per player and match: a flip-flop doesn't spam the captains)
  const ref = db.doc(`pushLog/late-${matchId}-${uid}`);
  const go = await runMatchTransaction(matchId, async (tx) => {
    const s = await tx.get(ref);
    if (!(await matchActiveTx(tx, matchId))) return false;
    const last = s.exists ? millis(s.get("sentAt")) : null;
    if (last != null && now - last < LATE_DEBOUNCE_MS) return false;
    tx.set(ref, { sentAt: now, matchId });
    return true;
  });
  if (!go) return;
  const captains = await db.collection("users").where("role", "in", ["admin", "superadmin"]).get();
  for (const c of captains.docs) if (c.id !== uid) await sendTo(notice, c.id);
});
