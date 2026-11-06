// Saca el correo de cada socio del perfil que lista todo el vestuario (users/{uid}.email) y lo deja en
// memberEmails/{uid}, que solo leen el propio socio y los capitanes (firestore.rules). Por defecto: EMULADOR y en
// seco (solo cuenta).
//   node functions/scripts/migrate-member-emails.mjs [--dry-run]   → muestra el plan (emulador)
//   node functions/scripts/migrate-member-emails.mjs --write       → lo escribe (emulador)
//   … --prod                                                      → plan en producción (credenciales por defecto de GCP)
//   … --prod --write --project=futbolmanagement-dc6cb --expect=<N> → lo escribe, solo si el plan tiene justo N perfiles
// Antes de --prod --write: desplegar las reglas (memberEmails), las funciones de la puerta (escriben ahí) y la web
// (lee de ahí; mientras tanto la web usa la copia del perfil, así que el orden no rompe ninguna pantalla).
// Idempotente: un perfil sin `email` no se toca; un correo que ya está en memberEmails no se pisa. Cada perfil va en
// un lote propio (copia + borrado juntos) con la precondición `lastUpdateTime` de la lectura: si alguien tocó el
// perfil entretanto, ese no se escribe (sale como «cambiado»: vuelve a lanzarla). Prueba: test/member-emails.integration.mjs.
import { existsSync, readFileSync, statSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..");
const ENTRIES = ["migratePositions", "memberEmailsLogic"];

// Sin process.exit(): en Windows cortar el proceso con la salida aún en vuelo dispara un assert de libuv.
process.exitCode = await main();

/** Each module the script loads must be compiled and newer than its source. */
function staleBuild() {
  for (const name of ENTRIES) {
    const src = join(ROOT, "src", name + ".ts");
    const lib = join(ROOT, "lib", name + ".js");
    if (!existsSync(lib)) return `falta functions/lib/${name}.js`;
    if (existsSync(src) && statSync(lib).mtimeMs < statSync(src).mtimeMs) return `functions/lib/${name}.js es más antiguo que src/${name}.ts`;
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
  const { resolveMigrationTarget, checkExpected, credentialProject, RETRY_CODES, classifyWriteError } = await lib("migratePositions");
  const { planEmailMove } = await lib("memberEmailsLogic");

  // («en seco» es lo de siempre sin --write: --dry-run solo lo dice explícitamente)
  const args = process.argv.slice(2);
  const dry = args.includes("--dry-run");
  if (dry && args.includes("--write")) {
    console.error("--dry-run y --write a la vez: elige uno. No se toca nada.");
    return 1;
  }
  const target = resolveMigrationTarget(
    args.filter((a) => a !== "--dry-run"),
    process.env,
  );
  if (!target.ok) {
    console.error(target.error);
    return 1;
  }
  const { write, projectId, emulatorHost } = target;
  if (emulatorHost) process.env.FIRESTORE_EMULATOR_HOST = emulatorHost;
  console.log(target.prod ? `${target.label} · credencial: ${credentialProject(process.env, readOrNull) ?? "proyecto desconocido"}` : target.label);

  const { initializeApp } = await import("firebase-admin/app");
  const { getFirestore, FieldValue } = await import("firebase-admin/firestore");
  initializeApp({ projectId });
  const db = getFirestore();
  try {
    return await migrate(db, write, target.expect, { planEmailMove, checkExpected, RETRY_CODES, classifyWriteError, FieldValue });
  } finally {
    await db.terminate(); // cierra los canales gRPC: el proceso acaba solo, sin process.exit()
  }
}

async function migrate(db, write, expect, m) {
  // (solo el campo que se mueve: un perfil es pequeño, pero no hace falta nada más)
  const [users, stored] = await Promise.all([db.collection("users").select("email").get(), db.collection("memberEmails").get()]);
  const storedBy = new Map(stored.docs.map((d) => [d.id, d.get("email")]));
  const plan = [];
  let copies = 0;
  for (const doc of users.docs) {
    const move = m.planEmailMove(doc.data() ?? {}, storedBy.get(doc.id));
    if (!move) continue;
    plan.push({ doc, move });
    if (move.copy) copies++;
  }
  // (nunca los correos en la salida: solo cuántos)
  const summary = (extra) =>
    [`perfiles ${users.size}`, `ya en memberEmails ${stored.size}`, `con correo en el perfil ${plan.length}`, `a copiar ${copies}`, `a escribir ${plan.length}`, ...extra].join(" · ");

  if (!write) {
    console.log(`Resumen (en seco): ${summary(["escritos 0"])}`);
    console.log("En seco: añade --write para escribirlo.");
    return 0;
  }
  const mismatch = m.checkExpected(expect, plan.length);
  if (mismatch) {
    console.error(mismatch);
    return 1;
  }

  const outcomes = [];
  for (const { doc, move } of plan) {
    let outcome = "error";
    for (let attempt = 1; attempt <= 5; attempt++) {
      try {
        const batch = db.batch();
        // (create: si la puerta lo escribió entretanto, el lote entero falla y ese perfil se reintenta otro día)
        if (move.copy) batch.create(db.doc(`memberEmails/${doc.id}`), { email: move.copy });
        batch.update(doc.ref, { email: m.FieldValue.delete() }, { lastUpdateTime: doc.updateTime });
        await batch.commit();
        outcome = "escrita";
        break;
      } catch (e) {
        if (m.RETRY_CODES.has(e?.code) && attempt < 5) continue;
        // ALREADY_EXISTS (6): memberEmails apareció entretanto = cambiado
        outcome = e?.code === 6 ? "cambiada" : m.classifyWriteError(e?.code);
        console.warn(`${doc.id}: ${outcome === "cambiada" ? "cambiado mientras tanto: no se toca" : `no escrito (${e?.message ?? e})`}.`);
        break;
      }
    }
    outcomes.push(outcome);
  }
  const n = (o) => outcomes.filter((x) => x === o).length;
  console.log(`Resumen: ${summary([`escritos ${n("escrita")}`, `cambiados ${n("cambiada")}`, `sin confirmar ${n("sin confirmar")}`, `errores ${n("error")}`])}`);
  if (outcomes.every((o) => o === "escrita")) return 0;
  console.warn("Quedan perfiles sin escribir (cambiados mientras tanto, sin confirmar o con error): vuelve a lanzarla.");
  return 1;
}
