// Run only with the demo emulators. No production credentials or endpoints.
// Turnos del equipo, against the Firestore emulator: a played match's turns are frozen into
// rotaTurns/{matchId} (freezeOnMatch, what pushOnMatch runs when it finishes; and lazily, before a later
// match's convocatoria, even without its acta); the convocatoria's notifyRota tells the member whose turn
// it is «Te toca lavar la equipación…», skipping a «No puedo», the car only away, once per match, job and
// member (pushLog rota-<match>-<job>-<player>); a captain's swap tells the new member (notifyRotaChange, what
// rotaTurnsOnWrite runs); when the one whose turn it is says «No puedo», the next one is told once, never
// for a pinned job (notifyRotaHandover, what pushOnAnswer runs). Kept in each centro de avisos (nobody is subscribed, so nothing is signed or sent).
import assert from "node:assert/strict";
process.env.FIRESTORE_EMULATOR_HOST = "127.0.0.1:8080";
process.env.GCLOUD_PROJECT = "demo-manchester-piti";
process.env.GOOGLE_CLOUD_PROJECT = "demo-manchester-piti";
process.env.FUNCTIONS_EMULATOR = "true";
const { db } = await import("../lib/common.js");
const { freezeOnMatch, notifyRota, notifyRotaChange, notifyRotaHandover } = await import("../lib/rota.js");
const { Timestamp } = await import("firebase-admin/firestore");

const suffix = Date.now().toString(36);
const DAY = 86_400_000;
const now = Date.now();
const seasonId = "rota-season-" + suffix;
const p = (k) => `rota-${k}-${suffix}`;
await db.doc(`seasons/${seasonId}`).set({ name: "Turnos · pruebas" });
for (const k of ["hugo", "dani", "leo"]) {
  await db.doc(`players/${p(k)}`).set({ firstName: k, seasons: [seasonId] });
  await db.doc(`playerLinks/${p(k)}`).set({ uid: "uid-" + p(k) });
}
const match = (k, date, status, home) => db.doc(`matches/${p(k)}`).set({ version: 2, seasonId, rival: "Rayo", status, home, date: Timestamp.fromMillis(date), events: [] });
await db.doc(`rotas/${seasonId}`).set({
  jobs: [
    { id: "lavar", name: "Lavar la equipación", icon: "shirt", awayOnly: false, order: [p("hugo"), p("dani"), p("leo")] },
    { id: "coche", name: "Coche a los partidos fuera", icon: "car", awayOnly: true, order: [p("dani"), p("leo")] },
  ],
  updatedAt: Timestamp.now(),
  updatedBy: "captain",
});
await match("m1", now - 14 * DAY, "finished", true);
// m2 was played a week ago, but nobody has published its acta: still «scheduled»
await match("m2", now - 7 * DAY, "scheduled", false);
await match("next", now + 3 * DAY, "scheduled", false);
const turnsOf = async (k) => (await db.doc(`rotaTurns/${p(k)}`).get()).data();

// The freeze: m1 finished → its turns are history (home: no car).
await freezeOnMatch(p("m1"));
const m1 = await turnsOf("m1");
assert.equal(m1?.frozen, true, "m1 frozen");
assert.equal(m1.seasonId, seasonId);
assert.equal(m1.lavar.playerId, p("hugo"));
assert.equal(m1.coche, undefined, "no car at home");

// Leo can't make the next one.
await db.doc(`matchPrivate/${p("next")}/availability/uid-${p("leo")}`).set({ response: "no", name: "leo", playerId: p("leo"), at: Timestamp.now() });
const noticesOf = async (k) => (await db.collection("notices").where("uid", "==", "uid-" + p(k)).get()).docs.map((d) => d.data());
await notifyRota(p("next"));
await notifyRota(p("next")); // a retry or «Cambios»: nothing twice

// m2's date has passed: frozen lazily before the convocatoria (Lavar: Dani, the longest without; Coche: Dani
// is taken, so Leo).
const m2 = await turnsOf("m2");
assert.equal(m2?.frozen, true, "m2 frozen without its acta");
assert.equal(m2.lavar.playerId, p("dani"));
assert.equal(m2.coche.playerId, p("leo"));

// next: Lavar → Leo has never done it but can't → Hugo (longer without than Dani); Coche → Dani.
const hugo = await noticesOf("hugo");
const dani = await noticesOf("dani");
assert.equal(hugo.length, 1, "Hugo gets one notice");
assert.match(hugo[0].title, /^Te toca lavar la equipación tras el partido del /);
assert.match(hugo[0].body, /Si no puedes, marca «No puedo» y pasa al siguiente\./);
assert.equal(hugo[0].url, `/matches/${p("next")}?tab=vestuario`);
assert.equal(dani.length, 1, "Dani gets the car's");
assert.match(dani[0].title, /^Te toca poner el coche en el partido del /);
assert.equal((await noticesOf("leo")).length, 0, "Leo said «No puedo»: nothing");
assert.ok((await db.doc(`pushLog/rota-${p("next")}-lavar-${p("hugo")}`).get()).exists);
assert.ok((await db.doc(`pushLog/rota-${p("next")}-coche-${p("dani")}`).get()).exists);
assert.equal((await turnsOf("next"))?.frozen, undefined, "an upcoming match is never frozen");

// A captain swaps Lavar to Leo (the convocatoria is out): Leo is told, once; nobody else again.
await db.doc(`pushLog/conv-${p("next")}`).set({ at: Timestamp.now(), matchId: p("next") });
await db.doc(`matchPrivate/${p("next")}/availability/uid-${p("leo")}`).delete();
const before = (await db.doc(`rotaTurns/${p("next")}`).get()).data();
const after = { seasonId, lavar: { playerId: p("leo"), swappedFrom: p("hugo"), at: Timestamp.now() } };
await db.doc(`rotaTurns/${p("next")}`).set(after);
await notifyRotaChange(p("next"), before, after);
await notifyRotaChange(p("next"), before, after);
const leo = await noticesOf("leo");
assert.equal(leo.length, 1, "Leo gets the swap's notice once");
assert.match(leo[0].title, /^Te toca lavar la equipación/);
assert.equal((await noticesOf("hugo")).length, 1);
assert.equal((await noticesOf("dani")).length, 1);
// the backend's own freeze says nothing
await notifyRotaChange(p("m2"), undefined, { ...m2, lavar: { playerId: p("hugo"), at: Timestamp.now() } });
assert.equal((await db.doc(`pushLog/rota-${p("m2")}-lavar-${p("hugo")}`).get()).exists, false);

// A home match: no car; a match already played: nothing.
await match("home", now + 10 * DAY, "scheduled", true);
await notifyRota(p("home"));
const logged = async (m, job, k) => (await db.doc(`pushLog/rota-${p(m)}-${job}-${p(k)}`).get()).exists;
assert.equal(await logged("home", "coche", "dani"), false);
assert.equal(await logged("home", "coche", "leo"), false);
assert.ok(await logged("home", "lavar", "leo"), "home: Leo, who has never washed");
await notifyRota(p("m2"));
for (const k of ["hugo", "dani", "leo"]) assert.equal(await logged("m2", "lavar", k), false);

// The one whose turn it is can't (notifyRotaHandover, what pushOnAnswer runs on his «No puedo»): the next
// one is told, once. History before «later»: m1 (Lava Hugo), m2 (Lava Dani, Coche Leo) → Lava Leo, Coche Dani.
const conv = (k) => db.doc(`pushLog/conv-${p(k)}`).set({ at: Timestamp.now(), matchId: p(k) });
const sayNo = (m, k) => db.doc(`matchPrivate/${p(m)}/availability/uid-${p(k)}`).set({ response: "no", name: k, playerId: p(k), at: Timestamp.now() });
const noticesFor = async (m, k) => (await noticesOf(k)).filter((n) => n.url === `/matches/${p(m)}?tab=vestuario`);
await match("later", now + 20 * DAY, "scheduled", false);
await conv("later");
await notifyRota(p("later"));
assert.ok(await logged("later", "lavar", "leo"));
assert.ok(await logged("later", "coche", "dani"));
await sayNo("later", "leo");
await notifyRotaHandover(p("later"), p("leo"));
await notifyRotaHandover(p("later"), p("leo")); // a retry: nothing twice
// Lava → Hugo (longer without than Dani); the car stays Dani's
const hugoLater = await noticesFor("later", "hugo");
assert.equal(hugoLater.length, 1, "Hugo, next in line, gets exactly one notice");
assert.match(hugoLater[0].title, /^Te toca lavar la equipación tras el partido del /);
assert.equal((await noticesFor("later", "dani")).length, 1, "Dani: only the car's, from the convocatoria");
assert.equal((await noticesFor("later", "leo")).length, 1, "Leo: only his first one");
// back to «Voy»: nothing more for anyone
await db.doc(`matchPrivate/${p("later")}/availability/uid-${p("leo")}`).set({ response: "yes", name: "leo", playerId: p("leo"), at: Timestamp.now() });
await notifyRotaHandover(p("later"), p("leo"));
for (const k of ["hugo", "dani", "leo"]) assert.equal((await noticesFor("later", k)).length, 1);

// A captain pinned the wash to Leo: his «No puedo» passes nothing on (the captain sorts it out).
await match("pinned", now + 27 * DAY, "scheduled", false);
await db.doc(`rotaTurns/${p("pinned")}`).set({ seasonId, lavar: { playerId: p("leo"), at: Timestamp.now() } });
await conv("pinned");
await notifyRota(p("pinned"));
assert.ok(await logged("pinned", "lavar", "leo"));
await sayNo("pinned", "leo");
await notifyRotaHandover(p("pinned"), p("leo"));
assert.equal(await logged("pinned", "lavar", "hugo"), false, "a pinned job: nobody else is told");
assert.equal(await logged("pinned", "lavar", "dani"), false);
for (const k of ["hugo", "leo"]) assert.equal((await noticesFor("pinned", k)).length, k === "leo" ? 1 : 0);

console.log("rota.integration: ok");
process.exit(0);
