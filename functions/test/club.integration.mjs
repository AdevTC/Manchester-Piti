// Run only with the demo emulators. No production credentials or endpoints.
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
process.env.FIRESTORE_EMULATOR_HOST = "127.0.0.1:8080";
process.env.FIREBASE_AUTH_EMULATOR_HOST = "127.0.0.1:9099";
const { initializeApp } = await import("firebase-admin/app");
const { getFirestore, Timestamp } = await import("firebase-admin/firestore");
initializeApp({ projectId: "demo-manchester-piti" });
const db = getFirestore();
const secret = readFileSync(
  new URL("../.secret.local", import.meta.url),
  "utf8",
)
  .trim()
  .split("=")
  .slice(1)
  .join("=");
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
    "http://127.0.0.1:5001/demo-manchester-piti/us-central1/" + name,
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
await denied("enterTeam", null, { password: secret }, "UNAUTHENTICATED");
for (let i = 0; i < 5; i++)
  await denied(
    "enterTeam",
    blocked,
    { password: "wrong" },
    "PERMISSION_DENIED",
  );
await denied("enterTeam", blocked, { password: secret }, "RESOURCE_EXHAUSTED");
await ok("enterTeam", admin, { password: secret });
await ok("enterTeam", member, { password: secret });
const newcomer = await google("newcomer");
await denied(
  "registerTeamProfile",
  newcomer,
  { nickname: "n" + suffix },
  "PERMISSION_DENIED",
);
await ok("enterTeam", newcomer, { password: secret });
const registered = await ok("registerTeamProfile", newcomer, {
  nickname: "n" + suffix,
  role: "superadmin",
});
assert.equal(registered.role, "user");
checked++;
await denied(
  "registerTeamProfile",
  member,
  { nickname: "n" + suffix },
  "ALREADY_EXISTS",
);
await ok("registerTeamProfile", newcomer, { nickname: "x" + suffix });
await ok("registerTeamProfile", member, { nickname: "n" + suffix });
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
const access = await ok("enterTeam", member, { password: secret });
// The key now unlocks the device for 30 days.
assert.ok(access.expiresAt - Date.now() > 29 * 86400000);
checked++;
await ok("leaveTeam", member, {});
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
const training = await ok("proposeTraining", fan, {
  slots: [{ at: Date.now() + 2 * 86400000, end: Date.now() + 2 * 86400000 + 90 * 60000, place: "Campo" }, { at: Date.now() + 86400000 }],
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
const feed = await fetch("http://127.0.0.1:5001/demo-manchester-piti/us-central1/clubCalendar").then((r) => r.text());
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
  "http://127.0.0.1:5001/demo-manchester-piti/us-central1/clubShare";
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
const calendarUrl = "http://127.0.0.1:5001/demo-manchester-piti/us-central1/clubCalendar";
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
console.log(
  checked +
    " comprobaciones de integración correctas: acceso, límites, borradores, actas, minutos, revisiones, acumulados, votos y disponibilidad.",
);
await db.terminate();
