// Stores what visitors' phones report about how the site felt (src/lib/vitals.ts, through /datos/v: vercel.json).
// Anyone can send one, so it is checked (vitalsLogic.ts) and kept small; nothing personal is stored (no IP, no
// account). Read with functions/scripts/vitals-report.mjs.
import { onRequest } from "firebase-functions/v2/https";
import { FieldValue, Timestamp } from "firebase-admin/firestore";
import { db, REGION } from "./common.js";
import { KEEP_DAYS, parseVitals, withinRate } from "./vitalsLogic.js";

/** This instance's recent writes (a flood can't run up Firestore: at most RATE_PER_MIN a minute each, 2 instances). */
const recent: number[] = [];

export const clubVitals = onRequest({ region: REGION, memory: "256MiB", maxInstances: 2, concurrency: 40 }, async (req, res) => {
  res.set("Cache-Control", "no-store");
  if (req.method !== "POST") {
    res.status(405).end();
    return;
  }
  const body = typeof req.rawBody === "object" && req.rawBody ? req.rawBody.toString("utf8") : typeof req.body === "string" ? req.body : JSON.stringify(req.body ?? null);
  const report = parseVitals(body);
  if (!report) {
    res.status(400).end();
    return;
  }
  const now = Date.now();
  if (!withinRate(recent, now)) {
    res.status(429).end();
    return;
  }
  await db.collection("vitals").add({
    ...report,
    at: FieldValue.serverTimestamp(),
    day: new Date(now).toISOString().slice(0, 10),
    expireAt: Timestamp.fromMillis(now + KEEP_DAYS * 86_400_000),
  });
  res.status(204).end();
});
