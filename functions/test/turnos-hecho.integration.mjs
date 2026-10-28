// Run only with the demo emulators. No production credentials or endpoints.
// Turnos «Hecho» (markTurnDone) through the functions emulator: a member marks his own turn (as today: done.{uid}
// and the captains are told); a member cannot mark another's; a captain marks another player's turn from the Sala's
// «Después» (r12) — under that player's member uid, or `p:<playerId>` when he has no account — without telling
// anyone, and takes it back with done:false; a player without that turn is refused. Its own `th-…` documents only.
import assert from "node:assert/strict";
process.env.FIRESTORE_EMULATOR_HOST = "127.0.0.1:8080";
process.env.FIREBASE_AUTH_EMULATOR_HOST = "127.0.0.1:9099";
const { initializeApp } = await import("firebase-admin/app");
const { getFirestore, Timestamp } = await import("firebase-admin/firestore");
initializeApp({ projectId: "demo-manchester-piti" });
const db = getFirestore();
const suffix = `th-${Date.now().toString(36)}`;
const HOUR = 3_600_000;
let checked = 0;
async function google(label) {
  const encode = (value) => Buffer.from(JSON.stringify(value)).toString("base64url");
  const token = `${encode({ alg: "none", typ: "JWT" })}.${encode({ sub: `${suffix}-${label}`, email: `${suffix}-${label}@example.test`, email_verified: true, name: label, aud: "demo", iss: "https://accounts.google.com" })}.`;
  const response = await fetch("http://127.0.0.1:9099/identitytoolkit.googleapis.com/v1/accounts:signInWithIdp?key=demo", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ postBody: new URLSearchParams({ id_token: token, providerId: "google.com" }).toString(), requestUri: "http://localhost", returnSecureToken: true }),
  });
  const value = await response.json();
  assert.ok(value.idToken, JSON.stringify(value));
  return { uid: value.localId, token: value.idToken };
}
async function call(name, who, data) {
  const response = await fetch(`http://127.0.0.1:5001/demo-manchester-piti/europe-southwest1/${name}`, {
    method: "POST",
    headers: { "content-type": "application/json", authorization: `Bearer ${who.token}` },
    body: JSON.stringify({ data }),
  });
  return response.json();
}
async function ok(who, data) {
  const value = await call("markTurnDone", who, data);
  assert.ok(!value.error, `markTurnDone: ${JSON.stringify(value)}`);
  checked++;
  return value.result;
}
async function denied(who, data, status, message) {
  const value = await call("markTurnDone", who, data);
  assert.equal(value.error?.status, status, `markTurnDone: ${JSON.stringify(value)}`);
  if (message) assert.match(value.error.message, message);
  checked++;
}
const doneOf = async (id) => (await db.doc(`rotaTurns/${id}`).get()).data()?.done ?? {};

const seasonId = `${suffix}-t1`;
const p = (k) => `${suffix}-${k}`;
const matchId = p("m1");
const people = [];
try {
  const captain = await google("capi"), hugo = await google("hugo"), dani = await google("dani");
  for (const [who, role, playerId] of [[captain, "admin", null], [hugo, "user", p("hugo")], [dani, "user", p("dani")]]) {
    people.push(who.uid);
    await db.doc(`users/${who.uid}`).set({ role, nickname: `${who.uid}`.slice(0, 20), email: `${who.uid}@example.test`, ...(playerId ? { playerId } : {}) });
    await db.doc(`teamMembers/${who.uid}`).set({ expiresAt: Timestamp.fromMillis(Date.now() + 24 * HOUR) });
  }
  await db.doc(`seasons/${seasonId}`).set({ name: "Turnos «Hecho» · pruebas" });
  // (leo has no account: his ficha is nobody's)
  for (const k of ["hugo", "dani", "leo", "pepe"]) await db.doc(`players/${p(k)}`).set({ firstName: k, seasons: [seasonId] });
  await db.doc(`playerLinks/${p("hugo")}`).set({ uid: hugo.uid });
  await db.doc(`playerLinks/${p("dani")}`).set({ uid: dani.uid });
  await db.doc(`rotas/${seasonId}`).set({
    jobs: [
      { id: "lavar", name: "Lavar la equipación", icon: "shirt", awayOnly: false, order: [p("hugo"), p("pepe")] },
      { id: "agua", name: "El agua", icon: "bottle", awayOnly: false, order: [p("dani"), p("pepe")] },
      { id: "balones", name: "Los balones", icon: "ball", awayOnly: false, order: [p("leo"), p("pepe")] },
    ],
    updatedAt: Timestamp.now(),
    updatedBy: "captain",
  });
  await db.doc(`matches/${matchId}`).set({ version: 2, seasonId, rival: "Rayo", status: "finished", home: true, date: Timestamp.fromMillis(Date.now() - 24 * HOUR), events: [] });

  // Today's: Hugo marks his own; the captains are told (once per match and member).
  await ok(hugo, { turnId: matchId });
  let done = await doneOf(matchId);
  assert.equal(typeof done[hugo.uid], "number"); checked++;
  const told = (await db.collection("pushLog").where("matchId", "==", matchId).get()).size;
  assert.ok(told >= 1, "the captains are told"); checked++;
  // A member cannot mark another's.
  await denied(dani, { turnId: matchId, playerId: p("hugo") }, "PERMISSION_DENIED", /capitán/);
  // (his own player id is his own: still today's path)
  await ok(dani, { turnId: matchId, playerId: p("dani") });
  done = await doneOf(matchId);
  assert.equal(typeof done[dani.uid], "number"); checked++;
  await ok(dani, { turnId: matchId, done: false });
  assert.equal((await doneOf(matchId))[dani.uid], undefined); checked++;

  // r12: a captain marks Dani's (an account: his uid) and Leo's (no account: p:<id>); nobody is told.
  const toldBefore = (await db.collection("pushLog").where("matchId", "==", matchId).get()).size;
  await ok(captain, { turnId: matchId, playerId: p("dani") });
  await ok(captain, { turnId: matchId, playerId: p("leo") });
  done = await doneOf(matchId);
  assert.equal(typeof done[dani.uid], "number"); checked++;
  assert.equal(typeof done[`p:${p("leo")}`], "number"); checked++;
  assert.equal(done[captain.uid], undefined); checked++;
  assert.equal((await db.collection("pushLog").where("matchId", "==", matchId).get()).size, toldBefore, "a captain's mark tells nobody"); checked++;
  // «Deshacer»
  await ok(captain, { turnId: matchId, playerId: p("leo"), done: false });
  assert.equal((await doneOf(matchId))[`p:${p("leo")}`], undefined); checked++;
  // Pepe has no turn in this match.
  await denied(captain, { turnId: matchId, playerId: p("pepe") }, "FAILED_PRECONDITION", /no es suyo/);
  // A removed member's account does not take the mark: his ficha counts as without an account.
  await db.doc(`users/${dani.uid}`).update({ removedAt: Timestamp.now() });
  await ok(captain, { turnId: matchId, playerId: p("dani") });
  assert.equal(typeof (await doneOf(matchId))[`p:${p("dani")}`], "number"); checked++;

  console.log(`turnos-hecho.integration: ${checked} comprobaciones`);
} finally {
  const del = (refs) => Promise.all(refs.map((ref) => ref.delete()));
  await del((await db.collection("pushLog").where("matchId", "==", matchId).get()).docs.map((d) => d.ref));
  await del((await db.collection("notices").where("matchId", "==", matchId).get()).docs.map((d) => d.ref));
  await del([`matches/${matchId}`, `rotaTurns/${matchId}`, `rotas/${seasonId}`, `seasons/${seasonId}`].map((x) => db.doc(x)));
  await del(["hugo", "dani", "leo", "pepe"].flatMap((k) => [db.doc(`players/${p(k)}`), db.doc(`playerLinks/${p(k)}`)]));
  await del(people.flatMap((uid) => [db.doc(`users/${uid}`), db.doc(`teamMembers/${uid}`)]));
  await db.terminate();
}
