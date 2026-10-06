// Push notices (Web Push with the club's own VAPID keys, no third party): anyone can ask for them
// on the web, by topic; the server sends them when a match changes (goals written live, final
// whistle, MVP vote, new dates) and at kick-off (a job every 5 minutes).
import { onCall } from "firebase-functions/v2/https";
import { onDocumentWritten } from "firebase-functions/v2/firestore";
import { onSchedule } from "firebase-functions/v2/scheduler";
import { defineSecret } from "firebase-functions/params";
import { FieldValue, Timestamp, type DocumentData } from "firebase-admin/firestore";
import { createHash } from "node:crypto";
import webpush from "web-push";
import { z } from "zod";
import { db, parse } from "./common.js";
import { kickoffNotice, noticesFor, TOPICS, type MatchLike, type Notice, type Topic } from "./pushLogic.js";

const vapidPrivate = defineSecret("VAPID_PRIVATE_KEY");
/** Public half of the key pair (also in the app, src/lib/push.ts). */
export const VAPID_PUBLIC = "BAZRaiFp6DqaRb1e2ONwNyUivVNI6AqQCrb-ovbyBJ7c_BYYHRt9SrPbE96MjDZfasbQrRqDREKCG6z7Ug3uDYc";
const SITE = "https://manchester-piti.vercel.app";

const subscription = z.object({
  endpoint: z.url().refine((u) => u.startsWith("https://"), "Suscripción no válida."),
  keys: z.object({ p256dh: z.string().min(1).max(200), auth: z.string().min(1).max(100) }),
});
const subId = (endpoint: string) => createHash("sha256").update(endpoint).digest("hex").slice(0, 40);

export const pushSubscribe = onCall(async (req) => {
  const input = parse(z.object({ subscription, topics: z.array(z.enum(TOPICS)).max(TOPICS.length) }), req.data);
  const ref = db.doc(`pushSubscriptions/${subId(input.subscription.endpoint)}`);
  if (!input.topics.length) {
    await ref.delete();
    return { topics: [] };
  }
  await ref.set({ endpoint: input.subscription.endpoint, keys: input.subscription.keys, topics: [...new Set(input.topics)], updatedAt: FieldValue.serverTimestamp() }, { merge: true });
  return { topics: input.topics };
});

export const pushUnsubscribe = onCall(async (req) => {
  const input = parse(z.object({ endpoint: z.url() }), req.data);
  await db.doc(`pushSubscriptions/${subId(input.endpoint)}`).delete();
  return { ok: true };
});

async function send(notice: Notice) {
  const subs = await db.collection("pushSubscriptions").where("topics", "array-contains", notice.topic satisfies Topic).get();
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
  for (const n of noticesFor(event.params.matchId, before, after, (id) => names.get(id) ?? "Jugador", Date.now())) await send(n);
});

export const pushKickoff = onSchedule({ schedule: "every 5 minutes", timeZone: "Europe/Madrid", secrets: [vapidPrivate] }, async () => {
  const now = Date.now();
  // Date range only (single-field index); the status is checked here.
  const due = await db.collection("matches").where("date", ">=", Timestamp.fromMillis(now - 10 * 60_000)).where("date", "<=", Timestamp.fromMillis(now + 60_000)).get();
  for (const m of due.docs) {
    if (m.get("archived") || m.get("status") !== "scheduled") continue;
    // Once per match, whatever the overlaps between runs.
    try {
      await db.doc(`pushLog/start-${m.id}`).create({ at: FieldValue.serverTimestamp() });
    } catch {
      continue;
    }
    await send(kickoffNotice(m.id, m.get("rival") ?? "el rival"));
  }
});

