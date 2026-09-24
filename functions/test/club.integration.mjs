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
    "http://127.0.0.1:5001/demo-manchester-piti/europe-west1/" + name,
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
await ok("setAvailability", member, { matchId: id, response: "yes" });
await denied(
  "voteMvp",
  member,
  { matchId: id, playerId: ids[0] },
  "FAILED_PRECONDITION",
);
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
await ok("voteMvp", member, { matchId: id, playerId: ids[7] });
await ok("voteMvp", member, { matchId: id, playerId: ids[1] });
await ok("voteMvp", member, { matchId: id, playerId: ids[1] });
let votes = await db.doc("mvpResults/" + id).get();
assert.equal(votes.get("total"), 1);
assert.equal(votes.get("counts")[ids[1]], 1);
checked += 2;
await denied(
  "voteMvp",
  member,
  { matchId: id, playerId: ids[9] },
  "INVALID_ARGUMENT",
);
await denied(
  "setAvailability",
  member,
  { matchId: id, response: "yes" },
  "FAILED_PRECONDITION",
);
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
assert.equal((await db.doc("mvpResults/" + id).get()).get("total"), 0);
checked++;
assert.equal(
  (await db.doc("matches/" + id + "/votes/" + member.uid).get()).exists,
  false,
);
checked++;
await db
  .doc("teamMembers/" + member.uid)
  .set({ expiresAt: Timestamp.fromMillis(Date.now() - 1) });
await denied(
  "voteMvp",
  member,
  { matchId: id, playerId: ids[0] },
  "PERMISSION_DENIED",
);
await ok("enterTeam", member, { password: secret });
await ok("leaveTeam", member, {});
await denied(
  "voteMvp",
  member,
  { matchId: id, playerId: ids[0] },
  "PERMISSION_DENIED",
);
await db.doc("matches/" + id).update({ voteClosesAt: Date.now() - 1 });
await denied(
  "voteMvp",
  admin,
  { matchId: id, playerId: ids[0] },
  "FAILED_PRECONDITION",
);
const shareBase =
  "http://127.0.0.1:5001/demo-manchester-piti/europe-west1/clubShare";
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
console.log(
  checked +
    " comprobaciones de integración correctas: acceso, límites, borradores, actas, minutos, revisiones, acumulados, votos y disponibilidad.",
);
await db.terminate();
