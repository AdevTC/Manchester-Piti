// Run only with the demo emulators. No production credentials or endpoints.
// Encuestas del vestuario, against the Firestore + Functions emulators: a poll created in polls/{id} gets
// one «Nueva encuesta» for the team (onPollCreated): one pushLog/poll-<id> and one notice kept in the
// centro de avisos (nobody is subscribed, so nothing is signed or sent). The trigger again on the same
// poll (a retry: Firestore delivers at least once) sends and stores nothing new.
import assert from "node:assert/strict";
process.env.FIRESTORE_EMULATOR_HOST = "127.0.0.1:8080";
process.env.FIREBASE_AUTH_EMULATOR_HOST = "127.0.0.1:9099";
// (the demo project, whatever the shell's GCP variables say)
process.env.GCLOUD_PROJECT = "demo-manchester-piti";
process.env.GOOGLE_CLOUD_PROJECT = "demo-manchester-piti";
// (the functions' own Firestore client, as under the emulator: no REST/credentials lookup)
process.env.FUNCTIONS_EMULATOR = "true";
const { db } = await import("../lib/common.js");
const { deliver } = await import("../lib/push.js");
const { pollNotice, POLL_URL } = await import("../lib/pollsLogic.js");
const { Timestamp } = await import("firebase-admin/firestore");

const suffix = Date.now().toString(36);
let checked = 0;
const sleep = (ms) => new Promise((ok) => setTimeout(ok, ms));
/** Waits until `test` holds (the trigger did its job; up to a minute: a trigger's first run after the
 *  emulator loads it can take half of that). */
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

const HOUR = 3_600_000;
const now = Date.now();
const question = `¿Cena el viernes? ${suffix}`;
const poll = {
  question,
  options: [{ id: "o1", label: "Sí" }, { id: "o2", label: "No" }],
  multi: false,
  authorUid: "encuesta-author-" + suffix,
  authorName: "nico",
  createdAt: Timestamp.fromMillis(now),
  closesAt: Timestamp.fromMillis(now + 72 * HOUR),
};
const ref = await db.collection("polls").add(poll);
const id = ref.id;
const logRef = db.doc(`pushLog/poll-${id}`);
const kept = async () => (await db.collection("notices").where("url", "==", POLL_URL).get()).docs.filter((d) => d.get("body") === `nico: ${question}`);

// ---------- created: one claim, one notice for the team
await until("pushLog/poll-<id> claimed", async () => (await logRef.get()).exists);
await until("the notice kept in the centro de avisos", async () => (await kept()).length === 1);
const n = (await kept())[0].data();
assert.equal(n.title, "Nueva encuesta");
assert.equal(n.topic, "lineup");
assert.equal(n.audience, "team");
assert.equal(n.uid, undefined);
checked++;
const claimedAt = (await logRef.get()).get("at").toMillis();

// ---------- a retry: the trigger's own step again on the same poll — nothing new
await deliver(pollNotice(id, poll));
await deliver(pollNotice(id, poll));
await sleep(2000);
assert.equal((await logRef.get()).get("at").toMillis(), claimedAt, "the claim stays the first one");
assert.equal((await kept()).length, 1, "a retry stores no second notice");
checked++;

// ---------- clean up
for (const d of await kept()) await d.ref.delete();
await logRef.delete();
await ref.delete();

console.log(checked + " comprobaciones de encuestas correctas: una encuesta nueva, un solo aviso al equipo y sin copias al reintentar.");
await db.terminate();
