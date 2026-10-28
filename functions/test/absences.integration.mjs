// Run only with the demo emulators. No production credentials or endpoints.
// Ausencias («no puedo del 12 al 19»), against the Firestore + Functions emulators: an absence answers
// «No puedo» on the matches still to play in its dates (onAbsenceWritten), a match published or moved into
// a range gets it only if unanswered (pushOnMatch → absencesOnMatch), deleting it takes back only its own
// answers, and the captains' notice is claimed once (pushLog absence-<id>; nobody is subscribed, so nothing
// is signed or sent). The «Baja de última hora» of pushOnAnswer never fires for an absence's answer.
import assert from "node:assert/strict";
process.env.FIRESTORE_EMULATOR_HOST = "127.0.0.1:8080";
process.env.FIREBASE_AUTH_EMULATOR_HOST = "127.0.0.1:9099";
// (the demo project, whatever the shell's GCP variables say)
process.env.GCLOUD_PROJECT = "demo-manchester-piti";
process.env.GOOGLE_CLOUD_PROJECT = "demo-manchester-piti";
// (the functions' own Firestore client, as under the emulator: no REST/credentials lookup)
process.env.FUNCTIONS_EMULATOR = "true";
const { db } = await import("../lib/common.js");
const { madridDate } = await import("../lib/absencesLogic.js");
// (what onAbsenceWritten runs, called directly to replay a create event: Firestore delivers at least once)
const { applyMemberAbsences } = await import("../lib/absenceAnswers.js");
const { Timestamp } = await import("firebase-admin/firestore");

const suffix = Date.now().toString(36);
let checked = 0;
const sleep = (ms) => new Promise((ok) => setTimeout(ok, ms));
/** Waits until `test` holds (a trigger did its job; up to a minute: a trigger's first run after the
 *  emulator loads it can take half of that). */
async function until(what, test) {
  for (let i = 0; i < 240; i++) {
    if (await test()) {
      checked++;
      return;
    }
    await sleep(250);
  }
  assert.fail(what);
}

const HOUR = 3_600_000;
const DAY = 24 * HOUR;
const now = Date.now();
const seasonId = "aus-season-" + suffix;
const uid = "aus-member-" + suffix;
const other = "aus-other-" + suffix;
const captain = "aus-captain-" + suffix;
const ficha = "aus-ficha-" + suffix;
const nick = "ausente" + suffix;
await db.doc(`seasons/${seasonId}`).set({ name: "Ausencias · pruebas" });
await db.doc(`players/${ficha}`).set({ firstName: "Ausente", shirtName: "AUSENTE", seasons: [seasonId] });
await db.doc(`users/${uid}`).set({ role: "user", nickname: nick, playerId: ficha });
await db.doc(`users/${other}`).set({ role: "user", nickname: "otro" + suffix });
await db.doc(`users/${captain}`).set({ role: "admin", nickname: "capi" + suffix });

const id = (k) => `aus-${k}-${suffix}`;
const matchRef = (k) => db.doc("matches/" + id(k));
const match = (k, date, status = "scheduled") => matchRef(k).set({ version: 2, seasonId, rival: "Rival Ausencias", status, date: Timestamp.fromMillis(date), events: [] });
const answerRef = (k, who = uid) => db.doc(`matchPrivate/${id(k)}/availability/${who}`);
const read = async (k, who = uid) => (await answerRef(k, who).get()).data();
/** A hand answer, as the web writes it (no source). */
const hand = (k, response, who = uid) => answerRef(k, who).set({ response, name: who === uid ? nick : "otro" + suffix, playerId: who === uid ? ficha : null, at: Timestamp.now() });
const isAbsence = (d, absenceId) => d?.response === "no" && d.source === "absence" && d.absenceId === absenceId;
const isHand = (d, response) => d?.response === response && d.source === undefined && d.absenceId === undefined;

// ---------- the matches: in the range (one within 24 h), out of it, called off, already kicked off
await match("soon", now + 5 * HOUR);
await match("in1", now + 3 * DAY);
await match("in2", now + 5 * DAY);
await match("out", now + 30 * DAY);
await match("off", now + 4 * DAY, "cancelled");
await match("past", now - 2 * HOUR);
// (their own pushOnMatch runs find no absence: let them pass before answering)
await sleep(2000);
await hand("soon", "yes");
await hand("in1", "yes");
await hand("past", "yes");
await hand("in2", "yes", other);

// ---------- an absence created: «No puedo» on its matches still to play, over the hand answers too
const from = madridDate(now - DAY);
const to = madridDate(now + 10 * DAY);
const aRef = await db.collection("absences").add({ uid, playerId: ficha, name: nick, from, to, note: "Boda", createdAt: Timestamp.now() });
const A = aRef.id;
await until("in2 answered by the absence", async () => isAbsence(await read("in2"), A));
// (in2 alone can be pushOnMatch's late run for its own publication — a cold worker — filling a blank: the
// notice's claim is written after onAbsenceWritten's transaction, so once it is there the absence's run is done)
await until("pushLog/absence-A claimed", async () => (await db.doc(`pushLog/absence-${A}`).get()).exists);
const in2 = await read("in2");
assert.equal(in2.name, nick);
assert.equal(in2.playerId, ficha);
assert.ok(in2.at instanceof Timestamp);
assert.ok(isAbsence(await read("in1"), A), "a hand answer in range is overwritten by the new absence");
assert.ok(isAbsence(await read("soon"), A));
assert.equal(await read("out"), undefined, "out of the range: untouched");
assert.equal(await read("off"), undefined, "called off: untouched");
assert.ok(isHand(await read("past"), "yes"), "kicked off: untouched");
assert.ok(isHand(await read("in2", other), "yes"), "another member: untouched");
checked += 7;
// one notice to the captains, claimed once…
const claimedAt = (await db.doc(`pushLog/absence-${A}`).get()).get("at").toMillis();
// …and no «Baja de última hora» for the «No puedo» it wrote within 24 h of kick-off
await sleep(3000);
assert.equal((await db.doc(`pushLog/late-${id("soon")}-${uid}`).get()).exists, false, "pushOnAnswer skips an absence's answer");
checked++;
// the trigger again on the same absence (a retry, an edit by hand): nothing new, never a second notice
await aRef.update({ note: "Boda en Cuenca" });
await sleep(3000);
assert.equal((await db.doc(`pushLog/absence-${A}`).get()).get("at").toMillis(), claimedAt);
assert.ok(isAbsence(await read("in2"), A));
checked += 2;

// ---------- the member changes one by hand: from then on it is theirs
await hand("in1", "maybe");
// …even if the create event comes again after it (a retry, a late worker): the trigger's own step, replayed
// with the absence as `fresh`, keeps a hand answer newer than the absence
const replay = await applyMemberAbsences(uid, A, Date.now());
assert.ok(isHand(await read("in1"), "maybe"), "a hand answer given after the absence survives a repeated create event");
assert.ok(isAbsence(await read("in2"), A), "the absence's own answers stay");
assert.equal(replay.freshSeen, true);
assert.deepEqual(replay.writes, []);
checked += 4;

// ---------- matches published into the range: «No puedo» only for who hasn't answered
await hand("newAns", "yes");
await match("newAns", now + 7 * DAY);
await match("new1", now + 6 * DAY);
await until("new1 answered by the absence", async () => isAbsence(await read("new1"), A));
await sleep(2000);
assert.ok(isHand(await read("newAns"), "yes"), "an answer given before the match was published stays");
checked++;
// a date moved into the range gets it; one moved out of it loses the absence's answer
await matchRef("out").update({ date: Timestamp.fromMillis(now + 8 * DAY) });
await until("out, moved in, answered by the absence", async () => isAbsence(await read("out"), A));
await matchRef("in2").update({ date: Timestamp.fromMillis(now + 40 * DAY) });
await until("in2, moved out, loses the absence's answer", async () => (await read("in2")) === undefined);
assert.ok(isHand(await read("in2", other), "yes"));
checked++;

// ---------- a second absence over new1 only: new1 keeps the first one's answer; its own notice
const bRef = await db.collection("absences").add({ uid, playerId: ficha, name: nick, from: madridDate(now + 6 * DAY), to: madridDate(now + 6 * DAY), createdAt: Timestamp.now() });
const B = bRef.id;
await until("pushLog/absence-B claimed", async () => (await db.doc(`pushLog/absence-${B}`).get()).exists);
assert.ok(isAbsence(await read("new1"), A));
checked++;

// ---------- the first absence deleted: only its own answers go (new1 passes to the second one)
await aRef.delete();
await until("soon loses the absence's answer", async () => (await read("soon")) === undefined);
assert.equal(await read("out"), undefined);
assert.ok(isAbsence(await read("new1"), B), "still covered by the second absence");
assert.ok(isHand(await read("in1"), "maybe"), "a hand answer survives the delete");
assert.ok(isHand(await read("newAns"), "yes"));
assert.ok(isHand(await read("past"), "yes"));
assert.ok(isHand(await read("in2", other), "yes"));
checked += 6;
await bRef.delete();
await until("new1 loses the second absence's answer", async () => (await read("new1")) === undefined);
// deleting never notifies: still the one claim per absence
assert.equal((await db.doc(`pushLog/absence-${A}`).get()).get("at").toMillis(), claimedAt);
checked++;

// ---------- r12: a captain writes one for the member from la Sala (`by`): «No puedo» all the same, no notice
const cRef = await db.collection("absences").add({ uid, playerId: ficha, name: nick, from: madridDate(now + 6 * DAY), to: madridDate(now + 6 * DAY), createdAt: Timestamp.now(), by: captain });
const C = cRef.id;
await until("new1 answered by the captain's absence", async () => isAbsence(await read("new1"), C));
await sleep(3000);
assert.equal((await db.doc(`pushLog/absence-${C}`).get()).exists, false, "a captain's own absence for a member tells no captain");
checked++;
await cRef.delete();
await until("new1 loses the captain's absence", async () => (await read("new1")) === undefined);

// (cleanup: the emulator keeps no upcoming test matches)
for (const k of ["soon", "in1", "in2", "out", "off", "past", "newAns", "new1"]) {
  for (const who of [uid, other]) await answerRef(k, who).delete();
  await matchRef(k).delete();
}
for (const p of [`seasons/${seasonId}`, `players/${ficha}`, `users/${uid}`, `users/${other}`, `users/${captain}`]) await db.doc(p).delete();

console.log(checked + " comprobaciones de ausencias correctas: «No puedo» en sus fechas, partidos nuevos y movidos, quitar sin pisar lo hecho a mano y un solo aviso.");
await db.terminate();
