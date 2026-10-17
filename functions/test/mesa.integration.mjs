// La mesa on the demo emulators (no production credentials, hosts or documents): two scorers writing
// at once, possible duplicates («Son dos» / «Es el mismo»), queued plays with their tapped time after a
// pause and the half-time, fixes and deletions by the other scorer, the clock's pause / resume /
// stoppage time, and publishLive from a scorer (refused while a duplicate is pending).
import assert from "node:assert/strict";
process.env.FIRESTORE_EMULATOR_HOST = "127.0.0.1:8080";
process.env.FIREBASE_AUTH_EMULATOR_HOST = "127.0.0.1:9099";
const { initializeApp } = await import("firebase-admin/app");
const { getFirestore, Timestamp } = await import("firebase-admin/firestore");
const { clockReading } = await import("../lib/matchClock.js");
const { liveScore, noticesFor } = await import("../lib/pushLogic.js");
initializeApp({ projectId: "demo-manchester-piti" });
const db = getFirestore(), suffix = `mesa-${Date.now().toString(36)}`;
let checks = 0;
async function person(label, role = "user") {
  const enc = (o) => Buffer.from(JSON.stringify(o)).toString("base64url");
  const jwt = enc({ alg: "none", typ: "JWT" }) + "." + enc({ sub: `${label}-${suffix}`, email: `${label}-${suffix}@example.test`, email_verified: true, name: label, aud: "demo", iss: "https://accounts.google.com" }) + ".";
  const r = await fetch("http://127.0.0.1:9099/identitytoolkit.googleapis.com/v1/accounts:signInWithIdp?key=demo", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ postBody: new URLSearchParams({ id_token: jwt, providerId: "google.com" }).toString(), requestUri: "http://localhost", returnSecureToken: true }) });
  const u = await r.json();
  assert.ok(u.idToken, JSON.stringify(u));
  await db.doc(`users/${u.localId}`).set({ role, nickname: label });
  await db.doc(`teamMembers/${u.localId}`).set({ expiresAt: Timestamp.fromMillis(Date.now() + 86_400_000) });
  return { uid: u.localId, token: u.idToken };
}
async function call(name, who, data) {
  const r = await fetch(`http://127.0.0.1:5001/demo-manchester-piti/europe-southwest1/${name}`, { method: "POST", headers: { "content-type": "application/json", authorization: `Bearer ${who.token}` }, body: JSON.stringify({ data }) });
  return r.json();
}
async function ok(name, who, data) { const r = await call(name, who, data); assert.ok(!r.error, `${name}: ${JSON.stringify(r)}`); checks++; return r.result; }
async function denied(name, who, data, status, words) {
  const r = await call(name, who, data);
  assert.equal(r.error?.status, status, `${name}: ${JSON.stringify(r)}`);
  if (words) assert.match(r.error.message, words);
  checks++;
  return r.error;
}

const admin = await person("mesa-admin", "admin"), david = await person("david"), pablo = await person("pablo"), outsider = await person("mesa-fan");
const seasonId = `${suffix}-season`, matchId = `${suffix}-match`;
const ids = Array.from({ length: 10 }, (_, i) => `${suffix}-p${i}`);
await db.doc(`seasons/${seasonId}`).set({ name: "La mesa · pruebas" });
await Promise.all(ids.map((id) => db.doc(`players/${id}`).set({ firstName: id, seasons: [seasonId] })));
const sheet = { version: 2, revision: 0, seasonId, rival: "Atlético Demo", rivalShort: "ATL", competition: "Liga", date: Date.now() + 3600_000, duration: 50, venue: "Pruebas", home: true, status: "scheduled", starters: ids.slice(0, 7), bench: ids.slice(7, 9), notCalled: [], events: [], report: "" };
const ref = db.doc(`matches/${matchId}`);
const snap = async () => (await ref.get()).data();
const byId = async (id) => (await snap()).events.find((e) => e.id === id);
await ok("saveMatchSheet", admin, { id: matchId, sheet });
assert.equal((await snap()).rivalShort, "ATL"); checks++;
await ok("setMatchScorers", admin, { matchId, uids: [david.uid, pablo.uid] });

// ---- kick-off, ten minutes in
await ok("controlMatchClock", david, { matchId, action: "start", revision: 0 });
await ref.update({ "clock.firstStartedAt": Date.now() - 600_000 });
let m = await snap();
const add = (requestId, type, extra = {}, envelope = {}) => ({ action: "add", matchId, clockRevision: m.clock.revision, requestId, event: { type, minute: 0, ...extra }, ...envelope });

// ---- two scorers writing at once: every play lands, each signed by who wrote it
await Promise.all([
  ok("liveEvent", david, add("r1", "chance", { playerId: ids[1] })),
  ok("liveEvent", pablo, add("r2", "foul", { playerId: ids[2] })),
  ok("liveEvent", david, add("r3", "opponent_foul")),
  ok("liveEvent", pablo, add("r4", "save", { playerId: ids[0] })),
  ok("liveEvent", david, add("r5", "foul_received", { playerId: ids[3] })),
  ok("liveEvent", pablo, add("r6", "opponent_offside")),
]);
m = await snap();
assert.equal(m.events.length, 6); checks++;
assert.equal(m.events.find((e) => e.id === "live-r1").byUid, david.uid); checks++;
assert.equal(m.events.find((e) => e.id === "live-r2").byUid, pablo.uid); checks++;
assert.equal(m.events.find((e) => e.id === "live-r4").outcome, "unknown"); checks++;
// a rival play never names a Piti player; an injury and a foul need one
await denied("liveEvent", david, add("bad-rival", "opponent_foul", { playerId: ids[1] }), "FAILED_PRECONDITION", /rival/);
await denied("liveEvent", david, add("bad-injury", "injury"), "FAILED_PRECONDITION", /convocado/);
await ok("liveEvent", pablo, add("pen", "penalty_received"));
await ok("liveEvent", pablo, add("knock", "injury", { playerId: ids[4] }));

// ---- the same goal from both phones: the later one is a possible duplicate, counted once
await ok("liveEvent", david, add("g-a", "goal", { playerId: ids[5] }));
const dupAnswer = await ok("liveEvent", pablo, add("g-b", "goal", { playerId: ids[5] }));
assert.equal(dupAnswer.dupOf, "live-g-a"); checks++;
assert.equal((await byId("live-g-b")).dupOf, "live-g-a"); checks++;
m = await snap();
assert.deepEqual(liveScore(m.events), { gf: 1, ga: 0 }); checks++;
// the goal push: the pending duplicate is no news; «Son dos» would make it a goal
{
  const before = { status: "scheduled", rival: "Atlético Demo", clock: { phase: "first" }, events: m.events.filter((e) => e.id !== "live-g-b") };
  const after = { ...before, events: m.events };
  assert.equal(noticesFor(matchId, before, after, () => "X", Date.now()).filter((n) => n.topic === "goals").length, 0);
  const counted = { ...after, events: m.events.map((e) => (e.id === "live-g-b" ? { ...e, dupOk: true } : e)) };
  const [goal] = noticesFor(matchId, after, counted, () => "X", Date.now()).filter((n) => n.topic === "goals");
  assert.match(goal.title, /2–0/);
  checks += 2;
}
// the same scorer twice is two goals; a rival play from both phones is a duplicate too
const second = await ok("liveEvent", david, add("g-a2", "goal", { playerId: ids[5] }));
assert.equal(second.dupOf, undefined); checks++;
await ok("liveEvent", david, add("oc-a", "opponent_corner"));
assert.equal((await ok("liveEvent", pablo, add("oc-b", "opponent_corner"))).dupOf, "live-oc-a"); checks++;
// «Son dos» (edit dupOk) by the other scorer: both stand, signed
await ok("liveEvent", david, { action: "edit", matchId, eventId: "live-oc-b", patch: { dupOk: true } });
{ const e = await byId("live-oc-b"); assert.equal(e.dupOk, true); assert.equal(e.editedByUid, david.uid); assert.equal(typeof e.editedAt, "number"); checks += 3; }
// «Es el mismo» (delete the later one); and Pablo deletes David's second goal
await ok("liveEvent", david, { action: "delete", matchId, eventId: "live-g-b" });
await ok("liveEvent", pablo, { action: "delete", matchId, eventId: "live-g-a2" });
await denied("liveEvent", david, { action: "delete", matchId, eventId: "live-g-a2" }, "ABORTED", /borrado/);
m = await snap();
assert.equal(m.events.some((e) => e.id === "live-g-b" || e.id === "live-g-a2"), false); checks++;
assert.deepEqual(liveScore(m.events), { gf: 1, ga: 0 }); checks++;

// ---- fixes by the other scorer: player, minute, type; a real conflict is refused with its reason
await ok("liveEvent", pablo, { action: "edit", matchId, eventId: "live-r1", patch: { playerId: ids[3], elapsedSeconds: 125 } });
{ const e = await byId("live-r1"); assert.equal(e.playerId, ids[3]); assert.equal(e.minute, 2); assert.equal(e.elapsedSeconds, 125); assert.equal(e.byUid, david.uid); assert.equal(e.editedByUid, pablo.uid); checks += 5; }
await ok("liveEvent", pablo, { action: "edit", matchId, eventId: "live-r1", patch: { type: "woodwork" } });
assert.equal((await byId("live-r1")).type, "woodwork"); checks++;
await denied("liveEvent", david, { action: "edit", matchId, eventId: "live-r2", patch: { playerId: ids[7] } }, "FAILED_PRECONDITION", /campo/);
await denied("liveEvent", david, { action: "edit", matchId, eventId: "live-r2", patch: { elapsedSeconds: 8000 } }, "INVALID_ARGUMENT", /futuro/);
await denied("liveEvent", david, { action: "edit", matchId, eventId: "live-nope", patch: { dupOk: true } }, "ABORTED");
// the pending scorer («Lo apunto luego»), filled in later
await ok("liveEvent", david, add("later", "goal"));
await ok("liveEvent", pablo, { action: "edit", matchId, eventId: "live-later", patch: { playerId: ids[6] } });
assert.equal((await byId("live-later")).playerId, ids[6]); checks++;

// ---- pause, stoppage time, resume
m = await snap();
await ok("controlMatchClock", pablo, { matchId, action: "pause", revision: m.clock.revision });
m = await snap();
const heldAt = m.clock.heldAt;
assert.equal(typeof heldAt, "number"); checks++;
{
  const r = clockReading(m.clock, Date.now()), later = clockReading(m.clock, Date.now() + 60_000);
  assert.equal(r.playing, false); assert.equal(r.held, true); assert.equal(later.elapsedSeconds, r.elapsedSeconds); checks += 3;
}
await denied("controlMatchClock", david, { matchId, action: "pause", revision: m.clock.revision }, "FAILED_PRECONDITION", /pausa/);
// during the hold, like at half-time: changes, cards and knocks only
await denied("liveEvent", david, add("held-goal", "goal", { playerId: ids[1] }), "FAILED_PRECONDITION", /pausa/);
await ok("liveEvent", david, add("held-sub", "substitution", { playerId: ids[6], inPlayerId: ids[7] }));
const heldElapsed = clockReading(m.clock, Date.now()).elapsedSeconds;
assert.equal((await byId("live-held-sub")).elapsedSeconds, heldElapsed); checks++;
// the stoppage time is a label: any revision, the clock's revision unchanged, 0–15
const revision = m.clock.revision;
await ok("controlMatchClock", david, { matchId, action: "added", revision: 0, value: 3 });
m = await snap();
assert.equal(m.clock.added["1"], 3); assert.equal(m.clock.revision, revision); checks += 2;
await denied("controlMatchClock", david, { matchId, action: "added", revision, value: 16 }, "INVALID_ARGUMENT");
await ok("controlMatchClock", david, { matchId, action: "resume", revision });
m = await snap();
assert.equal(m.clock.heldAt, undefined); assert.equal(m.clock.pauses.length, 1); assert.equal(m.clock.pauses[0].from, heldAt); checks += 3;
assert.ok(Math.abs(clockReading(m.clock, Date.now()).elapsedSeconds - heldElapsed) <= 2); checks++;
await denied("controlMatchClock", david, { matchId, action: "resume", revision: m.clock.revision }, "FAILED_PRECONDITION", /pausa/);
// a play tapped offline before the pause, uploaded after it: its tapped time, no revision check
await ok("liveEvent", pablo, add("q-pause", "chance", { playerId: ids[2] }, { clockRevision: revision - 1, tappedElapsed: heldElapsed - 20, period: 1 }));
{ const e = await byId("live-q-pause"); assert.equal(e.elapsedSeconds, heldElapsed - 20); assert.equal(e.queued, true); assert.equal(e.period, 1); checks += 3; }

// ---- half-time; queued plays tapped in the 1st half arrive during the break
await ok("controlMatchClock", pablo, { matchId, action: "halftime", revision: m.clock.revision });
m = await snap();
const first = clockReading(m.clock, Date.now()).firstSeconds;
await denied("liveEvent", david, add("break-goal", "goal", { playerId: ids[1] }), "FAILED_PRECONDITION");
await ok("liveEvent", david, add("q-goal", "goal", { playerId: ids[0] }, { clockRevision: 0, tappedElapsed: 60, period: 1 }));
assert.equal((await byId("live-q-goal")).elapsedSeconds, 60); checks++;
await denied("liveEvent", david, add("q-late", "chance", { playerId: ids[1] }, { tappedElapsed: first + 120, period: 1 }), "FAILED_PRECONDITION", /fuera del tiempo/);
await denied("liveEvent", david, add("q-early2", "chance", { playerId: ids[1] }, { tappedElapsed: first + 10, period: 2 }), "FAILED_PRECONDITION", /2ª parte/);
// a player already off can't have a play after he left: the real conflict, in words
await denied("liveEvent", david, add("q-off", "foul", { playerId: ids[6] }, { tappedElapsed: heldElapsed + 5, period: 1 }), "FAILED_PRECONDITION", /campo/);

// ---- the 2nd half: a queued play inside its window
await ok("controlMatchClock", david, { matchId, action: "second", revision: m.clock.revision });
await ref.update({ "clock.secondStartedAt": Date.now() - 180_000 });
m = await snap();
await ok("liveEvent", pablo, add("q-second", "corner", { playerId: ids[1] }, { tappedElapsed: first + 90, period: 2 }));
{ const e = await byId("live-q-second"); assert.equal(e.period, 2); assert.equal(e.elapsedSeconds, first + 90); checks += 2; }

// ---- a duplicate still pending at the final whistle blocks the publication
await ok("liveEvent", david, add("og-a", "opponent_goal"));
assert.equal((await ok("liveEvent", pablo, add("og-b", "opponent_goal"))).dupOf, "live-og-a"); checks++;
await denied("publishLive", pablo, { matchId }, "FAILED_PRECONDITION", /final/);
m = await snap();
await ok("controlMatchClock", david, { matchId, action: "finish", revision: m.clock.revision });
// after the whistle, until publication, plays can still be fixed
await denied("publishLive", outsider, { matchId }, "PERMISSION_DENIED");
await denied("publishLive", pablo, { matchId }, "FAILED_PRECONDITION", /repetidas/);
await ok("liveEvent", pablo, { action: "delete", matchId, eventId: "live-og-b" });
await ok("publishLive", pablo, { matchId, assists: { "live-g-a": ids[1] } });
m = await snap();
assert.equal(m.status, "finished"); checks++;
assert.equal(m.goalsFor, 3); assert.equal(m.goalsAgainst, 1); checks += 2;
assert.equal(m.ledger[ids[5]].goals, 1); assert.equal(m.ledger[ids[1]].assists, 1); assert.equal(m.ledger[ids[6]].goals, 1); checks += 3;
assert.equal(m.ledger[ids[2]].fouls, 1); assert.equal(m.ledger[ids[3]].foulsReceived, 1); assert.equal(m.ledger[ids[0]].saves, 1); checks += 3;
assert.equal(m.ledger[ids[9]].notCalled, true); checks++;
assert.equal(m.events.find((e) => e.id === "live-q-goal").assistReviewed, true); checks++;
assert.equal(m.events.find((e) => e.id === "live-r1").editedByUid, pablo.uid); checks++;
assert.equal(m.rivalShort, "ATL"); checks++;
assert.equal(typeof m.voteClosesAt, "number"); checks++;
const totals = await db.collection("playerSeasonStats").where("seasonId", "==", seasonId).get();
assert.equal(totals.docs.find((d) => d.get("playerId") === ids[5]).get("totals").goals, 1); checks++;
// published: la mesa can't change it any more, nor publish it twice
await denied("publishLive", pablo, { matchId }, "FAILED_PRECONDITION", /publicada/);
await denied("liveEvent", pablo, { action: "delete", matchId, eventId: "live-r3" }, "FAILED_PRECONDITION", /publicada/);
console.log(`${checks} comprobaciones de la mesa: dos anotadores, duplicados, correcciones, cola sin red, pausa y añadido, y publicación desde la mesa.`);
await db.terminate();
