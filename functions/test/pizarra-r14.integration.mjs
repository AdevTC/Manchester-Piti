// r14 · La pizarra's server on the demo emulators (no production credentials, hosts or documents):
// onLineupR14 — the official seven's version (publish and a new player bump it and delete the old reactions; a
// place swap does not), the board's history (create, sistema, «entra», publish; a burst is one snapshot), the
// fan view (setBoardFanLink on / rotate / off, the snapshot following the board, nothing private in it,
// fail-closed against revoke/rotate/delete races), the cascade on delete; setMatchLineup carrying the «Si pasa…»
// and marking its copy «De la mesa». Its own `r14-…` documents only (cleaned up at the end).
import assert from "node:assert/strict";
process.env.FIRESTORE_EMULATOR_HOST = "127.0.0.1:8080";
process.env.FIREBASE_AUTH_EMULATOR_HOST = "127.0.0.1:9099";
const { initializeApp } = await import("firebase-admin/app");
const { getFirestore, Timestamp, FieldValue } = await import("firebase-admin/firestore");
initializeApp({ projectId: "demo-manchester-piti" });
const db = getFirestore(), suffix = `r14-${Date.now().toString(36)}`;
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
async function denied(name, who, data, status) { const r = await call(name, who, data); assert.equal(r.error?.status, status, `${name}: ${JSON.stringify(r)}`); checks++; }
/** Waits until `test(value)` holds (the triggers run asynchronously). */
async function until(read, test, what, ms = 20_000) {
  const end = Date.now() + ms;
  let v;
  while (Date.now() < end) {
    v = await read();
    if (test(v)) { checks++; return v; }
    await wait(250);
  }
  assert.fail(`${what}: ${JSON.stringify(v)}`);
}

const seasonId = `${suffix}-season`;
const ids = Array.from({ length: 10 }, (_, i) => `${suffix}-p${i}`);
const boards = [];
const matchA = `${suffix}-a`;
try {
  const admin = await person("r14-admin", "admin"), david = await person("r14-david"), plain = await person("r14-member");
  await db.doc(`seasons/${seasonId}`).set({ name: "r14 · pruebas" });
  await Promise.all(ids.map((id, i) => db.doc(`players/${id}`).set({ firstName: `Nombre${i}`, lastName: `Apellidosecreto${i}`, shirtName: `CAM${i}`, seasons: [seasonId], seasonDetails: { [seasonId]: { number: i + 1 } } })));
  const board = async (name, owner, seven, extra = {}) => {
    const id = `${suffix}-${name}`;
    boards.push(id);
    await db.doc(`lineups/${id}`).set({ name, ownerUid: owner.uid, ownerNickname: name, seasonId, formation: "2-3-1", freeMode: false, slots: seven.map((playerId) => ({ playerId })), playerPositions: {}, isOfficial: false, matchId: null, updatedAt: Timestamp.now(), ...extra });
    return id;
  };
  const get = async (path) => (await db.doc(path).get()).data();
  const history = async (id) => (await db.collection(`lineups/${id}/history`).orderBy("at", "desc").get()).docs.map((d) => d.data());
  const reactions = async (id) => (await db.collection(`lineups/${id}/reactions`).get()).docs.map((d) => ({ id: d.id, ...d.data() }));

  // ── PZ-D21T: a new board gets its first snapshot
  const b1 = await board("uno", admin, ids.slice(0, 7), { roles: { captainId: ids[4] }, rival: { formation: "2-3-1", players: [{ num: 9, note: "Nota privada del rival" }], visible: true }, plan: { claves: ["Presión alta"], notes: "Nota privada del plan" } });
  await until(() => history(b1), (h) => h.length === 1 && h[0].kind === "nuevo", "the first snapshot");

  // ── PZ-D01: publishing stamps the seven and its version; a reaction to it is kept
  await db.doc(`lineups/${b1}`).update({ isOfficial: true });
  const s1 = await until(() => get(`lineups/${b1}`), (d) => d?.sevenRev === 1 && typeof d.sevenKey === "string", "published → sevenRev 1");
  await until(() => history(b1), (h) => h[0]?.kind === "publica", "publish snapshot");
  await db.doc(`lineups/${b1}/reactions/u1`).set({ value: "ok", rev: 1, at: Timestamp.now() });
  await db.doc(`lineups/${b1}/reactions/u2`).set({ value: "dudas", at: Timestamp.now() });
  // a place swap is the same seven: nothing moves
  const swapped = [ids[1], ids[0], ...ids.slice(2, 7)];
  await db.doc(`lineups/${b1}`).update({ slots: swapped.map((playerId) => ({ playerId })) });
  await wait(2500);
  assert.equal((await get(`lineups/${b1}`)).sevenRev, 1);
  assert.equal(s1.sevenKey, (await get(`lineups/${b1}`)).sevenKey);
  checks++;
  // someone new comes in: version 2, the old reactions go, an «entra» snapshot
  await db.doc(`lineups/${b1}`).update({ slots: [...ids.slice(0, 6), ids[8]].map((playerId) => ({ playerId })) });
  await until(() => get(`lineups/${b1}`), (d) => d?.sevenRev === 2, "a new player → sevenRev 2");
  await until(() => reactions(b1), (r) => r.length === 0, "old reactions deleted");
  const h = await until(() => history(b1), (x) => x[0]?.kind === "entra", "«entra» snapshot");
  assert.deepEqual(h[0].entra, [ids[8]]);
  // a second «entra» within 10 min replaces it (one snapshot per burst)
  const before = (await history(b1)).length;
  await db.doc(`lineups/${b1}`).update({ slots: [...ids.slice(0, 6), ids[9]].map((playerId) => ({ playerId })) });
  await until(() => get(`lineups/${b1}`), (d) => d?.sevenRev === 3, "another player → sevenRev 3");
  await until(() => history(b1), (x) => x.length === before && x[0].entra?.[0] === ids[9], "the burst is one snapshot");
  // a sistema change
  await db.doc(`lineups/${b1}`).update({ formation: "3-2-1" });
  await until(() => history(b1), (x) => x[0]?.kind === "sistema", "«sistema» snapshot");

  // ── PZ-D21F: the fan link
  await denied("setBoardFanLink", plain, { boardId: b1, on: true }, "PERMISSION_DENIED");
  await denied("setBoardFanLink", admin, { boardId: `${suffix}-nada`, on: true }, "NOT_FOUND");
  const { token } = await ok("setBoardFanLink", admin, { boardId: b1, on: true });
  assert.match(token, /^[A-Za-z0-9_-]{24}$/);
  const fan = await until(() => get(`fanBoards/${token}`), (d) => !!d && d.boardId === b1, "the fan doc");
  const text = JSON.stringify(fan);
  for (const secret of ["Apellidosecreto", "Nota privada", "r14-admin", admin.uid]) assert.ok(!text.includes(secret), `the fan view leaks «${secret}»`);
  assert.deepEqual(fan.seven.map((p) => p.shirt).slice(0, 2), ["CAM0", "CAM1"]);
  assert.equal(fan.seven[0].num, 1);
  assert.equal(fan.seven.find((p) => p.captain)?.shirt, "CAM4");
  checks++;
  // the same token again; it follows the board
  assert.equal((await ok("setBoardFanLink", admin, { boardId: b1, on: true })).token, token);
  await db.doc(`lineups/${b1}`).update({ roles: { captainId: ids[0] } });
  await until(() => get(`fanBoards/${token}`), (d) => d?.seven?.find((p) => p.captain)?.shirt === "CAM0", "the fan view follows the board");
  // a client can't set or change the token (the rules); a stale write by a slow run can't bring a revoked link back:
  // rotate → the old doc goes at once, the new one appears
  const { token: token2 } = await ok("setBoardFanLink", admin, { boardId: b1, on: true, rotate: true });
  assert.notEqual(token2, token);
  await until(() => get(`fanBoards/${token}`), (d) => d === undefined, "the rotated token's doc is gone");
  await until(() => get(`fanBoards/${token2}`), (d) => d?.boardId === b1, "the new token's doc");
  // revoke during a pending update: a board edit (its trigger still running) right before the revoke never
  // resurrects the doc
  await db.doc(`lineups/${b1}`).update({ roles: { captainId: ids[1] } });
  await ok("setBoardFanLink", admin, { boardId: b1, on: false });
  await wait(4000);
  assert.equal(await get(`fanBoards/${token2}`), undefined, "a revoked link came back");
  assert.equal((await get(`lineups/${b1}`)).fanToken, undefined);
  checks++;
  // (a stale doc left at a revoked token is never served: the rules check the board still names it — rules tests)
  const { token: token3 } = await ok("setBoardFanLink", admin, { boardId: b1, on: true });
  await until(() => get(`fanBoards/${token3}`), (d) => d?.boardId === b1, "a new link after the revoke");

  // ── a reaction given in the same moment the seven is published (before the stamp, at version 0) is kept and moved
  // to the new version; history written by a run that lands after the board's delete is never left behind
  const b2 = await board("dos", admin, ids.slice(0, 7));
  await until(() => history(b2), (x) => x.length === 1, "b2 first snapshot");
  const batch = db.batch();
  batch.update(db.doc(`lineups/${b2}`), { isOfficial: true });
  batch.set(db.doc(`lineups/${b2}/reactions/u9`), { value: "ok", rev: 0, at: FieldValue.serverTimestamp() });
  await batch.commit();
  await until(() => get(`lineups/${b2}`), (d) => d?.sevenRev === 1, "b2 stamped");
  await until(() => get(`lineups/${b2}/reactions/u9`), (d) => d?.rev === 1, "the reaction of the publishing moment is kept at version 1");
  await db.doc(`lineups/${b2}`).update({ formation: "3-2-1" });
  await db.doc(`lineups/${b2}`).delete();
  await wait(5000);
  assert.equal((await db.collection(`lineups/${b2}/history`).get()).size, 0, "history left under a deleted board");
  assert.equal((await db.collection(`lineups/${b2}/reactions`).get()).size, 0);
  checks++;

  // ── delete: voz, reactions, history and the fan view go with the board
  await db.doc(`lineups/${b1}/voz/v0`).set({ step: "plan", mime: "audio/webm", ms: 1000, data: "AQID", by: admin.uid, at: Timestamp.now() });
  await db.doc(`lineups/${b1}/reactions/u3`).set({ value: "ok", rev: 3, at: Timestamp.now() });
  await db.doc(`lineups/${b1}`).delete();
  await until(async () => [(await db.collection(`lineups/${b1}/voz`).get()).size, (await db.collection(`lineups/${b1}/history`).get()).size, (await db.collection(`lineups/${b1}/reactions`).get()).size, await get(`fanBoards/${token3}`)], (v) => v[0] === 0 && v[1] === 0 && v[2] === 0 && v[3] === undefined, "the cascade on delete");

  // ── setMatchLineup: the «Si pasa…» travels to the official; the scorer's copy is «De la mesa» without server fields
  const sheet = { version: 2, revision: 0, seasonId, rival: "r14 Demo", competition: "Liga", date: Date.now() + 3 * 3600_000, duration: 50, venue: "Pruebas", home: true, status: "scheduled", starters: [], bench: [], notCalled: [], events: [], report: "" };
  await ok("saveMatchSheet", admin, { id: matchA, sheet });
  await ok("setMatchScorers", admin, { matchId: matchA, uids: [david.uid] });
  const rule = { id: "c1", when: "perdiendo", by: 1, from: 35, key: "mentality", value: "Ofensiva", ver: "planb" };
  const official = await board("oficial", admin, ids.slice(0, 7), { isOfficial: true, matchId: null });
  await until(() => get(`lineups/${official}`), (d) => d?.sevenRev === 1, "the season official stamped");
  // (his board carries server fields of its own: the copy must not inherit them)
  const mine = await board("mia", david, [...ids.slice(0, 6), ids[7]], { condPlan: [rule], matchId: matchA, fanToken: "y".repeat(24), sevenKey: "zz", sevenRev: 7 });
  const sent = await ok("setMatchLineup", david, { matchId: matchA, boardId: mine });
  const copy = await get(`lineups/${sent.officialId}`);
  assert.equal(copy.fromMesa, true);
  assert.equal(copy.isOfficial, true);
  assert.deepEqual(copy.condPlan, [rule]);
  checks++;
  // admin edits the official's «Si pasa…» through the sent board → it travels
  const mine2 = await board("mia2", admin, [...ids.slice(0, 6), ids[8]], { condPlan: [{ ...rule, from: 40 }] });
  await ok("setMatchLineup", admin, { matchId: matchA, boardId: mine2 });
  await until(() => get(`lineups/${sent.officialId}`), (d) => d?.condPlan?.[0]?.from === 40, "condPlan travels onto the official");
  boards.push(sent.officialId);
  await until(() => get(`lineups/${sent.officialId}`), (d) => d?.sevenRev === 1 && d.fanToken === undefined && d.sevenKey !== "zz", "the copy has its own version and no fan link");

  // ── PZ-D04: the first official seven of the match closes «Adivina el siete» for good (a flag, not the scope doc)
  await until(() => get(`matchPrivate/${matchA}`), (d) => d?.sieteOutAt != null, "matchPrivate.sieteOutAt set on publish");
  await db.doc(`lineupOfficials/${seasonId}__${matchA}`).delete();
  await wait(1500);
  assert.ok((await get(`matchPrivate/${matchA}`)).sieteOutAt, "unpublishing must not clear the flag");
  checks++;

  // ── PZ-D21F: the fan view's jornada skips unpublished and individually archived matches (as the web)
  await db.doc(`matches/${suffix}-draft`).set({ seasonId, status: "scheduled", published: false, date: Date.now() - 86_400_000, rival: "Borrador" });
  await db.doc(`matches/${suffix}-gone`).set({ seasonId, status: "finished", individuallyArchived: true, date: Date.now() - 2 * 86_400_000, rival: "Archivado" });
  const { token: tokA } = await ok("setBoardFanLink", admin, { boardId: sent.officialId, on: true });
  await until(() => get(`fanBoards/${tokA}`), (d) => d?.title === "J1 · r14 Demo", "fan title counts only visible matches");
  await db.doc(`fanBoards/${tokA}`).delete();

  // ── the match's quedada goes when the match is deleted
  await db.doc(`quedadas/${matchA}`).set({ at: Timestamp.now(), where: "Puerta", by: admin.uid, setAt: Timestamp.now() });
  await ok("deleteMatch", admin, { id: matchA });
  await until(() => get(`quedadas/${matchA}`), (d) => d === undefined, "quedada cleaned with its match");

  console.log(`pizarra-r14.integration: ${checks} checks OK`);
} finally {
  for (const id of boards) await db.recursiveDelete(db.doc(`lineups/${id}`)).catch(() => {});
  await db.recursiveDelete(db.doc(`matches/${matchA}`)).catch(() => {});
  for (const p of ["matchDrafts", "lineupOfficials", "matchPrivate"]) await db.recursiveDelete(db.doc(`${p}/${matchA}`)).catch(() => {});
  await db.doc(`lineupOfficials/${seasonId}__${matchA}`).delete().catch(() => {});
  await db.doc(`lineupOfficials/${seasonId}__temporada`).delete().catch(() => {});
  await db.doc(`fanBoards/${"y".repeat(24)}`).delete().catch(() => {});
  for (const extra of ["draft", "gone"]) await db.doc(`matches/${suffix}-${extra}`).delete().catch(() => {});
  await db.doc(`quedadas/${matchA}`).delete().catch(() => {});
  await db.doc(`matchTombstones/${matchA}`).delete().catch(() => {});
  await Promise.all(ids.map((id) => db.doc(`players/${id}`).delete()));
  await db.doc(`seasons/${seasonId}`).delete();
  for (const uid of people) await Promise.all([db.doc(`users/${uid}`).delete(), db.doc(`teamMembers/${uid}`).delete()]);
  void FieldValue;
}
