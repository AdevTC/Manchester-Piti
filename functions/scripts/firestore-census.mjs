// Firestore census: every collection and subcollection with its document count and a
// fingerprint of the contents, so a migration (export → new database → import) can be
// checked document by document. Read-only.
//
//   node scripts/firestore-census.mjs --project <id> --out census-before.json
//   node scripts/firestore-census.mjs --project <id> --out census-after.json --compare census-before.json
//
// Uses Application Default Credentials (gcloud auth application-default login). Set
// FIRESTORE_EMULATOR_HOST to run it against the emulator instead.
import { createHash } from "node:crypto";
import { readFileSync, writeFileSync } from "node:fs";
import { initializeApp } from "firebase-admin/app";
import { getFirestore, Timestamp, GeoPoint, DocumentReference } from "firebase-admin/firestore";

const arg = (name) => {
  const i = process.argv.indexOf(`--${name}`);
  return i > 0 ? process.argv[i + 1] : undefined;
};
const projectId = arg("project");
if (!projectId) throw new Error("Falta --project <id>");
initializeApp({ projectId });
const db = getFirestore();

// Stable text for any Firestore value (key order, Timestamps, refs, bytes…).
const canon = (v) => {
  if (v instanceof Timestamp) return `ts:${v.seconds}.${v.nanoseconds}`;
  if (v instanceof GeoPoint) return `geo:${v.latitude},${v.longitude}`;
  if (v instanceof DocumentReference) return `ref:${v.path}`;
  if (Buffer.isBuffer(v) || v instanceof Uint8Array) return `bytes:${Buffer.from(v).toString("base64")}`;
  if (Array.isArray(v)) return `[${v.map(canon).join(",")}]`;
  if (v && typeof v === "object") return `{${Object.keys(v).sort().map((k) => `${JSON.stringify(k)}:${canon(v[k])}`).join(",")}}`;
  return JSON.stringify(v);
};

const census = {};
async function walk(collections) {
  for (const col of collections) {
    const snap = await col.get();
    const hash = createHash("sha256");
    for (const doc of [...snap.docs].sort((a, b) => a.id.localeCompare(b.id))) hash.update(`${doc.id}=${canon(doc.data())}\n`);
    census[col.path] = { docs: snap.size, sha256: hash.digest("hex").slice(0, 16) };
    // Subcollections can hang from documents that only exist as parents, so list every ref.
    for (const ref of await col.listDocuments()) await walk(await ref.listCollections());
  }
}
await walk(await db.listCollections());

const paths = Object.keys(census).sort();
const total = paths.reduce((n, p) => n + census[p].docs, 0);
const out = arg("out");
if (out) writeFileSync(out, JSON.stringify({ projectId, at: new Date().toISOString(), total, census }, null, 2));
console.log(`${paths.length} colecciones · ${total} documentos${out ? ` → ${out}` : ""}`);

const compare = arg("compare");
if (compare) {
  const before = JSON.parse(readFileSync(compare, "utf8")).census;
  const all = [...new Set([...Object.keys(before), ...paths])].sort();
  const diff = all.filter((p) => before[p]?.docs !== census[p]?.docs || before[p]?.sha256 !== census[p]?.sha256);
  for (const p of diff) console.log(`  DIFERENTE ${p}: antes ${JSON.stringify(before[p] ?? null)} · ahora ${JSON.stringify(census[p] ?? null)}`);
  console.log(diff.length ? `✗ ${diff.length} colecciones no coinciden` : "✓ Todo coincide: mismas colecciones, documentos y contenido");
  process.exitCode = diff.length ? 1 : 0;
}
