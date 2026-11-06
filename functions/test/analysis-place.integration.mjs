// The narrated analysis in its own place (matchAnalysis/{id}, functions/src/analysisPlace.ts): the old field kept in
// step while a match still has it, the later revision winning, the bundles, and the one-off move
// (scripts/migrate-analysis.mjs: dry run, copy, remove). Isolated demo-only records on the emulators.
import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { fileURLToPath } from "node:url";
process.env.FIRESTORE_EMULATOR_HOST = "127.0.0.1:8080";
process.env.FIREBASE_AUTH_EMULATOR_HOST = "127.0.0.1:9099";
const { initializeApp } = await import("firebase-admin/app");
const { getFirestore, Timestamp } = await import("firebase-admin/firestore");
const { getAuth } = await import("firebase-admin/auth");
const { DEFAULT_ANALYSIS_PROFILE } = await import("../lib/narrated/types.js");
initializeApp({ projectId: "demo-manchester-piti" });
const db = getFirestore(), tag = `place-${Date.now().toString(36)}`;
const seasonId = `${tag}-season`, ids = Array.from({ length: 8 }, (_, i) => `${tag}-p${i}`);
const matchId = `${tag}-m`, legacyId = `${tag}-legacy`, people = [];
let checks = 0;
async function person(role) {
  const encode = (o) => Buffer.from(JSON.stringify(o)).toString("base64url");
  const jwt = `${encode({ alg: "none", typ: "JWT" })}.${encode({ sub: `${tag}-${role}`, email: `${tag}-${role}@example.test`, email_verified: true, name: role, aud: "demo", iss: "https://accounts.google.com" })}.`;
  const res = await fetch("http://127.0.0.1:9099/identitytoolkit.googleapis.com/v1/accounts:signInWithIdp?key=demo", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ postBody: new URLSearchParams({ id_token: jwt, providerId: "google.com" }).toString(), requestUri: "http://localhost", returnSecureToken: true }) });
  const user = await res.json();
  assert.ok(user.idToken);
  const actor = { uid: user.localId, token: user.idToken };
  people.push(actor);
  await db.doc(`users/${actor.uid}`).set({ role, nickname: tag });
  await db.doc(`teamMembers/${actor.uid}`).set({ expiresAt: Timestamp.fromMillis(Date.now() + 3600000) });
  return actor;
}
async function ok(name, actor, data) {
  const r = await fetch(`http://127.0.0.1:5001/demo-manchester-piti/europe-southwest1/${name}`, { method: "POST", headers: { "content-type": "application/json", authorization: `Bearer ${actor.token}` }, body: JSON.stringify({ data }) }).then((x) => x.json());
  assert.ok(!r.error, JSON.stringify(r));
  checks++;
  return r.result;
}
const both = async (id) => {
  const [m, p] = await db.getAll(db.doc(`matches/${id}`), db.doc(`matchAnalysis/${id}`));
  return { match: m.data(), place: p.exists ? p.get("analysis") : undefined };
};
const script = fileURLToPath(new URL("../scripts/migrate-analysis.mjs", import.meta.url));
const migrate = (...args) => {
  const r = spawnSync(process.execPath, [script, ...args], { encoding: "utf8", env: { ...process.env } });
  return { status: r.status, out: `${r.stdout}${r.stderr}` };
};
const pass = (id, order, extra = {}) => ({ id, kind: "pass", team: "us", actorId: ids[0], receiverId: ids[1], order, time: { from: 60 + order, to: 60 + order, precision: "exact" }, facts: { outcome: "complete" }, ...extra });
const analysisOf = (revision, observations) => ({ version: 2, revision, profile: DEFAULT_ANALYSIS_PROFILE, coverage: [{ family: "pass", team: "us", state: "partial" }], observations });

let admin;
try {
  admin = await person("admin");
  await db.doc(`seasons/${seasonId}`).set({ name: tag });
  await Promise.all(ids.map((id) => db.doc(`players/${id}`).set({ firstName: id, seasons: [seasonId] })));
  const base = { version: 2, seasonId, rival: tag, competition: "Pruebas", date: Date.now() - 86400000, duration: 50, durationSeconds: 3000, home: true, venue: "Local", status: "finished", starters: ids.slice(0, 7), bench: [ids[7]], notCalled: [], events: [], goalsFor: 0, goalsAgainst: 0, report: "" };

  // 1. A new acta: its analysis goes only to its place.
  await ok("saveMatchSheet", admin, { id: matchId, sheet: { ...base, revision: 0, analysis: analysisOf(0, [pass("a", 1)]) } });
  let s = await both(matchId);
  assert.equal(s.match.analysis, undefined);
  assert.equal(s.place.revision, 1);
  assert.equal(s.place.observations.length, 1);
  assert.equal(s.match.ledger[ids[0]].passesCompleted, 1);
  checks += 4;

  // 2. A match from before the move (the old field, nothing in its place): read from the field, and kept in step.
  await db.doc(`matches/${legacyId}`).set({ ...base, rival: `${tag}-old`, date: Timestamp.fromMillis(base.date), revision: 1, analysis: analysisOf(3, [pass("b", 1)]) });
  await ok("saveMatchSheet", admin, { id: legacyId, sheet: { ...base, rival: `${tag}-old`, revision: 1, analysis: analysisOf(3, [pass("b", 1), pass("c", 2)]) } });
  s = await both(legacyId);
  assert.equal(s.place.revision, 4);
  assert.deepEqual(s.match.analysis, s.place);
  checks += 2;
  // (an old client without the analysis: the stored one is kept, in both)
  await ok("saveMatchSheet", admin, { id: legacyId, sheet: { ...base, rival: `${tag}-old`, revision: 2 } });
  s = await both(legacyId);
  assert.equal(s.place.observations.length, 2);
  assert.deepEqual(s.match.analysis, s.place);
  checks += 2;

  // 3. A function from before the move wrote a later revision in the old field: that one is the match's.
  await db.doc(`matches/${legacyId}`).update({ analysis: analysisOf(9, [pass("d", 1)]) });
  await ok("saveMatchSheet", admin, { id: legacyId, sheet: { ...base, rival: `${tag}-old`, revision: 3, analysis: analysisOf(9, [pass("d", 1), pass("e", 2)]) } });
  s = await both(legacyId);
  assert.equal(s.place.revision, 10);
  assert.deepEqual(s.place.observations.map((o) => o.id), ["d", "e"]);
  checks += 2;

  // 4. The bundles: the analyses' own, with its named query; the public one names its queries too.
  const analysisBundle = await fetch("http://127.0.0.1:5001/demo-manchester-piti/europe-southwest1/clubAnalysisBundle").then((r) => r.text());
  assert.ok(analysisBundle.includes('"name":"matchAnalysis"'));
  assert.ok(analysisBundle.includes(`/matchAnalysis/${matchId}"`));
  const club = await fetch("http://127.0.0.1:5001/demo-manchester-piti/europe-southwest1/clubBundle").then((r) => r.text());
  for (const q of ["matches", "players", "seasons", "mvpResults", "standings"]) assert.ok(club.includes(`"name":"${q}"`), q);
  checks += 3;

  // 5. The move: in a dry run nothing is written; the copy, then the field removed; never removed without its copy.
  const moved = `${tag}-move`;
  const old = analysisOf(5, [pass("f", 1)]);
  await db.doc(`matches/${moved}`).set({ ...base, rival: `${tag}-move`, date: Timestamp.fromMillis(base.date), revision: 1, analysis: old });
  let r = migrate("--quitar-campo", "--write");
  assert.equal((await both(moved)).match.analysis.revision, 5, r.out);
  assert.match(r.out, /falta copiar \(no se tocan\): [1-9]/);
  r = migrate();
  assert.equal(r.status, 0, r.out);
  assert.match(r.out, /En seco/);
  assert.equal((await both(moved)).place, undefined);
  r = migrate("--write");
  assert.equal(r.status, 0, r.out);
  s = await both(moved);
  assert.deepEqual(s.place, old);
  assert.deepEqual(s.match.analysis, old);
  r = migrate("--write");
  assert.match(r.out, new RegExp(`a escribir: 0`));
  r = migrate("--quitar-campo");
  assert.match(r.out, /En seco/);
  assert.deepEqual((await both(moved)).match.analysis, old);
  r = migrate("--quitar-campo", "--write");
  s = await both(moved);
  assert.equal(s.match.analysis, undefined, r.out);
  assert.deepEqual(s.place, old);
  assert.equal(s.match.revision, 1);
  // (--prod --write without its confirmations never runs)
  r = migrate("--prod", "--write");
  assert.notEqual(r.status, 0);
  checks += 14;

  // 6. Deleting the match takes its analysis with it.
  await ok("deleteMatch", admin, { id: matchId });
  assert.equal((await db.doc(`matchAnalysis/${matchId}`).get()).exists, false);
  checks++;
  console.log(`${checks} comprobaciones: el análisis en su sitio, el campo viejo al día mientras exista, la revisión más alta manda, los bundles con nombre y el traslado (en seco, copia, quitar).`);
} finally {
  for (const id of [matchId, legacyId, `${tag}-move`]) {
    if (admin && (await db.doc(`matches/${id}`).get()).exists) await ok("deleteMatch", admin, { id }).catch(() => {});
    for (const collection of ["matches", "matchPrivate", "matchDrafts", "matchTombstones", "matchAnalysis", "mvpResults"]) await db.recursiveDelete(db.doc(`${collection}/${id}`));
    const audit = await db.collection("matchAudit").where("matchId", "==", id).get();
    await Promise.all(audit.docs.map((d) => d.ref.delete()));
  }
  const stats = await db.collection("playerSeasonStats").where("seasonId", "==", seasonId).get();
  await Promise.all(stats.docs.map((d) => d.ref.delete()));
  await Promise.all(ids.map((id) => db.doc(`players/${id}`).delete()));
  await db.doc(`seasons/${seasonId}`).delete();
  for (const actor of people) {
    await db.recursiveDelete(db.doc(`users/${actor.uid}`));
    await db.doc(`teamMembers/${actor.uid}`).delete();
    await getAuth().deleteUser(actor.uid);
  }
  await db.terminate();
}
