// Dedicated demo-emulator checks: no production credentials, hosts or documents.
import assert from "node:assert/strict";
import { createHash } from "node:crypto";
process.env.FIRESTORE_EMULATOR_HOST = "127.0.0.1:8080";
process.env.FIREBASE_AUTH_EMULATOR_HOST = "127.0.0.1:9099";
const { initializeApp } = await import("firebase-admin/app");
const { getFirestore, Timestamp } = await import("firebase-admin/firestore");
initializeApp({ projectId: "demo-manchester-piti" });
const db = getFirestore();
const suffix = `lifecycle-${Date.now().toString(36)}`;
const seasonId = `${suffix}-season`, matchId = `${suffix}-match`, otherId = `${suffix}-other`;
const playerIds = Array.from({ length: 8 }, (_, i) => `${suffix}-p${i}`);
let checked = 0;
async function google(label) {
  const encode = value => Buffer.from(JSON.stringify(value)).toString("base64url");
  const token = `${encode({ alg: "none", typ: "JWT" })}.${encode({ sub: `${suffix}-${label}`, email: `${suffix}-${label}@example.test`, email_verified: true, name: label, aud: "demo", iss: "https://accounts.google.com" })}.`;
  const response = await fetch("http://127.0.0.1:9099/identitytoolkit.googleapis.com/v1/accounts:signInWithIdp?key=demo", {
    method: "POST", headers: { "content-type": "application/json" },
    body: JSON.stringify({ postBody: new URLSearchParams({ id_token: token, providerId: "google.com" }).toString(), requestUri: "http://localhost", returnSecureToken: true }),
  });
  const value = await response.json();
  assert.ok(value.idToken, JSON.stringify(value));
  return { uid: value.localId, token: value.idToken };
}
async function call(name, who, data) {
  const response = await fetch(`http://127.0.0.1:5001/demo-manchester-piti/europe-southwest1/${name}`, {
    method: "POST", headers: { "content-type": "application/json", ...(who ? { authorization: `Bearer ${who.token}` } : {}) }, body: JSON.stringify({ data }),
  });
  return response.json();
}
async function ok(name, who, data) {
  const value = await call(name, who, data);
  assert.ok(!value.error, `${name}: ${JSON.stringify(value)}`); checked++;
  return value.result;
}
async function denied(name, who, data, status = "FAILED_PRECONDITION") {
  const value = await call(name, who, data);
  assert.equal(value.error?.status, status, `${name}: ${JSON.stringify(value)}`); checked++;
}
async function eventually(check) {
  let last;
  for (let i = 0; i < 180; i++) { try { await check(); return; } catch (error) { last = error; await new Promise(resolve => setTimeout(resolve, 250)); } }
  throw last;
}
const admin = await google("admin"), member = await google("scorer");
for (const [who, role] of [[admin, "admin"], [member, "user"]]) {
  await db.doc(`users/${who.uid}`).set({ role, nickname: role });
  await db.doc(`teamMembers/${who.uid}`).set({ expiresAt: Timestamp.fromMillis(Date.now() + 3600000) });
}
await db.doc(`seasons/${seasonId}`).set({ name: "Ciclo de partidos · pruebas" });
for (const [i, id] of playerIds.entries()) await db.doc(`players/${id}`).set({ firstName: `Jugador ${i}`, number: i + 1, seasons: [seasonId], active: true });
const sheet = (goals = 1) => ({
  version: 2, revision: 0, seasonId, rival: "Archivo demo", rivalLogoUrl: "", competition: "Liga", date: Date.now() - 86400000,
  duration: 50, durationSeconds: 3000, venue: "Campo", home: true, status: "finished", starters: playerIds.slice(0, 7), bench: playerIds.slice(7), notCalled: [],
  goalsFor: goals, goalsAgainst: 0, report: "Crónica conservada al archivar.",
  events: Array.from({ length: goals }, (_, i) => ({ id: `goal${i}`, type: "goal", playerId: playerIds[0], assistPlayerId: playerIds[1], assistReviewed: true, minute: i + 3 })),
});
await ok("saveMatchSheet", admin, { id: matchId, sheet: sheet(1) });
await ok("saveMatchSheet", admin, { id: otherId, sheet: sheet(2) });
for (const [id, goals] of [[matchId, 1], [otherId, 2]]) await db.doc(`matchPrivate/${id}/predictions/${member.uid}`).set({ goalsFor: goals, goalsAgainst: 0, name: "scorer", playerId: playerIds[1] });
await ok("saveMatchSheet", admin, { id: otherId, sheet: { ...sheet(2), revision: 1 } });
await db.doc(`matchPrivate/${matchId}`).set({ scorerUids: [member.uid], meetingNote: "Quedada" }, { merge: true });
await db.doc(`matches/${matchId}/votes/${member.uid}`).set({ playerId: playerIds[0], voterName: "scorer", at: Timestamp.now() });
await eventually(async () => assert.equal((await db.doc(`mvpResults/${matchId}`).get()).get("total"), 1));
const key = createHash("sha256").update(`${seasonId}/${playerIds[0]}`).digest("hex");
const totals = async () => (await db.doc(`playerSeasonStats/${key}`).get()).get("totals") ?? {};
const porra = async () => (await db.doc(`porraStandings/${seasonId}`).get()).data();
assert.equal((await totals()).goals, 3);
assert.equal((await porra()).matches, 2);
assert.equal((await porra()).rows[0].points, 6);
const original = (await db.doc(`matches/${matchId}`).get()).data();

// Designated scorers cannot change a match's lifecycle; neither can a signed-out visitor.
for (const name of ["setMatchArchived", "deleteMatch"]) {
  await denied(name, null, { id: matchId, archived: true }, "UNAUTHENTICATED");
  await denied(name, member, { id: matchId, archived: true }, "PERMISSION_DENIED");
}
await Promise.all([ok("setMatchArchived", admin, { id: matchId, archived: true }), ok("setMatchArchived", admin, { id: matchId, archived: true })]);
const archived = (await db.doc(`matches/${matchId}`).get()).data();
assert.equal(archived.archived, true); assert.equal(archived.individuallyArchived, true);
assert.deepEqual(archived.events, original.events); assert.deepEqual(archived.ledger, original.ledger); assert.equal(archived.report, original.report);
assert.equal((await totals()).goals, 2); assert.equal((await totals()).played, 1);
assert.equal((await porra()).matches, 1); assert.equal((await porra()).rows[0].points, 3);
assert.ok((await db.doc(`matches/${matchId}/votes/${member.uid}`).get()).exists);
assert.ok((await db.doc(`matchPrivate/${matchId}/predictions/${member.uid}`).get()).exists);
// Simulate a vote accepted just before archive whose aggregate trigger had not finished.
await db.doc(`mvpResults/${matchId}`).set({ matchId, seasonId, total: 0, counts: {} });
await denied("saveMatchSheet", admin, { id: matchId, sheet: { ...sheet(), revision: archived.revision } });
await denied("saveMatchSheet", admin, { id: matchId, draft: true, sheet: { ...sheet(), revision: archived.revision } });
await denied("setMatchScorers", admin, { matchId, uids: [] });

// A season round-trip never wakes individually archived matches.
await ok("setSeasonArchived", admin, { seasonId, archived: true });
assert.equal((await totals()).goals ?? 0, 0); assert.equal((await porra()).matches, 0);
await denied("setMatchArchived", admin, { id: matchId, archived: false });
await ok("setSeasonArchived", admin, { seasonId, archived: false });
assert.equal((await db.doc(`matches/${matchId}`).get()).get("archived"), true);
assert.equal((await totals()).goals, 2); assert.equal((await porra()).matches, 1);
await Promise.all([ok("setMatchArchived", admin, { id: matchId, archived: false }), ok("setMatchArchived", admin, { id: matchId, archived: false })]);
assert.equal((await totals()).goals, 3); assert.equal((await totals()).played, 2);
assert.equal((await porra()).matches, 2); assert.equal((await porra()).rows[0].points, 6);
await eventually(async () => assert.equal((await db.doc(`mvpResults/${matchId}`).get()).get("total"), 1));

// Associated data and nested collections disappear with a finished match, beyond one write batch.
await db.doc(`players/${playerIds[7]}`).update({ sanction: { games: 2, from: Date.now() - 86400000, untilMatchId: matchId, reason: "Sanción manual" } });
const boardId = `${suffix}-board`;
await db.doc(`lineups/${boardId}`).set({ matchId, seasonId, ownerUid: admin.uid, name: "Siete guardado", isOfficial: true });
await db.doc(`lineups/${boardId}/voz/v0`).set({ data: "audio" });
await db.doc(`lineups/${boardId}/reactions/${member.uid}`).set({ value: "ok" });
await db.doc(`lineupOfficials/${seasonId}__${matchId}`).set({ matchId, seasonId, lineupId: boardId });
await db.doc(`convocatoriaReminders/${matchId}`).set({ auto: false });
await db.doc(`matchPrivate/${matchId}/availability/${member.uid}`).set({ response: "yes" });
await db.doc(`matchPrivate/${matchId}/nested/chunk/more/item`).set({ detail: "nested" });
await db.doc(`matchDrafts/${matchId}`).set({ ...sheet(), revision: (await db.doc(`matches/${matchId}`).get()).get("revision") });
for (const log of [`siete-${matchId}`, `seven-${boardId}`, `final-${matchId}`, `goal-${matchId}-goal0`]) await db.doc(`pushLog/${log}`).set({ at: 1 });
for (let i = 0; i < 450; i += 300) {
  const batch = db.batch();
  for (let j = i; j < Math.min(i + 300, 450); j++) batch.set(db.doc(`matchAudit/${suffix}-${j}`), { matchId, revision: j });
  await batch.commit();
}
await ok("deleteMatch", admin, { id: matchId });
await eventually(async () => {
  for (const path of [`matches/${matchId}`, `matches/${matchId}/votes/${member.uid}`, `matchPrivate/${matchId}`, `matchPrivate/${matchId}/predictions/${member.uid}`, `matchPrivate/${matchId}/nested/chunk/more/item`, `matchDrafts/${matchId}`, `mvpResults/${matchId}`, `lineups/${boardId}`, `lineups/${boardId}/voz/v0`, `lineups/${boardId}/reactions/${member.uid}`, `lineupOfficials/${seasonId}__${matchId}`, `convocatoriaReminders/${matchId}`, `pushLog/siete-${matchId}`, `pushLog/seven-${boardId}`, `pushLog/final-${matchId}`, `pushLog/goal-${matchId}-goal0`]) assert.equal((await db.doc(path).get()).exists, false, path);
  assert.equal((await db.collection("matchAudit").where("matchId", "==", matchId).get()).size, 0);
});
assert.equal((await totals()).goals, 2); assert.equal((await porra()).matches, 1); assert.equal((await porra()).rows[0].points, 3);
const sanction = (await db.doc(`players/${playerIds[7]}`).get()).get("sanction");
assert.equal(sanction.untilMatchId, undefined); assert.equal(sanction.games, 2);
const tombstone = (await db.doc(`matchTombstones/${matchId}`).get()).data();
assert.deepEqual(Object.keys(tombstone), ["deletedAt"]);
await denied("saveMatchSheet", admin, { id: matchId, sheet: sheet() });
await denied("saveMatchSheet", admin, { id: matchId, draft: true, sheet: sheet() });
// A retry finishes orphaned work without restoring or subtracting the match a second time.
await db.doc(`matchPrivate/${matchId}/nested/retry`).set({ detail: "retry cleanup" });
await ok("deleteMatch", admin, { id: matchId });
assert.equal((await db.doc(`matchPrivate/${matchId}/nested/retry`).get()).exists, false);
assert.equal((await totals()).goals, 2);

// Draft-only archive/restore/delete and a live match's clock must remain well defined.
const draftId = `${suffix}-draft`, liveId = `${suffix}-live`;
await ok("saveMatchSheet", admin, { id: draftId, draft: true, sheet: { ...sheet(0), status: "scheduled", date: Date.now() + 86400000 } });
await ok("setMatchArchived", admin, { id: draftId, archived: true });
assert.equal((await db.doc(`matchDrafts/${draftId}`).get()).get("archived"), true);
await ok("setMatchArchived", admin, { id: draftId, archived: false });
await ok("deleteMatch", admin, { id: draftId });
await ok("saveMatchSheet", admin, { id: liveId, sheet: { ...sheet(0), status: "scheduled", date: Date.now() } });
await ok("controlMatchClock", admin, { matchId: liveId, action: "start", revision: 0 });
await denied("setMatchArchived", admin, { id: liveId, archived: true });
await ok("deleteMatch", admin, { id: liveId });
await ok("setMatchArchived", admin, { id: otherId, archived: true });
await ok("deleteMatch", admin, { id: otherId });
assert.equal((await totals()).goals ?? 0, 0); assert.equal((await porra()).matches, 0);
// Historical MVP aggregates without a complete ledger also survive an archive round-trip.
const legacyId = `${suffix}-legacy`;
await db.doc(`matches/${legacyId}`).set({ seasonId, rival: "Histórico sin acta completa", status: "finished", date: Timestamp.fromMillis(Date.now() - 86400000), goalsFor: 1, goalsAgainst: 0 });
const legacyMvp = { counts: { [playerIds[0]]: 3 }, total: 3 };
await db.doc(`mvpResults/${legacyId}`).set(legacyMvp);
await ok("setMatchArchived", admin, { id: legacyId, archived: true });
await ok("setMatchArchived", admin, { id: legacyId, archived: false });
assert.deepEqual((await db.doc(`mvpResults/${legacyId}`).get()).data(), legacyMvp);
await ok("deleteMatch", admin, { id: legacyId });
// Different matches in one season can be managed at once without deadlock or lost totals.
const raceA = `${suffix}-race-a`, raceB = `${suffix}-race-b`;
await ok("saveMatchSheet", admin, { id: raceA, sheet: sheet(1) });
await ok("saveMatchSheet", admin, { id: raceB, sheet: sheet(2) });
await Promise.all([ok("setMatchArchived", admin, { id: raceA, archived: true }), ok("deleteMatch", admin, { id: raceB })]);
assert.equal((await totals()).goals ?? 0, 0); assert.equal((await porra()).matches, 0);
await ok("setMatchArchived", admin, { id: raceA, archived: false });
assert.equal((await totals()).goals, 1);
const beforeRace = (await db.doc(`matches/${raceA}`).get()).data();
const [, staleSave] = await Promise.all([
  ok("deleteMatch", admin, { id: raceA }),
  call("saveMatchSheet", admin, { id: raceA, sheet: { ...sheet(2), revision: beforeRace.revision } }),
]);
assert.ok(!staleSave.error || staleSave.error.status === "FAILED_PRECONDITION", JSON.stringify(staleSave));
assert.equal((await db.doc(`matches/${raceA}`).get()).exists, false);
assert.equal((await totals()).goals ?? 0, 0); assert.equal((await porra()).matches, 0);
// Moving a match must not leave its old season's prediction points behind.
const movedId = `${suffix}-moved`, nextSeason = `${suffix}-next-season`;
await db.doc(`seasons/${nextSeason}`).set({ name: "Segunda temporada de pruebas" });
for (const id of playerIds) await db.doc(`players/${id}`).update({ seasons: [seasonId, nextSeason] });
await ok("saveMatchSheet", admin, { id: movedId, sheet: sheet(1) });
await db.doc(`matchPrivate/${movedId}/predictions/${member.uid}`).set({ goalsFor: 1, goalsAgainst: 0, name: "scorer" });
await ok("saveMatchSheet", admin, { id: movedId, sheet: { ...sheet(1), revision: 1 } });
assert.equal((await porra()).rows[0].points, 3);
await ok("saveMatchSheet", admin, { id: movedId, sheet: { ...sheet(1), seasonId: nextSeason, revision: 2 } });
assert.equal((await porra()).matches, 0); assert.deepEqual((await porra()).rows, []);
assert.equal((await totals()).goals ?? 0, 0);
const movedPorra = (await db.doc(`porraStandings/${nextSeason}`).get()).data();
assert.equal(movedPorra.matches, 1); assert.equal(movedPorra.rows[0].points, 3);
await ok("deleteMatch", admin, { id: movedId });
assert.equal((await db.doc(`porraStandings/${nextSeason}`).get()).get("matches"), 0);
// The persisted deletion marker also drives a retryable server cleanup if the original call dies.
const recoveryId = `${suffix}-recovery`;
await db.doc(`matchPrivate/${recoveryId}/nested/item`).set({ detail: "interrupted cleanup" });
await db.doc(`lineups/${recoveryId}`).set({ matchId: recoveryId, seasonId, ownerUid: admin.uid });
await db.doc(`lineups/${recoveryId}/voz/v0`).set({ data: "audio" });
await db.doc(`matchAudit/${recoveryId}`).set({ matchId: recoveryId });
await db.doc(`matchTombstones/${recoveryId}`).set({ deletedAt: Timestamp.now() });
await eventually(async () => {
  for (const path of [`matchPrivate/${recoveryId}/nested/item`, `lineups/${recoveryId}`, `lineups/${recoveryId}/voz/v0`, `matchAudit/${recoveryId}`]) assert.equal((await db.doc(path).get()).exists, false, path);
});
console.log(`Match lifecycle: ${checked} callable checks plus totals, permissions, preservation, nested cleanup and idempotency assertions passed.`);
