// Rellena «ha jugado de» en las actas ya publicadas: matches/{id}.ledger[pid].positionsPlayed,
// positionEvents y positionsEstimated, y matches/{id}.system, como los guardaría hoy saveMatchSheet
// (misma pizarra oficial del partido, mismas preferidas). Por defecto: EMULADOR y en seco.
//   node functions/scripts/backfill-positions-played.mjs            → muestra el plan (emulador)
//   node functions/scripts/backfill-positions-played.mjs --write    → lo escribe (emulador)
//   node functions/scripts/backfill-positions-played.mjs --prod [--write] → producción (credenciales por defecto de GCP)
// Idempotente: un acta que ya está como debe no se toca. --prod se niega si FIRESTORE_EMULATOR_HOST está definida.
// Cada escritura lleva la precondición `lastUpdateTime` de la lectura: si alguien guardó el acta entretanto,
// esa no se pisa. Un timeout o un ABORTED no se reintentan: salen como «no confirmados» y hay que relanzarla.
// Usa los módulos COMPILADOS (functions/lib): boardCodes.ts importa "./x.js", que Node no resuelve desde src.
import { existsSync, readFileSync, statSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..");
const ENTRIES = ["positionsPlayed", "officialBoard", "migratePositions", "positions"];

// Sin process.exit(): en Windows cortar el proceso con la salida aún en vuelo dispara un assert de libuv.
process.exitCode = await main();

/** Each module the script loads (and what it imports) must be compiled and newer than its source. */
function staleBuild() {
  const seen = new Set();
  const todo = [...ENTRIES];
  while (todo.length) {
    const name = todo.pop();
    if (seen.has(name)) continue;
    seen.add(name);
    const src = join(ROOT, "src", name + ".ts");
    const lib = join(ROOT, "lib", name + ".js");
    if (!existsSync(lib)) return `falta functions/lib/${name}.js`;
    if (existsSync(src) && statSync(lib).mtimeMs < statSync(src).mtimeMs) return `functions/lib/${name}.js es más antiguo que src/${name}.ts`;
    if (existsSync(src)) for (const m of readFileSync(src, "utf8").matchAll(/from\s+"\.\/([\w-]+)\.js"/g)) todo.push(m[1]);
  }
  return null;
}

async function main() {
  const stale = staleBuild();
  if (stale) {
    console.error(`${stale}. Compila antes: cd functions && npm run build`);
    return 1;
  }
  const lib = (name) => import(new URL(`../lib/${name}.js`, import.meta.url).href);
  const { resolveMigrationTarget, RETRY_CODES, classifyWriteError } = await lib("migratePositions");
  const { backfillPatch } = await lib("positionsPlayed");
  const { findOfficialBoard } = await lib("officialBoard");
  const { isPosCode } = await lib("positions");

  const target = resolveMigrationTarget(process.argv.slice(2), process.env);
  if (!target.ok) {
    console.error(target.error);
    return 1;
  }
  const { write, projectId, emulatorHost } = target;
  if (emulatorHost) process.env.FIRESTORE_EMULATOR_HOST = emulatorHost;
  console.log(target.label);

  const { initializeApp } = await import("firebase-admin/app");
  const { getFirestore, FieldValue } = await import("firebase-admin/firestore");
  initializeApp({ projectId });
  const db = getFirestore();
  try {
    return await backfill(db, write, { backfillPatch, findOfficialBoard, isPosCode, RETRY_CODES, classifyWriteError, FieldValue });
  } finally {
    await db.terminate(); // cierra los canales gRPC: el proceso acaba solo, sin process.exit()
  }
}

async function backfill(db, write, m) {
  const players = await db.collection("players").get();
  const mains = Object.fromEntries(players.docs.map((d) => {
    const main = d.get("positions")?.main;
    return [d.id, m.isPosCode(main) ? main : null];
  }));
  const matches = await db.collection("matches").where("status", "==", "finished").get();
  const counts = { conPizarra: 0, estimados: 0, sinDatos: 0, sinCambios: 0 };
  const plan = [];
  for (const doc of matches.docs) {
    const match = doc.data();
    const seasonId = typeof match.seasonId === "string" ? match.seasonId : "";
    const found = seasonId ? await m.findOfficialBoard(db, seasonId, doc.id) : null;
    const board = found?.board ?? null;
    if (board) counts.conPizarra++;
    const patch = m.backfillPatch(match, board, mains);
    // what the acta will hold once patched (or already holds)
    const after = Object.entries(match.ledger ?? {}).map(([pid, row]) => {
      const key = (k) => `ledger.${pid}.${k}`;
      const pick = (k) => (patch && key(k) in patch ? patch[key(k)] : row?.[k]);
      return { played: pick("positionsPlayed"), estimated: pick("positionsEstimated") === true };
    });
    if (after.some((r) => r.estimated)) counts.estimados++;
    if (!after.some((r) => r.played && Object.keys(r.played).length)) counts.sinDatos++;
    if (!patch) {
      counts.sinCambios++;
      continue;
    }
    plan.push({ doc, patch, board: found?.id ?? null });
  }
  if (plan.length > 0)
    console.table(plan.map(({ doc, patch, board }) => ({
      partido: doc.id,
      pizarra: board ?? "— (estimado)",
      sistema: patch.system ?? "—",
      campos: Object.keys(patch).length - 1,
    })));
  const line = (extra) =>
    [`actas acabadas ${matches.size}`, `con pizarra ${counts.conPizarra}`, `estimados ${counts.estimados}`, `sin datos ${counts.sinDatos}`, `sin cambios ${counts.sinCambios}`, ...extra].join(" · ");

  if (!write) {
    console.log(`Resumen (en seco): ${line([`a escribir ${plan.length}`, "escritos 0", "no confirmados 0"])}`);
    console.log("En seco: añade --write para escribirlo.");
    return 0;
  }

  // BulkWriter: un resultado por acta; un fallo no aborta el resto.
  const bulk = db.bulkWriter();
  bulk.onWriteError((e) => m.RETRY_CODES.has(e.code) && e.failedAttempts < 5);
  const pending = plan.map(({ doc, patch }) => {
    const data = Object.fromEntries(Object.entries(patch).map(([k, v]) => [k, v === null && k !== "system" ? m.FieldValue.delete() : v]));
    return bulk
      .update(doc.ref, data, { lastUpdateTime: doc.updateTime })
      .then(() => "escrita")
      .catch((e) => {
        const outcome = m.classifyWriteError(e?.code);
        if (outcome === "cambiada") console.warn(`${doc.id}: cambiada mientras tanto: no se toca.`);
        else if (outcome === "sin confirmar") console.warn(`${doc.id}: no confirmada (${e?.message ?? e}).`);
        else console.error(`${doc.id}: error al escribir: ${e?.message ?? e}`);
        return outcome;
      });
  });
  await bulk.close(); // envía lo pendiente; las promesas de arriba ya no fallan (cada una recoge su error)
  const outcomes = await Promise.all(pending);
  const n = (o) => outcomes.filter((x) => x === o).length;
  console.log(`Resumen: ${line([`a escribir ${plan.length}`, `escritos ${n("escrita")}`, `no confirmados ${outcomes.length - n("escrita")}`, `(cambiadas ${n("cambiada")}, sin confirmar ${n("sin confirmar")}, errores ${n("error")})`])}`);
  if (outcomes.every((o) => o === "escrita")) return 0;
  console.warn("Quedan actas sin confirmar (cambiadas mientras tanto, sin confirmar o con error): vuelve a lanzarla.");
  return 1;
}
