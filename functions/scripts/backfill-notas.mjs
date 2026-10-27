// Congela las notas de las actas ya publicadas (matches/{id}.notas), como las guardaría hoy saveMatchSheet: cada
// acta con los partidos de su temporada hasta ella y el factor del rival de la clasificación (la de hoy: no se
// guardan las de cada semana). Va en orden de fecha, así que cada acta usa el factor congelado de las anteriores.
// Un acta que ya tiene notas de este modelo no se toca. Por defecto: EMULADOR y en seco.
//   node functions/scripts/backfill-notas.mjs            → muestra el plan (emulador)
//   node functions/scripts/backfill-notas.mjs --write    → lo escribe (emulador)
//   … --prod                                             → plan en producción (credenciales por defecto de GCP)
//   … --prod --write --project=futbolmanagement-dc6cb --expect=<N> → lo escribe, solo si el plan tiene justo N actas
// --prod se niega si FIRESTORE_EMULATOR_HOST está definida. Cada escritura lleva la precondición `lastUpdateTime`
// de la lectura: si alguien guardó el acta entretanto, esa no se pisa (y se relanza).
// Usa los módulos COMPILADOS (functions/lib): cd functions && npm run build antes.
import { existsSync, readFileSync, statSync } from "node:fs";
import { dirname, join, normalize } from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..");
const ENTRIES = ["rating/season", "rating/frozen", "rating/rival", "matchEngine", "migratePositions"];

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
    if (!existsSync(src)) continue;
    for (const m of readFileSync(src, "utf8").matchAll(/from\s+"(\.{1,2}\/[\w./-]+)\.js"/g))
      todo.push(normalize(join(dirname(name), m[1])).replaceAll("\\", "/"));
  }
  return null;
}

// A declaration, not a const: main() runs from the top-level await above, before a const here exists.
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
  const { resolveMigrationTarget, checkExpected, credentialProject, RETRY_CODES, classifyWriteError } = await lib("migratePositions");
  const { frozenNotas } = await lib("rating/season");
  const { notasDoc, parseStoredNotas, storedNotasOf } = await lib("rating/frozen");
  const { standingsLike } = await lib("rating/rival");
  const { isCompleted, dateMillis } = await lib("matchEngine");

  const target = resolveMigrationTarget(process.argv.slice(2), process.env);
  if (!target.ok) {
    console.error(target.error);
    return 1;
  }
  const { write, projectId, emulatorHost } = target;
  if (emulatorHost) process.env.FIRESTORE_EMULATOR_HOST = emulatorHost;
  console.log(target.prod ? `${target.label} · credencial: ${credentialProject(process.env, readOrNull) ?? "proyecto desconocido"}` : target.label);

  const { initializeApp } = await import("firebase-admin/app");
  const { getFirestore } = await import("firebase-admin/firestore");
  initializeApp({ projectId });
  const db = getFirestore();
  try {
    return await backfill(db, write, target.expect, { frozenNotas, notasDoc, parseStoredNotas, storedNotasOf, standingsLike, isCompleted, dateMillis, checkExpected, RETRY_CODES, classifyWriteError });
  } finally {
    await db.terminate(); // cierra los canales gRPC: el proceso acaba solo, sin process.exit()
  }
}

async function backfill(db, write, expect, m) {
  const snap = await db.collection("matches").where("status", "==", "finished").get();
  const docs = snap.docs.filter((d) => m.isCompleted(d.data()));
  const bySeason = new Map();
  for (const d of docs) {
    const key = typeof d.get("seasonId") === "string" ? d.get("seasonId") : "";
    if (!bySeason.has(key)) bySeason.set(key, []);
    bySeason.get(key).push(d);
  }
  const counts = { yaTenian: 0, fallidos: 0 };
  const plan = [];
  const now = Date.now();
  for (const [seasonId, list] of bySeason) {
    const standings = seasonId ? await db.doc(`standings/${seasonId}`).get() : null;
    const t = standings?.exists ? m.standingsLike(seasonId, standings.data()) : null;
    const table = t ? [t] : [];
    // play order; each acta sees the ones before it with the notas they have or are about to get
    const games = list
      .map((d) => ({ doc: d, match: { ...d.data(), id: d.id } }))
      .sort((a, b) => m.dateMillis(a.match.date) - m.dateMillis(b.match.date) || a.match.id.localeCompare(b.match.id));
    for (const g of games) {
      if (m.storedNotasOf(g.match)) {
        counts.yaTenian++;
        continue;
      }
      // un acta rara no para el resto: se cuenta y se sigue
      try {
        const notas = m.notasDoc(m.frozenNotas(g.match, games.map((x) => x.match), table, m.parseStoredNotas(g.match.notas)?.rival ?? null, m.parseStoredNotas(g.match.notas)?.normal ?? null), now);
        g.match = { ...g.match, notas };
        games[games.indexOf(g)] = g;
        plan.push({ doc: g.doc, notas, seasonId, table: !!t });
      } catch (e) {
        counts.fallidos++;
        console.error(`${g.doc.id}: no se pudo calcular (${e?.message ?? e}): se salta.`);
      }
    }
  }
  if (plan.length > 0)
    console.table(
      plan.map(({ doc, notas, seasonId, table }) => {
        const values = Object.values(notas.players).map((p) => p.nota);
        return {
          partido: doc.id,
          temporada: seasonId || "—",
          rival: doc.get("rival") ?? "—",
          clasificación: table ? "sí" : "no (factor 1)",
          factor: notas.rival,
          notas: values.length,
          media: values.length ? Math.round((values.reduce((s, x) => s + x, 0) / values.length) * 100) / 100 : "—",
        };
      }),
    );
  const summary = (extra) => [`actas acabadas ${docs.length}`, `ya tenían ${counts.yaTenian}`, `no calculadas ${counts.fallidos}`, `a escribir ${plan.length}`, ...extra].join(" · ");
  if (!write) {
    console.log(`Resumen (en seco): ${summary(["escritos 0"])}`);
    console.log("En seco: añade --write para escribirlo.");
    return counts.fallidos ? 1 : 0;
  }
  const mismatch = m.checkExpected(expect, plan.length);
  if (mismatch) {
    console.error(mismatch);
    return 1;
  }
  const bulk = db.bulkWriter();
  bulk.onWriteError((e) => m.RETRY_CODES.has(e.code) && e.failedAttempts < 5);
  const pending = plan.map(({ doc, notas }) =>
    bulk
      .update(doc.ref, { notas }, { lastUpdateTime: doc.updateTime })
      .then(() => "escrita")
      .catch((e) => {
        const outcome = m.classifyWriteError(e?.code);
        if (outcome === "cambiada") console.warn(`${doc.id}: cambiada mientras tanto: no se toca.`);
        else if (outcome === "sin confirmar") console.warn(`${doc.id}: no confirmada (${e?.message ?? e}).`);
        else console.error(`${doc.id}: error al escribir: ${e?.message ?? e}`);
        return outcome;
      }),
  );
  await bulk.close();
  const outcomes = await Promise.all(pending);
  const n = (o) => outcomes.filter((x) => x === o).length;
  console.log(`Resumen: ${summary([`escritos ${n("escrita")}`, `no confirmados ${outcomes.length - n("escrita")}`])}`);
  if (outcomes.every((o) => o === "escrita") && !counts.fallidos) return 0;
  console.warn("Quedan actas sin escribir (cambiadas mientras tanto, sin confirmar, con error o sin calcular): vuelve a lanzarla.");
  return 1;
}
