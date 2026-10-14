// Push notices (Web Push with the club's own VAPID keys, no third party): anyone can ask for them
// on the web, by topic; the server sends them when a match changes (goals written live, final
// whistle, MVP vote, new dates), at kick-off (the clock starting; a job every 5 minutes for legacy
// matches without a clock) and when the captain publishes
// the official seven on the pizarra («Ya está el siete»).
import { HttpsError, onCall } from "firebase-functions/v2/https";
import { onDocumentWritten } from "firebase-functions/v2/firestore";
import { onSchedule } from "firebase-functions/v2/scheduler";
import { defineSecret } from "firebase-functions/params";
import { FieldValue, Timestamp, type DocumentData } from "firebase-admin/firestore";
import { createHash } from "node:crypto";
import webpush from "web-push";
import { z } from "zod";
import { db, googleUser, memberAs, parse } from "./common.js";
import { convocatoriaNotice, DOOR_TOPICS, kickoffNotice, legacyKickoff, lineupNotice, noticesFor, PERSONAL_TOPICS, TOPICS, type LineupLike, type MatchLike, type Notice, type Topic } from "./pushLogic.js";
import { sevenEdited, sevenPublished } from "./seven.js";
import { jornadaOf } from "./jornada.js";

export const vapidPrivate = defineSecret("VAPID_PRIVATE_KEY");
/** Public half of the key pair (also in the app, src/lib/push.ts). */
export const VAPID_PUBLIC = "BAZRaiFp6DqaRb1e2ONwNyUivVNI6AqQCrb-ovbyBJ7c_BYYHRt9SrPbE96MjDZfasbQrRqDREKCG6z7Ug3uDYc";
const SITE = "https://manchester-piti.vercel.app";

const subscription = z.object({
  endpoint: z.url().refine((u) => u.startsWith("https://"), "Suscripción no válida."),
  keys: z.object({ p256dh: z.string().min(1).max(200), auth: z.string().min(1).max(100) }),
});
const subId = (endpoint: string) => createHash("sha256").update(endpoint).digest("hex").slice(0, 40);

export const pushSubscribe = onCall(async (req) => {
  const input = parse(z.object({ subscription, topics: z.array(z.enum([...TOPICS, ...DOOR_TOPICS, ...PERSONAL_TOPICS])).max(TOPICS.length + DOOR_TOPICS.length + PERSONAL_TOPICS.length) }), req.data);
  // Door notices are personal: "access" needs the Google account that asked, "door" an admin.
  let uid: string | undefined;
  if (input.topics.includes("access")) uid = googleUser(req);
  if (input.topics.includes("door")) {
    const me = await memberAs(req);
    if (!me.isAdmin) throw new HttpsError("permission-denied", "Solo los administradores reciben la puerta.");
    uid = me.uid;
  }
  // The convocatoria's reminders are personal too (to whoever hasn't answered): members only. Anyone
  // else keeps the rest of their topics, without this one.
  if (input.topics.includes("convocatoria")) {
    try {
      uid = (await memberAs(req)).uid;
    } catch {
      input.topics = input.topics.filter((t) => t !== "convocatoria");
    }
  }
  const ref = db.doc(`pushSubscriptions/${subId(input.subscription.endpoint)}`);
  if (!input.topics.length) {
    await ref.delete();
    return { topics: [] };
  }
  await ref.set({ endpoint: input.subscription.endpoint, keys: input.subscription.keys, topics: [...new Set(input.topics)], ...(uid ? { uid } : {}), updatedAt: FieldValue.serverTimestamp() }, { merge: true });
  return { topics: input.topics };
});

export const pushUnsubscribe = onCall(async (req) => {
  const input = parse(z.object({ endpoint: z.url() }), req.data);
  await db.doc(`pushSubscriptions/${subId(input.endpoint)}`).delete();
  return { ok: true };
});

/** Sends a notice to everyone subscribed to its topic (or only to `uid`'s devices). */
export async function sendTo(notice: Notice, uid?: string) {
  let q = db.collection("pushSubscriptions").where("topics", "array-contains", notice.topic satisfies Topic);
  if (uid) q = q.where("uid", "==", uid);
  const subs = await q.get();
  // Nobody asked for this topic (always the case in tests and the emulators): nothing to sign.
  if (subs.empty) return;
  webpush.setVapidDetails(SITE, VAPID_PUBLIC, vapidPrivate.value());
  const payload = JSON.stringify({ title: notice.title, body: notice.body, tag: notice.tag, url: notice.url });
  await Promise.all(
    subs.docs.map(async (d) => {
      try {
        await webpush.sendNotification({ endpoint: d.get("endpoint"), keys: d.get("keys") }, payload, { TTL: 6 * 3600, urgency: notice.topic === "goals" ? "high" : "normal" });
      } catch (e) {
        // Gone or not found: the phone dropped the subscription; forget it.
        const status = (e as { statusCode?: number }).statusCode;
        if (status === 404 || status === 410) await d.ref.delete();
        else console.warn("push", notice.topic, status ?? e);
      }
    }),
  );
}

const asMatch = (d: DocumentData | undefined): MatchLike | undefined =>
  d && { ...d, date: (d.date as Timestamp | undefined)?.toMillis?.(), voteClosesAt: typeof d.voteClosesAt === "number" ? d.voteClosesAt : (d.voteClosesAt as Timestamp | undefined)?.toMillis?.() };

export const pushOnMatch = onDocumentWritten({ document: "matches/{matchId}", secrets: [vapidPrivate] }, async (event) => {
  const before = asMatch(event.data?.before.data());
  const after = asMatch(event.data?.after.data());
  const ids = new Set((after?.events ?? []).map((e) => e.playerId).filter(Boolean) as string[]);
  const players = await Promise.all([...ids].map((id) => db.doc(`players/${id}`).get()));
  const names = new Map(players.map((p) => [p.id, (p.get("shirtName") as string) || [p.get("firstName"), p.get("lastName")].filter(Boolean).join(" ") || "Jugador"]));
  for (const n of noticesFor(event.params.matchId, before, after, (id) => names.get(id) ?? "Jugador", Date.now())) {
    // «¡Empieza el partido!» once per match (pushLog, shared with pushKickoff): a reset and a second
    // start, or a trigger retry, never repeat it.
    if (n.topic === "start" && !(await claimLog(n.tag))) continue;
    await sendTo(n);
  }
  // «Ya está la convocatoria»: the first time it is published with titulares — once per match (pushLog).
  if (!convocatoriaNotice(event.params.matchId, before, after, null, Date.now())) return;
  const jornada = after?.seasonId ? await seasonJornada(after.seasonId, event.params.matchId) : null;
  const conv = convocatoriaNotice(event.params.matchId, before, after, jornada, Date.now());
  if (!conv) return;
  try {
    await db.doc(`pushLog/${conv.tag}`).create({ at: FieldValue.serverTimestamp() });
  } catch {
    return;
  }
  await sendTo(conv);
});

/** Claims pushLog/<tag> (false = it was already there: the notice already went). */
async function claimLog(tag: string): Promise<boolean> {
  try {
    await db.doc(`pushLog/${tag}`).create({ at: FieldValue.serverTimestamp() });
    return true;
  } catch {
    return false;
  }
}

/** A published match's jornada in its season — the one numbering (jornada.ts), the same «J5» the web
 *  shows (null: not in the calendar, cancelled…). */
export async function seasonJornada(seasonId: string, matchId: string): Promise<number | null> {
  const all = await db.collection("matches").where("seasonId", "==", seasonId).get();
  return jornadaOf(
    all.docs.map((d) => ({ id: d.id, seasonId: d.get("seasonId") as string | undefined, date: d.get("date") as unknown, status: d.get("status") as string | undefined })),
    matchId,
  );
}

// «Ya está el siete»: a board becomes the official one (or the official moves to another match). The
// notice goes once per board and match (pushLog), whatever the retries of the trigger or a captain
// publishing, unpublishing and publishing it again.
export const pushOnLineup = onDocumentWritten({ document: "lineups/{lineupId}", secrets: [vapidPrivate] }, async (event) => {
  const before = event.data?.before.data() as LineupLike | undefined;
  const after = event.data?.after.data() as LineupLike | undefined;
  // (most writes are autosaves of boards that are not official: nothing to read for them)
  if (!after?.isOfficial) return;
  // An official that stays official: «Cambio en el siete» when its seven changed (seven.ts).
  if (before?.isOfficial && (before.matchId ?? null) === (after.matchId ?? null)) {
    await sevenEdited(event.params.lineupId, before, after, (n) => sendTo(n));
    return;
  }
  // (what the team is told about from now on: this seven)
  await sevenPublished(event.params.lineupId, after);
  const mid = after.matchId ?? null;
  const match = mid ? asMatch((await db.doc(`matches/${mid}`).get()).data()) : null;
  const notice = lineupNotice(event.params.lineupId, before, after, match);
  if (!notice) return;
  try {
    await db.doc(`pushLog/${notice.tag}`).create({ at: FieldValue.serverTimestamp() });
  } catch {
    return;
  }
  await sendTo(notice);
});

// Cloud Scheduler has no Madrid location: the job (and this function) live in Belgium; it only reads a
// handful of matches every 5 minutes.
export const pushKickoff = onSchedule({ schedule: "every 5 minutes", timeZone: "Europe/Madrid", region: "europe-west1", secrets: [vapidPrivate] }, async () => {
  const now = Date.now();
  // Date range only (single-field index); the status is checked here.
  const due = await db.collection("matches").where("date", ">=", Timestamp.fromMillis(now - 10 * 60_000)).where("date", "<=", Timestamp.fromMillis(now + 60_000)).get();
  for (const m of due.docs) {
    if (m.get("archived") || m.get("status") !== "scheduled") continue;
    // Matches with a clock kick off when it starts (pushOnMatch), not at their date.
    if (!legacyKickoff({ version: m.get("version"), clock: m.get("clock") })) continue;
    const notice = kickoffNotice(m.id, m.get("rival") ?? "el rival");
    // Once per match, whatever the overlaps between runs.
    if (!(await claimLog(notice.tag))) continue;
    await sendTo(notice);
  }
});

