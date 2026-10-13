// Rellena players/{id}.positions desde naturalPosition (texto antiguo). Por defecto: EMULADOR y en seco.
//   node functions/scripts/migrate-positions.mjs            → muestra el plan (emulador)
//   node functions/scripts/migrate-positions.mjs --write    → lo escribe (emulador)
//   node functions/scripts/migrate-positions.mjs --prod [--write] → producción (credenciales por defecto de GCP)
// Idempotente: solo toca fichas sin `positions`. No cambia naturalPosition.
import { legacyPlan } from "../src/positions.ts";

const write = process.argv.includes("--write");
const prod = process.argv.includes("--prod");
if (!prod) process.env.FIRESTORE_EMULATOR_HOST ??= "127.0.0.1:8080";
const { initializeApp } = await import("firebase-admin/app");
const { getFirestore } = await import("firebase-admin/firestore");
initializeApp({ projectId: prod ? "futbolmanagement-dc6cb" : "demo-manchester-piti" });
const db = getFirestore();

const snap = await db.collection("players").get();
const plan = legacyPlan(snap.docs.map((d) => ({ id: d.id, ...d.data() })));
console.table(plan.map((p) => ({ id: p.id, antes: p.from, preferida: p.to.main ?? "— (Sin posición)" })));
console.log(`${plan.length} fichas sin «positions» (${prod ? "PRODUCCIÓN" : "emulador"}).`);
if (!write) {
  console.log("En seco: añade --write para escribirlo.");
  process.exit(0);
}
const batch = db.batch();
for (const p of plan) batch.update(db.collection("players").doc(p.id), { positions: p.to });
await batch.commit();
console.log(`Escritas ${plan.length}.`);
