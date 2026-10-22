// Run only with the demo emulators. No production credentials or endpoints.
// «La porra del equipo: N ya han apostado»: a porra created or deleted in matchPrivate/{m}/predictions recounts
// them on matchPrivate/{m}.porraCount (porraCountOnWrite); editing one leaves the count as it is.
import assert from "node:assert/strict";
process.env.FIRESTORE_EMULATOR_HOST = "127.0.0.1:8080";
process.env.FIREBASE_AUTH_EMULATOR_HOST = "127.0.0.1:9099";
// (the demo project, whatever the shell's GCP variables say)
process.env.GCLOUD_PROJECT = "demo-manchester-piti";
process.env.GOOGLE_CLOUD_PROJECT = "demo-manchester-piti";
process.env.FUNCTIONS_EMULATOR = "true";
const { db } = await import("../lib/common.js");

const suffix = Date.now().toString(36);
let checked = 0;
const sleep = (ms) => new Promise((ok) => setTimeout(ok, ms));
/** Waits until `test` holds (the trigger did its job; up to a minute). */
async function until(what, test) {
  for (let i = 0; i < 240; i++) {
    if (await test()) {
      checked++;
      return;
    }
    await sleep(250);
  }
  assert.fail(what);
}

const matchId = `porra-count-${suffix}`;
const preds = db.collection("matchPrivate").doc(matchId).collection("predictions");
const count = async () => (await db.doc(`matchPrivate/${matchId}`).get()).get("porraCount");
const porra = (gf, ga) => ({ goalsFor: gf, goalsAgainst: ga, goals: [], name: "Prueba", at: new Date() });

// (the count is kept only for a match that is there: the porras of a deleted one never bring its doc back)
await db.doc(`matches/${matchId}`).set({ rival: "Prueba", status: "scheduled" });
await preds.doc("u1").set(porra(2, 1));
await preds.doc("u2").set(porra(1, 1));
await until("two porras counted", async () => (await count()) === 2);

await preds.doc("u1").delete();
await until("one porra left", async () => (await count()) === 1);

// an edit is not a new porra
await preds.doc("u2").set(porra(3, 0));
await sleep(3000);
assert.equal(await count(), 1);
checked++;

await preds.doc("u2").delete();
await until("none left", async () => (await count()) === 0);

// a deleted match (tombstone first, as deleteMatch does): its porras going don't recreate matchPrivate
await preds.doc("u3").set(porra(1, 0));
await until("the last porra counted", async () => (await count()) === 1);
await db.doc(`matchTombstones/${matchId}`).set({ at: new Date() });
await db.doc(`matches/${matchId}`).delete();
await db.doc(`matchPrivate/${matchId}`).delete();
await preds.doc("u3").delete();
await sleep(3000);
assert.equal((await db.doc(`matchPrivate/${matchId}`).get()).exists, false);
checked++;
await db.doc(`matchTombstones/${matchId}`).delete();

console.log(`porra-count.integration: ${checked} checks ok`);
process.exit(0);
