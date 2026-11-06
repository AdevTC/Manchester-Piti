// Demo-only: functions/scripts/migrate-member-emails.mjs against the Firestore emulator. En seco no toca nada;
// --write copia cada correo del perfil a memberEmails/{uid} (sin pisar el que ya hay) y lo quita del perfil;
// otra pasada ya no tiene nada que escribir; --dry-run con --write se niega.
import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { fileURLToPath } from "node:url";
process.env.FIRESTORE_EMULATOR_HOST = "127.0.0.1:8080";
const { initializeApp } = await import("firebase-admin/app");
const { getFirestore } = await import("firebase-admin/firestore");
initializeApp({ projectId: "demo-manchester-piti" });
const db = getFirestore();
const suffix = Date.now().toString(36);
const script = fileURLToPath(new URL("../scripts/migrate-member-emails.mjs", import.meta.url));
let checks = 0;

const run = (...args) => {
  const r = spawnSync(process.execPath, [script, ...args], { encoding: "utf8", env: { ...process.env, FIRESTORE_EMULATOR_HOST: "127.0.0.1:8080" } });
  return { code: r.status, out: (r.stdout ?? "") + (r.stderr ?? "") };
};
const count = (out, label) => Number(new RegExp(`${label} (\\d+)`).exec(out)?.[1] ?? NaN);

const uid = (k) => `mail-${k}-${suffix}`;
// a profile from before (email inside), one whose door already wrote memberEmails (a newer address), one with a
// blank email, and one already migrated
await db.doc(`users/${uid("old")}`).set({ nickname: `old_${suffix}`, role: "user", email: "old@example.test" });
await db.doc(`users/${uid("both")}`).set({ nickname: `both_${suffix}`, role: "user", email: "viejo@example.test" });
await db.doc(`memberEmails/${uid("both")}`).set({ email: "nuevo@example.test" });
await db.doc(`users/${uid("blank")}`).set({ nickname: `blank_${suffix}`, role: "user", email: "" });
await db.doc(`users/${uid("done")}`).set({ nickname: `done_${suffix}`, role: "user" });
await db.doc(`memberEmails/${uid("done")}`).set({ email: "done@example.test" });

// 1 · en seco (también con --dry-run explícito): cuenta, no escribe
for (const args of [[], ["--dry-run"]]) {
  const dry = run(...args);
  assert.equal(dry.code, 0, dry.out);
  assert.match(dry.out, /Resumen \(en seco\)/);
  assert.ok(count(dry.out, "a escribir") >= 3, dry.out);
  assert.ok(!dry.out.includes("old@example.test"), "la salida nunca lleva correos");
  checks += 3;
}
assert.equal((await db.doc(`users/${uid("old")}`).get()).get("email"), "old@example.test");
assert.equal((await db.doc(`memberEmails/${uid("old")}`).get()).exists, false);
checks += 2;

// 2 · --dry-run y --write a la vez: se niega
assert.notEqual(run("--dry-run", "--write").code, 0);
checks++;

// 3 · --write
const wrote = run("--write");
assert.equal(wrote.code, 0, wrote.out);
assert.equal(count(wrote.out, "errores"), 0, wrote.out);
checks += 2;
const user = async (k) => (await db.doc(`users/${uid(k)}`).get()).data();
const mail = async (k) => (await db.doc(`memberEmails/${uid(k)}`).get()).get("email");
assert.equal((await user("old")).email, undefined);
assert.equal((await user("old")).nickname, `old_${suffix}`);
assert.equal(await mail("old"), "old@example.test");
assert.equal((await user("both")).email, undefined);
assert.equal(await mail("both"), "nuevo@example.test"); // the newer one stays
assert.equal((await user("blank")).email, undefined);
assert.equal((await db.doc(`memberEmails/${uid("blank")}`).get()).exists, false);
assert.equal(await mail("done"), "done@example.test");
checks += 8;

// 4 · idempotente: nada más que escribir
const again = run();
assert.equal(again.code, 0, again.out);
assert.equal(count(again.out, "a escribir"), 0, again.out);
checks++;

for (const k of ["old", "both", "blank", "done"]) await Promise.all([db.doc(`users/${uid(k)}`).delete(), db.doc(`memberEmails/${uid(k)}`).delete()]);
console.log(`${checks} comprobaciones: la migración del correo a memberEmails cuenta en seco, copia sin pisar, lo quita del perfil y es idempotente.`);
await db.terminate();
