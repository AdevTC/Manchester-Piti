// Saca el análisis narrado de los partidos: `matches/{id}.analysis` → `matchAnalysis/{id}` (functions/src/analysisPlace.ts
// dice por qué). Dos pasos, cada uno su ejecución, y cada uno en seco por defecto (solo cuenta y enseña el plan):
//   1. copiar (por defecto): a su sitio, donde falta o es más antiguo (por la revisión del análisis). Los partidos no
//      cambian.
//   2. --quitar-campo: borra el campo viejo de los partidos, SOLO donde su sitio ya lo tiene (misma revisión y mismo
//      contenido, o una posterior). Si alguno «falta copiar», ese no se toca: lanza antes el paso 1.
// Cada partido va en su transacción (lee el partido y su sitio, decide y escribe): un acta guardada mientras tanto no se
// pisa. El paso 2 no cambia la revisión del partido ni su fecha de actualización.
// Orden: reglas, funciones y web desplegadas (en cualquier orden: los lectores miran los dos sitios) → paso 1 → paso 2
// (solo con las funciones y la web nuevas ya en producción: una web vieja lee el análisis solo del partido).
//   node functions/scripts/migrate-analysis.mjs                      → plan del paso 1 (emulador)
//   node functions/scripts/migrate-analysis.mjs --write              → lo escribe (emulador)
//   … --quitar-campo [--write]                                       → paso 2
//   … --prod                                                         → plan en producción (credenciales por defecto de GCP)
//   … --prod --write --project=futbolmanagement-dc6cb --expect=<N>   → lo escribe, solo si el plan tiene justo N
// --prod se niega si FIRESTORE_EMULATOR_HOST está definida. Usa los módulos COMPILADOS (functions/lib): cd functions &&
// npm run build antes.
import { existsSync, readFileSync, statSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..");
const ENTRIES = ["analysisMoveLogic", "analysisPlaceLogic", "migratePositions"];

process.exitCode = await main();

function staleBuild() {
  for (const name of ENTRIES) {
    const src = join(ROOT, "src", name + ".ts");
    const out = join(ROOT, "lib", name + ".js");
    if (!existsSync(out)) return `Falta ${out}`;
    if (statSync(out).mtimeMs < statSync(src).mtimeMs) return `${out} es más antiguo que su fuente`;
  }
  return null;
}
function readOrNull(path) {
  try {
    return readFileSync(path, "utf8");
  } catch {
    return null;
  }
}

async function main() {
  const stale = staleBuild();
  if (stale) {
    console.error(`${stale}. Compila antes: cd functions && npm run build`);
    return 1;
  }
  const lib = (name) => import(new URL(`../lib/${name}.js`, import.meta.url).href);
  const { planMove } = await lib("analysisMoveLogic");
  const { resolveMigrationTarget, checkExpected, credentialProject } = await lib("migratePositions");
  const argv = process.argv.slice(2);
  const step = argv.includes("--quitar-campo") ? "quitar" : "copiar";
  const target = resolveMigrationTarget(argv.filter((a) => a !== "--quitar-campo"), process.env);
  if (!target.ok) {
    console.error(target.error);
    return 1;
  }
  const { write, projectId, emulatorHost } = target;
  if (emulatorHost) process.env.FIRESTORE_EMULATOR_HOST = emulatorHost;
  console.log(`${target.label}${target.prod ? ` · credencial: ${credentialProject(process.env, readOrNull) ?? "proyecto desconocido"}` : ""} · paso: ${step === "copiar" ? "1, copiar a matchAnalysis" : "2, quitar el campo de los partidos"} · ${write ? "ESCRIBE" : "en seco"}`);

  const { initializeApp } = await import("firebase-admin/app");
  const { getFirestore, FieldValue } = await import("firebase-admin/firestore");
  initializeApp({ projectId });
  const db = getFirestore();
  try {
    // (only the field: every match's analysis together is megabytes, one at a time below)
    const ids = (await db.collection("matches").select().get()).docs.map((d) => d.id);
    const plan = [];
    const counts = { nada: 0, "falta copiar": 0 };
    for (const id of ids) {
      const [match, place] = await db.getAll(db.doc(`matches/${id}`), db.doc(`matchAnalysis/${id}`));
      const action = planMove(step, match.get("analysis"), place.data());
      if (action === "copiar" || action === "quitar") plan.push({ id, action, bytes: Buffer.byteLength(JSON.stringify(match.get("analysis"))), revision: match.get("analysis.revision") ?? null });
      else counts[action]++;
    }
    if (plan.length) console.table(plan);
    console.log(`partidos: ${ids.length} · a escribir: ${plan.length} · sin nada que hacer: ${counts.nada}${step === "quitar" ? ` · falta copiar (no se tocan): ${counts["falta copiar"]}` : ""}`);
    if (!write) {
      console.log("En seco: no se ha escrito nada. Añade --write para escribirlo.");
      return 0;
    }
    const refused = checkExpected(target.expect, plan.length);
    if (refused) {
      console.error(refused);
      return 1;
    }
    const outcomes = { escrita: 0, cambiada: 0, error: 0 };
    for (const p of plan) {
      try {
        const done = await db.runTransaction(async (tx) => {
          const [match, place] = await tx.getAll(db.doc(`matches/${p.id}`), db.doc(`matchAnalysis/${p.id}`));
          // (decided again inside: whatever changed since the plan)
          const action = planMove(step, match.get("analysis"), place.data());
          if (action !== p.action) return false;
          if (action === "copiar") tx.set(db.doc(`matchAnalysis/${p.id}`), { analysis: match.get("analysis"), updatedAt: FieldValue.serverTimestamp() });
          else tx.update(db.doc(`matches/${p.id}`), { analysis: FieldValue.delete() });
          return true;
        });
        outcomes[done ? "escrita" : "cambiada"]++;
        console.log(`${p.id}: ${done ? (p.action === "copiar" ? "copiado" : "campo quitado") : "cambió entretanto: no se toca (vuelve a lanzarla)"}`);
      } catch (e) {
        outcomes.error++;
        console.error(`${p.id}: error (${e?.message ?? e})`);
      }
    }
    console.log(`escritas: ${outcomes.escrita} · cambiadas entretanto: ${outcomes.cambiada} · errores: ${outcomes.error}`);
    return outcomes.error || outcomes.cambiada ? 1 : 0;
  } finally {
    await db.terminate();
  }
}
