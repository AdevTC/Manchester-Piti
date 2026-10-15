// «La convocatoria que persigue sola»: 48 h and 24 h before kick-off, a push to each convocado (titulares and
// banquillo) who hasn't answered yet — once per player, match and reminder (pushLog) — unless a captain
// turned off «Recordatorios automáticos» for that match (convocatoriaReminders/{matchId}.auto == false).
// To the member's own devices (personal topic «convocatoria»: playerLinks gives the member of a player).
// The same 5-minute job sends the «Cambio en el siete» held by its 10-minute window (seven.ts).
// And when someone changes their answer in the last 24 h, the captains get a notice (debounced per player)
// — never for the «No puedo» an absence writes (its one notice is absences.ts's).
// Cloud Scheduler has no Madrid location: the job lives in Belgium, like pushKickoff.
import { onSchedule } from "firebase-functions/v2/scheduler";
import { onDocumentWritten } from "firebase-functions/v2/firestore";
import { FieldValue, Timestamp } from "firebase-admin/firestore";
import { db } from "./common.js";
import { sendTo, vapidPrivate } from "./push.js";
import { flushSevens } from "./seven.js";
import { nameFor } from "./names.js";
import { byAbsence } from "./absencesLogic.js";
import { HOUR, LATE_DEBOUNCE_MS, lateChangeNotice, REMINDER_MIN_LEAD, reminderDue, reminderNotice, unanswered } from "./remindersLogic.js";

const strs = (v: unknown): string[] => (Array.isArray(v) ? v.filter((x): x is string => typeof x === "string" && !!x) : []);
const millis = (v: unknown): number | null => {
  if (typeof v === "number") return v;
  const t = v as { toMillis?: () => number } | undefined;
  return typeof t?.toMillis === "function" ? t.toMillis() : null;
};

/** Claims a pushLog entry (false = it was already there: someone else did it). */
async function once(id: string, data: Record<string, unknown> = {}): Promise<boolean> {
  try {
    await db.doc(`pushLog/${id}`).create({ at: FieldValue.serverTimestamp(), ...data });
    return true;
  } catch {
    return false;
  }
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
    if (!(await once(`remind-${kind}-${m.id}`))) continue;
    const answers = await db.collection(`matchPrivate/${m.id}/availability`).get();
    const answered = new Set(answers.docs.map((a) => a.get("playerId")).filter((x): x is string => typeof x === "string"));
    const notice = reminderNotice(m.id, kind, { rival: m.get("rival") ?? "el rival", date });
    for (const pid of unanswered(starters, bench, answered)) {
      const uid = (await db.doc(`playerLinks/${pid}`).get()).get("uid");
      if (typeof uid !== "string" || !uid) continue;
      if (!(await once(`remind-${kind}-${m.id}-${pid}`, { uid }))) continue;
      await sendTo(notice, uid);
    }
  }
}

export const pushReminders = onSchedule({ schedule: "every 5 minutes", timeZone: "Europe/Madrid", region: "europe-west1", secrets: [vapidPrivate] }, async () => {
  const now = Date.now();
  await remindConvocados(now);
  await flushSevens(now, (n) => sendTo(n));
});

// A member changes their answer (Voy / Duda / No puedo) within 24 h of kick-off: the captains are told.
export const pushOnAnswer = onDocumentWritten({ document: "matchPrivate/{matchId}/availability/{uid}", secrets: [vapidPrivate] }, async (event) => {
  const before = event.data?.before.data();
  const after = event.data?.after.data();
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
  const go = await db.runTransaction(async (tx) => {
    const s = await tx.get(ref);
    const last = s.exists ? millis(s.get("sentAt")) : null;
    if (last != null && now - last < LATE_DEBOUNCE_MS) return false;
    tx.set(ref, { sentAt: now });
    return true;
  });
  if (!go) return;
  const captains = await db.collection("users").where("role", "in", ["admin", "superadmin"]).get();
  for (const c of captains.docs) if (c.id !== uid) await sendTo(notice, c.id);
});
