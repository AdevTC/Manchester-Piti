// Rellena players/{id}.positions desde naturalPosition (texto antiguo). Por defecto: EMULADOR y en seco.
//   node functions/scripts/migrate-positions.mjs            → muestra el plan (emulador)
//   node functions/scripts/migrate-positions.mjs --write    → lo escribe (emulador)
//   node functions/scripts/migrate-positions.mjs --prod          → plan en producción (credenciales por defecto de GCP)
//   … --prod --write --project=futbolmanagement-dc6cb --expect=<N> → lo escribe, si el plan tiene justo N fichas
// Idempotente: solo toca fichas sin `positions`. No cambia naturalPosition.
// --prod se niega si FIRESTORE_EMULATOR_HOST está definida. Cada escritura lleva la precondición
// `lastUpdateTime` de la lectura: si un admin tocó la ficha entretanto, esa no se pisa (y el resto sigue).
// Bajo esa precondición un timeout o un ABORTED no se reintentan (si llegó, el reintento diría «cambiada»):
// salen como «no confirmadas». Si queda alguna cambiada o sin confirmar, sale con 1: vuelve a lanzarla.
import { legacyPlan } from "../src/positions.ts";
import { readFileSync } from "node:fs";
import { RETRY_CODES, checkExpected, classifyWriteError, credentialProject, migrationExit, migrationSummary, resolveMigrationTarget } from "../src/migratePositions.ts";

// Sin process.exit(): en Windows cortar el proceso con la salida aún en vuelo dispara un assert de libuv.
process.exitCode = await main();

async function main() {
  const target = resolveMigrationTarget(process.argv.slice(2), process.env);
  if (!target.ok) {
    console.error(target.error);
    return 1;
  }
  const { write, projectId, emulatorHost } = target;
  if (emulatorHost) process.env.FIRESTORE_EMULATOR_HOST = emulatorHost;
  const readOrNull = (path) => {
    try {
      return readFileSync(path, "utf8");
    } catch {
      return null;
    }
  };
  console.log(target.prod ? `${target.label} · credencial: ${credentialProject(process.env, readOrNull) ?? "proyecto desconocido"}` : target.label);

  const { initializeApp } = await import("firebase-admin/app");
  const { getFirestore } = await import("firebase-admin/firestore");
  initializeApp({ projectId });
  const db = getFirestore();
  try {
    return await migrate(db, write, target.expect);
  } finally {
    await db.terminate(); // cierra los canales gRPC: el proceso acaba solo, sin process.exit()
  }
}

async function migrate(db, write, expect) {
  const snap = await db.collection("players").get();
  const byId = new Map(snap.docs.map((d) => [d.id, d]));
  const plan = legacyPlan(snap.docs.map((d) => ({ id: d.id, ...d.data() })));
  if (plan.length > 0) console.table(plan.map((p) => ({ id: p.id, antes: p.from, preferida: p.to.main ?? "— (Sin posición)" })));
  console.log(`${plan.length} de ${snap.size} fichas sin «positions».`);

  if (!write) {
    console.log(migrationSummary({ total: snap.size, planned: plan.length, write: false }));
    console.log("En seco: añade --write para escribirlo.");
    return 0;
  }
  const mismatch = checkExpected(expect, plan.length);
  if (mismatch) {
    console.error(mismatch);
    return 1;
  }

  // BulkWriter: lotes pequeños (≤ 20, muy por debajo de 450) y un resultado por ficha; un fallo no aborta el resto.
  const bulk = db.bulkWriter();
  bulk.onWriteError((e) => RETRY_CODES.has(e.code) && e.failedAttempts < 5);
  const pending = plan.map((p) => {
    const doc = byId.get(p.id);
    return bulk
      .update(doc.ref, { positions: p.to }, { lastUpdateTime: doc.updateTime })
      .then(() => "escrita")
      .catch((e) => {
        const outcome = classifyWriteError(e?.code);
        if (outcome === "cambiada") console.warn(`${p.id}: cambiada mientras tanto: no se toca.`);
        else if (outcome === "sin confirmar") console.warn(`${p.id}: no confirmada (${e?.message ?? e}): vuelve a lanzarla.`);
        else console.error(`${p.id}: error al escribir: ${e?.message ?? e}`);
        return outcome;
      });
  });
  await bulk.close(); // envía lo pendiente; las promesas de arriba ya no fallan (cada una recoge su error)
  const outcomes = await Promise.all(pending);
  console.log(migrationSummary({ total: snap.size, planned: plan.length, write: true, outcomes }));
  const exit = migrationExit(outcomes);
  if (exit.advice) console.warn(exit.advice);
  return exit.code;
}
