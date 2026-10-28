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
import { FieldPath, FieldValue, Timestamp, type DocumentData } from "firebase-admin/firestore";
import { createHash } from "node:crypto";
import webpush from "web-push";
import { z } from "zod";
import { db, googleUser, idSchema, memberAs, parse } from "./common.js";
import { heldGoalNotice } from "./pushLogic.js";
import { claimNotice, convocatoriaNotice, devicePayload, DOOR_TOPICS, kickoffNotice, legacyKickoff, lineupNotice, mvpWinnerIds, mvpWinnerNotice, notaPlayers, notasNotice, noticesFor, PERSONAL_TOPICS, positionsNotice, publicTopics, standingsNotice, pushAudience, sevenOf, sieteKey, TOPICS, type ClaimLike, type LineupLike, type MatchLike, type Notice } from "./pushLogic.js";
import { LATE_TOPICS, legacyTodoGets, presetOf, presetTopics, PUSH_PRESETS, TOPICS_VERSION } from "./pushPresets.js";
import { deviceGets, isMatchTopic, MATCH_TOPICS, nextMatchTopics, noticeMatchTopic, type MatchInfo } from "./pushMatchTopics.js";
import { isPaused } from "./pushPauseLogic.js";
import { nameFor } from "./names.js";
import { isGuestId } from "./guests.js";
import { NOTICE_TTL_MS, noticeRecord, noticeRecordAs, type NoticeAudience } from "./noticesLogic.js";
import { claimSiete, sevenEdited, sevenPublished } from "./seven.js";
import { jornadaOf } from "./jornada.js";
import { absencesOnMatch } from "./absenceAnswers.js";
import { archivedMatch, matchActive, matchActiveTx, noticeMatchId, runOptionalMatchTransaction } from './matchAccess.js';
import { freezeOnMatch, notifyRota, notifyRotaChange } from "./rota.js";

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
  // `v`: the version of the topic list the app knows (pushPresets.ts TOPICS_VERSION; absent from apps and
  // service workers that predate it). `resetMatches`: a preset was chosen, so the per-match choices go.
  const input = parse(
    z.object({
      subscription,
      topics: z.array(z.enum([...TOPICS, ...DOOR_TOPICS, ...PERSONAL_TOPICS])).max(TOPICS.length + DOOR_TOPICS.length + PERSONAL_TOPICS.length),
      vibrate: z.boolean().optional(),
      v: z.number().int().min(1).max(99).optional(),
      resetMatches: z.boolean().optional(),
    }),
    req.data,
  );
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
  // «Avisos a medida»: the preset these topics make (sendTo honours it), and «Vibrar con los goles» when the
  // device says (absent: the stored one stays).
  const topics = [...new Set(input.topics)];
  await ref.set(
    {
      endpoint: input.subscription.endpoint,
      keys: input.subscription.keys,
      topics,
      preset: presetOf(topics),
      ...(input.vibrate === undefined ? {} : { vibrate: input.vibrate }),
      ...(input.v === undefined ? {} : { topicsV: input.v }),
      ...(input.resetMatches ? { matchTopics: FieldValue.delete(), matchTopicsAt: FieldValue.delete() } : {}),
      uid: uid ?? FieldValue.delete(),
      updatedAt: FieldValue.serverTimestamp(),
    },
    { merge: true },
  );
  return { topics: input.topics, uid: uid ?? null, known };
});

/**
 * A device's «Avisos a medida» by its endpoint (the service worker's «Solo goles» button, which has no
 * session; the endpoint is the device's own secret, as for pushUnsubscribe): its topics become the
 * preset's (pushPresets.ts; the door's stay; «Todo» carries the personal ones only when the device has its
 * member's uid), and `vibrate` when given. A preset is a choice for every match, so the device's choices
 * for single matches go (a «Solo goles» tapped during a match means only goals, of that match too). A
 * device the server doesn't have is not found (nothing is made).
 */
export const pushSetPreset = onCall(async (req) => {
  const input = parse(z.object({ endpoint: z.url(), preset: z.enum(PUSH_PRESETS), vibrate: z.boolean().optional() }), req.data);
  const ref = db.doc(`pushSubscriptions/${subId(input.endpoint)}`);
  return db.runTransaction(async (tx) => {
    const snap = await tx.get(ref);
    if (!snap.exists) throw new HttpsError("not-found", "Este dispositivo ya no recibe avisos.");
    const current = Array.isArray(snap.get("topics")) ? (snap.get("topics") as unknown[]).filter((t): t is string => typeof t === "string") : [];
    const topics = presetTopics(input.preset, current, typeof snap.get("uid") === "string");
    if (!topics.length) {
      tx.delete(ref);
      return { topics: [], preset: "nada" as const };
    }
    tx.update(ref, {
      topics,
      preset: presetOf(topics),
      topicsV: TOPICS_VERSION,
      matchTopics: FieldValue.delete(),
      matchTopicsAt: FieldValue.delete(),
      ...(input.vibrate === undefined ? {} : { vibrate: input.vibrate }),
      updatedAt: FieldValue.serverTimestamp(),
    });
    return { topics, preset: presetOf(topics) };
  });
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
    if (keep.length) batch.update(d.ref, { topics: keep, preset: presetOf(keep), uid: FieldValue.delete() });
    else batch.delete(d.ref);
  }
  await batch.commit();
}

/**
 * «Avisos de este partido»: a device's own choice for one match, by its endpoint (the device's own secret, as
 * for pushSetPreset): `topics` (the match topics only; [] = nothing of this match) becomes its override for
 * `matchId`, `null` drops it (its global topics decide again). sendTo honours it (pushMatchTopics.ts). The
 * overrides are tidied on every write: gone, archived or long-finished matches go, and the oldest beyond a
 * dozen. A device the server doesn't have is made only when the app sends its `keys` (its first notice ever,
 * from the match's sheet): it then has no global topics, just this match. A device left with neither global
 * topics nor any override is forgotten.
 */
export const pushSetMatchTopics = onCall(async (req) => {
  const input = parse(
    z.object({
      endpoint: z.url().refine((u) => u.startsWith("https://"), "Suscripción no válida."),
      keys: subscription.shape.keys.optional(),
      matchId: idSchema,
      topics: z.array(z.enum(MATCH_TOPICS)).max(MATCH_TOPICS.length).nullable(),
    }),
    req.data,
  );
  const match = await db.doc(`matches/${input.matchId}`).get();
  if (!match.exists || archivedMatch(match.data())) throw new HttpsError("not-found", "Este partido ya no está.");
  const ref = db.doc(`pushSubscriptions/${subId(input.endpoint)}`);
  return db.runTransaction(async (tx) => {
    const snap = await tx.get(ref);
    if (!snap.exists && !(input.topics?.length && input.keys)) {
      if (!input.topics?.length) return { matchTopics: {} as Record<string, string[]>, kept: false };
      throw new HttpsError("not-found", "Este dispositivo ya no recibe avisos.");
    }
    // (what the other overrides' matches are now, read outside the transaction: a live match's writes never wait on this)
    const others = Object.keys((snap.get("matchTopics") as Record<string, unknown> | undefined) ?? {}).filter((id) => id !== input.matchId && idSchema.safeParse(id).success);
    const infos = new Map<string, MatchInfo>();
    const docs = others.length ? await db.getAll(...others.map((id) => db.doc(`matches/${id}`))) : [];
    for (const d of docs) infos.set(d.id, { exists: d.exists, archived: archivedMatch(d.data()), status: d.get("status") as string | undefined, date: (d.get("date") as Timestamp | undefined)?.toMillis?.() ?? null });
    const next = nextMatchTopics({ matchTopics: snap.get("matchTopics"), matchTopicsAt: snap.get("matchTopicsAt") }, input.matchId, input.topics, infos, Date.now());
    const global = Array.isArray(snap.get("topics")) ? (snap.get("topics") as unknown[]) : [];
    if (!global.length && !Object.values(next.matchTopics).some((t) => t.length)) {
      if (snap.exists) tx.delete(ref);
      return { matchTopics: {}, kept: false };
    }
    if (snap.exists) tx.update(ref, { matchTopics: next.matchTopics, matchTopicsAt: next.matchTopicsAt, updatedAt: FieldValue.serverTimestamp() });
    // (a device the server didn't have: this match only; its global choice is still «Nada»)
    else tx.set(ref, { endpoint: input.endpoint, keys: input.keys, topics: [], preset: presetOf([]), matchTopics: next.matchTopics, matchTopicsAt: next.matchTopicsAt, updatedAt: FieldValue.serverTimestamp() });
    return { matchTopics: next.matchTopics, kept: true };
  });
});

export const pushUnsubscribe = onCall(async (req) => {
  const input = parse(z.object({ endpoint: z.url() }), req.data);
  await db.doc(`pushSubscriptions/${subId(input.endpoint)}`).delete();
  return { ok: true };
});

/** Sends a notice to everyone subscribed to its topic (or only to `uid`'s devices). A personal notice
 *  goes to `uid`'s devices only, whatever their topics (and nowhere without a uid). */
/** `skip`: members whose devices a broadcast leaves out (they got their own version of it); `keep` false: a push
 *  only, not kept in the centro de avisos (a personal copy of a notice the bell already has for everyone). */
export async function sendTo(notice: Notice, uid?: string, skip?: ReadonlySet<string>, keep = true): Promise<SentCount> {
  const none = { devices: 0, members: 0 };
  const matchId = noticeMatchId(notice.url);
  if (matchId && !(await matchActive(matchId))) return none;
  const who = pushAudience(notice, uid);
  if (!who) return none;
  // The centro de avisos keeps it too, whoever has push on (even nobody).
  if (keep) await keepNotice(notice, uid);
  let q: FirebaseFirestore.Query = db.collection("pushSubscriptions");
  if (who.topic) q = q.where("topics", "array-contains", who.topic);
  if (who.uid) q = q.where("uid", "==", who.uid);
  // «Avisos de este partido»: the devices that chose this match's notices of this kind, whatever their
  // global topics (merged with the ones on the topic, once each).
  const about = notice.matchId ?? matchId;
  const own = about && who.topic && !who.uid && isMatchTopic(noticeMatchTopic(notice)) ? db.collection("pushSubscriptions").where(new FieldPath("matchTopics", about), "array-contains", noticeMatchTopic(notice)).get() : null;
  // A public topic added after «Todo» was first saved (pushPresets.ts LATE_TOPICS, e.g. «tabla»): the «Todo»
  // devices whose app never offered it get it too (legacyTodoGets).
  const late = who.topic && !who.uid && LATE_TOPICS.includes(who.topic) ? db.collection("pushSubscriptions").where("preset", "==", "todo").get() : null;
  const [subs, chose, todo] = await Promise.all([q.get(), own, late]);
  const found = new Map(subs.docs.map((d) => [d.id, d]));
  for (const d of chose?.docs ?? []) found.set(d.id, d);
  for (const d of todo?.docs ?? []) if (legacyTodoGets({ preset: d.get("preset"), topics: d.get("topics"), topicsV: d.get("topicsV") }, who.topic as string)) found.set(d.id, d);
  // A device's choice for this match decides alone; otherwise «Avisos a medida»: «Solo goles» gets only
  // the goals (not even the personal notices), «Nada» nothing (pushMatchTopics.ts deviceGets).
  // «Pausar» (pushPause.ts): a paused device gets nothing for now; the bell already kept the notice.
  const now = Date.now();
  const devices = [...found.values()].filter((d) => !(skip && skip.has(d.get("uid"))) && !isPaused(d.get("pausedUntil"), now) && deviceGets({ preset: d.get("preset"), matchTopics: d.get("matchTopics") }, notice, about));
  const sent = { devices: devices.length, members: new Set(devices.map((d) => d.get("uid")).filter((u) => typeof u === "string" && u)).size };
  // M-18 «Lo que se ha mandado»: every notice to a topic (the personal ones are counted by whoever sends them).
  if (!uid && keep) await logSent(notice, sent, { kind: "auto", audience: "publico" });
  // Nobody asked for this topic (always the case in tests and the emulators): nothing to sign.
  if (!devices.length) return sent;
  webpush.setVapidDetails(SITE, VAPID_PUBLIC, vapidPrivate.value());
  await Promise.all(
    devices.map(async (d) => {
      const payload = JSON.stringify(devicePayload(notice, { preset: d.get("preset"), vibrate: d.get("vibrate") }));
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
  return sent;
}

/** M-18: a notice kept once in the centro de avisos for `audience`, and pushed to each of `uids`' devices. */
export async function sendToMembers(notice: Notice, uids: readonly string[], audience: NoticeAudience): Promise<SentCount> {
  if (audience !== "personal") await keepNotice(notice, undefined, { audience });
  const people = [...new Set(uids)];
  let devices = 0;
  for (const u of people) devices += (await sendTo({ ...notice, topic: "personal" }, u, undefined, audience === "personal")).devices;
  // (members: everyone it was meant for, whether or not their phone has push on; devices: the phones it reached)
  return { devices, members: people.length };
}

/** How many devices (and distinct members) a notice went to. */
export interface SentCount {
  devices: number;
  members: number;
}
/** M-18 «Lo que se ha mandado» (`pushSent`, the captains read it): a notice sent, to whom, how many. Never in the
 *  way of the push. */
export async function logSent(notice: Notice, sent: SentCount, how: { kind: "auto" | "manual" | "recordatorio"; audience: "publico" | "equipo" | "capitanes" | "convocados"; by?: string }): Promise<void> {
  try {
    const now = Date.now();
    await db.collection("pushSent").add({
      title: notice.title,
      body: notice.body,
      topic: notice.topic,
      url: notice.url,
      tag: notice.tag,
      matchId: noticeMatchId(notice.url) ?? notice.matchId ?? null,
      audience: how.audience,
      kind: how.kind,
      devices: sent.devices,
      members: sent.members,
      by: how.by ?? null,
      at: Timestamp.fromMillis(now),
      expireAt: Timestamp.fromMillis(now + NOTICE_TTL_MS),
    });
  } catch (e) {
    console.error("pushSent", notice.tag, e);
  }
}

/** Stores a notice in `notices/{id}` for the centro de avisos (noticesLogic.ts: whether, for whom, its id).
 *  `create`: a retried trigger finds its doc taken and stores nothing. Never in the way of the push. */
async function keepNotice(notice: Notice, uid?: string, who?: { audience: NoticeAudience; uid?: string }): Promise<void> {
  try {
    const rec = who ? noticeRecordAs(notice, who, Date.now()) : noticeRecord(notice, uid, Date.now());
    if (!rec) return;
    await db.doc(`notices/${rec.id}`).create({ ...rec.doc, at: Timestamp.fromMillis(rec.doc.at), expireAt: Timestamp.fromMillis(rec.doc.expireAt) });
  } catch (e) {
    // (ALREADY_EXISTS: the same notice was already kept)
    const code = (e as { code?: unknown }).code;
    if (code === 6 || code === "already-exists") return;
    console.error("notices", notice.topic, notice.tag, e);
  }
}

/** M-33 in the emulator (tests and local runs): the rival's goal waits this long instead of THEIR_GOAL_HOLD_MS. */
export const EMULATOR_HOLD_MS = 2_000;
const asMatch = (d: DocumentData | undefined): MatchLike | undefined =>
  d && {
    ...d,
    date: (d.date as Timestamp | undefined)?.toMillis?.(),
    voteClosesAt: typeof d.voteClosesAt === "number" ? d.voteClosesAt : (d.voteClosesAt as Timestamp | undefined)?.toMillis?.(),
    postponedTo: typeof d.postponedTo === "number" ? d.postponedTo : ((d.postponedTo as Timestamp | null | undefined)?.toMillis?.() ?? null),
  };

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
  // Turnos del equipo: a match that just finished (the acta) or whose clock just ended is history: its
  // turns are frozen (rota.ts; never in the way of the notices, it logs its own errors).
  const ended = (m: MatchLike | undefined) => !!m && (m.status === "finished" || m.clock?.phase === "ended" || typeof m.liveEndedAt === "number");
  if (ended(after) && !ended(before)) await freezeOnMatch(event.params.matchId);
  // (names only when a notice needs them: most writes of a match say nothing)
  const now = Date.now();
  const draft = noticesFor(event.params.matchId, before, after, () => "", now);
  const named = draft.some((n) => n.topic === "goals" || n.topic === "cards");
  const ids = named
    ? new Set(
        [...(before?.events ?? []), ...(after?.events ?? [])]
          .filter((e) => typeof e.type === "string" && (e.type.includes("goal") || e.type.includes("card") || e.type.includes("yellow")))
          .flatMap((e) => [e.playerId, e.assistPlayerId])
          .filter((pid): pid is string => !!pid && !isGuestId(pid)),
      )
    : new Set<string>();
  const players = await Promise.all([...ids].map((id) => db.doc(`players/${id}`).get()));
  // the season's shirt names, like the match page (nameFor with the match's season)
  const names = new Map(players.map((p) => [p.id, nameFor(p.data(), after?.seasonId)]));
  const held: Notice[] = [];
  for (const n of named ? noticesFor(event.params.matchId, before, after, (id) => names.get(id) ?? "Jugador", now) : draft) {
    if (n.holdFor) held.push(n);
    else await deliver(n);
  }
  // M-33: the rival's goal goes after its wait, from the match as it is then — undone meanwhile, nothing goes.
  for (const n of held) {
    // (the emulator runs one trigger at a time: there the wait is 2 s, so it never holds every other trigger 10 s)
    await new Promise((ok) => setTimeout(ok, process.env.FUNCTIONS_EMULATOR === "true" ? EMULATOR_HOLD_MS : n.holdFor!.ms));
    try {
      if (!(await matchActive(event.params.matchId))) continue;
      const fresh = asMatch((await db.doc(`matches/${event.params.matchId}`).get()).data());
      const pid = fresh?.events?.find((e) => e.id === n.holdFor!.eventId)?.playerId;
      if (pid && !isGuestId(pid) && !names.has(pid)) names.set(pid, nameFor((await db.doc(`players/${pid}`).get()).data(), fresh?.seasonId));
      const late = heldGoalNotice(event.params.matchId, fresh, n.holdFor!.eventId, (id) => names.get(id) ?? "Jugador");
      if (late) await deliver(late);
    } catch (e) {
      console.error("pushOnMatch: held goal", event.params.matchId, e);
    }
  }
  // «Ya están las notas»: the acta's notas just appeared — «Mira la tuya» to each one with a nota (once each),
  // «Míralas» to everyone else on the result's topic (once per match). Never in the way of the rest.
  if (notasNotice(event.params.matchId, before, after, null, false))
    try {
      await notasOnMatch(event.params.matchId, before, after);
    } catch (e) {
      console.error("notasOnMatch", event.params.matchId, e);
    }
  // «Ya está la convocatoria»: the first time it is published with titulares — once per match (pushLog).
  if (!convocatoriaNotice(event.params.matchId, before, after, null, Date.now())) return;
  const jornada = after?.seasonId ? await seasonJornada(after.seasonId, event.params.matchId) : null;
  const conv = convocatoriaNotice(event.params.matchId, before, after, jornada, Date.now());
  if (!conv) return;
  if (!(await claimLog(conv.tag, event.params.matchId))) return;
  // One «siete» per match: quiet when «Ya está el siete» just told the team these titulares.
  if (!(await claimSiete(event.params.matchId, { by: "conv", seven: sieteKey(after?.starters) }))) {
    await quiet(conv.tag);
  } else await sendTo(conv);
  // Turnos del equipo: the convocatoria is out — «Te toca…» to whoever's turn it is (once per match and job).
  await notifyRota(event.params.matchId);
});

/** Turnos del equipo: a captain's pin or swap tells the newly assigned member «Te toca…» (rota.ts). */
export const rotaTurnsOnWrite = onDocumentWritten({ document: "rotaTurns/{matchId}", secrets: [vapidPrivate] }, async (event) => {
  try {
    await notifyRotaChange(event.params.matchId, event.data?.before.data(), event.data?.after.data());
  } catch (e) {
    console.error("rotaTurnsOnWrite", event.params.matchId, e);
  }
});

/** A claimed notice that stayed quiet: the other «siete» notice told the team (the log says why). */
async function quiet(tag: string): Promise<void> {
  await db.runTransaction(async tx => {
    const ref = db.doc(`pushLog/${tag}`);
    if ((await tx.get(ref)).exists) tx.update(ref, { quiet: 'siete' });
  });
}

/** «Ya están las notas» (pushOnMatch): the personal ones first, then the broadcast without their devices. */
async function notasOnMatch(matchId: string, before: MatchLike | undefined, after: MatchLike | undefined): Promise<void> {
  const jornada = after?.seasonId ? await seasonJornada(after.seasonId, matchId) : null;
  const everyone = notasNotice(matchId, before, after, jornada, false);
  const mine = notasNotice(matchId, before, after, jornada, true);
  if (!everyone || !mine) return;
  if (!(await claimLog(everyone.log ?? everyone.tag, matchId))) return;
  const told = new Set<string>();
  for (const pid of notaPlayers(after?.notas)) {
    const uid = (await db.doc(`playerLinks/${pid}`).get()).get("uid");
    if (typeof uid !== "string" || !uid) continue;
    told.add(uid);
    if (await claimLog(`notas-${matchId}-${pid}`, matchId)) await sendTo(mine, uid, undefined, false);
  }
  await sendTo(everyone, undefined, told);
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
  const notice = lineupNotice(event.params.lineupId, before, after, match, Date.now());
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

/** «Ya está la clasificación»: a captain published (or replaced) the league table of a season. */
export const pushOnStandings = onDocumentWritten({ document: "standings/{seasonId}", secrets: [vapidPrivate] }, async (event) => {
  const notice = standingsNotice(event.params.seasonId, event.data?.before.data(), event.data?.after.data());
  if (notice) await deliver(notice);
});
