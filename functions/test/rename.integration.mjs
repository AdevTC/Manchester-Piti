// Run only with the demo emulators. No production credentials or endpoints.
// A member's new handle reaches every copy signed with the old one (renameEverywhere, M7): rename through
// the real setNickname callable, wait for the trigger, and check each copy — and that another member's
// copies and the vestuario's own posts are left as they were. Two renames in a row: the last one wins.
import assert from "node:assert/strict";
process.env.FIRESTORE_EMULATOR_HOST = "127.0.0.1:8080";
process.env.FIREBASE_AUTH_EMULATOR_HOST = "127.0.0.1:9099";
// (the demo project, whatever the shell's GCP variables say)
process.env.GCLOUD_PROJECT = "demo-manchester-piti";
process.env.GOOGLE_CLOUD_PROJECT = "demo-manchester-piti";
const { initializeApp } = await import("firebase-admin/app");
const { getFirestore, Timestamp } = await import("firebase-admin/firestore");
initializeApp({ projectId: "demo-manchester-piti" });
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
  return { token: data.idToken, uid: data.localId };
}
async function rename(user, nickname) {
  const response = await fetch("http://127.0.0.1:5001/demo-manchester-piti/europe-southwest1/setNickname", {
    method: "POST",
    headers: { "content-type": "application/json", authorization: "Bearer " + user.token },
    body: JSON.stringify({ data: { nickname } }),
  });
  const body = await response.json();
  assert.ok(!body.error, JSON.stringify(body));
  assert.equal(body.result.changed, true);
  checked++;
}
async function join(user, nickname) {
  await db.doc("teamMembers/" + user.uid).set({ expiresAt: Timestamp.fromMillis(Date.UTC(2200, 0, 1)) });
  await db.doc("users/" + user.uid).set({ nickname, role: "user", email: "" });
  await db.doc("nicknames/" + nickname).set({ uid: user.uid });
}

const me = await google("renombra");
const other = await google("vecino");
const old = "ren_" + suffix;
const otherNick = "vec_" + suffix;
await join(me, old);
await join(other, otherNick);

// ---------- copies of both members' handles, as the app and the callables write them
const seasonId = "ren-season-" + suffix;
const matchId = "ren-match-" + suffix;
const trainingId = "ren-training-" + suffix;
const invite = "ren-invite-" + suffix;
const boardMine = "ren-board-" + suffix;
const boardOther = "ren-board-other-" + suffix;
const boardClub = "ren-board-club-" + suffix;
const lineupMine = "ren-lineup-" + suffix;
const lineupOther = "ren-lineup-other-" + suffix;
const at = Timestamp.now();
await db.doc("seasons/" + seasonId).set({ name: "Apodos · pruebas" });
await db.doc("matches/" + matchId).set({ version: 2, seasonId, rival: "Rival Apodos", status: "scheduled", date: Timestamp.fromMillis(Date.now() + 7 * 86400_000), events: [] });
for (const [who, nick] of [[me, old], [other, otherNick]]) {
  await db.doc(`matches/${matchId}/votes/${who.uid}`).set({ playerId: "p", voterName: nick, at });
  await db.doc(`matchPrivate/${matchId}/availability/${who.uid}`).set({ response: "yes", name: nick, playerId: null, at });
  await db.doc(`matchPrivate/${matchId}/predictions/${who.uid}`).set({ goalsFor: 2, goalsAgainst: 1, name: nick, playerId: null, at });
  await db.doc(`trainings/${trainingId}/votes/${who.uid}`).set({ slotIds: ["s1"], name: nick, playerId: null, at });
}
await db.doc("trainings/" + trainingId).set({
  slots: [{ id: "s1", at: Timestamp.fromMillis(Date.now() + 86400_000), place: "" }],
  note: "",
  proposedBy: me.uid,
  proposedByName: old,
  lastSlotAt: Timestamp.fromMillis(Date.now() + 86400_000),
  confirmed: { slotId: "s1", at: Timestamp.fromMillis(Date.now() + 86400_000), place: "", by: me.uid, byName: old, confirmedAt: at },
});
await db.doc("board/" + boardMine).set({ text: "hola", uid: me.uid, name: old, playerId: null, at });
await db.doc("board/" + boardOther).set({ text: "hola", uid: other.uid, name: otherNick, playerId: null, at });
await db.doc("board/" + boardClub).set({ text: "Entreno confirmado", uid: "vestuario", name: "Vestuario", playerId: null, at });
await db.doc("lineups/" + lineupMine).set({ ownerUid: me.uid, ownerNickname: old, seasonId, name: "Mi siete", isOfficial: false, matchId: null });
await db.doc("lineups/" + lineupOther).set({ ownerUid: other.uid, ownerNickname: otherNick, seasonId, name: "Su siete", isOfficial: false, matchId: null });
await db.doc("invites/" + invite).set({ by: me.uid, byName: old, expiresAt: Timestamp.fromMillis(Date.now() + 86400_000), maxUses: 1, uses: 0 });
await db.doc("playerClaims/" + me.uid).set({ playerId: "p", playerName: "P", nickname: old, email: "", status: "rejected", at });
await db.doc("porraStandings/" + seasonId).set({
  seasonId,
  rows: [
    { uid: other.uid, name: otherNick, playerId: null, points: 3, exact: 1, hits: 1, played: 1 },
    { uid: me.uid, name: old, playerId: null, points: 1, exact: 0, hits: 1, played: 1 },
  ],
  matches: 1,
});

/** Each copy of my handle: [path, field]. */
const mine = [
  [`matches/${matchId}/votes/${me.uid}`, "voterName"],
  [`matchPrivate/${matchId}/availability/${me.uid}`, "name"],
  [`matchPrivate/${matchId}/predictions/${me.uid}`, "name"],
  [`trainings/${trainingId}/votes/${me.uid}`, "name"],
  [`trainings/${trainingId}`, "proposedByName"],
  [`trainings/${trainingId}`, "confirmed.byName"],
  [`board/${boardMine}`, "name"],
  [`lineups/${lineupMine}`, "ownerNickname"],
  [`invites/${invite}`, "byName"],
  [`playerClaims/${me.uid}`, "nickname"],
];
const porraName = async (uid) => (await db.doc("porraStandings/" + seasonId).get()).get("rows").find((r) => r.uid === uid)?.name;
async function names() {
  const out = {};
  for (const [path, field] of mine) out[`${path}.${field}`] = (await db.doc(path).get()).get(field);
  out["porra"] = await porraName(me.uid);
  return out;
}
/** Waits until every copy of my handle says `nick`. */
async function everywhere(nick) {
  let last = {};
  for (let i = 0; i < 80; i++) {
    last = await names();
    if (Object.values(last).every((n) => n === nick)) {
      checked++;
      return;
    }
    await sleep(250);
  }
  assert.fail(`not every copy says ${nick}: ${JSON.stringify(last)}`);
}
async function othersUntouched() {
  assert.equal((await db.doc(`matches/${matchId}/votes/${other.uid}`).get()).get("voterName"), otherNick);
  for (const sub of ["availability", "predictions"]) assert.equal((await db.doc(`matchPrivate/${matchId}/${sub}/${other.uid}`).get()).get("name"), otherNick);
  assert.equal((await db.doc(`trainings/${trainingId}/votes/${other.uid}`).get()).get("name"), otherNick);
  assert.equal((await db.doc("board/" + boardOther).get()).get("name"), otherNick);
  assert.equal((await db.doc("board/" + boardClub).get()).get("name"), "Vestuario");
  assert.equal((await db.doc("lineups/" + lineupOther).get()).get("ownerNickname"), otherNick);
  assert.equal(await porraName(other.uid), otherNick);
  // (the rest of a rewritten doc stays as it was)
  const porra = (await db.doc("porraStandings/" + seasonId).get()).get("rows");
  assert.deepEqual(porra.map((r) => r.uid), [other.uid, me.uid]);
  assert.equal(porra[1].points, 1);
  assert.equal((await db.doc(`matchPrivate/${matchId}/availability/${me.uid}`).get()).get("response"), "yes");
  assert.equal((await db.doc("lineups/" + lineupMine).get()).get("name"), "Mi siete");
  checked++;
}

// ---------- a write of the profile that leaves the handle alone: nothing is rewritten — a copy of mine
// signed with a wrong name (the decoy) keeps it: only a rename sends the rewrite
const boardDecoy = "ren-board-decoy-" + suffix;
await db.doc("board/" + boardDecoy).set({ text: "hola", uid: me.uid, name: "mal_" + suffix, playerId: null, at });
await db.doc("users/" + me.uid).update({ role: "user", playerId: "p" });
await sleep(3000);
assert.equal((await db.doc("board/" + boardDecoy).get()).get("name"), "mal_" + suffix, "a non-rename write rewrote a copy");
assert.equal((await names())["board/" + boardMine + ".name"], old);
checked += 2;

// ---------- one rename: every copy follows, nobody else's
const first = "nuevo_" + suffix;
await rename(me, first);
await everywhere(first);
await othersUntouched();
// (the decoy is mine too: the rename fixes it with the rest)
assert.equal((await db.doc("board/" + boardDecoy).get()).get("name"), first);
checked++;

// ---------- two renames in a row (two triggers racing): the last name wins and stays
const second = "otro_" + suffix;
const third = "fin_" + suffix;
await rename(me, second);
await rename(me, third);
await everywhere(third);
await sleep(4000);
await everywhere(third);
await othersUntouched();

console.log(`${checked} comprobaciones de apodos correctas: cada copia lleva el nuevo, nadie más cambia y el último gana.`);
