// Run only with the demo emulators. No production credentials or endpoints.
// The push notices of the whole match and the personal ones: each trigger claims its pushLog id (the
// proof it would send, once), against the Firestore + Functions emulators. Nobody is subscribed while
// they run, so nothing is signed or sent. The MVP's winner (a step of the 5-minute job) is run here
// directly against the emulator.
import assert from "node:assert/strict";
process.env.FIRESTORE_EMULATOR_HOST = "127.0.0.1:8080";
process.env.FIREBASE_AUTH_EMULATOR_HOST = "127.0.0.1:9099";
// (the demo project, whatever the shell's GCP variables say)
process.env.GCLOUD_PROJECT = "demo-manchester-piti";
process.env.GOOGLE_CLOUD_PROJECT = "demo-manchester-piti";
// (the functions' own Firestore client, as under the emulator: no REST/credentials lookup)
process.env.FUNCTIONS_EMULATOR = "true";
const { db } = await import("../lib/common.js");
const { announceMvpWinners } = await import("../lib/push.js");
const { Timestamp } = await import("firebase-admin/firestore");

const suffix = Date.now().toString(36);
let checked = 0;
const sleep = (ms) => new Promise((ok) => setTimeout(ok, ms));
const logged = async (id) => (await db.doc("pushLog/" + id).get()).exists;
/** Waits for a trigger to claim pushLog/<id>. */
async function claimed(id) {
  for (let i = 0; i < 80; i++) {
    if (await logged(id)) {
      checked++;
      return (await db.doc("pushLog/" + id).get()).get("at").toMillis();
    }
    await sleep(250);
  }
  assert.fail("pushLog/" + id + " did not appear");
}
/** After the trigger had time to run: pushLog/<id> is not there. */
async function notClaimed(id, wait = 3000) {
  await sleep(wait);
  assert.equal(await logged(id), false, "pushLog/" + id + " should not exist");
  checked++;
}

// ---------- the clock's whistles and «Gol anulado» (pushOnMatch)
const seasonId = "push-season-" + suffix;
const scorer = "push-scorer-" + suffix;
await db.doc(`seasons/${seasonId}`).set({ name: "Avisos · pruebas" });
await db.doc(`players/${scorer}`).set({ firstName: "Pruebas", shirtName: "VIEJO", seasons: [seasonId], seasonDetails: { [seasonId]: { shirtName: "NUEVO" } } });
const id = "push-match-" + suffix;
const ref = db.doc("matches/" + id);
const clock = (phase, revision) => ({ phase, revision });
const goal = (eid, minute, playerId) => ({ id: eid, type: "goal", minute, ...(playerId ? { playerId } : {}) });
await ref.set({ version: 2, seasonId, rival: "Rival Avisos", status: "scheduled", date: Timestamp.fromMillis(Date.now() - 60_000), clock: clock("ready", 0), events: [] });
await ref.update({ clock: clock("first", 1) });
await claimed(`start-${id}`);
// a goal, pushed (its own pushLog), then undone: «Gol anulado»
await ref.update({ events: [goal("g1", 10, scorer)] });
await claimed(`goal-${id}-g1`);
await ref.update({ events: [] });
await claimed(`goal-off-${id}-g1`);
// a goal whose notice never went (no pushLog): undoing it says nothing (the descanso in the same write
// is the proof the trigger ran)
await ref.update({ events: [goal("g2", 20)] });
await claimed(`goal-${id}-g2`);
await db.doc(`pushLog/goal-${id}-g2`).delete();
await ref.update({ events: [], clock: clock("halftime", 2) });
const half = await claimed(`half-${id}`);
assert.equal(await logged(`goal-off-${id}-g2`), false);
checked++;
// the descanso undone and blown again: the same pushLog, never claimed twice
await ref.update({ clock: clock("first", 3) });
await ref.update({ clock: clock("halftime", 4) });
await sleep(3000);
assert.equal((await db.doc(`pushLog/half-${id}`).get()).get("at").toMillis(), half);
checked++;
await ref.update({ clock: clock("second", 5), events: [goal("g3", 40, scorer)] });
await claimed(`second-${id}`);
await claimed(`goal-${id}-g3`);
await ref.update({ clock: clock("ended", 6) });
const provisional = await claimed(`final-live-${id}`);
// reopened and ended again: still the one provisional final
await ref.update({ clock: clock("second", 7) });
await ref.update({ clock: clock("ended", 8) });
await sleep(3000);
assert.equal((await db.doc(`pushLog/final-live-${id}`).get()).get("at").toMillis(), provisional);
checked++;
// after the final whistle a goal written (and undone) is a correction of the acta: silent both ways
await ref.update({ events: [goal("g3", 40, scorer), goal("g4", 49)] });
await notClaimed(`goal-${id}-g4`);
// (g3 was pushed live: undoing it now is still a correction, not «Gol anulado»)
await ref.update({ events: [goal("g4", 49)] });
await notClaimed(`goal-off-${id}-g3`, 2000);
await ref.update({ events: [goal("g3", 40, scorer)] });
// the acta published: the official «Final» (its own pushLog, the provisional's tag) and the MVP vote
await ref.update({ status: "finished", goalsFor: 1, goalsAgainst: 0, voteClosesAt: Date.now() + 48 * 3600_000 });
await claimed(`final-${id}`);
await claimed(`mvp-open-${id}`);
// a correction of that acta that removes the goal: never «Gol anulado»
await ref.update({ events: [], goalsFor: 0 });
await notClaimed(`goal-off-${id}-g3`);

// the acta's «Final» already went (an acta published, then un-published and its clock ended again, or
// triggers out of order): no provisional final after it
const late = "push-late-" + suffix;
await db.doc("matches/" + late).set({ version: 2, seasonId, rival: "Rival Tarde", status: "scheduled", date: Timestamp.fromMillis(Date.now() - 3600_000), clock: clock("second", 3), events: [] });
await db.doc(`pushLog/final-${late}`).set({ at: Timestamp.now() });
await sleep(1000);
await db.doc("matches/" + late).update({ clock: clock("ended", 4) });
await notClaimed(`final-live-${late}`);

// ---------- «MVP de la J5»: the job's step, once the vote has closed
const now = Date.now();
const mvpMatch = (mid, closes) => db.doc("matches/" + mid).set({ version: 2, seasonId, rival: "Rival MVP", status: "finished", goalsFor: 1, goalsAgainst: 0, date: Timestamp.fromMillis(now - 3 * 86400_000), voteClosesAt: closes, clock: clock("ended", 3), events: [] });
const won = "push-mvp-" + suffix, tie = "push-mvp-tie-" + suffix, empty = "push-mvp-none-" + suffix, open = "push-mvp-open-" + suffix, old = "push-mvp-old-" + suffix;
await mvpMatch(won, now - 60_000);
await mvpMatch(tie, now - 60_000);
await mvpMatch(empty, now - 60_000);
await mvpMatch(open, now + 3600_000);
await mvpMatch(old, now - 3 * 86400_000);
await db.doc("mvpResults/" + won).set({ counts: { [scorer]: 3, other: 1 }, total: 4 });
await db.doc("mvpResults/" + tie).set({ counts: { [scorer]: 2, other: 2 }, total: 4 });
await db.doc("mvpResults/" + empty).set({ counts: {}, total: 0 });
await db.doc("mvpResults/" + open).set({ counts: { [scorer]: 1 }, total: 1 });
await db.doc("mvpResults/" + old).set({ counts: { [scorer]: 1 }, total: 1 });
await announceMvpWinners(now);
assert.ok(await logged(`mvp-win-${won}`));
assert.ok(await logged(`mvp-win-${tie}`));
assert.equal(await logged(`mvp-win-${empty}`), false);
assert.equal(await logged(`mvp-win-${open}`), false);
assert.equal(await logged(`mvp-win-${old}`), false);
checked += 5;
// the next run (and an overlapping one) finds it claimed: once
const first = (await db.doc(`pushLog/mvp-win-${won}`).get()).get("at").toMillis();
await Promise.all([announceMvpWinners(now + 300_000), announceMvpWinners(now + 300_000)]);
assert.equal((await db.doc(`pushLog/mvp-win-${won}`).get()).get("at").toMillis(), first);
checked++;

// ---------- personal notices (to the member's own devices)
const member = "push-member-" + suffix;
const ficha = "push-ficha-" + suffix;
await db.doc(`players/${ficha}`).set({ firstName: "Ficha", seasons: [seasonId] });
// «Tu ficha ya es tuya»: a captain approves the claim (pushOnClaim)
await db.doc(`playerClaims/${member}`).set({ playerId: ficha, status: "pending" });
await db.doc(`playerClaims/${member}`).update({ status: "approved", resolvedBy: "push-captain-" + suffix });
await claimed(`claim-${member}-${ficha}`);
// a captain's own claim links at once: nothing to tell him
const captain = "push-captain2-" + suffix;
await db.doc(`playerClaims/${captain}`).set({ playerId: ficha + "-c", status: "pending" });
await db.doc(`playerClaims/${captain}`).update({ status: "approved", resolvedBy: captain });
await notClaimed(`claim-${captain}-${ficha}-c`);
// «El capitán revisó tus posiciones» (pushOnPositionsReview), to the member linked to the ficha
await db.doc(`playerLinks/${ficha}`).set({ uid: member, at: Timestamp.now() });
const reviewAt = Timestamp.fromMillis(now - 1000);
await db.doc(`players/${ficha}`).update({ positionsProposal: null, positionsReview: { status: "aprobada", at: reviewAt, by: "push-captain-" + suffix } });
const reviewed = await claimed(`positions-${ficha}-${reviewAt.toMillis()}`);
// the ficha saved again with the same review: no new notice (the same review, the same claim)
await db.doc(`players/${ficha}`).update({ number: 9 });
await sleep(2000);
assert.equal((await db.doc(`pushLog/positions-${ficha}-${reviewAt.toMillis()}`).get()).get("at").toMillis(), reviewed);
checked++;
// the member reviewing his own ficha (a captain too): nothing
const ownAt = Timestamp.fromMillis(now - 500);
await db.doc(`players/${ficha}`).update({ positionsReview: { status: "ajustada", at: ownAt, by: member } });
await notClaimed(`positions-${ficha}-${ownAt.toMillis()}`);

// ---------- pushSubscribe: a signed-in member's device carries their uid (personal notices find it)
async function google(label) {
  const encode = (o) => Buffer.from(JSON.stringify(o)).toString("base64url");
  const token = encode({ alg: "none", typ: "JWT" }) + "." + encode({ sub: label + "-" + suffix, email: label + "-" + suffix + "@example.test", email_verified: true, name: label, aud: "demo", iss: "https://accounts.google.com" }) + ".";
  const r = await fetch("http://127.0.0.1:9099/identitytoolkit.googleapis.com/v1/accounts:signInWithIdp?key=demo", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ postBody: new URLSearchParams({ id_token: token, providerId: "google.com" }).toString(), requestUri: "http://localhost", returnSecureToken: true }) });
  const data = await r.json();
  assert.ok(data.idToken, JSON.stringify(data));
  return { token: data.idToken, uid: data.localId };
}
async function call(name, user, data) {
  const r = await fetch("http://127.0.0.1:5001/demo-manchester-piti/europe-southwest1/" + name, { method: "POST", headers: { "content-type": "application/json", ...(user ? { authorization: "Bearer " + user.token } : {}) }, body: JSON.stringify({ data }) });
  return r.json();
}
const socio = await google("push-socio");
await db.doc(`users/${socio.uid}`).set({ role: "user", nickname: "socio" + suffix });
await db.doc(`teamMembers/${socio.uid}`).set({ expiresAt: Timestamp.fromMillis(Date.UTC(2200, 0, 1)) });
const sub = (n) => ({ endpoint: `https://push.example.test/${suffix}/${n}`, keys: { p256dh: "p", auth: "a" } });
const mine = await call("pushSubscribe", socio, { subscription: sub("socio"), topics: ["goals"] });
assert.ok(!mine.error, JSON.stringify(mine));
const fan = await call("pushSubscribe", null, { subscription: sub("fan"), topics: ["goals", "convocatoria"] });
assert.deepEqual(fan.result?.topics, ["goals"]);
const docs = await db.collection("pushSubscriptions").where("endpoint", "in", [sub("socio").endpoint, sub("fan").endpoint]).get();
const byEndpoint = new Map(docs.docs.map((d) => [d.get("endpoint"), d]));
assert.equal(byEndpoint.get(sub("socio").endpoint)?.get("uid"), socio.uid);
assert.equal(byEndpoint.get(sub("fan").endpoint)?.get("uid"), undefined);
// a first registration: the server didn't know it
assert.equal(mine.result?.known, false);
assert.equal(mine.result?.uid, socio.uid);
checked += 5;
// the member signs out on that device: re-registered anonymously, the doc loses the uid (and the
// personal topics); the server knew it
const out = await call("pushSubscribe", null, { subscription: sub("socio"), topics: ["goals", "convocatoria"] });
assert.equal(out.result?.known, true);
assert.equal(out.result?.uid, null);
const after = (await db.collection("pushSubscriptions").where("endpoint", "==", sub("socio").endpoint).get()).docs[0];
assert.equal(after.get("uid"), undefined);
assert.deepEqual(after.get("topics"), ["goals"]);
checked += 4;
// (cleanup: nobody stays subscribed in the emulator)
for (const n of ["socio", "fan"]) assert.ok(!(await call("pushSubscribe", n === "socio" ? socio : null, { subscription: sub(n), topics: [] })).error);
assert.equal((await db.collection("pushSubscriptions").where("endpoint", "in", [sub("socio").endpoint, sub("fan").endpoint]).get()).size, 0);
checked++;

// ---------- «Responder desde el aviso»: what the phone gets for the members' RSVP reminder carries the
// buttons «Voy» / «No puedo» and its match; «Ya está la convocatoria» (public: fans get it) carries none
// (the built payload sendTo signs: lib/pushLogic.js pushPayload)
const { convocatoriaMessage, pushPayload } = await import("../lib/pushLogic.js");
const { reminderNotice } = await import("../lib/remindersLogic.js");
const convId = "push-conv-" + suffix;
const convDate = Date.now() + 48 * 3600_000;
const remindPayload = JSON.parse(JSON.stringify(pushPayload(reminderNotice(convId, "48", { rival: "Rival Avisos", date: convDate }))));
assert.deepEqual(remindPayload.actions, [{ action: "yes", title: "Voy" }, { action: "no", title: "No puedo" }]);
assert.equal(remindPayload.matchId, convId);
for (const kind of ["first", "changes"]) {
  const p = pushPayload(convocatoriaMessage(convId, kind, { rival: "Rival Avisos", date: convDate }, 5));
  assert.equal(p.actions, undefined);
  assert.equal(p.matchId, undefined);
}
checked++;

console.log(checked + " comprobaciones de avisos correctas: pitidos, gol anulado, final provisional, MVP, tu ficha, tus posiciones, suscripciones y botones del recordatorio.");
await db.terminate();
