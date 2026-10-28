// La alineación del partido on the demo emulators (no production credentials, hosts or documents):
// setMatchLineup («Mandar a la mesa») and setMatchPresent («¿Quién ha venido?») — who may send which
// board, only before kick-off, the official board created or carrying the seven, the convocatoria it
// leaves (with and without roll call), a resend that writes nothing, setConvocatoria dropping a stale
// lineup, one notice per send, and the acta taking its system and positions from the lineup after a
// substitution. Its own `lt-…` documents only (cleaned up at the end); never the seeded ones.
import assert from "node:assert/strict";
process.env.FIRESTORE_EMULATOR_HOST = "127.0.0.1:8080";
process.env.FIREBASE_AUTH_EMULATOR_HOST = "127.0.0.1:9099";
const { initializeApp } = await import("firebase-admin/app");
const { getFirestore, Timestamp } = await import("firebase-admin/firestore");
initializeApp({ projectId: "demo-manchester-piti" });
const db = getFirestore(), suffix = `lt-${Date.now().toString(36)}`;
const wait = (ms) => new Promise((r) => setTimeout(r, ms));
let checks = 0;
const people = [];
async function person(label, role = "user") {
  const enc = (o) => Buffer.from(JSON.stringify(o)).toString("base64url");
  const jwt = enc({ alg: "none", typ: "JWT" }) + "." + enc({ sub: `${label}-${suffix}`, email: `${label}-${suffix}@example.test`, email_verified: true, name: label, aud: "demo", iss: "https://accounts.google.com" }) + ".";
  const r = await fetch("http://127.0.0.1:9099/identitytoolkit.googleapis.com/v1/accounts:signInWithIdp?key=demo", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ postBody: new URLSearchParams({ id_token: jwt, providerId: "google.com" }).toString(), requestUri: "http://localhost", returnSecureToken: true }) });
  const u = await r.json();
  assert.ok(u.idToken, JSON.stringify(u));
  await db.doc(`users/${u.localId}`).set({ role, nickname: label });
  await db.doc(`teamMembers/${u.localId}`).set({ expiresAt: Timestamp.fromMillis(Date.now() + 86_400_000) });
  people.push(u.localId);
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

const seasonId = `${suffix}-season`, otherSeason = `${suffix}-season2`;
const matchA = `${suffix}-a`, matchB = `${suffix}-b`, matchC = `${suffix}-c`;
const ids = Array.from({ length: 10 }, (_, i) => `${suffix}-p${i}`);
const boards = [];
try {
  const admin = await person("lt-admin", "admin"), david = await person("lt-david"), plain = await person("lt-member");
  await db.doc(`seasons/${seasonId}`).set({ name: "La alineación · pruebas" });
  await db.doc(`seasons/${otherSeason}`).set({ name: "Otra temporada · pruebas" });
  await Promise.all(ids.map((id) => db.doc(`players/${id}`).set({ firstName: id, seasons: [seasonId] })));
  const board = async (name, owner, formation, seven, extra = {}) => {
    const id = `${suffix}-${name}`;
    boards.push(id);
    await db.doc(`lineups/${id}`).set({ name, ownerUid: owner.uid, ownerNickname: name, seasonId, formation, freeMode: false, slots: seven.map((playerId) => ({ playerId })), playerPositions: {}, isOfficial: false, matchId: null, updatedAt: Timestamp.now(), ...extra });
    return id;
  };
  const sheet = (over) => ({ version: 2, revision: 0, seasonId, rival: "Alineación Demo", competition: "Liga", date: Date.now() + 3 * 3600_000, duration: 50, venue: "Pruebas", home: true, status: "scheduled", starters: [], bench: [], notCalled: [], events: [], report: "", ...over });
  const snap = async (id) => (await db.doc(`matches/${id}`).get()).data();
  const boardOf = async (id) => (await db.doc(`lineups/${id}`).get()).data();
  const lockOf = async (mid) => (await db.doc(`lineupOfficials/${seasonId}__${mid}`).get()).data();

  // ---- match A: no titulares yet, two on the bench; David scores it
  await ok("saveMatchSheet", admin, { id: matchA, sheet: sheet({ bench: [ids[6], ids[8]] }) });
  await ok("setMatchScorers", admin, { matchId: matchA, uids: [david.uid] });
  const sevenA = [...ids.slice(0, 6), ids[7]];
  const bDavid = await board("david", david, "3-2-1", sevenA);
  const bAdmin = await board("admin", admin, "2-3-1", ids.slice(0, 7), { bench: [ids[8]] });
  const bPlain = await board("plain", plain, "2-3-1", ids.slice(0, 7));
  const bSix = await board("six", david, "2-3-1", [...ids.slice(0, 6), null]);
  const bTwice = await board("twice", david, "2-3-1", [...ids.slice(0, 6), ids[0]]);
  const bOther = await board("other", david, "2-3-1", ids.slice(0, 7), { seasonId: otherSeason });
  const bOutsider = await board("outsider", admin, "2-3-1", [...ids.slice(0, 6), "guest:g1"]);

  // ---- permissions: a plain member never; a scorer only his own board or the official
  await denied("setMatchLineup", plain, { matchId: matchA, boardId: bPlain }, "PERMISSION_DENIED");
  await denied("setMatchLineup", david, { matchId: matchA, boardId: bPlain }, "PERMISSION_DENIED", /tuyo/);
  await denied("setMatchPresent", plain, { matchId: matchA, present: [ids[0]] }, "PERMISSION_DENIED");
  // ---- a board that doesn't put seven distinct players of this match on the pitch
  await denied("setMatchLineup", david, { matchId: matchA, boardId: bSix }, "INVALID_ARGUMENT", /siete/);
  await denied("setMatchLineup", david, { matchId: matchA, boardId: bTwice }, "INVALID_ARGUMENT", /siete/);
  await denied("setMatchLineup", david, { matchId: matchA, boardId: bOther }, "INVALID_ARGUMENT", /temporada/);
  await denied("setMatchLineup", admin, { matchId: matchA, boardId: bOutsider }, "INVALID_ARGUMENT", /invitado/);
  await denied("setMatchLineup", admin, { matchId: matchA, boardId: `${suffix}-nope` }, "NOT_FOUND");

  // ---- no official yet: a scorer's board never becomes it (PZ-B-PAR-02) — the match gets a copy as its official
  // and David keeps his own board to fix and send again; no roll call, so the old banquillo stays
  let r = await ok("setMatchLineup", david, { matchId: matchA, boardId: bDavid });
  assert.equal(r.changed, true); assert.notEqual(r.officialId, bDavid); checks += 2;
  const off = r.officialId;
  boards.push(off);
  assert.deepEqual(r.starters, sevenA); assert.deepEqual(r.bench, [ids[6], ids[8]]); checks += 2;
  let m = await snap(matchA);
  assert.equal(m.lineup.system, "3-2-1"); assert.equal(m.lineup.boardId, off); assert.equal(m.lineup.setBy, david.uid); checks += 3;
  assert.deepEqual(m.lineup.slots.map((s) => s.playerId), sevenA); checks++;
  assert.deepEqual(m.lineup.slots.map((s) => s.code), ["POR", "LI", "DFC", "LD", "MC", "MC", "DC"]); checks++;
  assert.deepEqual(m.starters, sevenA); assert.deepEqual(m.bench, [ids[6], ids[8]]); assert.deepEqual(m.notCalled, [ids[9]]); checks += 3;
  assert.equal(typeof m.convocatoriaAt, "number"); checks++;
  { const b = await boardOf(bDavid); assert.equal(b.isOfficial, false); assert.equal(b.matchId, null); checks += 2; }
  { const b = await boardOf(off); assert.deepEqual([b.isOfficial, b.matchId, b.formation], [true, matchA, "3-2-1"]); checks++; }
  assert.equal((await lockOf(matchA)).lineupId, off); checks++;

  // ---- the same again: nothing written
  const revision = m.revision;
  r = await ok("setMatchLineup", david, { matchId: matchA, boardId: bDavid });
  assert.equal(r.changed, false); checks++;
  assert.equal((await snap(matchA)).revision, revision); checks++;

  // ---- one notice per send: «Ya está el siete» from the official, never a convocatoria notice as well
  await wait(3000);
  assert.equal((await db.doc(`pushLog/lineup-${off}-${matchA}`).get()).exists, true); checks++;
  assert.equal((await db.doc(`pushLog/conv-${matchA}`).get()).exists, false); checks++;

  // ---- the admin sends another board: copied onto the official, with its plan (PZ-B-PAR-01)
  await db.doc(`lineups/${bAdmin}`).update({ subs: [{ minute: 25, outId: ids[0], inId: ids[8] }], roles: { captain: ids[1] }, takers: { penalties: [ids[2]] }, variants: [{ id: "v2", name: "2ª parte", slots: ids.slice(0, 7).map((playerId) => ({ playerId })) }] });
  r = await ok("setMatchLineup", admin, { matchId: matchA, boardId: bAdmin });
  assert.equal(r.changed, true); assert.equal(r.officialId, off); checks += 2;
  {
    const b = await boardOf(off);
    assert.equal(b.formation, "2-3-1"); assert.deepEqual(b.slots.map((s) => s.playerId), ids.slice(0, 7)); assert.deepEqual(b.bench, [ids[8]]); assert.equal(b.isOfficial, true); checks += 4;
    assert.deepEqual(b.subs, [{ minute: 25, outId: ids[0], inId: ids[8] }]); assert.deepEqual(b.roles, { captain: ids[1] }); assert.deepEqual(b.takers, { penalties: [ids[2]] }); assert.equal(b.variants.length, 1); checks += 4;
    assert.equal((await boardOf(bAdmin)).isOfficial, false); checks++;
  }
  m = await snap(matchA);
  assert.equal(m.lineup.system, "2-3-1"); assert.equal(m.lineup.boardId, off); assert.equal(m.lineup.setBy, admin.uid); checks += 3;
  assert.deepEqual(m.bench, [ids[8], ids[7]]); assert.deepEqual(m.notCalled, [ids[9]]); checks += 2;
  // the official sent again: the same seven, nothing to write
  assert.equal((await ok("setMatchLineup", david, { matchId: matchA, boardId: off })).changed, false); checks++;
  // the same seven with another plan is news: only the plan changes on the official
  await db.doc(`lineups/${bAdmin}`).update({ subs: [] });
  assert.equal((await ok("setMatchLineup", admin, { matchId: matchA, boardId: bAdmin })).changed, true); checks++;
  assert.deepEqual((await boardOf(off)).subs, []); checks++;

  // ---- «¿Quién ha venido?»
  await denied("setMatchPresent", david, { matchId: matchA, present: [ids[0], `${suffix}-ghost`] }, "INVALID_ARGUMENT", /temporada/);
  await denied("setMatchPresent", david, { matchId: matchA, present: [ids[0], "guest:g1"] }, "INVALID_ARGUMENT", /invitado/);
  await denied("setMatchPresent", david, { matchId: matchA, present: Array.from({ length: 41 }, (_, i) => `x${i}`) }, "INVALID_ARGUMENT");
  await denied("setMatchPresent", david, { matchId: matchA, present: ["bad/id"] }, "INVALID_ARGUMENT");
  await ok("setMatchPresent", david, { matchId: matchA, present: [...ids.slice(0, 8), ids[0]] });
  assert.deepEqual((await snap(matchA)).present, ids.slice(0, 8)); checks++;
  // with a roll call: the banquillo is who came, the rest «no convocado»
  const bDavid2 = await board("david2", david, "3-2-1", sevenA);
  r = await ok("setMatchLineup", david, { matchId: matchA, boardId: bDavid2 });
  assert.equal(r.changed, true); assert.equal(r.officialId, off); checks += 2;
  m = await snap(matchA);
  assert.deepEqual(m.starters, sevenA); assert.deepEqual(m.bench, [ids[6]]); assert.deepEqual(m.notCalled, [ids[8], ids[9]]); checks += 3;
  assert.equal((await boardOf(off)).formation, "3-2-1"); checks++;
  // (a board without a plan clears the official's: what la mesa reads is the plan of the seven sent)
  assert.equal((await boardOf(off)).subs, undefined); checks++;
  assert.equal((await boardOf(bDavid2)).isOfficial, false); checks++;

  // ---- setConvocatoria: the same seven (any order) keeps the lineup; another seven drops it
  await ok("setConvocatoria", admin, { matchId: matchA, starters: [...sevenA].reverse(), bench: [ids[6]] });
  assert.equal((await snap(matchA)).lineup?.system, "3-2-1"); checks++;
  await ok("setConvocatoria", admin, { matchId: matchA, starters: ids.slice(0, 7), bench: [ids[7]] });
  assert.equal((await snap(matchA)).lineup, undefined); checks++;

  // ---- match B: only before kick-off; the acta takes the lineup's system and positions
  await ok("saveMatchSheet", admin, { id: matchB, sheet: sheet({ starters: ids.slice(0, 7), bench: [ids[7]], notCalled: [ids[8], ids[9]] }) });
  await ok("setMatchScorers", admin, { matchId: matchB, uids: [david.uid] });
  const bActa = await board("acta", admin, "3-1-2", ids.slice(0, 7));
  r = await ok("setMatchLineup", admin, { matchId: matchB, boardId: bActa });
  assert.equal(r.officialId, bActa); checks++;
  // the official, not his own, sent by the scorer: allowed (nothing new)
  assert.equal((await ok("setMatchLineup", david, { matchId: matchB, boardId: bActa })).changed, false); checks++;
  m = await snap(matchB);
  await ok("controlMatchClock", david, { matchId: matchB, action: "start", revision: m.clock?.revision ?? 0 });
  await denied("setMatchLineup", admin, { matchId: matchB, boardId: bActa }, "FAILED_PRECONDITION", /empezado/);
  await denied("setMatchPresent", david, { matchId: matchB, present: [ids[0]] }, "FAILED_PRECONDITION", /empezado/);
  await db.doc(`matches/${matchB}`).update({ "clock.firstStartedAt": Date.now() - 20 * 60_000 });
  m = await snap(matchB);
  // minute 10: the striker on the right (slot 6, DC) goes off, the sub comes on in his slot
  await ok("liveEvent", david, { action: "add", matchId: matchB, clockRevision: m.clock.revision, requestId: `${suffix}-sub`, manualTime: true, event: { type: "substitution", minute: 10, playerId: ids[6], inPlayerId: ids[7] } });
  m = await snap(matchB);
  await ok("controlMatchClock", david, { matchId: matchB, action: "finish", revision: m.clock.revision });
  await ok("publishLive", david, { matchId: matchB });
  m = await snap(matchB);
  assert.equal(m.status, "finished"); assert.equal(m.system, "3-1-2"); checks += 2;
  assert.deepEqual(Object.keys(m.ledger[ids[0]].positionsPlayed), ["POR"]); checks++;
  assert.deepEqual(Object.keys(m.ledger[ids[4]].positionsPlayed), ["MCD"]); checks++;
  assert.deepEqual(Object.keys(m.ledger[ids[6]].positionsPlayed), ["DC"]); checks++;
  assert.deepEqual(Object.keys(m.ledger[ids[7]].positionsPlayed), ["DC"]); checks++;
  assert.equal(m.ledger[ids[7]].positionsEstimated, undefined); checks++;
  assert.ok(m.ledger[ids[7]].positionsPlayed.DC > 0); checks++;
  assert.equal(m.lineup?.system, "3-1-2"); checks++;

  // ---- match C: no official of its own; sending the season's plan leaves the plan where it is and gives
  // the match its own copy
  await ok("saveMatchSheet", admin, { id: matchC, sheet: sheet({ bench: ids.slice(0, 9) }) });
  const bPlan = await board("plan", admin, "2-2-2", ids.slice(0, 7), { isOfficial: true, matchId: null });
  await db.doc(`lineupOfficials/${seasonId}__temporada`).set({ lineupId: bPlan, seasonId, matchId: null });
  const rc = await ok("setMatchLineup", admin, { matchId: matchC, boardId: bPlan });
  assert.notEqual(rc.officialId, bPlan); checks++;
  boards.push(rc.officialId);
  assert.deepEqual([(await boardOf(bPlan)).isOfficial, (await boardOf(bPlan)).matchId], [true, null]); checks++;
  assert.equal((await db.doc(`lineupOfficials/${seasonId}__temporada`).get()).get("lineupId"), bPlan); checks++;
  const copy = await boardOf(rc.officialId);
  assert.deepEqual([copy.isOfficial, copy.matchId, copy.formation, copy.ownerUid], [true, matchC, "2-2-2", admin.uid]); checks++;
  assert.equal((await lockOf(matchC)).lineupId, rc.officialId); checks++;
  assert.equal((await snap(matchC)).lineup.boardId, rc.officialId); checks++;
  console.log(`${checks} comprobaciones de la alineación: permisos, solo antes del pitido, tablero incompleto, oficial creada o copiada, convocatoria con y sin «¿Quién ha venido?», reenvío sin cambios, setConvocatoria, un aviso por envío y el acta desde la alineación.`);
} finally {
  // (the triggers of the last writes settle before the cleanup)
  await wait(2500);
  const del = (refs) => Promise.all(refs.map((ref) => ref.delete()));
  for (const mid of [matchA, matchB, matchC]) {
    await del((await db.collection("matchAudit").where("matchId", "==", mid).get()).docs.map((d) => d.ref));
    await del((await db.collection("pushLog").where("matchId", "==", mid).get()).docs.map((d) => d.ref));
    await del((await db.doc(`matches/${mid}`).collection("votes").get()).docs.map((d) => d.ref));
    await del([`matches/${mid}`, `matchDrafts/${mid}`, `matchPrivate/${mid}`, `mvpResults/${mid}`, `lineupOfficials/${seasonId}__${mid}`, `rotaTurns/${mid}`].map((p) => db.doc(p)));
  }
  await del(boards.flatMap((id) => [db.doc(`lineups/${id}`), db.doc(`pushLog/seven-${id}`)]));
  await del((await db.collection("playerSeasonStats").where("seasonId", "==", seasonId).get()).docs.map((d) => d.ref));
  await del(ids.map((id) => db.doc(`players/${id}`)));
  await db.doc(`lineupOfficials/${seasonId}__temporada`).delete();
  await del([db.doc(`seasons/${seasonId}`), db.doc(`seasons/${otherSeason}`)]);
  await del(people.flatMap((uid) => [db.doc(`users/${uid}`), db.doc(`teamMembers/${uid}`)]));
  await db.terminate();
}
