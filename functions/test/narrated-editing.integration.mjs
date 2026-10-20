// Only isolated local demo records. Never seed/clear an existing database.
import assert from 'node:assert/strict';
process.env.FIRESTORE_EMULATOR_HOST = '127.0.0.1:8080';
process.env.FIREBASE_AUTH_EMULATOR_HOST = '127.0.0.1:9099';
const { initializeApp } = await import('firebase-admin/app');
const { getFirestore, Timestamp } = await import('firebase-admin/firestore');
const { getAuth } = await import('firebase-admin/auth');
const { DEFAULT_ANALYSIS_PROFILE } = await import('../lib/narrated/types.js');
const { synchronizeCanonicalAnalysis, editNarratedObservation, addNarratedObservation, removeNarratedObservation } = await import('../lib/narrated/editing.js');
initializeApp({ projectId: 'demo-manchester-piti' });
const db = getFirestore(), tag = `narrated-edit-${Date.now().toString(36)}`;
const matchId = `${tag}-match`, liveId = `${tag}-live`, seasonId = `${tag}-season`, ids = Array.from({ length: 9 }, (_, i) => `${tag}-p${i}`);
const people = [];
let checks = 0;
async function person(role) {
  const encode = o => Buffer.from(JSON.stringify(o)).toString('base64url');
  const jwt = `${encode({ alg: 'none', typ: 'JWT' })}.${encode({ sub: `${tag}-${role}`, email: `${tag}-${role}@example.test`, email_verified: true, name: role, aud: 'demo', iss: 'https://accounts.google.com' })}.`;
  const res = await fetch('http://127.0.0.1:9099/identitytoolkit.googleapis.com/v1/accounts:signInWithIdp?key=demo', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ postBody: new URLSearchParams({ id_token: jwt, providerId: 'google.com' }).toString(), requestUri: 'http://localhost', returnSecureToken: true }) });
  const user = await res.json(); assert.ok(user.idToken);
  const actor = { uid: user.localId, token: user.idToken }; people.push(actor);
  await db.doc(`users/${actor.uid}`).set({ role, nickname: tag });
  await db.doc(`teamMembers/${actor.uid}`).set({ expiresAt: Timestamp.fromMillis(Date.now() + 3600000) });
  return actor;
}
async function call(name, actor, data) {
  const r = await fetch(`http://127.0.0.1:5001/demo-manchester-piti/europe-southwest1/${name}`, { method: 'POST', headers: { 'content-type': 'application/json', authorization: `Bearer ${actor.token}` }, body: JSON.stringify({ data }) });
  return r.json();
}
async function ok(name, actor, data) { const r = await call(name, actor, data); assert.ok(!r.error, JSON.stringify(r)); checks++; return r.result; }
const snapshot = async id => (await db.doc(`matches/${id}`).get()).data();
const presenceWrite = (id, actor) => fetch('http://127.0.0.1:8080/v1/projects/demo-manchester-piti/databases/(default)/documents:commit', { method: 'POST', headers: { authorization: `Bearer ${actor.token}`, 'content-type': 'application/json' }, body: JSON.stringify({ writes: [{ update: { name: `projects/demo-manchester-piti/databases/(default)/documents/matchPrivate/${id}/presence/${actor.uid}`, fields: { name: { stringValue: 'Anotador local' } } }, updateTransforms: [{ fieldPath: 'at', setToServerValue: 'REQUEST_TIME' }] }] }) });
const assertMinutes = (m, exit, enter, minutes) => {
  assert.equal(m.ledger[exit].minutes, minutes); assert.equal(m.ledger[enter].minutes, 50 - minutes);
  assert.equal(Object.values(m.ledger).reduce((n, row) => n + row.minutes, 0), 350); checks += 3;
};
let admin;
try {
  admin = await person('admin'); const scorer = await person('user');
  await db.doc(`seasons/${seasonId}`).set({ name: tag });
  await Promise.all(ids.map(id => db.doc(`players/${id}`).set({ firstName: id, seasons: [seasonId] })));
  const event = { id: 'sub', type: 'substitution', minute: 2, elapsedSeconds: 120, period: 1, playerId: ids[0], inPlayerId: ids[7], source: 'narration' };
  const detail = { id: 'sub-detail', kind: 'substitution', team: 'us', actorId: ids[0], canonicalEventId: 'sub', order: 0, period: 1, time: { from: 120, to: 120, precision: 'exact' }, facts: { inPlayerId: ids[7] }, provenance: { time: { kind: 'explicit', sourceId: 'original' } } };
  const analysis = { version: 2, revision: 0, profile: DEFAULT_ANALYSIS_PROFILE, coverage: [{ family: 'substitution', team: 'us', state: 'complete', from: 0, to: 3000 }], observations: [detail] };
  let sheet = { version: 2, revision: 0, seasonId, rival: tag, competition: 'Pruebas', date: Date.now() - 86400000, duration: 50, durationSeconds: 3000, home: true, venue: 'Local', status: 'finished', starters: ids.slice(0, 7), bench: ids.slice(7), notCalled: [], events: [event], analysis, goalsFor: 0, goalsAgainst: 0, report: '' };
  const sources = [{ id: 'original', quote: 'En el minuto dos sale el primero y entra el octavo.' }];
  await ok('saveMatchSheet', admin, { id: matchId, sheet, sources });
  let m = await snapshot(matchId); assertMinutes(m, ids[0], ids[7], 2);
  const events = [{ ...event, minute: 3, elapsedSeconds: 180 }];
  sheet = { ...sheet, revision: m.revision, events, analysis: synchronizeCanonicalAnalysis(m.analysis, m.events, events, 3000) };
  await ok('saveMatchSheet', admin, { id: matchId, sheet });
  m = await snapshot(matchId); assertMinutes(m, ids[0], ids[7], 3);
  assert.equal(m.analysis.observations[0].time.from, 180); assert.equal(m.analysis.observations[0].provenance.time.rule, 'manual-correction'); checks += 2;
  const detailEdit = { ...m.analysis.observations[0], actorId: ids[1], facts: { inPlayerId: ids[8] }, time: { from: 240, to: 240, precision: 'exact' } };
  sheet = editNarratedObservation({ ...sheet, revision: m.revision, events: m.events, analysis: m.analysis }, detailEdit);
  await ok('saveMatchSheet', admin, { id: matchId, sheet });
  m = await snapshot(matchId); assertMinutes(m, ids[1], ids[8], 4);
  assert.equal(m.events[0].inPlayerId, ids[8]); assert.equal(m.events[0].playerId, ids[1]); checks += 2;
  await ok('setMatchScorers', admin, { matchId, uids: [scorer.uid] });
  const denied = await call('saveMatchSheet', scorer, { id: matchId, sheet: { ...sheet, revision: m.revision, analysis: m.analysis } });
  assert.equal(denied.error?.status, 'PERMISSION_DENIED'); checks++;
  // Old clients cannot silently leave a stale detail behind when they omit analysis.
  const { analysis: _omitted, ...oldClient } = sheet;
  await ok('saveMatchSheet', admin, { id: matchId, sheet: { ...oldClient, revision: m.revision, events: [{ ...m.events[0], minute: 5, elapsedSeconds: 300 }] } });
  m = await snapshot(matchId); assertMinutes(m, ids[1], ids[8], 5);
  assert.equal(m.analysis.observations[0].time.from, 300); checks++;
  const history = await db.collection(`matchPrivate/${matchId}/analysisHistory`).get();
  assert.ok(history.docs.some(d => JSON.stringify(d.data()).includes(sources[0].quote))); assert.ok(!JSON.stringify(m).includes(sources[0].quote)); checks += 2;
  const historyUrl = `http://127.0.0.1:8080/v1/projects/demo-manchester-piti/databases/(default)/documents/matchPrivate/${matchId}/analysisHistory/${history.docs[0].id}`;
  assert.equal((await fetch(historyUrl, { headers: { authorization: `Bearer ${admin.token}` } })).status, 200);
  assert.equal((await fetch(historyUrl, { headers: { authorization: `Bearer ${scorer.token}` } })).status, 403);
  assert.equal((await fetch(historyUrl)).status, 403); checks += 3;
  const aggregate = await db.collection('playerSeasonStats').where('seasonId', '==', seasonId).get();
  assert.equal(aggregate.docs.find(d => d.get('playerId') === ids[1]).get('totals.minutes'), 5); checks++;
  // Full post-match CRUD: add a fact, edit its attributes and coverage, remove it, preserve original evidence.
  sheet = { ...sheet, revision: m.revision, events: m.events, analysis: m.analysis };
  sheet = addNarratedObservation(sheet, { id: 'manual-pass', kind: 'pass', team: 'us', actorId: ids[2], receiverId: ids[3], order: 5, time: { from: 600, to: 600, precision: 'exact' }, facts: { outcome: 'complete' } });
  await ok('saveMatchSheet', admin, { id: matchId, sheet }); m = await snapshot(matchId);
  assert.equal(m.ledger[ids[2]].passesCompleted, 1); checks++;
  sheet = editNarratedObservation({ ...sheet, revision: m.revision, analysis: m.analysis }, { ...m.analysis.observations.find(o => o.id === 'manual-pass'), receiverId: undefined, facts: { outcome: 'failed', underPressure: true } });
  sheet.analysis.coverage = [{ family: 'pass', team: 'us', state: 'partial', from: 0, to: 3000 }];
  sheet.analysis.profile.parameters.windowSeconds = 180;
  await ok('saveMatchSheet', admin, { id: matchId, sheet }); m = await snapshot(matchId);
  assert.equal(m.ledger[ids[2]].passesFailed, 1); assert.equal(m.analysis.profile.parameters.windowSeconds, 180); assert.equal(m.analysis.coverage[0].state, 'partial'); checks += 3;
  sheet = removeNarratedObservation({ ...sheet, revision: m.revision, analysis: m.analysis }, 'manual-pass');
  await ok('saveMatchSheet', admin, { id: matchId, sheet }); m = await snapshot(matchId);
  assert.equal(m.ledger[ids[2]].passesFailed ?? 0, 0); assert.ok(!m.analysis.observations.some(o => o.id === 'manual-pass')); assertMinutes(m, ids[1], ids[8], 5); checks += 2;
  assert.ok((await db.collection(`matchPrivate/${matchId}/analysisHistory`).get()).docs.some(d => JSON.stringify(d.data()).includes(sources[0].quote))); checks++;
  // The live mesa also fixes the linked detail atomically and increments both revisions.
  const liveSheet = { ...sheet, revision: 0, status: 'scheduled', events: [event], analysis };
  await ok('saveMatchSheet', admin, { id: liveId, sheet: liveSheet });
  await db.doc(`matches/${liveId}`).update({ clock: { revision: 1, phase: 'first', firstStartedAt: Date.now() - 600000 } });
  await ok('setMatchScorers', admin, { matchId: liveId, uids: [scorer.uid] });
  const oldLive = await snapshot(liveId);
  await ok('liveEvent', admin, { matchId: liveId, action: 'edit', eventId: 'sub', patch: { elapsedSeconds: 180, playerId: ids[1], inPlayerId: ids[8] } });
  const live = await snapshot(liveId);
  assert.equal(live.revision, oldLive.revision + 1); assert.equal(live.analysis.revision, oldLive.analysis.revision + 1);
  assert.equal(live.analysis.observations[0].time.from, 180); assert.equal(live.analysis.observations[0].actorId, ids[1]); assert.equal(live.analysis.observations[0].facts.inPlayerId, ids[8]); checks += 5;
  await ok('liveEvent', admin, { matchId: liveId, action: 'delete', eventId: 'sub' });
  const deleted = await snapshot(liveId); assert.equal(deleted.events.length, 0); assert.equal(deleted.analysis.observations[0].validity, 'void'); checks += 2;
  // Deletion clears public descendants even after the root is already absent, without touching another match.
  const child = db.doc(`matches/${matchId}/comments/first/replies/nested`);
  const protectedChild = db.doc(`matches/${liveId}/comments/protected`);
  await child.set({ fixture: tag }); await protectedChild.set({ fixture: tag });
  assert.equal((await presenceWrite(matchId, admin)).status, 200); checks++;
  await ok('deleteMatch', admin, { id: matchId });
  assert.equal((await db.doc(`matches/${matchId}`).get()).exists, false);
  assert.equal((await child.get()).exists, false);
  assert.equal((await db.collection(`matchPrivate/${matchId}/analysisHistory`).get()).size, 0);
  assert.equal((await db.doc(`matchTombstones/${matchId}`).get()).exists, true); checks += 4;
  assert.equal((await presenceWrite(matchId, admin)).status, 403);
  assert.equal((await db.doc(`matchPrivate/${matchId}/presence/${admin.uid}`).get()).exists, false); checks += 2;
  const orphan = db.doc(`matches/${matchId}/comments/absent-parent/replies/orphan`);
  await orphan.set({ fixture: tag });
  await ok('deleteMatch', admin, { id: matchId });
  assert.equal((await orphan.get()).exists, false);
  assert.equal((await db.doc(`matches/${matchId}`).get()).exists, false);
  assert.deepEqual(await snapshot(liveId), deleted);
  assert.equal((await protectedChild.get()).exists, true); checks += 4;
  console.log(`${checks} comprobaciones: acta publicada, narración, edición recíproca, 350 minutos, permisos, revisiones y mesa sincronizados.`);
} finally {
  // Every target belongs to this invocation; never clear collections or touch the narrated demo.
  for (const id of [matchId, liveId]) {
    if (admin && (await db.doc(`matches/${id}`).get()).exists) await ok('deleteMatch', admin, { id });
    const matchRef = db.doc(`matches/${id}`);
    for (const collection of await matchRef.listCollections()) await db.recursiveDelete(collection);
    if ((await matchRef.get()).exists) await matchRef.delete();
    for (const collection of ['matchPrivate', 'matchDrafts', 'matchTombstones']) await db.recursiveDelete(db.doc(`${collection}/${id}`));
    const audit = await db.collection('matchAudit').where('matchId', '==', id).get(); await Promise.all(audit.docs.map(d => d.ref.delete()));
  }
  const stats = await db.collection('playerSeasonStats').where('seasonId', '==', seasonId).get(); await Promise.all(stats.docs.map(d => d.ref.delete()));
  await Promise.all(ids.map(id => db.doc(`players/${id}`).delete())); await db.doc(`seasons/${seasonId}`).delete();
  for (const actor of people) { await db.recursiveDelete(db.doc(`users/${actor.uid}`)); await db.doc(`teamMembers/${actor.uid}`).delete(); await getAuth().deleteUser(actor.uid); }
  await db.terminate();
}
