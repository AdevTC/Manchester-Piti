// Run only with the demo emulators. No production credentials or endpoints.
import assert from "node:assert/strict";
process.env.FIRESTORE_EMULATOR_HOST = "127.0.0.1:8080";
process.env.FIREBASE_AUTH_EMULATOR_HOST = "127.0.0.1:9099";
const { initializeApp } = await import("firebase-admin/app");
const { getFirestore, Timestamp } = await import("firebase-admin/firestore");
initializeApp({ projectId: "demo-manchester-piti" });
const db = getFirestore();
const suffix = Date.now().toString(36);
let checked = 0;
async function google(label) {
  const email = label + "-" + suffix + "@example.test";
  const encode = (o) => Buffer.from(JSON.stringify(o)).toString("base64url");
  const token =
    encode({ alg: "none", typ: "JWT" }) +
    "." +
    encode({
      sub: label + "-" + suffix,
      email,
      email_verified: true,
      name: label,
      aud: "demo",
      iss: "https://accounts.google.com",
    }) +
    ".";
  const response = await fetch(
    "http://127.0.0.1:9099/identitytoolkit.googleapis.com/v1/accounts:signInWithIdp?key=demo",
    {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        postBody: new URLSearchParams({
          id_token: token,
          providerId: "google.com",
        }).toString(),
        requestUri: "http://localhost",
        returnSecureToken: true,
      }),
    },
  );
  const data = await response.json();
  assert.ok(data.idToken, JSON.stringify(data));
  return { token: data.idToken, uid: data.localId, email };
}
async function call(name, user, data) {
  const response = await fetch(
    "http://127.0.0.1:5001/demo-manchester-piti/europe-southwest1/" + name,
    {
      method: "POST",
      headers: {
        "content-type": "application/json",
        ...(user ? { authorization: "Bearer " + user.token } : {}),
      },
      body: JSON.stringify({ data }),
    },
  );
  const body = await response.json();
  return body;
}
async function ok(name, user, data) {
  const r = await call(name, user, data);
  assert.ok(!r.error, JSON.stringify(r));
  checked++;
  return r.result;
}
async function denied(name, user, data, status) {
  const r = await call(name, user, data);
  assert.equal(r.error?.status, status, JSON.stringify(r));
  checked++;
}
// Everyday vestuario actions are client writes checked by firestore.rules: exercise them
// the way the app does, with the member's own token against the emulator.
const DOCS = "projects/demo-manchester-piti/databases/(default)/documents/";
const value = (v) =>
  v === null ? { nullValue: null }
  : typeof v === "string" ? { stringValue: v }
  : typeof v === "boolean" ? { booleanValue: v }
  : typeof v === "number" ? (Number.isInteger(v) ? { integerValue: String(v) } : { doubleValue: v })
  : Array.isArray(v) ? { arrayValue: { values: v.map(value) } }
  : { mapValue: { fields: Object.fromEntries(Object.entries(v).map(([k, x]) => [k, value(x)])) } };
/** `writes`: [path, data] sets (`at` becomes the server time) or [path, null] deletes. */
async function commit(user, writes) {
  const response = await fetch("http://127.0.0.1:8080/v1/" + DOCS.slice(0, -1) + ":commit", {
    method: "POST",
    headers: { "content-type": "application/json", authorization: "Bearer " + user.token },
    body: JSON.stringify({
      writes: writes.map(([path, data]) =>
        data === null
          ? { delete: DOCS + path }
          : { update: { name: DOCS + path, fields: value(data).mapValue.fields }, updateTransforms: [{ fieldPath: "at", setToServerValue: "REQUEST_TIME" }] },
      ),
    }),
  });
  if (process.env.DEBUG_WRITES && response.status !== 200) console.error(await response.text());
  return response.status;
}
async function wrote(user, ...writes) {
  assert.equal(await commit(user, writes), 200, JSON.stringify(writes));
  checked++;
}
async function refused(user, ...writes) {
  assert.equal(await commit(user, writes), 403, JSON.stringify(writes));
  checked++;
}
/** The MVP tally is kept by a trigger: wait for it to settle. */
async function tally(matchId, expect) {
  for (let i = 0; i < 60; i++) {
    const r = (await db.doc("mvpResults/" + matchId).get()).data();
    if (r && expect(r)) return r;
    await new Promise((ok) => setTimeout(ok, 250));
  }
  assert.fail("mvpResults/" + matchId + " did not settle: " + JSON.stringify((await db.doc("mvpResults/" + matchId).get()).data()));
}
const admin = await google("admin"),
  member = await google("member"),
  blocked = await google("blocked");
await db
  .doc("users/" + admin.uid)
  .set({ role: "admin", nickname: "admin", email: admin.email });
await db
  .doc("users/" + member.uid)
  .set({ role: "user", nickname: "member", email: member.email });
// ---------- the door: no shared key; invitations and access requests
// Members from before (a vestuario profile) walk back in by asking.
await denied("requestAccess", null, { name: "Nadie" }, "UNAUTHENTICATED");
assert.equal((await ok("requestAccess", admin, { name: "Admin" })).status, "member");
assert.equal((await ok("requestAccess", member, { name: "Member" })).status, "member");
checked += 2;
await denied("createInvite", null, {}, "UNAUTHENTICATED");
await denied("createInvite", member, {}, "PERMISSION_DENIED");
const invite = await ok("createInvite", admin, {});
assert.match(invite.code, /^[A-Z2-9]{10}$/);
checked++;
const info = await ok("inviteInfo", null, { code: invite.code });
assert.equal(info.state, "valid");
assert.equal(info.by, "Admin"); // the captain's display name, not the nickname
checked += 2;
const newcomer = await google("newcomer");
const joined = await ok("joinWithInvite", newcomer, { code: invite.code, name: "x" + suffix, role: "superadmin" });
assert.equal(joined.nickname, "x" + suffix);
const newcomerUser = (await db.doc("users/" + newcomer.uid).get()).data();
assert.equal(newcomerUser.role, "user");
assert.ok((await db.doc("teamMembers/" + newcomer.uid).get()).get("expiresAt").toMillis() > Date.UTC(2100, 0, 1));
checked += 3;
// A single-use invitation can't be used twice.
await denied("joinWithInvite", blocked, { code: invite.code, name: "Otro" }, "FAILED_PRECONDITION");
assert.equal((await ok("inviteInfo", null, { code: invite.code })).state, "used");
checked++;
// Asking for access: pending until a captain approves it.
const asker = await google("asker");
await denied("requestAccess", asker, {}, "INVALID_ARGUMENT");
assert.equal((await ok("requestAccess", asker, { name: "Pide " + suffix })).status, "pending");
assert.equal((await db.doc("accessRequests/" + asker.uid).get()).get("status"), "pending");
checked += 2;
await denied("resolveAccess", member, { uid: asker.uid, approve: true }, "PERMISSION_DENIED");
await ok("resolveAccess", admin, { uid: asker.uid, approve: true });
assert.equal((await db.doc("teamMembers/" + asker.uid).get()).exists, true);
assert.equal((await db.doc("accessRequests/" + asker.uid).get()).exists, false);
checked += 2;
// Removing someone: they can't walk back in on their own any more.
await denied("revokeMember", admin, { uid: admin.uid }, "FAILED_PRECONDITION");
// The door's public head count: everyone with a profile, minus whoever a captain removed.
const before = (await ok("doorShirts", null, null)).inside;
await ok("revokeMember", admin, { uid: asker.uid });
assert.equal((await ok("doorShirts", null, null)).inside, before - 1);
checked++;
assert.equal((await db.doc("teamMembers/" + asker.uid).get()).exists, false);
assert.equal((await ok("requestAccess", asker, { name: "Otra vez" })).status, "pending");
checked += 2;
await ok("resolveAccess", admin, { uid: asker.uid, approve: false });
assert.equal((await db.doc("accessRequests/" + asker.uid).get()).get("status"), "rejected");
checked++;
// A revoked invitation is dead.
const second = await ok("createInvite", admin, { maxUses: 0, days: 1 });
await ok("revokeInvite", admin, { code: second.code });
assert.equal((await ok("inviteInfo", null, { code: second.code })).state, "revoked");
checked++;
const season = "integration-" + suffix;
await db.doc("seasons/" + season).set({ name: "Temporada de prueba" });
const ids = Array.from({ length: 10 }, (_, i) => "p" + i + "-" + suffix);
for (let i = 0; i < ids.length; i++)
  await db.doc("players/" + ids[i]).set({
    shirtName: "Jugador " + i,
    firstName: "Jugador",
    number: i + 1,
    seasons: [season],
    active: true,
  });
const id = "match-" + suffix;
const sheet = {
  version: 2,
  revision: 0,
  seasonId: season,
  rival: "Rival de pruebas",
  rivalLogoUrl: "https://example.test/escudo.png",
  rivalInitials: "RP",
  competition: "Liga",
  date: Date.now() + 86400000,
  duration: 60,
  venue: "Campo de prueba",
  home: true,
  status: "scheduled",
  starters: ids.slice(0, 7),
  bench: ids.slice(7, 9),
  notCalled: [ids[9]],
  events: [],
  goalsFor: 0,
  goalsAgainst: 0,
  report: "",
};
await denied(
  "saveMatchSheet",
  member,
  { id, sheet, draft: false },
  "PERMISSION_DENIED",
);
await ok("saveMatchSheet", admin, { id, sheet, draft: true });
await denied(
  "saveMatchSheet",
  admin,
  {
    id,
    sheet: { ...sheet, rivalLogoUrl: "http://example.test/escudo.png" },
    draft: true,
  },
  "INVALID_ARGUMENT",
);
await denied(
  "saveMatchSheet",
  admin,
  { id, sheet: { ...sheet, rivalInitials: "ABCD" }, draft: true },
  "INVALID_ARGUMENT",
);
assert.equal((await db.doc("matches/" + id).get()).exists, false);
checked++;
await ok("saveMatchSheet", admin, { id, sheet, draft: false });
assert.equal((await db.doc("matches/" + id).get()).get("goalsFor"), null);
checked++;
assert.equal((await db.doc("matches/" + id).get()).get("rivalInitials"), "RP");
assert.equal(
  (await db.doc("matches/" + id).get()).get("rivalLogoUrl"),
  "https://example.test/escudo.png",
);
checked += 2;
// Direct writes are signed with the nickname on users/{uid}, as the app does.
const nickname = async (u) => (await db.doc("users/" + u.uid).get()).get("nickname");
const memberName = await nickname(member), adminName = await nickname(admin);
await wrote(member, [`matchPrivate/${id}/availability/${member.uid}`, { response: "yes", name: memberName, playerId: null, at: null }]);
await refused(member, [`matches/${id}/votes/${member.uid}`, { playerId: ids[0], voterName: memberName, at: null }]);
const finished = {
  ...sheet,
  revision: 1,
  status: "finished",
  date: Date.now() - 7200000,
  goalsFor: 1,
  goalsAgainst: 0,
  events: [
    {
      id: "change",
      type: "substitution",
      minute: 20,
      playerId: ids[0],
      inPlayerId: ids[7],
    },
    {
      id: "goal",
      type: "goal",
      minute: 35,
      playerId: ids[7],
      assistPlayerId: ids[1],
    },
  ],
};
await denied(
  "saveMatchSheet",
  admin,
  { id, sheet: { ...finished, goalsFor: 2 }, draft: false },
  "INVALID_ARGUMENT",
);
await denied(
  "saveMatchSheet",
  admin,
  { id, sheet: { ...finished, notCalled: [] }, draft: false },
  "INVALID_ARGUMENT",
);
await ok("saveMatchSheet", admin, { id, sheet: finished, draft: false });
let saved = await db.doc("matches/" + id).get();
assert.equal(saved.get("ledger")[ids[0]].minutes, 20);
assert.equal(saved.get("ledger")[ids[7]].minutes, 40);
checked += 2;
await denied(
  "saveMatchSheet",
  admin,
  { id, sheet: finished, draft: false },
  "ABORTED",
);
await wrote(member, [`matches/${id}/votes/${member.uid}`, { playerId: ids[7], voterName: memberName, at: null }]);
await wrote(member, [`matches/${id}/votes/${member.uid}`, { playerId: ids[1], voterName: memberName, at: null }]);
await wrote(member, [`matches/${id}/votes/${member.uid}`, { playerId: ids[1], voterName: memberName, at: null }]);
const votes = await tally(id, (r) => r.total === 1 && r.counts[ids[1]] === 1 && !r.counts[ids[7]]);
assert.equal(votes.total, 1);
checked++;
await refused(member, [`matches/${id}/votes/${member.uid}`, { playerId: ids[9], voterName: memberName, at: null }]);
await refused(member, [`matchPrivate/${id}/availability/${member.uid}`, { response: "yes", name: memberName, playerId: null, at: null }]);
const corrected = {
  ...finished,
  revision: 2,
  events: finished.events.map((e) =>
    e.id === "change" ? { ...e, minute: 25 } : e,
  ),
};
await ok("saveMatchSheet", admin, { id, sheet: corrected, draft: false });
const totals = await db
  .collection("playerSeasonStats")
  .where("seasonId", "==", season)
  .get();
const p0 = totals.docs.find((d) => d.get("playerId") === ids[0]);
const p7 = totals.docs.find((d) => d.get("playerId") === ids[7]);
assert.equal(p0.get("totals").minutes, 25);
assert.equal(p7.get("totals").minutes, 35);
assert.equal(p7.get("totals").goals, 1);
assert.equal(p7.get("totals").played, 1);
checked += 4;
const amended = {
  ...corrected,
  revision: 3,
  starters: corrected.starters.map((p) => (p === ids[1] ? ids[8] : p)),
  bench: [ids[7], ids[1]],
  events: corrected.events.map((e) =>
    e.id === "goal" ? { ...e, assistPlayerId: ids[8] } : e,
  ),
};
await ok("saveMatchSheet", admin, { id, sheet: amended, draft: false });
assert.equal((await tally(id, (r) => r.total === 0)).total, 0);
checked++;
assert.equal(
  (await db.doc("matches/" + id + "/votes/" + member.uid).get()).exists,
  false,
);
checked++;
await db
  .doc("teamMembers/" + member.uid)
  .set({ expiresAt: Timestamp.fromMillis(Date.now() - 1) });
await refused(member, [`matches/${id}/votes/${member.uid}`, { playerId: ids[0], voterName: memberName, at: null }]);
// Access is back only when a captain lets them in again (here, by removing and approving).
await db.doc("teamMembers/" + member.uid).delete();
await refused(member, [`matches/${id}/votes/${member.uid}`, { playerId: ids[0], voterName: memberName, at: null }]);
await db.doc("matches/" + id).update({ voteClosesAt: Date.now() - 1 });
await refused(admin, [`matches/${id}/votes/${admin.uid}`, { playerId: ids[0], voterName: adminName, at: null }]);
// ---------- vestuario: identity in responses, ficha claims, trainings, porra, board
const fan = newcomer;
await denied("requestPlayerClaim", member, { playerId: ids[2] }, "PERMISSION_DENIED");
await denied("requestPlayerClaim", fan, { playerId: "missing-" + suffix }, "NOT_FOUND");
await ok("requestPlayerClaim", fan, { playerId: ids[2] });
assert.equal((await db.doc("playerClaims/" + fan.uid).get()).get("status"), "pending");
checked++;
await denied("resolvePlayerClaim", fan, { uid: fan.uid, approve: true }, "PERMISSION_DENIED");
await ok("resolvePlayerClaim", admin, { uid: fan.uid, approve: true });
assert.equal((await db.doc("users/" + fan.uid).get()).get("playerId"), ids[2]);
assert.equal((await db.doc("playerLinks/" + ids[2]).get()).get("uid"), fan.uid);
checked += 2;
await ok("requestPlayerClaim", admin, { playerId: ids[3] });
// An admin's own claim links at once, no second admin needed.
assert.equal((await db.doc("users/" + admin.uid).get()).get("playerId"), ids[3]);
assert.equal((await db.doc("playerClaims/" + admin.uid).get()).get("status"), "approved");
assert.equal((await db.doc("playerLinks/" + ids[3]).get()).get("uid"), admin.uid);
checked += 3;
await denied("requestPlayerClaim", admin, { playerId: ids[2] }, "ALREADY_EXISTS");
await ok("resolvePlayerClaim", admin, { uid: admin.uid, approve: false });
assert.equal((await db.doc("users/" + admin.uid).get()).get("playerId"), undefined);
checked++;

const nextId = "next-" + suffix;
const upcoming = { ...sheet, revision: 0, date: Date.now() + 3 * 86400000, kit: "away" };
await ok("saveMatchSheet", admin, { id: nextId, sheet: upcoming, draft: false });
assert.equal((await db.doc("matches/" + nextId).get()).get("kit"), "away");
checked++;

// ---------- «Ya está el siete»: publishing the official seven on the pizarra notifies (pushOnLineup),
// once per board and match; the trigger logs it before sending (nobody is subscribed in the emulators).
async function pushLogged(tag) {
  for (let i = 0; i < 60; i++) {
    if ((await db.doc("pushLog/" + tag).get()).exists) return;
    await new Promise((ok) => setTimeout(ok, 250));
  }
  assert.fail("pushLog/" + tag + " did not appear");
}
const boardId = "board-" + suffix;
await db.doc("lineups/" + boardId).set({
  ownerUid: admin.uid, ownerNickname: adminName, seasonId: season, name: "Oficial " + suffix, isOfficial: false, matchId: null,
  formation: "2-3-1", freeMode: false, slots: [], bench: [], roles: {}, tactics: {}, playerPositions: {}, pinned: [], drawings: [], plays: [],
});
await db.doc("lineups/" + boardId).update({ isOfficial: true, matchId: nextId });
await pushLogged(`lineup-${boardId}-${nextId}`);
await db.doc("lineups/" + boardId).update({ name: "Oficial retocado " + suffix });
await db.doc("lineups/" + boardId).update({ matchId: null });
await pushLogged(`lineup-${boardId}-temporada`);
await db.doc("lineups/" + boardId).delete();
checked += 2;
await wrote(fan, [`matchPrivate/${nextId}/availability/${fan.uid}`, { response: "yes", name: "x" + suffix, playerId: ids[2], at: null }]);
const answer = await db.doc("matchPrivate/" + nextId + "/availability/" + fan.uid).get();
assert.equal(answer.get("playerId"), ids[2]);
assert.equal(answer.get("name"), "x" + suffix);
checked += 2;
await wrote(admin, [`matchPrivate/${nextId}/predictions/${admin.uid}`, { goalsFor: 1, goalsAgainst: 0, name: adminName, playerId: null, at: null }]);
await wrote(fan, [`matchPrivate/${nextId}/predictions/${fan.uid}`, { goalsFor: 2, goalsAgainst: 0, name: "x" + suffix, playerId: ids[2], at: null }]);
await refused(fan, [`matchPrivate/${nextId}/predictions/${fan.uid}`, { goalsFor: -1, goalsAgainst: 0, name: "x" + suffix, playerId: ids[2], at: null }]);
await refused(fan, [`matchPrivate/${id}/predictions/${fan.uid}`, { goalsFor: 1, goalsAgainst: 0, name: "x" + suffix, playerId: ids[2], at: null }]);
await ok("saveMatchSheet", admin, {
  id: nextId,
  // Older than the e2e seed's finished match, which must stay the latest one with an MVP vote.
  sheet: { ...finished, revision: 1, kit: "away", events: finished.events, date: Date.now() - 2 * 86400000 },
  draft: false,
});
const porra = (await db.doc("porraStandings/" + season).get()).get("rows");
assert.equal(porra[0].uid, admin.uid);
assert.equal(porra[0].points, 3);
assert.equal(porra[1].points, 1);
checked += 3;
await refused(admin, [`matchPrivate/${nextId}/predictions/${admin.uid}`, { goalsFor: 3, goalsAgainst: 0, name: adminName, playerId: null, at: null }]);

await denied("proposeTraining", fan, { slots: [{ at: Date.now() - 1000 }] }, "INVALID_ARGUMENT");
await denied("proposeTraining", fan, { slots: [{ at: Date.now() + 86400000, end: Date.now() + 86400000 - 60000 }] }, "INVALID_ARGUMENT");
await denied("proposeTraining", fan, { slots: [{ at: Date.now() + 86400000, end: Date.now() + 86400000 + 7 * 3600000 }] }, "INVALID_ARGUMENT");
const t0 = Date.now();
const training = await ok("proposeTraining", fan, {
  slots: [{ at: t0 + 2 * 86400000, end: t0 + 2 * 86400000 + 90 * 60000, place: "Campo" }, { at: t0 + 86400000 }],
});
const tdoc = await db.doc("trainings/" + training.id).get();
assert.equal(tdoc.get("slots")[0].id, "s1");
assert.ok(tdoc.get("slots")[0].at.toMillis() < tdoc.get("slots")[1].at.toMillis());
assert.equal(tdoc.get("slots")[1].end.toMillis() - tdoc.get("slots")[1].at.toMillis(), 90 * 60000);
assert.equal(tdoc.get("slots")[0].end, undefined);
checked += 2;
await wrote(admin, [`trainings/${training.id}/votes/${admin.uid}`, { slotIds: ["s1", "s2"], name: adminName, playerId: null, at: null }]);
await refused(admin, [`trainings/${training.id}/votes/${admin.uid}`, { slotIds: ["s9"], name: adminName, playerId: null, at: null }]);
await wrote(admin, [`trainings/${training.id}/votes/${admin.uid}`, null]);
assert.equal((await db.doc("trainings/" + training.id + "/votes/" + admin.uid).get()).exists, false);
checked++;
await wrote(fan, [`trainings/${training.id}/votes/${fan.uid}`, { slotIds: ["s2"], name: "x" + suffix, playerId: ids[2], at: null }]);
// Confirming closes the vote, announces it on the board and puts it in the calendar feed.
await denied("confirmTraining", member, { trainingId: training.id, slotId: "s2" }, "PERMISSION_DENIED");
await denied("confirmTraining", fan, { trainingId: training.id, slotId: "s9" }, "NOT_FOUND");
await ok("confirmTraining", fan, { trainingId: training.id, slotId: "s1" });
await ok("confirmTraining", admin, { trainingId: training.id, slotId: "s2" });
const confirmedDoc = await db.doc("trainings/" + training.id).get();
assert.equal(confirmedDoc.get("confirmed.slotId"), "s2");
assert.equal(confirmedDoc.get("confirmed.place"), "Campo");
const announce = await db.collection("board").where("uid", "==", "vestuario").get();
assert.ok(announce.docs.some((d) => d.get("text").startsWith("Entreno confirmado:")));
checked += 3;
await refused(admin, [`trainings/${training.id}/votes/${admin.uid}`, { slotIds: ["s1"], name: adminName, playerId: null, at: null }]);
await wrote(admin, [`trainings/${training.id}/votes/${admin.uid}`, { slotIds: ["s2"], name: adminName, playerId: null, at: null }]);
const feed = await fetch("http://127.0.0.1:5001/demo-manchester-piti/europe-southwest1/clubCalendar").then((r) => r.text());
assert.ok(feed.includes(`UID:training-${training.id}@manchester-piti`));
await ok("confirmTraining", admin, { trainingId: training.id, slotId: null });
assert.equal((await db.doc("trainings/" + training.id).get()).get("confirmed"), undefined);
checked += 3;
for (const d of announce.docs) await d.ref.delete();
await ok("deleteTraining", admin, { trainingId: training.id });
assert.equal((await db.doc("trainings/" + training.id + "/votes/" + fan.uid).get()).exists, false);
checked++;

const message = (who, name, board, text, player = null) => [
  [`boardRate/${who.uid}`, { at: null }],
  [`board/${board}`, { text, uid: who.uid, name, playerId: player, at: null }],
];
await wrote(fan, ...message(fan, "x" + suffix, "post-" + suffix, "Yo llevo balones", ids[2]));
assert.equal((await db.doc("board/post-" + suffix).get()).get("text"), "Yo llevo balones");
checked++;
await refused(fan, ...message(fan, "x" + suffix, "again-" + suffix, "Otra vez", ids[2]));
await refused(admin, ...message(admin, adminName, "blank-" + suffix, "   "));
await wrote(admin, ...message(admin, adminName, "theirs-" + suffix, "Tercer tiempo"));
await refused(fan, ["board/theirs-" + suffix, null]);
await wrote(fan, ["board/post-" + suffix, null]);
await wrote(admin, ["board/theirs-" + suffix, null]);
assert.equal((await db.collection("board").where("uid", "==", fan.uid).get()).size, 0);
checked++;

const shareBase =
  "http://127.0.0.1:5001/demo-manchester-piti/europe-southwest1/clubShare";
const html = await fetch(shareBase + "/compartir/partido/" + id).then((r) =>
  r.text(),
);
assert.ok(html.includes("og:image"));
assert.ok(html.includes("Rival de pruebas"));
checked += 2;
const picture = await fetch(shareBase + "/social/partido/" + id + ".png");
assert.equal(picture.status, 200);
assert.equal(picture.headers.get("content-type"), "image/png");
checked += 2;
const sharp = (await import("sharp")).default;
const meta = await sharp(Buffer.from(await picture.arrayBuffer())).metadata();
assert.equal(meta.width, 1200);
assert.equal(meta.height, 630);
checked += 2;
assert.equal(
  (await fetch(shareBase + "/compartir/partido/missing")).status,
  404,
);
checked++;

// ---------- season archive: data stays, every public reader drops it
const other = "other-" + suffix;
await db.doc("seasons/" + other).set({ name: "Otra temporada" });
await db.doc("players/" + ids[9]).update({ seasons: [season, other] });
await denied("setSeasonArchived", member, { seasonId: season, archived: true }, "PERMISSION_DENIED");
await ok("setSeasonArchived", admin, { seasonId: season, archived: true });
assert.equal((await db.doc("seasons/" + season).get()).get("archived"), true);
assert.equal((await db.doc("matches/" + id).get()).get("archived"), true);
assert.equal((await db.doc("players/" + ids[0]).get()).get("archived"), true);
assert.equal((await db.doc("players/" + ids[9]).get()).get("archived"), undefined);
assert.equal((await db.doc("matches/" + id).get()).get("rival"), "Rival de pruebas");
checked += 5;
assert.equal((await fetch(shareBase + "/compartir/partido/" + id)).status, 404);
const calendarUrl = "http://127.0.0.1:5001/demo-manchester-piti/europe-southwest1/clubCalendar";
const archivedFeed = await fetch(calendarUrl).then((r) => r.text());
assert.ok(archivedFeed.startsWith("BEGIN:VCALENDAR"));
assert.ok(!archivedFeed.includes(`UID:${id}@manchester-piti`));
checked += 2;
await denied("saveMatchSheet", admin, { id: "blocked-" + suffix, sheet: { ...sheet, revision: 0 }, draft: true }, "FAILED_PRECONDITION");
checked += 2;
await ok("setSeasonArchived", admin, { seasonId: season, archived: false });
assert.equal((await db.doc("seasons/" + season).get()).get("archived"), undefined);
assert.equal((await db.doc("matches/" + id).get()).get("archived"), undefined);
assert.equal((await db.doc("players/" + ids[0]).get()).get("archived"), undefined);
assert.equal((await fetch(shareBase + "/compartir/partido/" + id)).status, 200);
checked += 4;
assert.ok((await fetch(calendarUrl).then((r) => r.text())).includes(`UID:${id}@manchester-piti`));
checked++;
// ---------- /profile: apodo, nombre en la espalda, cancelar la petición de ficha y darse de baja
const tag = suffix.replace(/[0-9]/g, (d) => "ABCDEFGHIJ"[Number(d)]).toUpperCase();
const perfilSeason = "perfil-" + suffix;
await db.doc("seasons/" + perfilSeason).set({ name: "Temporada del perfil" });
const forever = Timestamp.fromMillis(Date.UTC(2200, 0, 1));
async function socio(label, extra = {}) {
  const u = await google(label);
  await db.doc("teamMembers/" + u.uid).set({ expiresAt: forever, joinedAt: Timestamp.now(), via: "invite", by: admin.uid });
  await db.doc("users/" + u.uid).set({ role: "user", nickname: label + "_" + suffix, email: u.email, ...extra });
  await db.doc("nicknames/" + label + "_" + suffix).set({ uid: u.uid });
  return u;
}
const pA = "pa-" + suffix, pB = "pb-" + suffix, pC = "pc-" + suffix, pD = "pd-" + suffix;
// A legacy shirt name the rules refuse today (digits), whatever the random suffix looks like.
const legacyName = "Lea 7" + suffix;
await db.doc("players/" + pA).set({ shirtName: legacyName, firstName: "Lea", number: 21, seasons: [perfilSeason], active: true, seasonDetails: { [perfilSeason]: { shirtName: legacyName, number: 21 } } });
await db.doc("players/" + pB).set({ shirtName: "É" + tag, firstName: "Otro", number: 9, seasons: [perfilSeason], active: true });
await db.doc("players/" + pC).set({ shirtName: "C" + tag, firstName: "Libre", number: 30, seasons: [perfilSeason], active: true });
await db.doc("players/" + pD).set({ shirtName: "D" + tag, firstName: "Baja", number: 31, seasons: [perfilSeason], active: true });
const lea = await socio("lea", { playerId: pA });
await db.doc("playerLinks/" + pA).set({ uid: lea.uid });
const rival = await socio("rival", { playerId: pD });
await db.doc("playerLinks/" + pD).set({ uid: rival.uid });
const pend = await socio("pend");
const impostor = await socio("impostor", { playerId: pB }); // says pB is his, but the link is someone else's
await db.doc("playerLinks/" + pB).set({ uid: rival.uid });
const boss = await socio("boss", { role: "superadmin" });
// Tu apodo: the backend's rules, unique among members, the old reservation freed.
await denied("setNickname", null, { nickname: "nadie_" + suffix }, "UNAUTHENTICATED");
await denied("setNickname", blocked, { nickname: "fuera_" + suffix }, "PERMISSION_DENIED");
await denied("setNickname", lea, { nickname: "ab" }, "INVALID_ARGUMENT");
await denied("setNickname", lea, { nickname: "Lea.Mayus" }, "INVALID_ARGUMENT");
await denied("setNickname", lea, { nickname: "admin" }, "INVALID_ARGUMENT");
await denied("setNickname", lea, { nickname: "x".repeat(16) }, "INVALID_ARGUMENT");
const nick = "nk_" + suffix;
const renamed = await ok("setNickname", lea, { nickname: nick });
assert.deepEqual(renamed, { nickname: nick, previous: "lea_" + suffix, changed: true });
assert.equal((await db.doc("users/" + lea.uid).get()).get("nickname"), nick);
assert.ok((await db.doc("users/" + lea.uid).get()).get("nicknameAt"));
assert.equal((await db.doc("nicknames/" + nick).get()).get("uid"), lea.uid);
assert.equal((await db.doc("nicknames/lea_" + suffix).get()).exists, false);
checked += 5;
assert.equal((await ok("setNickname", lea, { nickname: nick })).changed, false);
checked++;
await denied("setNickname", rival, { nickname: nick }, "ALREADY_EXISTS");
// The freed handle can be taken by someone else.
assert.equal((await ok("setNickname", rival, { nickname: "lea_" + suffix })).changed, true);
checked++;
// En la espalda: only the owner of the ficha, the rules, unique without caring about case or accents.
await denied("setShirtName", pend, { name: "PENDIENTE" }, "FAILED_PRECONDITION");
await denied("setShirtName", impostor, { name: "IMPOSTOR" }, "FAILED_PRECONDITION");
await denied("setShirtName", blocked, { name: "FUERA" }, "PERMISSION_DENIED");
await denied("setShirtName", lea, { name: "R2D" + tag }, "INVALID_ARGUMENT");
await denied("setShirtName", lea, { name: "A" }, "INVALID_ARGUMENT");
await denied("setShirtName", lea, { name: "ABCDEFGHIJKLM" }, "INVALID_ARGUMENT");
await denied("setShirtName", lea, { name: "LEA_" + tag }, "INVALID_ARGUMENT");
await denied("setShirtName", lea, { name: "e" + tag.toLowerCase() }, "ALREADY_EXISTS");
const clash = await call("setShirtName", lea, { name: "e" + tag.toLowerCase() });
assert.equal(clash.error?.message, "Ya la lleva el 9 (É" + tag + "): elige otro");
checked++;
const stamped = await ok("setShirtName", lea, { name: "  q  " + tag.toLowerCase() + " " });
assert.deepEqual(stamped, { shirtName: "Q " + tag, previous: legacyName, changed: true });
const pa = (await db.doc("players/" + pA).get()).data();
assert.equal(pa.shirtName, "Q " + tag);
assert.equal(pa.shirtNameBy, lea.uid);
assert.equal(pa.seasonDetails[perfilSeason].shirtName, "Q " + tag);
assert.equal(pa.seasonDetails[perfilSeason].number, 21);
assert.equal(pa.shirtNamePrev, legacyName);
checked += 5;
assert.equal((await ok("setShirtName", lea, { name: "Q " + tag })).changed, false);
checked++;
// Deshacer: the legacy name (digits) comes back inside the 10-minute window…
assert.equal((await ok("setShirtName", lea, { name: legacyName })).shirtName, legacyName);
assert.equal((await db.doc("players/" + pA).get()).get("shirtName"), legacyName);
checked++;
// …but not after it.
await ok("setShirtName", lea, { name: "Q " + tag });
await db.doc("players/" + pA).update({ shirtNamePrevAt: Timestamp.fromMillis(Date.now() - 11 * 60_000) });
await denied("setShirtName", lea, { name: legacyName }, "INVALID_ARGUMENT");
// Nobody else can take it now: «Q TAG» is lea's.
await denied("setShirtName", rival, { name: "q " + tag }, "ALREADY_EXISTS");
// Cancelar la petición: only a pending one, and twice is fine.
await ok("requestPlayerClaim", pend, { playerId: pC });
assert.equal((await db.doc("playerClaims/" + pend.uid).get()).get("status"), "pending");
await ok("cancelPlayerClaim", pend, {});
assert.equal((await db.doc("playerClaims/" + pend.uid).get()).exists, false);
await ok("cancelPlayerClaim", pend, {});
await db.doc("playerClaims/" + lea.uid).set({ playerId: pA, status: "approved" });
await ok("cancelPlayerClaim", lea, {});
assert.equal((await db.doc("playerClaims/" + lea.uid).get()).get("status"), "approved");
checked += 3;
// Darme de baja: like a captain removing you, plus this account's notices; the ficha link stays.
await db.doc("pushSubscriptions/perfil-" + suffix).set({ endpoint: "https://example.test/push/" + suffix, keys: { p256dh: "x", auth: "y" }, topics: ["access"], uid: rival.uid });
await denied("leaveVestuario", rival, {}, "INVALID_ARGUMENT");
await denied("leaveVestuario", rival, { confirm: false }, "INVALID_ARGUMENT");
await denied("leaveVestuario", boss, { confirm: true }, "PERMISSION_DENIED");
assert.equal((await db.doc("teamMembers/" + boss.uid).get()).exists, true);
checked++;
await ok("leaveVestuario", rival, { confirm: true });
assert.equal((await db.doc("teamMembers/" + rival.uid).get()).exists, false);
assert.ok((await db.doc("users/" + rival.uid).get()).get("removedAt"));
const left = (await db.doc("accessRequests/" + rival.uid).get()).data();
assert.equal(left.status, "left");
assert.equal(left.resolvedBy, rival.uid);
assert.equal((await db.doc("pushSubscriptions/perfil-" + suffix).get()).exists, false);
assert.equal((await db.doc("playerLinks/" + pD).get()).get("uid"), rival.uid);
checked += 6;
await denied("setNickname", rival, { nickname: "vuelta_" + suffix }, "PERMISSION_DENIED");
await denied("leaveVestuario", rival, { confirm: true }, "PERMISSION_DENIED");
// Gone means gone: asking again waits for a captain.
assert.equal((await ok("requestAccess", rival, { name: "Rival" })).status, "pending");
checked++;
// Leave the door empty for the browser suite that runs next on the same emulators.
await ok("cancelAccessRequest", rival, {});
console.log(
  checked +
    " comprobaciones de integración correctas: acceso, límites, borradores, actas, minutos, revisiones, acumulados, votos, disponibilidad, avisos del siete y perfil.",
);
await db.terminate();
