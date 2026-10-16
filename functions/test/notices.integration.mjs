// Run only with the demo emulators. No production credentials or endpoints.
// El centro de avisos, against the Firestore emulator: every notice that goes through sendTo is kept in
// notices/{id} for its audience, even with nobody subscribed (always the case here: nothing is signed or
// sent). A convocatoria is the team's, a personal notice its member's (with uid), a goal is not kept, and
// a retried trigger (sendTo again with the same notice) stores no second copy.
import assert from "node:assert/strict";
process.env.FIRESTORE_EMULATOR_HOST = "127.0.0.1:8080";
process.env.FIREBASE_AUTH_EMULATOR_HOST = "127.0.0.1:9099";
// (the demo project, whatever the shell's GCP variables say)
process.env.GCLOUD_PROJECT = "demo-manchester-piti";
process.env.GOOGLE_CLOUD_PROJECT = "demo-manchester-piti";
// (the functions' own Firestore client, as under the emulator: no REST/credentials lookup)
process.env.FUNCTIONS_EMULATOR = "true";
const { db } = await import("../lib/common.js");
const { sendTo } = await import("../lib/push.js");
const { convocatoriaMessage } = await import("../lib/pushLogic.js");
const { Timestamp } = await import("firebase-admin/firestore");

const suffix = Date.now().toString(36);
let checked = 0;
const HOUR = 3_600_000;
const DAY = 24 * HOUR;
const now = Date.now();
const matchId = "avisos-match-" + suffix;
const uid = "avisos-member-" + suffix;
const url = `/matches/${matchId}`;

await db.doc(`matches/${matchId}`).set({ version: 2, rival: "Rival Avisos", status: "scheduled", date: Timestamp.fromMillis(now + 3 * DAY), events: [] });

/** The kept notices with this title for the match (the emulator's own triggers may keep others for it). */
const keptFor = async (title) => (await db.collection("notices").where("url", "==", url).get()).docs.filter((d) => d.get("title") === title);
const close = (ts, ms) => Math.abs(ts.toMillis() - ms) < 60_000;

// ---------- a convocatoria: one doc for the team, with its 60 days
const conv = convocatoriaMessage(matchId, "first", { rival: "Rival Avisos", date: now + 3 * DAY }, 4);
await sendTo(conv);
let docs = await keptFor(conv.title);
assert.equal(docs.length, 1, "la convocatoria se guarda una vez");
const c = docs[0].data();
assert.equal(c.audience, "team");
assert.equal(c.topic, "lineup");
assert.equal(c.body, conv.body);
assert.equal(c.uid, undefined, "un aviso del equipo no lleva uid");
assert.ok(c.at instanceof Timestamp && close(c.at, now), "at es la hora del aviso");
assert.equal(c.expireAt.toMillis() - c.at.toMillis(), 60 * DAY, "caduca a los 60 días");
checked++;

// ---------- a retried trigger: the same notice again stores no copy
await sendTo(conv);
await sendTo(conv);
docs = await keptFor(conv.title);
assert.equal(docs.length, 1, "un reintento no duplica el aviso");
checked++;

// ---------- a goal: not kept (the island tells it)
const goal = { topic: "goals", title: `¡Gol! 1–0 ${suffix}`, body: "Marca NICO", tag: `goal-${matchId}`, url, log: `goal-${matchId}-e1` };
await sendTo(goal);
assert.equal((await keptFor(goal.title)).length, 0, "un gol no se guarda");
checked++;

// ---------- a personal notice: one doc for its member, with uid
const claim = { topic: "personal", title: "Tu ficha ya es tuya", body: "El capitán aprobó tu ficha.", tag: `claim-${uid}`, url: "/profile", log: `claim-${uid}-p1` };
await sendTo(claim, uid);
await sendTo(claim, uid);
const mine = await db.collection("notices").where("audience", "==", "personal").where("uid", "==", uid).get();
assert.equal(mine.size, 1, "el aviso personal se guarda una vez, para su socio");
assert.equal(mine.docs[0].get("title"), claim.title);
assert.equal(mine.docs[0].get("topic"), "personal");
checked++;
// (and without its member it isn't kept: nobody to read it)
await sendTo({ ...claim, title: `Sin socio ${suffix}` });
assert.equal((await db.collection("notices").where("title", "==", `Sin socio ${suffix}`).get()).size, 0, "lo personal sin uid no se guarda");
checked++;

// ---------- clean up
for (const d of (await db.collection("notices").where("url", "==", url).get()).docs) await d.ref.delete();
for (const d of mine.docs) await d.ref.delete();
await db.doc(`matches/${matchId}`).delete();

console.log(checked + " comprobaciones del centro de avisos correctas: la convocatoria para el equipo, lo personal para su socio, sin goles y sin copias al reintentar.");
await db.terminate();
