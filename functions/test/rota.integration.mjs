// Run only with the demo emulators. No production credentials or endpoints.
// Turnos del equipo, against the Firestore emulator: when the convocatoria is published, notifyRota (what
// setConvocatoria and pushOnMatch run) tells the member whose turn it is «Te toca lavar la equipación…» —
// skipping a «No puedo», the car only away — once per match and job (pushLog rota-<match>-<job>), kept in
// his centro de avisos (nobody is subscribed, so nothing is signed or sent).
import assert from "node:assert/strict";
process.env.FIRESTORE_EMULATOR_HOST = "127.0.0.1:8080";
process.env.GCLOUD_PROJECT = "demo-manchester-piti";
process.env.GOOGLE_CLOUD_PROJECT = "demo-manchester-piti";
process.env.FUNCTIONS_EMULATOR = "true";
const { db } = await import("../lib/common.js");
const { notifyRota } = await import("../lib/rota.js");
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
await match("m1", now - 14 * DAY, "finished", true);
await match("m2", now - 7 * DAY, "finished", false);
await match("next", now + 3 * DAY, "scheduled", false);
await db.doc(`rotas/${seasonId}`).set({
  jobs: [
    { id: "lavar", name: "Lavar la equipación", icon: "shirt", awayOnly: false, order: [p("hugo"), p("dani"), p("leo")] },
    { id: "coche", name: "Coche a los partidos fuera", icon: "car", awayOnly: true, order: [p("dani"), p("leo")] },
  ],
  updatedAt: Timestamp.now(),
  updatedBy: "captain",
});
// Lavar: Hugo (m1), Dani (m2) → Leo; but Leo can't → Hugo. Coche: m2 away → Dani did it → Leo; Leo can't → Dani.
await db.doc(`matchPrivate/${p("next")}/availability/uid-${p("leo")}`).set({ response: "no", name: "leo", playerId: p("leo"), at: Timestamp.now() });

const noticesOf = async (k) => (await db.collection("notices").where("uid", "==", "uid-" + p(k)).get()).docs.map((d) => d.data());
await notifyRota(p("next"));
await notifyRota(p("next")); // a retry or «Cambios»: nothing twice
const hugo = await noticesOf("hugo");
const dani = await noticesOf("dani");
assert.equal(hugo.length, 1, "Hugo gets one notice");
assert.match(hugo[0].title, /^Te toca lavar la equipación tras el partido del /);
assert.equal(hugo[0].url, `/matches/${p("next")}?tab=vestuario`);
assert.equal(dani.length, 1, "Dani gets the car's");
assert.match(dani[0].title, /^Te toca poner el coche en el partido del /);
assert.equal((await noticesOf("leo")).length, 0, "Leo said «No puedo»: nothing");
assert.ok((await db.doc(`pushLog/rota-${p("next")}-lavar`).get()).exists);
assert.ok((await db.doc(`pushLog/rota-${p("next")}-coche`).get()).exists);

// A home match: no car; a match already played: nothing.
await match("home", now + 10 * DAY, "scheduled", true);
await notifyRota(p("home"));
assert.equal((await db.doc(`pushLog/rota-${p("home")}-coche`).get()).exists, false);
assert.ok((await db.doc(`pushLog/rota-${p("home")}-lavar`).get()).exists);
await notifyRota(p("m2"));
assert.equal((await db.doc(`pushLog/rota-${p("m2")}-lavar`).get()).exists, false);

console.log("rota.integration: ok");
process.exit(0);
