// Run only with the demo emulators. No production credentials or endpoints.
// One «siete» per match (M6): «Ya está el siete» (pushOnLineup) and the convocatoria's notice
// (setConvocatoria) never both tell the team the same seven within 10 minutes — pushLog/siete-<match> is
// the proof of who told it. Publishing the official with «Usar este siete como convocatoria» (fromBoard)
// leaves the telling to the board's notice, whatever order the trigger and the call run in. Nobody is
// subscribed while this runs, so nothing is signed or sent.
import assert from "node:assert/strict";
process.env.FIRESTORE_EMULATOR_HOST = "127.0.0.1:8080";
process.env.FIREBASE_AUTH_EMULATOR_HOST = "127.0.0.1:9099";
// (the demo project, whatever the shell's GCP variables say)
process.env.GCLOUD_PROJECT = "demo-manchester-piti";
process.env.GOOGLE_CLOUD_PROJECT = "demo-manchester-piti";
// (the job's flushSevens, run here against the emulator: lib/common.js initializes the default app, and
// with FUNCTIONS_EMULATOR it keeps the gRPC client — its REST one would look for real credentials)
process.env.FUNCTIONS_EMULATOR = "true";
const { flushSevens } = await import("../lib/seven.js");
const { getApps, initializeApp } = await import("firebase-admin/app");
const { getFirestore, Timestamp, FieldValue } = await import("firebase-admin/firestore");
if (!getApps().length) initializeApp({ projectId: "demo-manchester-piti" });
const db = getFirestore();

const suffix = Date.now().toString(36);
let checked = 0;
const sleep = (ms) => new Promise((ok) => setTimeout(ok, ms));

async function google(label) {
  const email = label + "-" + suffix + "@example.test";
  const encode = (o) => Buffer.from(JSON.stringify(o)).toString("base64url");
  const token =
    encode({ alg: "none", typ: "JWT" }) +
    "." +
    encode({ sub: label + "-" + suffix, email, email_verified: true, name: label, aud: "demo", iss: "https://accounts.google.com" }) +
    ".";
  const response = await fetch("http://127.0.0.1:9099/identitytoolkit.googleapis.com/v1/accounts:signInWithIdp?key=demo", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ postBody: new URLSearchParams({ id_token: token, providerId: "google.com" }).toString(), requestUri: "http://localhost", returnSecureToken: true }),
  });
  const data = await response.json();
  assert.ok(data.idToken, JSON.stringify(data));
  return { token: data.idToken, uid: data.localId, email };
}
async function setConvocatoria(user, data) {
  const response = await fetch("http://127.0.0.1:5001/demo-manchester-piti/europe-southwest1/setConvocatoria", {
    method: "POST",
    headers: { "content-type": "application/json", authorization: "Bearer " + user.token },
    body: JSON.stringify({ data }),
  });
  const body = await response.json();
  assert.ok(!body.error, JSON.stringify(body));
  checked++;
  return body.result;
}
const log = async (id) => {
  const s = await db.doc("pushLog/" + id).get();
  return s.exists ? s.data() : null;
};
/** Waits for a trigger to claim pushLog/<id>. */
async function claimed(id) {
  for (let i = 0; i < 80; i++) {
    const d = await log(id);
    if (d) {
      checked++;
      return d;
    }
    await sleep(250);
  }
  assert.fail("pushLog/" + id + " did not appear");
}
/** Waits until pushLog/siete-<match> says a board's notice (that `board`'s, when given) went. */
async function sieteSent(mid, board = null) {
  for (let i = 0; i < 80; i++) {
    const d = await log("siete-" + mid);
    if (d?.sent === true && d.by === "lineup" && (!board || d.board === board)) {
      checked++;
      return d;
    }
    await sleep(250);
  }
  assert.fail("pushLog/siete-" + mid + " was never marked sent: " + JSON.stringify(await log("siete-" + mid)));
}

// ---------- the club: an admin, a season with nine players, matches to be played
const admin = await google("siete-admin");
await db.doc("users/" + admin.uid).set({ role: "admin", nickname: "sieteadmin" + suffix, email: admin.email });
await db.doc("teamMembers/" + admin.uid).set({ expiresAt: Timestamp.fromMillis(Date.UTC(2200, 0, 1)) });
const seasonId = "siete-season-" + suffix;
await db.doc("seasons/" + seasonId).set({ name: "Un solo siete · pruebas" });
const ids = Array.from({ length: 9 }, (_, i) => `siete-p${i}-${suffix}`);
await Promise.all(ids.map((id, i) => db.doc("players/" + id).set({ firstName: "Jugador" + i, seasons: [seasonId] })));
const seven = ids.slice(0, 7);
const otherSeven = [...ids.slice(0, 6), ids[7]];
const slots = (pids) => pids.map((playerId, i) => ({ id: "s" + i, playerId, x: 50, y: 10 + i * 10 }));
const matchOf = async (tag) => {
  const mid = `siete-${tag}-${suffix}`;
  await db.doc("matches/" + mid).set({ seasonId, rival: "Rival " + tag, status: "scheduled", date: Timestamp.fromMillis(Date.now() + 3 * 86_400_000), revision: 1 });
  return mid;
};
const boardOf = async (tag, pids) => {
  const bid = `siete-board-${tag}-${suffix}`;
  await db.doc("lineups/" + bid).set({ ownerUid: admin.uid, ownerNickname: "sieteadmin" + suffix, seasonId, name: "Tablero " + tag, isOfficial: false, matchId: null, formation: "2-3-1", slots: slots(pids) });
  return bid;
};
/** The pizarra's publish (useLineups.publishOfficial): the board official for the match + its scope doc, at once. */
const publish = async (bid, mid, unmark = null) => {
  const batch = db.batch();
  // (the official it replaces stops being one in the same write, as publishOfficial does)
  if (unmark) batch.update(db.doc("lineups/" + unmark), { isOfficial: false, updatedAt: FieldValue.serverTimestamp() });
  batch.update(db.doc("lineups/" + bid), { isOfficial: true, matchId: mid, updatedAt: FieldValue.serverTimestamp() });
  batch.set(db.doc(`lineupOfficials/${seasonId}__${mid}`), { lineupId: bid, seasonId, matchId: mid, at: FieldValue.serverTimestamp() });
  await batch.commit();
};
/** «Quitar el oficial»: the board stops being official and its scope doc goes. */
const unpublish = async (bid, mid) => {
  const batch = db.batch();
  batch.update(db.doc("lineups/" + bid), { isOfficial: false, updatedAt: FieldValue.serverTimestamp() });
  batch.delete(db.doc(`lineupOfficials/${seasonId}__${mid}`));
  await batch.commit();
};

// ---------- 1. Publish + «Usar este siete como convocatoria»: the call right after the publish (racing
// its trigger). One notice: «Ya está el siete»; the convocatoria is set and counts as announced.
const m1 = await matchOf("uno");
const b1 = await boardOf("uno", seven);
await publish(b1, m1);
const r1 = await setConvocatoria(admin, { matchId: m1, starters: seven, bench: ids.slice(7), notify: true, fromBoard: b1 });
assert.equal(r1.notice, null);
assert.equal(r1.covered, true);
const conv1 = (await db.doc("matches/" + m1).get()).data();
assert.deepEqual(conv1.starters, seven);
assert.deepEqual(conv1.bench, ids.slice(7));
assert.deepEqual(conv1.notCalled, []);
assert.equal(conv1.convocatoriaNotifiedAt, r1.at);
assert.equal((await log("conv-" + m1))?.quiet, "siete", "the convocatoria counts as announced, its notice quiet");
checked += 6;
await claimed(`lineup-${b1}-${m1}`);
const s1 = await sieteSent(m1);
assert.equal(s1.by, "lineup");
assert.equal(s1.board, b1);
assert.equal((await log(`lineup-${b1}-${m1}`))?.quiet, undefined, "«Ya está el siete» went");
checked += 3;
// «Convocar y avisar» again a moment later: nothing new (the same seven, already announced)
const again1 = await setConvocatoria(admin, { matchId: m1, starters: seven, bench: ids.slice(7), notify: true });
assert.equal(again1.notice, null);
checked++;

// ---------- 2. The trigger runs first, then the call (fromBoard): still one notice, nothing overwritten.
const m2 = await matchOf("dos");
const b2 = await boardOf("dos", seven);
await publish(b2, m2);
await claimed(`lineup-${b2}-${m2}`);
const s2 = await sieteSent(m2);
const r2 = await setConvocatoria(admin, { matchId: m2, starters: seven, bench: [], notify: true, fromBoard: b2 });
assert.equal(r2.covered, true);
assert.equal(r2.notice, null);
assert.deepEqual(await log("siete-" + m2), s2);
checked += 3;

// ---------- 3. «Convocar y avisar» from Convocar (no board) minutes after «Ya está el siete», the same
// seven (another order): covered; another seven: «Ya está la convocatoria» goes.
const m3 = await matchOf("tres");
const b3 = await boardOf("tres", seven);
await publish(b3, m3);
await sieteSent(m3);
const covered3 = await setConvocatoria(admin, { matchId: m3, starters: [...seven].reverse(), bench: [ids[7]], notify: true });
assert.equal(covered3.covered, true);
assert.equal(covered3.notice, null);
checked += 2;
const m4 = await matchOf("cuatro");
const b4 = await boardOf("cuatro", seven);
await publish(b4, m4);
await sieteSent(m4);
const sent4 = await setConvocatoria(admin, { matchId: m4, starters: otherSeven, bench: [], notify: true });
assert.equal(sent4.notice, "first");
assert.equal(sent4.covered, false);
const s4 = await log("siete-" + m4);
assert.equal(s4.by, "conv");
checked += 3;

// ---------- 4. The convocatoria told the seven first; the official with that seven published minutes
// later: its «Ya está el siete» stays quiet (its own claim is the proof the trigger ran).
const m5 = await matchOf("cinco");
const first5 = await setConvocatoria(admin, { matchId: m5, starters: seven, bench: [], notify: true });
assert.equal(first5.notice, "first");
const s5 = await log("siete-" + m5);
assert.equal(s5.by, "conv");
checked += 2;
const b5 = await boardOf("cinco", [...seven].reverse());
await publish(b5, m5);
await claimed(`lineup-${b5}-${m5}`);
for (let i = 0; i < 40 && (await log(`lineup-${b5}-${m5}`))?.quiet !== "siete"; i++) await sleep(250);
assert.equal((await log(`lineup-${b5}-${m5}`))?.quiet, "siete", "«Ya está el siete» stayed quiet");
assert.deepEqual(await log("siete-" + m5), s5, "the board's notice did not claim the siete");
checked += 2;

// ---------- 5. fromBoard that doesn't cover: a board that isn't the match's official, or whose notice
// went long ago — the convocatoria's own notice goes.
const m6 = await matchOf("seis");
const b6 = await boardOf("seis", seven);
const r6 = await setConvocatoria(admin, { matchId: m6, starters: seven, bench: [], notify: true, fromBoard: b6 });
assert.equal(r6.notice, "first");
assert.equal(r6.covered, false);
checked += 2;
const m7 = await matchOf("siete");
const b7 = await boardOf("siete", seven);
await db.doc(`pushLog/lineup-${b7}-${m7}`).set({ at: Timestamp.fromMillis(Date.now() - 3600_000) });
await publish(b7, m7);
await sleep(1500);
const r7 = await setConvocatoria(admin, { matchId: m7, starters: seven, bench: [], notify: true, fromBoard: b7 });
assert.equal(r7.notice, "first");
assert.equal(r7.covered, false);
checked += 2;

// ---------- 6. A convocatoria notice is never covered by another one: a bench-only change announced
// right after «Ya está la convocatoria» (same seven, within 10 minutes) — «Cambios» goes.
const m8 = await matchOf("ocho");
assert.equal((await setConvocatoria(admin, { matchId: m8, starters: seven, bench: [ids[7]], notify: true })).notice, "first");
const bench8 = await setConvocatoria(admin, { matchId: m8, starters: seven, bench: [ids[7], ids[8]], notify: true });
assert.equal(bench8.notice, "changes");
assert.equal(bench8.covered, false);
assert.ok(await log("conv-" + m8 + "-cambios"));
checked += 3;

// ---------- 7. «Cambios» that only change who starts, right after «Ya está el siete» of that seven: quiet,
// and its once-per-match slot is NOT taken — a later real change (someone newly called) is announced.
const m9 = await matchOf("nueve");
const b9 = await boardOf("nueve", seven);
await publish(b9, m9);
await sieteSent(m9);
assert.equal((await setConvocatoria(admin, { matchId: m9, starters: seven, bench: [ids[7]], notify: true, fromBoard: b9 })).covered, true);
const b9b = await boardOf("nueve-b", otherSeven);
await publish(b9b, m9, b9);
const s9 = await sieteSent(m9, b9b);
assert.equal(s9.seven, [...otherSeven].sort().join(","));
const quiet9 = await setConvocatoria(admin, { matchId: m9, starters: otherSeven, bench: [ids[6]], notify: true });
assert.equal(quiet9.notice, null);
assert.equal(quiet9.covered, true);
assert.equal(await log("conv-" + m9 + "-cambios"), null, "a quiet «Cambios» keeps its slot");
checked += 4;
const real9 = await setConvocatoria(admin, { matchId: m9, starters: otherSeven, bench: [ids[6], ids[8]], notify: true });
assert.equal(real9.notice, "changes");
assert.ok(await log("conv-" + m9 + "-cambios"));
checked += 2;

// ---------- 8. The same board published with S1, unpublished and republished with S2 within 10 minutes:
// its «Ya está el siete» went for S1 and won't go again — the convocatoria tells the team S2.
const m10 = await matchOf("diez");
const b10 = await boardOf("diez", seven);
await publish(b10, m10);
await sieteSent(m10);
assert.equal((await setConvocatoria(admin, { matchId: m10, starters: seven, bench: [ids[7]], notify: true, fromBoard: b10 })).covered, true);
await unpublish(b10, m10);
await db.doc("lineups/" + b10).update({ slots: slots(otherSeven) });
await sleep(1100);
await publish(b10, m10);
await sleep(1500);
const r10 = await setConvocatoria(admin, { matchId: m10, starters: otherSeven, bench: [ids[6]], notify: true, fromBoard: b10 });
assert.equal(r10.notice, "changes");
assert.equal(r10.covered, false);
assert.equal((await log("siete-" + m10)).by, "conv");
checked += 3;

// ---------- 9. «Cambio en el siete» of a match's official tells the team that seven too: it takes the
// claim, and a convocatoria «Cambios» right after with that seven (the same players called) stays quiet.
// a) sent at once by the trigger (its 10-minute window over)
const sieteKeyOf = (pids) => [...pids].sort().join(",");
async function sieteIs(mid, pids, board) {
  for (let i = 0; i < 80; i++) {
    const d = await log("siete-" + mid);
    if (d?.sent === true && d.by === "lineup" && d.board === board && d.seven === sieteKeyOf(pids)) {
      checked++;
      return d;
    }
    await sleep(250);
  }
  assert.fail("pushLog/siete-" + mid + " never took the changed seven: " + JSON.stringify(await log("siete-" + mid)));
}
const m11 = await matchOf("once");
const b11 = await boardOf("once", seven);
await publish(b11, m11);
// (the board's notice is a trigger: wait for its claim before convocar, as a captain always comes after it)
await sieteSent(m11, b11);
assert.equal((await setConvocatoria(admin, { matchId: m11, starters: seven, bench: [ids[7]], notify: true, fromBoard: b11 })).covered, true);
await db.doc("pushLog/seven-" + b11).update({ sentAt: Date.now() - 11 * 60_000 });
await db.doc("lineups/" + b11).update({ slots: slots(otherSeven), updatedAt: FieldValue.serverTimestamp() });
await sieteIs(m11, otherSeven, b11);
const quiet11 = await setConvocatoria(admin, { matchId: m11, starters: otherSeven, bench: [ids[6]], notify: true });
assert.equal(quiet11.notice, null, "«Cambio en el siete» already told this seven");
assert.equal(quiet11.covered, true);
checked += 3;
// b) held (within the window) and sent by the job (flushSevens): same claim, the link to the match's Campo
const m12 = await matchOf("doce");
const b12 = await boardOf("doce", seven);
await publish(b12, m12);
await sieteSent(m12, b12);
assert.equal((await setConvocatoria(admin, { matchId: m12, starters: seven, bench: [ids[7]], notify: true, fromBoard: b12 })).covered, true);
await db.doc("lineups/" + b12).update({ slots: slots(otherSeven), updatedAt: FieldValue.serverTimestamp() });
for (let i = 0; i < 80 && (await log("seven-" + b12))?.pending !== true; i++) await sleep(250);
assert.equal((await log("seven-" + b12))?.pending, true, "the change right after the publish waits for the job");
await db.doc("pushLog/seven-" + b12).update({ sentAt: Date.now() - 11 * 60_000 });
const flushed = [];
await flushSevens(Date.now(), async (n) => {
  flushed.push(n);
});
const change12 = flushed.find((n) => n.tag === "seven-" + b12);
assert.ok(change12, "the job sent «Cambio en el siete»");
assert.equal(change12.url, "/partidos/" + m12 + "/siete");
await sieteIs(m12, otherSeven, b12);
const quiet12 = await setConvocatoria(admin, { matchId: m12, starters: otherSeven, bench: [ids[6]], notify: true });
assert.equal(quiet12.notice, null);
assert.equal(quiet12.covered, true);
checked += 6;

// (cleanup)
const mids = [m1, m2, m3, m4, m5, m6, m7, m8, m9, m10, m11, m12];
const bids = [b1, b2, b3, b4, b5, b6, b7, b9, b9b, b10, b11, b12];
for (const mid of mids) {
  await db.doc("matches/" + mid).delete();
  await db.doc(`lineupOfficials/${seasonId}__${mid}`).delete();
  for (const id of ["siete-" + mid, "conv-" + mid, "conv-" + mid + "-cambios", ...bids.map((b) => `lineup-${b}-${mid}`)]) await db.doc("pushLog/" + id).delete();
}
for (const b of bids) {
  await db.doc("lineups/" + b).delete();
  await db.doc("pushLog/seven-" + b).delete();
}
await Promise.all(ids.map((id) => db.doc("players/" + id).delete()));
await db.doc("seasons/" + seasonId).delete();

console.log(checked + " comprobaciones de un solo siete correctas: la pizarra y la convocatoria nunca avisan dos veces del mismo siete.");
await db.terminate();
