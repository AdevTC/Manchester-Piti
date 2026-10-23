// How the site feels on the visitors' phones, from what they reported (src/lib/vitals.ts → functions/src/vitals.ts):
// the 75th percentile of each Core Web Vital overall, by device and by page, the slowest taps with what made them
// slow, and the frames of the page changes. Read-only.
//
//   node scripts/vitals-report.mjs --project futbolmanagement-dc6cb [--days 7] [--touch]
//
// Uses Application Default Credentials (gcloud auth application-default login). --touch: touch screens only.
import { initializeApp } from "firebase-admin/app";
import { getFirestore } from "firebase-admin/firestore";

const arg = (name) => {
  const i = process.argv.indexOf(`--${name}`);
  return i > 0 ? process.argv[i + 1] : undefined;
};
const projectId = arg("project");
if (!projectId) throw new Error("Falta --project <id>");
const days = Number(arg("days") ?? 7);
const touchOnly = process.argv.includes("--touch");
initializeApp({ projectId });
const db = getFirestore();

const since = new Date(Date.now() - days * 86_400_000).toISOString().slice(0, 10);
const snap = await db.collection("vitals").where("day", ">=", since).get();
// (what visitors sent is printed: control characters out, whatever got stored)
const clean = (v) => (typeof v === "string" ? [...v].filter((c) => { const k = c.charCodeAt(0); return k >= 0x20 && !(k >= 0x7f && k <= 0x9f); }).join("") : Array.isArray(v) ? v.map(clean) : v && typeof v === "object" ? Object.fromEntries(Object.entries(v).map(([k, x]) => [clean(k), clean(x)])) : v);
const reports = snap.docs.map((d) => clean(d.data())).filter((r) => !touchOnly || r.d?.touch);
const rows = reports.flatMap((r) => (r.m ?? []).map((m) => ({ ...m, d: r.d })));
console.log(`${reports.length} visitas, ${rows.length} medidas, desde ${since}${touchOnly ? " (solo pantallas táctiles)" : ""}\n`);

const p75 = (xs) => {
  if (!xs.length) return null;
  const s = [...xs].sort((a, b) => a - b);
  return s[Math.min(s.length - 1, Math.floor(s.length * 0.75))];
};
const GOOD = { LCP: 2500, INP: 200, CLS: 0.1, FCP: 1800, TTFB: 800, VT: 50 };
const line = (label, list) => {
  const cells = ["LCP", "INP", "CLS", "FCP", "TTFB", "VT"].map((n) => {
    const xs = list.filter((m) => m.n === n).map((m) => m.v);
    const v = p75(xs);
    return v === null ? `${n} –` : `${n} ${n === "CLS" ? v.toFixed(3) : Math.round(v)}${v > GOOD[n] ? "!" : ""} (${xs.length})`;
  });
  console.log(`${label.padEnd(28)} ${cells.join("  ")}`);
};

console.log("p75 (! = peor que el umbral bueno; entre paréntesis, cuántas medidas)");
line("todo", rows);
for (const os of ["android", "ios", "other"]) line(`  ${os}`, rows.filter((m) => m.d?.os === os));
console.log("\npor página");
const pages = [...new Set(rows.map((m) => m.p))].sort();
for (const p of pages) line(`  ${p}`, rows.filter((m) => m.p === p));

const worst = (n, k = 8) => rows.filter((m) => m.n === n).sort((a, b) => b.v - a.v).slice(0, k);
console.log("\ntoques más lentos (INP): página · elemento · ms (entrada / proceso / pintado) · js / estilo / pintura · script");
for (const m of worst("INP")) {
  const a = m.a ?? {};
  console.log(`  ${m.p} · ${a.el ?? "?"} · ${m.v} (${a.input ?? "?"}/${a.proc ?? "?"}/${a.pres ?? "?"}) · ${a.js ?? "?"}/${a.style ?? "?"}/${a.paint ?? "?"} · ${a.script ?? "-"} ${a.scriptMs ?? ""} [${m.d?.os}, dpr ${m.d?.dpr}]`);
}
console.log("\ncambios de página más lentos (VT): de → a · fotograma más largo · fotogramas > 50 ms · duración");
for (const m of worst("VT")) console.log(`  ${m.a?.from ?? "?"} → ${m.p} (${m.a?.kind}) · ${m.v} ms · ${m.a?.slow ?? "?"} · ${m.a?.dur ?? "?"} ms [${m.d?.os}, dpr ${m.d?.dpr}]`);
console.log("\nsaltos más grandes (CLS): página · elemento · valor");
for (const m of worst("CLS", 6)) console.log(`  ${m.p} · ${m.a?.el ?? "?"} · ${m.v} [${m.d?.os}]`);
console.log("\nLCP más lentos: página · elemento · ms (ttfb / espera / carga / pintado)");
for (const m of worst("LCP", 6)) console.log(`  ${m.p} · ${m.a?.el ?? "?"} · ${m.v} (${m.a?.ttfb ?? "?"}/${m.a?.wait ?? "?"}/${m.a?.load ?? "?"}/${m.a?.render ?? "?"}) [${m.d?.os}, ${m.nt}]`);
