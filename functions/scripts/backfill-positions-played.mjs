// Rellena «ha jugado de» en las actas ya publicadas: matches/{id}.ledger[pid].positionsPlayed,
// positionEvents y positionsEstimated, y matches/{id}.system, como los guardaría hoy saveMatchSheet
// (misma pizarra oficial del partido, mismas preferidas). Por defecto: EMULADOR y en seco.
//   node functions/scripts/backfill-positions-played.mjs            → muestra el plan (emulador)
//   node functions/scripts/backfill-positions-played.mjs --write    → lo escribe (emulador)
//   … --prod                                                       → plan en producción (credenciales por defecto de GCP)
//   … --prod --write --project=futbolmanagement-dc6cb --expect=<N> → lo escribe, solo si el plan tiene justo N actas
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

const readOrNull = (path) => {
  try {
    return readFileSync(path, "utf8");
  } catch {
    return null;
  }
};

async function main() {
  const stale = staleBuild();
  if (stale) {
    console.error(`${stale}. Compila antes: cd functions && npm run build`);
    return 1;
  }
  const lib = (name) => import(new URL(`../lib/${name}.js`, import.meta.url).href);
  const { resolveMigrationTarget, checkExpected, credentialProject, RETRY_CODES, classifyWriteError } = await lib("migratePositions");
  const { backfillPatch, backfillUpdates } = await lib("positionsPlayed");
  const { findOfficialBoard } = await lib("officialBoard");
  const { isPosCode } = await lib("positions");

  const target = resolveMigrationTarget(process.argv.slice(2), process.env);
  if (!target.ok) {
    console.error(target.error);
    return 1;
  }
  const { write, projectId, emulatorHost } = target;
  if (emulatorHost) process.env.FIRESTORE_EMULATOR_HOST = emulatorHost;
  console.log(target.prod ? `${target.label} · credencial: ${credentialProject(process.env, readOrNull) ?? "proyecto desconocido"}` : target.label);

  const { initializeApp } = await import("firebase-admin/app");
  const { getFirestore, FieldValue, FieldPath } = await import("firebase-admin/firestore");
  initializeApp({ projectId });
  const db = getFirestore();
  try {
    return await backfill(db, write, target.expect, {
      backfillPatch,
      backfillUpdates,
      findOfficialBoard,
      isPosCode,
      checkExpected,
      RETRY_CODES,
      classifyWriteError,
      FieldValue,
      FieldPath,
    });
  } finally {
    await db.terminate(); // cierra los canales gRPC: el proceso acaba solo, sin process.exit()
  }
}

async function backfill(db, write, expect, m) {
  const players = await db.collection("players").get();
  const mains = Object.fromEntries(
    players.docs.map((d) => {
      const main = d.get("positions")?.main;
      return [d.id, m.isPosCode(main) ? main : null];
    }),
  );
  const matches = await db.collection("matches").where("status", "==", "finished").get();
  const counts = { conPizarra: 0, estimados: 0, sinDatos: 0, sinCambios: 0, idNoValido: 0, fallidos: 0 };
  const invalidIds = [];
  const make = { path: (...segments) => new m.FieldPath(...segments), del: m.FieldValue.delete() };
  const plan = [];
  for (const doc of matches.docs) {
    // un acta rara no para el resto: se cuenta y se sigue
    try {
      const match = doc.data();
      const seasonId = typeof match.seasonId === "string" ? match.seasonId : "";
      const onInvalidId = (what, id) => {
        counts.idNoValido++;
        invalidIds.push(`${doc.id}: ${what} «${id}»`);
      };
      const found = seasonId ? await m.findOfficialBoard(db, seasonId, doc.id, { onInvalidId }) : null;
      if (!seasonId) onInvalidId("temporada", String(match.seasonId));
      const board = found?.board ?? null;
      const patch = m.backfillPatch(match, board, mains);
      for (const pid of Object.keys(match.ledger ?? {})) if (!/^[A-Za-z0-9_-]+$/.test(pid)) onInvalidId("jugador", pid);
      const updates = patch ? m.backfillUpdates(patch, make) : null;
      for (const pid of updates?.invalid ?? []) onInvalidId("jugador", pid); // (backfillPatch ya los deja fuera)
      if (board) counts.conPizarra++;
      // lo que tendrá el acta una vez escrita (o lo que ya tiene)
      const after = Object.entries(match.ledger ?? {}).map(([pid, row]) => {
        const changed = patch?.ledger[pid] ?? {};
        const pick = (k) => (k in changed ? changed[k] : row?.[k]);
        return { played: pick("positionsPlayed"), estimated: pick("positionsEstimated") === true };
      });
      if (after.some((r) => r.estimated)) counts.estimados++;
      if (!after.some((r) => r.played && Object.keys(r.played).length)) counts.sinDatos++;
      if (!patch) {
        counts.sinCambios++;
        continue;
      }
      plan.push({ doc, patch, pairs: updates.pairs, board: found?.id ?? null });
    } catch (e) {
      counts.fallidos++;
      console.error(`${doc.id}: no se pudo calcular (${e?.message ?? e}): se salta.`);
    }
  }
  if (plan.length > 0)
    console.table(
      plan.map(({ doc, patch, pairs, board }) => ({
        partido: doc.id,
        pizarra: board ?? "— (estimado)",
        sistema: patch.system ?? "—",
        campos: pairs.length - 1,
        borra: pairs.filter(([, v]) => v === make.del).length,
      })),
    );
  for (const line of invalidIds) console.warn(`id no válido: ${line}`);
  const summary = (extra) =>
    [
      `actas acabadas ${matches.size}`,
      `con pizarra ${counts.conPizarra}`,
      `estimados ${counts.estimados}`,
      `sin datos ${counts.sinDatos}`,
      `sin cambios ${counts.sinCambios}`,
      `id no válido ${counts.idNoValido}`,
      `no calculadas ${counts.fallidos}`,
      `a escribir ${plan.length}`,
      ...extra,
    ].join(" · ");

  if (!write) {
    console.log(`Resumen (en seco): ${summary(["escritos 0", "no confirmados 0"])}`);
    console.log("En seco: añade --write para escribirlo.");
    return counts.fallidos ? 1 : 0;
  }
  const mismatch = m.checkExpected(expect, plan.length);
  if (mismatch) {
    console.error(mismatch);
    return 1;
  }

  // BulkWriter: un resultado por acta; un fallo no aborta el resto.
  const bulk = db.bulkWriter();
  bulk.onWriteError((e) => m.RETRY_CODES.has(e.code) && e.failedAttempts < 5);
  const pending = plan.map(({ doc, pairs }) => {
    const [[firstPath, firstValue], ...rest] = pairs;
    return bulk
      .update(doc.ref, firstPath, firstValue, ...rest.flat(), { lastUpdateTime: doc.updateTime })
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
  console.log(
    `Resumen: ${summary([`escritos ${n("escrita")}`, `no confirmados ${outcomes.length - n("escrita")}`, `(cambiadas ${n("cambiada")}, sin confirmar ${n("sin confirmar")}, errores ${n("error")})`])}`,
  );
  if (outcomes.every((o) => o === "escrita") && !counts.fallidos) return 0;
  console.warn("Quedan actas sin escribir (cambiadas mientras tanto, sin confirmar, con error o sin calcular): vuelve a lanzarla.");
  return 1;
}
