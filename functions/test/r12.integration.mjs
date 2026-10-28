// Run only with the demo emulators. No production credentials or endpoints.
// r12 · la Sala de control y la mesa, the server's part: the new callables (MVP by hand, crónica corta, notas,
// draft, video marks, guest and duration from la mesa, porra, deleting a ficha or a season, a captain's notice,
// «Recordar ahora», a guest promoted to his ficha) and the fixes (revokeMember frees the ficha and the
// brazalete, B-PAR-01, the rival's goal held 10 s). Its own `r12-…` documents only (cleaned up at the end).
import assert from "node:assert/strict";
process.env.FIRESTORE_EMULATOR_HOST = "127.0.0.1:8080";
process.env.FIREBASE_AUTH_EMULATOR_HOST = "127.0.0.1:9099";
const { initializeApp } = await import("firebase-admin/app");
const { getFirestore, Timestamp } = await import("firebase-admin/firestore");
initializeApp({ projectId: "demo-manchester-piti" });
const db = getFirestore();
const suffix = `r12-${Date.now().toString(36)}`;
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
    headers: { "content-type": "application/json", ...(who ? { authorization: `Bearer ${who.token}` } : {}) },
    body: JSON.stringify({ data }),
  });
  return response.json();
}
async function ok(name, who, data) {
  const value = await call(name, who, data);
  assert.ok(!value.error, `${name}: ${JSON.stringify(value)}`);
  checked++;
  return value.result;
}
async function denied(name, who, data, status = "FAILED_PRECONDITION", message) {
  const value = await call(name, who, data);
  assert.equal(value.error?.status, status, `${name}: ${JSON.stringify(value)}`);
  if (message) assert.match(value.error.message, message, `${name}: ${value.error.message}`);
  checked++;
}
async function eventually(check, tries = 120) {
  let last;
  for (let i = 0; i < tries; i++) {
    try {
      return await check();
    } catch (error) {
      last = error;
      await new Promise((r) => setTimeout(r, 250));
    }
  }
  throw last;
}
const wait = (ms) => new Promise((r) => setTimeout(r, ms));
const get = async (path) => (await db.doc(path).get()).data();

const seasonId = `${suffix}-t1`, oldSeason = `${suffix}-t0`;
const ids = Array.from({ length: 9 }, (_, i) => `${suffix}-p${i}`);
const m = (k) => `${suffix}-${k}`;
const people = [];
const created = { matches: [], players: [...ids], seasons: [seasonId, oldSeason] };
try {
  const admin = await google("admin"), scorer = await google("scorer"), member = await google("member"), other = await google("other");
  const general = await google("general");
  for (const [who, role, nick] of [[admin, "admin", "capi"], [scorer, "user", "anota"], [member, "user", "socio"], [other, "admin", "capi2"], [general, "superadmin", "general"]]) {
    people.push(who.uid);
    await db.doc(`users/${who.uid}`).set({ role, nickname: `${nick}-${suffix}`.slice(0, 30), email: `${who.uid}@example.test` });
    await db.doc(`teamMembers/${who.uid}`).set({ expiresAt: Timestamp.fromMillis(Date.now() + 24 * HOUR) });
  }
  await db.doc(`seasons/${seasonId}`).set({ name: "r12 · pruebas" });
  for (const [i, id] of ids.entries()) await db.doc(`players/${id}`).set({ firstName: `Jugador ${i}`, number: i + 1, seasons: [seasonId], active: true });
  await db.doc(`playerLinks/${ids[1]}`).set({ uid: member.uid });
  await db.doc(`users/${member.uid}`).update({ playerId: ids[1] });
  const sheet = (over = {}) => ({
    version: 2, revision: 0, seasonId, rival: "Rival r12", competition: "Liga", date: Date.now() - 86_400_000, duration: 50, durationSeconds: 3000,
    venue: "Campo", home: true, status: "finished", starters: ids.slice(0, 7), bench: ids.slice(7), notCalled: [], goalsFor: 1, goalsAgainst: 0, report: "",
    events: [{ id: "g1", type: "goal", playerId: ids[0], assistPlayerId: ids[1], assistReviewed: true, minute: 3 }], ...over,
  });

  // ---- B-PAR-01: a draft archived and restored saves again
  {
    const id = m("draft-only");
    created.matches.push(id);
    const upcoming = sheet({ status: "scheduled", date: Date.now() + 3 * 86_400_000, events: [], goalsFor: undefined, goalsAgainst: undefined });
    await ok("saveMatchSheet", admin, { id, draft: true, sheet: upcoming });
    await ok("setMatchArchived", admin, { id, archived: true });
    await ok("setMatchArchived", admin, { id, archived: false });
    const rev = (await get(`matchDrafts/${id}`)).revision;
    assert.equal(rev, 2); checked++;
    await ok("saveMatchSheet", admin, { id, draft: true, sheet: { ...upcoming, revision: rev, venue: "Otro campo" } });
    // (a stale base is still refused)
    await denied("saveMatchSheet", admin, { id, draft: true, sheet: { ...upcoming, revision: 0 } }, "ABORTED");
    // M-44: only a published match's draft can be discarded
    await denied("discardMatchDraft", admin, { matchId: id }, "FAILED_PRECONDITION", /solo existe como borrador/);
    // B-CNV-01 is in the rules tests (the switch is a direct write)
  }

  // ---- a published acta: MVP by hand, notas, video marks, the draft, the crónica corta
  const acta = m("acta");
  created.matches.push(acta);
  await ok("saveMatchSheet", admin, { id: acta, sheet: sheet() });
  let doc = await get(`matches/${acta}`);
  assert.equal(typeof doc.actaPublishedAt, "number"); assert.ok(Math.abs(doc.voteClosesAt - 48 * HOUR - doc.actaPublishedAt) < 5000); checked += 2;
  const published = doc.actaPublishedAt;
  await denied("setMvpVote", member, { matchId: acta, action: "close" }, "PERMISSION_DENIED");
  let r = await ok("setMvpVote", admin, { matchId: acta, action: "close" });
  assert.ok(r.voteClosesAt <= Date.now()); checked++;
  await eventually(async () => assert.equal((await get(`mvpResults/${acta}`)).open, false));
  await denied("setMvpVote", admin, { matchId: acta, action: "close" }, "FAILED_PRECONDITION", /ya está cerrada/);
  r = await ok("setMvpVote", admin, { matchId: acta, action: "reopen" });
  assert.ok(r.voteClosesAt > Date.now() + 23 * HOUR); checked++;
  doc = await get(`matches/${acta}`);
  assert.equal(doc.actaPublishedAt, published); assert.equal(doc.mvpManual, undefined, "who moved it is not public"); checked += 2;
  { const priv = await get(`matchPrivate/${acta}`); assert.equal(priv.mvpManual.action, "reopen"); assert.equal(priv.mvpManual.by, admin.uid); checked += 2; }
  assert.equal((await get(`mvpResults/${acta}`)).open, true); checked++;
  // reopening an open vote never shortens it
  assert.equal((await ok("setMvpVote", admin, { matchId: acta, action: "reopen" })).voteClosesAt >= r.voteClosesAt, true); checked++;
  r = { voteClosesAt: (await get(`matches/${acta}`)).voteClosesAt };
  // a correction keeps the window moved by hand and the publication time
  await ok("saveMatchSheet", admin, { id: acta, sheet: { ...sheet(), revision: doc.revision, report: "" } });
  doc = await get(`matches/${acta}`);
  assert.equal(doc.actaPublishedAt, published); assert.equal(doc.voteClosesAt, r.voteClosesAt); assert.equal((await get(`matchPrivate/${acta}`)).mvpManual.action, "reopen"); checked += 3;
  // M-42
  const notas = await ok("recalcMatchNotas", admin, { matchId: acta });
  assert.equal(typeof notas.players, "number"); checked++;
  assert.equal((await get(`matchPrivate/${acta}`))?.notasError, undefined); checked++;
  await denied("recalcMatchNotas", member, { matchId: acta }, "PERMISSION_DENIED");
  // M-43
  await denied("setVideoMarks", admin, { matchId: acta, marks: { g1: 30 } }, "FAILED_PRECONDITION", /vídeo/);
  await denied("setVideoMarks", admin, { matchId: m("draft-only"), marks: {} }, "FAILED_PRECONDITION", /no está publicada/);
  await db.doc(`matches/${acta}`).update({ videoUrl: "https://www.youtube.com/watch?v=dQw4w9WgXcQ" });
  r = await ok("setVideoMarks", admin, { matchId: acta, marks: { g1: 30, nope: 50 } });
  assert.deepEqual(r.marks, { g1: 30 }); checked++;
  doc = await get(`matches/${acta}`);
  assert.deepEqual(doc.videoMarks, { g1: 30 }); checked++;
  // the acta saved again without marks keeps them; with them, takes them
  await ok("saveMatchSheet", admin, { id: acta, sheet: { ...sheet(), revision: doc.revision, videoUrl: doc.videoUrl } });
  doc = await get(`matches/${acta}`);
  assert.deepEqual(doc.videoMarks, { g1: 30 }); checked++;
  await ok("saveMatchSheet", admin, { id: acta, sheet: { ...sheet(), revision: doc.revision, videoUrl: doc.videoUrl, videoMarks: { g1: 42 } } });
  doc = await get(`matches/${acta}`);
  assert.deepEqual(doc.videoMarks, { g1: 42 }); checked++;
  // M-44: a draft over the published acta, discarded
  await ok("saveMatchSheet", admin, { id: acta, draft: true, sheet: { ...sheet(), revision: doc.revision, report: "Borrador" } });
  await denied("discardMatchDraft", member, { matchId: acta }, "PERMISSION_DENIED");
  await ok("discardMatchDraft", admin, { matchId: acta });
  assert.equal((await db.doc(`matchDrafts/${acta}`).get()).exists, false); checked++;
  await denied("discardMatchDraft", admin, { matchId: acta }, "NOT_FOUND");
  // M-38: the scorer writes the crónica corta; a captain's rewrite takes it from him
  await denied("saveMatchReport", scorer, { matchId: acta, report: "Dos líneas" }, "PERMISSION_DENIED");
  await db.doc(`matchPrivate/${acta}`).set({ scorerUids: [scorer.uid] }, { merge: true });
  await denied("saveMatchReport", scorer, { matchId: acta, report: "x".repeat(221) }, "INVALID_ARGUMENT", /220/);
  r = await ok("saveMatchReport", scorer, { matchId: acta, report: "Remontada a lo City." });
  assert.equal((await get(`matches/${acta}`)).report, "Remontada a lo City."); checked++;
  await ok("saveMatchReport", scorer, { matchId: acta, report: "Remontada a lo City, otra vez." });
  doc = await get(`matches/${acta}`);
  await ok("saveMatchSheet", admin, { id: acta, sheet: { ...sheet(), revision: doc.revision, videoUrl: doc.videoUrl, report: "La del capitán." } });
  assert.equal((await get(`matchPrivate/${acta}`)).reportBy, admin.uid); checked++;
  await denied("saveMatchReport", scorer, { matchId: acta, report: "Pisarla" }, "FAILED_PRECONDITION", /capitán/);
  // (even if reportBy were still his: the text is not the one he saved)
  await db.doc(`matchPrivate/${acta}`).set({ reportBy: scorer.uid }, { merge: true });
  await denied("saveMatchReport", scorer, { matchId: acta, report: "Pisarla" }, "FAILED_PRECONDITION", /capitán/);
  await ok("saveMatchReport", admin, { matchId: acta, report: "La del capitán, corregida." });
  {
    // a draft over the acta with its own crónica: the callable never overwrites it; one that still has the
    // published text follows
    doc = await get(`matches/${acta}`);
    await ok("saveMatchSheet", admin, { id: acta, draft: true, sheet: { ...sheet(), revision: doc.revision, videoUrl: doc.videoUrl, report: "La del borrador." } });
    await ok("saveMatchReport", admin, { matchId: acta, report: "Otra publicada." });
    assert.equal((await get(`matchDrafts/${acta}`)).report, "La del borrador."); assert.equal((await get(`matches/${acta}`)).report, "Otra publicada."); checked += 2;
    await db.doc(`matchDrafts/${acta}`).update({ report: "Otra publicada." });
    await ok("saveMatchReport", admin, { matchId: acta, report: "Y otra más." });
    assert.equal((await get(`matchDrafts/${acta}`)).report, "Y otra más."); checked++;
    await ok("discardMatchDraft", admin, { matchId: acta });
    // the scorer's 48 h: past them, a captain writes it
    await ok("saveMatchReport", admin, { matchId: acta, report: "" });
    await db.doc(`matches/${acta}`).update({ actaPublishedAt: Date.now() - 49 * HOUR });
    await denied("saveMatchReport", scorer, { matchId: acta, report: "Tarde" }, "FAILED_PRECONDITION", /plazo/);
    await db.doc(`matches/${acta}`).update({ actaPublishedAt: published });
  }

  // ---- M-46: a captain corrects a member's porra after kick-off; «Recalcular»
  await denied("correctPrediction", member, { matchId: acta, uid: member.uid, goalsFor: 1, goalsAgainst: 0, goals: [{ playerId: ids[0] }] }, "PERMISSION_DENIED");
  await denied("correctPrediction", admin, { matchId: acta, uid: member.uid, goalsFor: 2, goalsAgainst: 0, goals: [{ playerId: ids[0] }] }, "INVALID_ARGUMENT", /goleador/);
  await ok("correctPrediction", admin, { matchId: acta, uid: member.uid, goalsFor: 1, goalsAgainst: 0, goals: [{ playerId: ids[0], assistPlayerId: ids[1] }] });
  const pred = await get(`matchPrivate/${acta}/predictions/${member.uid}`);
  assert.equal(pred.correctedBy, admin.uid); assert.equal(pred.correctedByName, (await get(`users/${admin.uid}`)).nickname); assert.ok(pred.correctedAt); assert.equal(pred.playerId, ids[1]); assert.equal(pred.goalsFor, 1); checked += 5;
  await denied("correctPrediction", admin, { matchId: acta, uid: admin.uid, remove: true }, "PERMISSION_DENIED", /propia/);
  await db.doc(`players/${ids[8]}`).update({ active: false });
  await denied("correctPrediction", admin, { matchId: acta, uid: member.uid, goalsFor: 1, goalsAgainst: 0, goals: [{ playerId: ids[8] }] }, "INVALID_ARGUMENT", /activos/);
  await db.doc(`players/${ids[8]}`).update({ active: true });
  {
    const outside = `${suffix}-outside`;
    people.push(outside);
    await db.doc(`users/${outside}`).set({ role: "user", nickname: "fuera" });
    await denied("correctPrediction", admin, { matchId: acta, uid: outside, remove: true }, "FAILED_PRECONDITION", /ya no está en el vestuario/);
  }
  await eventually(async () => assert.ok((await get(`porraStandings/${seasonId}`)) !== undefined));
  await ok("correctPrediction", admin, { matchId: acta, uid: member.uid, remove: true });
  assert.equal((await db.doc(`matchPrivate/${acta}/predictions/${member.uid}`).get()).exists, false); checked++;
  await ok("recomputeSeasonPorra", admin, { seasonId });
  await denied("recomputeSeasonPorra", admin, { seasonId: `${suffix}-nope` }, "NOT_FOUND");

  // ---- B-CLUB-05: a ficha cited by an acta can't be deleted; a fresh one can
  await denied("deletePlayer", admin, { playerId: ids[0] }, "FAILED_PRECONDITION", /sale en el acta/);
  const fresh = `${suffix}-fresh`;
  created.players.push(fresh);
  await db.doc(`players/${fresh}`).set({ firstName: "Nuevo", seasons: [] });
  await denied("deletePlayer", member, { playerId: fresh }, "PERMISSION_DENIED");
  {
    const check = async (path, data, message) => {
      await db.doc(path).set(data);
      await denied("deletePlayer", admin, { playerId: fresh }, "FAILED_PRECONDITION", message);
      await db.doc(path).delete();
    };
    await check(`cajaMovs/${suffix}-mov`, { playerId: fresh, kind: "cargo", amount: 100 }, /caja/);
    await check(`cajaClaims/${suffix}-claim`, { playerId: fresh, status: "pendiente" }, /caja/);
    await check(`lineups/${suffix}-board`, { name: "x", slots: [{ playerId: fresh }] }, /tablero/);
    await check(`absences/${suffix}-abs`, { playerId: fresh, from: "2026-10-01", to: "2026-10-02" }, /ausencias/);
    await check(`matchPrivate/${acta}/availability/${suffix}-ans`, { playerId: fresh, response: "yes" }, /convocatoria/);
    await check(`matchPrivate/${acta}/predictions/${suffix}-pr`, { goals: [{ playerId: fresh }] }, /porra/);
    await check(`matchDrafts/${suffix}-lineup`, { present: [fresh] }, /acta/);
    await db.doc(`players/${fresh}`).update({ sanction: { games: 1, from: 0, by: admin.uid } });
    await denied("deletePlayer", admin, { playerId: fresh }, "FAILED_PRECONDITION", /sanción/);
    await db.doc(`players/${fresh}`).update({ sanction: null });
    // a removed holder's link and pointer go with it
    const was = `${suffix}-was`;
    people.push(was);
    await db.doc(`users/${was}`).set({ role: "user", nickname: "was", playerId: fresh, removedAt: Timestamp.now(), removedBy: admin.uid });
    await db.doc(`playerLinks/${fresh}`).set({ uid: was });
  }
  await ok("deletePlayer", admin, { playerId: fresh });
  assert.equal((await db.doc(`playerLinks/${fresh}`).get()).exists, false); assert.equal((await get(`users/${suffix}-was`)).playerId, undefined); checked += 2;
  assert.equal((await db.doc(`players/${fresh}`).get()).exists, false); checked++;

  // ---- la mesa (M-48): a guest from the touchline, the duration
  const next = m("next");
  created.matches.push(next);
  await ok("saveMatchSheet", admin, { id: next, sheet: sheet({ status: "scheduled", date: Date.now() + 30 * HOUR, events: [], goalsFor: undefined, goalsAgainst: undefined, starters: ids.slice(0, 7), bench: [ids[7]], notCalled: [ids[8]] }) });
  await ok("setMatchScorers", admin, { matchId: next, uids: [scorer.uid] });
  await denied("addMatchGuest", member, { matchId: next, name: "Rafa" }, "PERMISSION_DENIED");
  r = await ok("addMatchGuest", scorer, { matchId: next, name: "Rafa" });
  assert.deepEqual([r.guest.id, r.ref, r.created], ["g1", "guest:g1", true]); checked++;
  r = await ok("addMatchGuest", scorer, { matchId: next, name: "rafá" });
  assert.equal(r.created, false); checked++;
  doc = await get(`matches/${next}`);
  assert.deepEqual(doc.guests, [{ id: "g1", name: "Rafa" }]); assert.deepEqual(doc.bench, [ids[7], "guest:g1"]); checked += 2;
  {
    // a draft over the match with a guest of its own: the new guest takes another id and the draft keeps its own
    doc = await get(`matches/${next}`);
    await db.doc(`matchDrafts/${next}`).set({ seasonId, rival: "Rival r12", status: "scheduled", revision: doc.revision, guests: [{ id: "g2", name: "Toni" }], starters: ids.slice(0, 7), bench: [ids[7], "guest:g2"], report: "", duration: 50 });
    r = await ok("addMatchGuest", scorer, { matchId: next, name: "Leo" });
    assert.equal(r.guest.id, "g3"); checked++;
    const d = await get(`matchDrafts/${next}`);
    assert.deepEqual(d.guests, [{ id: "g2", name: "Toni" }, { id: "g3", name: "Leo" }]); assert.deepEqual(d.bench, [ids[7], "guest:g2", "guest:g3"]); checked += 2;
    assert.deepEqual((await get(`matches/${next}`)).guests.map((x) => x.id), ["g1", "g3"]); checked++;
    // (2) the duration: the draft that had its own keeps it
    await db.doc(`matchDrafts/${next}`).update({ duration: 70 });
    await ok("setMatchDuration", scorer, { matchId: next, minutes: 55 });
    assert.equal((await get(`matchDrafts/${next}`)).duration, 70); checked++;
    await db.doc(`matchDrafts/${next}`).delete();
  }
  await denied("setMatchDuration", scorer, { matchId: next, minutes: 5 }, "INVALID_ARGUMENT");
  r = await ok("setMatchDuration", scorer, { matchId: next, minutes: 60 });
  assert.equal((await get(`matches/${next}`)).duration, 60); checked++;

  // ---- M-07 «Recordar ahora»: to the convocados who haven't answered, once every 30 min
  await denied("remindNow", member, { matchId: next }, "PERMISSION_DENIED");
  await db.doc(`matchPrivate/${next}/availability/${member.uid}`).set({ response: "yes", name: "socio", playerId: ids[1], at: Timestamp.now() });
  // ids[0] is the scorer's ficha (inside); ids[3] is linked to someone removed: never reminded
  await db.doc(`playerLinks/${ids[0]}`).set({ uid: scorer.uid });
  const removedOne = `${suffix}-removed`;
  people.push(removedOne);
  await db.doc(`playerLinks/${ids[3]}`).set({ uid: removedOne });
  await db.doc(`users/${removedOne}`).set({ role: "user", nickname: "quitado", removedAt: Timestamp.now(), removedBy: admin.uid });
  r = await ok("remindNow", admin, { matchId: next });
  assert.equal(r.missing, 7); assert.equal(r.sent, 1); checked += 2; // (ids 0, 2–7, never the guest; only ids[0] has an account inside)
  const toScorer = await db.collection("notices").where("uid", "==", scorer.uid).where("audience", "==", "personal").get();
  assert.ok(toScorer.docs.some((d) => d.get("url") === `/partidos/${next}/vestuario`)); checked++;
  assert.equal((await db.collection("notices").where("uid", "==", removedOne).get()).size, 0); checked++;
  await denied("remindNow", admin, { matchId: next }, "RESOURCE_EXHAUSTED", /min/);
  await denied("remindNow", admin, { matchId: acta }, "FAILED_PRECONDITION", /ya no se juega/);
  const sentNow = await db.collection("pushSent").where("matchId", "==", next).get();
  const manual = sentNow.docs.filter((d) => d.get("kind") === "manual" && d.get("audience") === "convocados" && d.get("by") === admin.uid);
  assert.equal(manual.length, 1); assert.equal(manual[0].get("members"), 1); checked += 2;
  // everyone answered: nothing to remind
  await db.doc(`pushLog/remind-now-${next}`).delete();
  for (const pid of [ids[0], ...ids.slice(2, 8)]) await db.doc(`matchPrivate/${next}/availability/a-${pid}`).set({ response: "no", name: pid, playerId: pid, at: Timestamp.now() });
  await denied("remindNow", admin, { matchId: next }, "FAILED_PRECONDITION", /contestaron todos/);
  await db.doc(`playerLinks/${ids[0]}`).delete();
  await db.doc(`playerLinks/${ids[3]}`).delete();

  // ---- M-18 «Mandar un aviso a mano»
  await denied("sendCaptainNotice", admin, { text: "  ", audience: "todos" }, "INVALID_ARGUMENT", /Escribe/);
  await denied("sendCaptainNotice", admin, { text: "Hola", audience: "convocados" }, "INVALID_ARGUMENT", /partido/);
  await denied("sendCaptainNotice", admin, { text: "Hola", audience: "convocados", matchId: `${suffix}-nope` }, "FAILED_PRECONDITION", /convocatoria/);
  r = await ok("sendCaptainNotice", admin, { text: "Mañana cambiamos de campo", audience: "todos" });
  assert.ok(r.members >= 5); assert.equal(r.devices, 0); checked += 2;
  await denied("sendCaptainNotice", admin, { text: "Otra vez", audience: "capitanes" }, "RESOURCE_EXHAUSTED");
  const kept = await db.collection("notices").where("audience", "==", "team").where("title", "==", "Aviso de la capitanía").get();
  assert.ok(kept.docs.some((d) => d.get("body") === "Mañana cambiamos de campo")); checked++;
  r = await ok("sendCaptainNotice", other, { text: "Para la capitanía", audience: "capitanes" });
  assert.ok(r.members >= 3); checked++;
  // (12) the team: only who is inside the vestuario
  {
    const inside = (await db.collection("teamMembers").where("expiresAt", ">", new Date()).get()).size;
    r = await ok("sendCaptainNotice", general, { text: "Solo los de dentro", audience: "todos" });
    assert.ok(Math.abs(r.members - inside) <= 1); checked++;
  }

  // ---- M-41: a guest promoted to his ficha (a draft and a published acta)
  const g = `${suffix}-rafa`;
  created.players.push(g);
  const guestActa = m("guest-acta");
  created.matches.push(guestActa);
  await ok("saveMatchSheet", admin, { id: guestActa, sheet: sheet({ starters: [...ids.slice(0, 6), "guest:g1"], bench: ids.slice(6), guests: [{ id: "g1", name: "Rafa" }], events: [{ id: "g1e", type: "goal", playerId: "guest:g1", assistPlayerId: ids[1], assistReviewed: true, minute: 3 }] }) });
  await db.doc(`players/${g}`).set({ firstName: "Rafa", seasons: [] });
  await denied("promoteGuest", admin, { playerId: g, guests: [{ matchId: guestActa, guestId: "g2" }] }, "NOT_FOUND");
  r = await ok("promoteGuest", admin, { playerId: g, guests: [{ matchId: guestActa, guestId: "g1" }] });
  assert.deepEqual(r, { matches: 1, seasons: [seasonId] }); checked++;
  doc = await get(`matches/${guestActa}`);
  assert.ok(doc.starters.includes(g)); assert.ok(!doc.starters.includes("guest:g1")); assert.deepEqual(doc.guests, []); checked += 3;
  assert.equal(doc.events[0].playerId, g); assert.equal(doc.ledger[g].goals, 1); checked += 2;
  assert.deepEqual((await get(`players/${g}`)).seasons, [seasonId]); checked++;
  {
    // a retry (the same match again, plus a draft): the done one is left as it is, the draft takes him
    const guestDraft = m("guest-draft");
    created.matches.push(guestDraft);
    await db.doc(`matchDrafts/${guestDraft}`).set({ seasonId, rival: "Borrador r12", status: "scheduled", guests: [{ id: "g1", name: "Rafa" }], starters: ["guest:g1"], bench: [], events: [], revision: 0 });
    const before = (await get(`matches/${guestActa}`)).revision;
    r = await ok("promoteGuest", admin, { playerId: g, guests: [{ matchId: guestActa, guestId: "g1" }, { matchId: guestDraft, guestId: "g1" }] });
    assert.equal(r.matches, 2); checked++;
    assert.equal((await get(`matches/${guestActa}`)).revision, before, "done before: not published again"); checked++;
    const gd = await get(`matchDrafts/${guestDraft}`);
    assert.deepEqual(gd.starters, [g]); assert.deepEqual(gd.guests, []); checked += 2;
    // one match that can't take it (its guest is gone): nothing is written, not even his seasons
    const third = m("guest-third");
    created.matches.push(third);
    const g2 = `${suffix}-leo`;
    created.players.push(g2);
    await db.doc(`players/${g2}`).set({ firstName: "Leo", seasons: [] });
    await db.doc(`matchDrafts/${third}`).set({ seasonId, rival: "Otro r12", status: "scheduled", guests: [{ id: "g1", name: "Leo" }], starters: ["guest:g1"], bench: [], events: [], revision: 0 });
    await denied("promoteGuest", admin, { playerId: g2, guests: [{ matchId: third, guestId: "g1" }, { matchId: guestActa, guestId: "g4" }] }, "NOT_FOUND");
    assert.deepEqual((await get(`players/${g2}`)).seasons, []); assert.deepEqual((await get(`matchDrafts/${third}`)).starters, ["guest:g1"]); checked += 2;
  }

  // ---- M-13 · B-CLUB-02/03: quitar el acceso frees the ficha and the brazalete
  await db.doc(`users/${member.uid}`).update({ role: "admin" });
  // M-40: taking a captain's access takes his brazalete: only the capitán general
  await denied("revokeMember", admin, { uid: member.uid }, "PERMISSION_DENIED", /capitán general/);
  r = await ok("revokeMember", general, { uid: member.uid });
  assert.equal(r.freed, ids[1]); assert.equal(r.wasCaptain, true); checked += 2;
  assert.equal((await get(`users/${member.uid}`)).removedBy, general.uid); checked++;
  const gone = await get(`users/${member.uid}`);
  assert.equal(gone.role, "user"); assert.equal(gone.playerId, undefined); assert.ok(gone.removedAt); checked += 3;
  assert.equal((await db.doc(`playerLinks/${ids[1]}`).get()).exists, false); checked++;
  // a link left behind by an older removal: free at the door, for a claim and in «¿Quién eres?»
  const ghost = `${suffix}-ghost`;
  people.push(ghost);
  await db.doc(`users/${ghost}`).set({ role: "admin", nickname: "ghost", playerId: ids[2], removedAt: Timestamp.now(), removedBy: other.uid });
  await db.doc(`playerLinks/${ids[2]}`).set({ uid: ghost });
  assert.ok(!(await ok("doorShirts", null, null)).taken.includes(ids[2])); checked++;
  await ok("requestPlayerClaim", scorer, { playerId: ids[2] });
  await ok("resolvePlayerClaim", admin, { uid: scorer.uid, approve: true });
  assert.equal((await get(`playerLinks/${ids[2]}`)).uid, scorer.uid); assert.equal((await get(`users/${ghost}`)).playerId, undefined); checked += 2;
  // (4) someone who left on his own keeps his ficha — and so does a removal from before the stamp
  {
    const leaver = await google("leaver");
    people.push(leaver.uid);
    await db.doc(`users/${leaver.uid}`).set({ role: "admin", nickname: `leaver-${suffix}`.slice(0, 30), playerId: ids[4] });
    await db.doc(`teamMembers/${leaver.uid}`).set({ expiresAt: Timestamp.fromMillis(Date.now() + HOUR) });
    await db.doc(`playerLinks/${ids[4]}`).set({ uid: leaver.uid });
    await ok("leaveVestuario", leaver, { confirm: true });
    assert.equal((await get(`users/${leaver.uid}`)).removedBy, leaver.uid); checked++;
    assert.ok((await ok("doorShirts", null, null)).taken.includes(ids[4])); checked++;
    await denied("requestPlayerClaim", other, { playerId: ids[4] }, "ALREADY_EXISTS");
    const legacy = `${suffix}-legacy`;
    people.push(legacy);
    await db.doc(`users/${legacy}`).set({ role: "user", nickname: "legacy", playerId: ids[5], removedAt: Timestamp.now() });
    await db.doc(`playerLinks/${ids[5]}`).set({ uid: legacy });
    assert.ok((await ok("doorShirts", null, null)).taken.includes(ids[5])); checked++;
    await denied("requestPlayerClaim", other, { playerId: ids[5] }, "ALREADY_EXISTS");
    // he comes back with his role (he wasn't removed)
    assert.equal((await ok("requestAccess", leaver, { name: "Vuelvo" })).status, "pending"); checked++;
    await ok("resolveAccess", admin, { uid: leaver.uid, approve: true });
    assert.equal((await get(`users/${leaver.uid}`)).role, "admin"); checked++;
    await db.doc(`playerLinks/${ids[4]}`).delete();
    await db.doc(`playerLinks/${ids[5]}`).delete();
    // a captain removed before r12 (no stamp) asks again: back as a socio (B-CLUB-03), his ficha still his
    const oldCap = await google("oldcap");
    people.push(oldCap.uid);
    await db.doc(`users/${oldCap.uid}`).set({ role: "admin", nickname: `oldcap-${suffix}`.slice(0, 30), playerId: ids[6], removedAt: Timestamp.now() });
    await db.doc(`playerLinks/${ids[6]}`).set({ uid: oldCap.uid });
    assert.equal((await ok("requestAccess", oldCap, { name: "Vuelvo" })).status, "pending"); checked++;
    await ok("resolveAccess", admin, { uid: oldCap.uid, approve: true });
    const back = await get(`users/${oldCap.uid}`);
    assert.equal(back.role, "user"); assert.equal(back.playerId, ids[6]); assert.equal((await get(`playerLinks/${ids[6]}`)).uid, oldCap.uid); checked += 3;
    await db.doc(`playerLinks/${ids[6]}`).delete();
  }
  // the removed captain asks again and comes back as a socio
  assert.equal((await ok("requestAccess", member, { name: "Socio" })).status, "pending"); checked++;
  // (a role left as it was: he still comes back as a socio, removed by a captain)
  await db.doc(`users/${member.uid}`).update({ role: "admin" });
  await ok("resolveAccess", admin, { uid: member.uid, approve: true });
  assert.equal((await get(`users/${member.uid}`)).role, "user"); checked++;

  // ---- B-CLUB-01: deleting a season gives its players back (callable and a direct delete)
  await db.doc(`seasons/${oldSeason}`).set({ name: "r12 · antigua", archived: true });
  const only = `${suffix}-only`, both = `${suffix}-both`, direct = `${suffix}-direct`;
  created.players.push(only, both, direct);
  await db.doc(`players/${only}`).set({ firstName: "Solo", seasons: [oldSeason], archived: true, seasonDetails: { [oldSeason]: { number: 9 }, keep: { number: 4 } } });
  const oldMatch = m("old-match");
  created.matches.push(oldMatch);
  await db.doc(`matches/${oldMatch}`).set({ seasonId: oldSeason, rival: "Antiguo", status: "finished", archived: true, individuallyArchived: true, date: Timestamp.fromMillis(Date.now() - 400 * 86_400_000), revision: 1 });
  await db.doc(`players/${both}`).set({ firstName: "Dos", seasons: [oldSeason, seasonId] });
  await denied("deleteSeason", member, { seasonId: oldSeason }, "PERMISSION_DENIED");
  await denied("deleteSeason", admin, { seasonId }, "FAILED_PRECONDITION", /Archiva/);
  r = await ok("deleteSeason", admin, { seasonId: oldSeason });
  assert.equal(r.players, 1); checked++;
  assert.equal((await db.doc(`seasons/${oldSeason}`).get()).exists, false); checked++;
  let p = await get(`players/${only}`);
  assert.deepEqual(p.seasons, []); assert.equal(p.archived, undefined); assert.deepEqual(p.seasonDetails, { keep: { number: 4 } }); checked += 3;
  assert.deepEqual((await get(`players/${both}`)).seasons, [seasonId]); checked++;
  // its matches stay archived: without a season, none can be restored
  await denied("setMatchArchived", admin, { id: oldMatch, archived: false }, "FAILED_PRECONDITION", /se eliminó/);
  assert.equal((await get(`matches/${oldMatch}`)).archived, true); checked++;
  // the web of today deletes the document itself: the trigger does the same
  await db.doc(`seasons/${oldSeason}`).set({ name: "r12 · antigua", archived: true });
  await db.doc(`players/${direct}`).set({ firstName: "Directo", seasons: [oldSeason], archived: true });
  await db.doc(`seasons/${oldSeason}`).delete();
  await eventually(async () => {
    p = await get(`players/${direct}`);
    assert.deepEqual(p.seasons, []);
    assert.equal(p.archived, undefined);
  });
  checked++;

  // ---- M-33: the rival's goal waits (10 s in production, 2 s in the emulator); undone meanwhile, nothing goes
  const live = m("live");
  created.matches.push(live);
  await ok("saveMatchSheet", admin, { id: live, sheet: sheet({ status: "scheduled", date: Date.now() + HOUR, events: [], goalsFor: undefined, goalsAgainst: undefined }) });
  let lm = await get(`matches/${live}`);
  await ok("controlMatchClock", admin, { matchId: live, action: "start", revision: lm.clock?.revision ?? 0 });
  lm = await get(`matches/${live}`);
  const add = (requestId, type) => ({ action: "add", matchId: live, requestId, clockRevision: lm.clock.revision, event: { type, minute: 0 } });
  await ok("liveEvent", admin, add("og1", "opponent_goal"));
  await ok("liveEvent", admin, { action: "undo", matchId: live, eventId: "live-og1" });
  // our goal is told at once; the rival's waits at least the emulator's 2 s from its write
  const tOurs = Date.now();
  await ok("liveEvent", admin, { ...add("g1", "goal"), event: { type: "goal", minute: 0, playerId: ids[0] } });
  await eventually(async () => assert.ok((await db.doc(`pushLog/goal-${live}-live-g1`).get()).exists), 80);
  const tTheirs = Date.now();
  await ok("liveEvent", admin, add("og2", "opponent_goal"));
  let seen = 0;
  await eventually(async () => {
    assert.ok((await db.doc(`pushLog/goal-${live}-live-og2`).get()).exists);
    seen = Date.now();
  }, 80);
  assert.ok(seen - tTheirs >= 1900, `held: told ${seen - tTheirs} ms after its write`); checked++;
  assert.ok(tTheirs - tOurs < 15_000); checked++;
  assert.equal((await db.doc(`pushLog/goal-${live}-live-og1`).get()).exists, false, "undone within the wait: never told"); checked++;
  assert.equal((await db.doc(`pushLog/goal-off-${live}-live-og1`).get()).exists, false); checked++;
  // (7) a rival goal right before the final whistle: the whistle during its wait doesn't silence it
  lm = await get(`matches/${live}`);
  await ok("liveEvent", admin, add("og3", "opponent_goal"));
  await ok("controlMatchClock", admin, { matchId: live, action: "finish", revision: lm.clock.revision });
  await eventually(async () => assert.ok((await db.doc(`pushLog/goal-${live}-live-og3`).get()).exists), 80);
  checked++;
  // B-MESA-01 through the callable: reopening after a while in Final carries on from the whistle
  await wait(2500);
  lm = await get(`matches/${live}`);
  const before = lm.durationSeconds;
  const endedAt = lm.clock.endedAt;
  await ok("controlMatchClock", admin, { matchId: live, action: "reopen", revision: lm.clock.revision });
  lm = await get(`matches/${live}`);
  assert.equal(lm.clock.pauses.at(-1).from, endedAt); assert.ok(lm.clock.pauses.at(-1).to - endedAt >= 2000); checked += 2;
  await ok("controlMatchClock", admin, { matchId: live, action: "finish", revision: lm.clock.revision });
  assert.ok((await get(`matches/${live}`)).durationSeconds - before <= 1, "the minutes in Final never count"); checked++;

  console.log(`r12: ${checked} comprobaciones del servidor de la sala y la mesa.`);
} finally {
  await wait(1500);
  const del = (refs) => Promise.all(refs.map((ref) => ref.delete()));
  for (const id of created.matches) {
    await del((await db.collection("matchAudit").where("matchId", "==", id).get()).docs.map((d) => d.ref));
    await del((await db.collection("pushLog").where("matchId", "==", id).get()).docs.map((d) => d.ref));
    await del((await db.collection("pushSent").where("matchId", "==", id).get()).docs.map((d) => d.ref));
    for (const sub of ["votes"]) await del((await db.doc(`matches/${id}`).collection(sub).get()).docs.map((d) => d.ref));
    for (const sub of ["predictions", "availability"]) await del((await db.doc(`matchPrivate/${id}`).collection(sub).get()).docs.map((d) => d.ref));
    await del([`matches/${id}`, `matchDrafts/${id}`, `matchPrivate/${id}`, `mvpResults/${id}`, `rotaTurns/${id}`].map((p) => db.doc(p)));
  }
  await del((await db.collection("playerSeasonStats").where("seasonId", "==", seasonId).get()).docs.map((d) => d.ref));
  await del(created.players.flatMap((id) => [db.doc(`players/${id}`), db.doc(`playerLinks/${id}`)]));
  await del(created.seasons.flatMap((id) => [db.doc(`seasons/${id}`), db.doc(`porraStandings/${id}`)]));
  await del(people.flatMap((uid) => [db.doc(`users/${uid}`), db.doc(`teamMembers/${uid}`), db.doc(`accessRequests/${uid}`), db.doc(`playerClaims/${uid}`), db.doc(`pushLog/manual-${uid}`)]));
  await db.terminate();
}
