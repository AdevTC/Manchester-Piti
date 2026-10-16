// Push notices (Web Push with the club's own VAPID keys, no third party): anyone can ask for them
// on the web, by topic; the server sends them when a match changes (goals written live and undone,
// the clock's whistles, the final, MVP vote, new dates), at kick-off (the clock starting; a job every
// 5 minutes for legacy matches without a clock), when the MVP vote closes (the same job), when the
// captain publishes the official seven on the pizarra («Ya está el siete»), and to a member's own
// devices when their ficha claim is approved or their positions are reviewed.
import { HttpsError, onCall } from "firebase-functions/v2/https";
import { onDocumentWritten } from "firebase-functions/v2/firestore";
import { onSchedule } from "firebase-functions/v2/scheduler";
import { defineSecret } from "firebase-functions/params";
import { FieldValue, Timestamp, type DocumentData } from "firebase-admin/firestore";
import { createHash } from "node:crypto";
import webpush from "web-push";
import { z } from "zod";
import { db, googleUser, memberAs, parse } from "./common.js";
import { claimNotice, convocatoriaNotice, DOOR_TOPICS, kickoffNotice, legacyKickoff, lineupNotice, mvpWinnerIds, mvpWinnerNotice, noticesFor, PERSONAL_TOPICS, positionsNotice, publicTopics, pushAudience, sevenOf, sieteKey, TOPICS, type ClaimLike, type LineupLike, type MatchLike, type Notice } from "./pushLogic.js";
import { nameFor } from "./names.js";
import { noticeRecord } from "./noticesLogic.js";
import { claimSiete, sevenEdited, sevenPublished } from "./seven.js";
import { jornadaOf } from "./jornada.js";
import { absencesOnMatch } from "./absenceAnswers.js";
import { matchActive, matchActiveTx, noticeMatchId, runOptionalMatchTransaction } from './matchAccess.js';

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
  // A signed-in member's device is theirs: it carries their uid, so their personal notices (the
  // convocatoria's reminders, «Tu ficha ya es tuya», their positions reviewed) find it whatever topics
  // they chose. The convocatoria's reminders are for members only: anyone else keeps the rest of
  // their topics, without this one.
  if (!input.topics.includes("door")) {
    try {
      if (!req.auth) throw new Error("anónimo");
      uid = (await memberAs(req)).uid;
    } catch {
      input.topics = input.topics.filter((t) => t !== "convocatoria");
    }
  }
  const ref = db.doc(`pushSubscriptions/${subId(input.subscription.endpoint)}`);
  // `known`: whether the server still had this device (false after a 404/410 dropped it, see sendTo):
  // the app then renews its subscription (src/lib/push.ts reassertPush).
  const known = (await ref.get()).exists;
  if (!input.topics.length) {
    await ref.delete();
    return { topics: [], uid: null, known };
  }
  // The uid is the session's, or none: a member who signed out (or another person now on this device)
  // must stop getting that member's personal notices here (a merge would keep the old one).
  await ref.set({ endpoint: input.subscription.endpoint, keys: input.subscription.keys, topics: [...new Set(input.topics)], uid: uid ?? FieldValue.delete(), updatedAt: FieldValue.serverTimestamp() }, { merge: true });
  return { topics: input.topics, uid: uid ?? null, known };
});

/**
 * A member is out of the vestuario (they left, or a captain removed them): their devices keep the club's
 * public notices (goals, final…) but lose the personal topics and the uid, so nothing about the
 * vestuario reaches them any more; a device left with no topics is forgotten.
 */
export async function forgetMemberDevices(uid: string): Promise<void> {
  const subs = await db.collection("pushSubscriptions").where("uid", "==", uid).get();
  if (subs.empty) return;
  const batch = db.batch();
  for (const d of subs.docs) {
    const keep = publicTopics(d.get("topics"));
    if (keep.length) batch.update(d.ref, { topics: keep, uid: FieldValue.delete() });
    else batch.delete(d.ref);
  }
  await batch.commit();
}

export const pushUnsubscribe = onCall(async (req) => {
  const input = parse(z.object({ endpoint: z.url() }), req.data);
  await db.doc(`pushSubscriptions/${subId(input.endpoint)}`).delete();
  return { ok: true };
});

/** Sends a notice to everyone subscribed to its topic (or only to `uid`'s devices). A personal notice
 *  goes to `uid`'s devices only, whatever their topics (and nowhere without a uid). */
export async function sendTo(notice: Notice, uid?: string) {
  const matchId = noticeMatchId(notice.url);
  if (matchId && !(await matchActive(matchId))) return;
  const who = pushAudience(notice, uid);
  if (!who) return;
  // The centro de avisos keeps it too, whoever has push on (even nobody).
  await keepNotice(notice, uid);
  let q: FirebaseFirestore.Query = db.collection("pushSubscriptions");
  if (who.topic) q = q.where("topics", "array-contains", who.topic);
  if (who.uid) q = q.where("uid", "==", who.uid);
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

/** Stores a notice in `notices/{id}` for the centro de avisos (noticesLogic.ts: whether, for whom, its id).
 *  `create`: a retried trigger finds its doc taken and stores nothing. Never in the way of the push. */
async function keepNotice(notice: Notice, uid?: string): Promise<void> {
  try {
    const rec = noticeRecord(notice, uid, Date.now());
    if (!rec) return;
    await db.doc(`notices/${rec.id}`).create({ ...rec.doc, at: Timestamp.fromMillis(rec.doc.at), expireAt: Timestamp.fromMillis(rec.doc.expireAt) });
  } catch (e) {
    // (ALREADY_EXISTS: the same notice was already kept)
    const code = (e as { code?: unknown }).code;
    if (code === 6 || code === "already-exists") return;
    console.error("notices", notice.topic, notice.tag, e);
  }
}

const asMatch = (d: DocumentData | undefined): MatchLike | undefined =>
  d && { ...d, date: (d.date as Timestamp | undefined)?.toMillis?.(), voteClosesAt: typeof d.voteClosesAt === "number" ? d.voteClosesAt : (d.voteClosesAt as Timestamp | undefined)?.toMillis?.() };

export const pushOnMatch = onDocumentWritten({ document: "matches/{matchId}", secrets: [vapidPrivate] }, async (event) => {
  if (!(await matchActive(event.params.matchId))) return;
  const before = asMatch(event.data?.before.data());
  const after = asMatch(event.data?.after.data());
  // Ausencias: a match published, moved or rescheduled gets «No puedo» from the absences covering its
  // day, for who hasn't answered (absenceAnswers.ts; nothing is read for any other write). Never in the
  // way of the notices below.
  try {
    await absencesOnMatch(event.params.matchId, before, after);
  } catch (e) {
    console.error("absencesOnMatch", event.params.matchId, e);
  }
  // (names only when a notice needs them: most writes of a match say nothing)
  const now = Date.now();
  const draft = noticesFor(event.params.matchId, before, after, () => "", now);
  const named = draft.some((n) => n.topic === "goals");
  const ids = named ? new Set([...(before?.events ?? []), ...(after?.events ?? [])].filter((e) => typeof e.type === "string" && e.type.includes("goal")).map((e) => e.playerId).filter(Boolean) as string[]) : new Set<string>();
  const players = await Promise.all([...ids].map((id) => db.doc(`players/${id}`).get()));
  // the season's shirt names, like the match page (nameFor with the match's season)
  const names = new Map(players.map((p) => [p.id, nameFor(p.data(), after?.seasonId)]));
  for (const n of named ? noticesFor(event.params.matchId, before, after, (id) => names.get(id) ?? "Jugador", now) : draft) await deliver(n);
  // «Ya está la convocatoria»: the first time it is published with titulares — once per match (pushLog).
  if (!convocatoriaNotice(event.params.matchId, before, after, null, Date.now())) return;
  const jornada = after?.seasonId ? await seasonJornada(after.seasonId, event.params.matchId) : null;
  const conv = convocatoriaNotice(event.params.matchId, before, after, jornada, Date.now());
  if (!conv) return;
  if (!(await claimLog(conv.tag, event.params.matchId))) return;
  // One «siete» per match: quiet when «Ya está el siete» just told the team these titulares.
  if (!(await claimSiete(event.params.matchId, { by: "conv", seven: sieteKey(after?.starters) }))) {
    await quiet(conv.tag);
    return;
  }
  await sendTo(conv);
});

/** A claimed notice that stayed quiet: the other «siete» notice told the team (the log says why). */
async function quiet(tag: string): Promise<void> {
  await db.runTransaction(async tx => {
    const ref = db.doc(`pushLog/${tag}`);
    if ((await tx.get(ref)).exists) tx.update(ref, { quiet: 'siete' });
  });
}

/** Claims pushLog/<tag> (false = it was already there: the notice already went). */
async function claimLog(tag: string, matchId?: string): Promise<boolean> {
  return runOptionalMatchTransaction(matchId, async tx => {
    const ref = db.doc(`pushLog/${tag}`);
    const old = await tx.get(ref);
    if (old.exists || (matchId && !(await matchActiveTx(tx, matchId)))) return false;
    tx.create(ref, { at: FieldValue.serverTimestamp(), ...(matchId ? { matchId } : {}) });
    return true;
  });
}

/** Sends a notice at most once: what it `requires` must be in pushLog, and its `log` is claimed first
 *  (a trigger retry, an overlapping job run or the same whistle again finds it taken). */
export async function deliver(n: Notice, uid?: string): Promise<void> {
  if (n.requires && !(await db.doc(`pushLog/${n.requires}`).get()).exists) return;
  if (n.skipIf && (await db.doc(`pushLog/${n.skipIf}`).get()).exists) return;
  if (n.log && !(await claimLog(n.log, noticeMatchId(n.url) ?? undefined))) return;
  await sendTo(n, uid);
}

/** A published match's jornada in its season — the one numbering (jornada.ts), the same «J5» the web
 *  shows (null: not in the calendar, cancelled…). Archived matches are left out, as the web's mappers do. */
export async function seasonJornada(seasonId: string, matchId: string): Promise<number | null> {
  const all = await db.collection("matches").where("seasonId", "==", seasonId).get();
  return jornadaOf(
    all.docs
      .filter((d) => d.get("archived") !== true)
      .map((d) => ({ id: d.id, seasonId: d.get("seasonId") as string | undefined, date: d.get("date") as unknown, status: d.get("status") as string | undefined })),
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
  const current = await db.doc(`lineups/${event.params.lineupId}`).get();
  if (!current.exists || current.get('isOfficial') !== true || (current.get('matchId') ?? null) !== (after.matchId ?? null)) return;
  if (after.matchId && !(await matchActive(after.matchId))) return;
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
  if (!(await claimLog(notice.tag, mid ?? undefined))) return;
  // One «siete» per match: quiet when the convocatoria just told the team this same seven (seven.ts).
  if (mid && !(await claimSiete(mid, { by: "lineup", board: event.params.lineupId, seven: sieteKey(sevenOf(after.slots)) }))) {
    await quiet(notice.tag);
    return;
  }
  await sendTo(notice);
});

/** How long after its vote closes a match can still get its «MVP de la J5» (a job that was down for a
 *  while catches up; an older vote is no longer news). */
export const MVP_NEWS_MS = 24 * 3600_000;

/** The MVP's winner of each match whose vote closed in the last MVP_NEWS_MS — once per match
 *  (pushLog `mvp-win-<id>`), with the winner counted like the web (mvpWinnerIds over mvpResults). */
export async function announceMvpWinners(now: number): Promise<void> {
  // voteClosesAt range only (a number in ms, single-field index); the rest is checked here.
  const closed = await db.collection("matches").where("voteClosesAt", ">=", now - MVP_NEWS_MS).where("voteClosesAt", "<=", now).get();
  for (const m of closed.docs) {
    if (m.get("archived") || m.get("status") !== "finished") continue;
    if ((await db.doc(`pushLog/mvp-win-${m.id}`).get()).exists) continue;
    const result = (await db.doc(`mvpResults/${m.id}`).get()).data();
    const winners = mvpWinnerIds(m.get("voteClosesAt") as number, result as { counts?: Record<string, number>; total?: number } | undefined, now);
    if (!winners.length) continue;
    const seasonId = m.get("seasonId") as string | undefined;
    const players = await Promise.all(winners.map((id) => db.doc(`players/${id}`).get()));
    const names = new Map(players.map((p) => [p.id, nameFor(p.data(), seasonId)]));
    const jornada = seasonId ? await seasonJornada(seasonId, m.id) : null;
    const notice = mvpWinnerNotice(m.id, { rival: m.get("rival") as string | undefined }, winners, (id) => names.get(id) ?? "Jugador", jornada);
    if (notice) await deliver(notice);
  }
}

// Cloud Scheduler has no Madrid location: the job (and this function) live in Belgium; it only reads a
// handful of matches every 5 minutes: the legacy kick-offs, and the MVP votes that just closed.
export const pushKickoff = onSchedule({ schedule: "every 5 minutes", timeZone: "Europe/Madrid", region: "europe-west1", secrets: [vapidPrivate] }, async () => {
  const now = Date.now();
  // Date range only (single-field index); the status is checked here.
  const due = await db.collection("matches").where("date", ">=", Timestamp.fromMillis(now - 10 * 60_000)).where("date", "<=", Timestamp.fromMillis(now + 60_000)).get();
  for (const m of due.docs) {
    if (m.get("archived") || m.get("status") !== "scheduled") continue;
    // Matches with a clock kick off when it starts (pushOnMatch), not at their date.
    if (!legacyKickoff({ version: m.get("version"), clock: m.get("clock") })) continue;
    // Once per match (its pushLog, shared with pushOnMatch), whatever the overlaps between runs.
    await deliver(kickoffNotice(m.id, m.get("rival") ?? "el rival"));
  }
  await announceMvpWinners(now);
});

// «Tu ficha ya es tuya»: a captain approved the member's claim — to that member's devices only.
export const pushOnClaim = onDocumentWritten({ document: "playerClaims/{uid}", secrets: [vapidPrivate] }, async (event) => {
  const notice = claimNotice(event.params.uid, event.data?.before.data() as ClaimLike | undefined, event.data?.after.data() as ClaimLike | undefined);
  if (notice) await deliver(notice, event.params.uid);
});

// «El capitán revisó tus posiciones»: a new review on a ficha — to the member linked to it (playerLinks).
// Most writes of a ficha don't touch its review: nothing is read for them.
export const pushOnPositionsReview = onDocumentWritten({ document: "players/{playerId}", secrets: [vapidPrivate] }, async (event) => {
  const before = event.data?.before.data();
  const after = event.data?.after.data();
  const { playerId } = event.params;
  // (a cheap first look, without the member: a review that is new)
  if (!positionsNotice(playerId, before, after, "?")) return;
  const uid = (await db.doc(`playerLinks/${playerId}`).get()).get("uid");
  const notice = typeof uid === "string" && uid ? positionsNotice(playerId, before, after, uid) : null;
  if (notice) await deliver(notice, uid as string);
});

