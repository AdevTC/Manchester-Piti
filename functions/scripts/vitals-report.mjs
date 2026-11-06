// How the site feels on the visitors' phones, from what they reported (src/lib/vitals.ts → functions/src/vitals.ts):
// the 75th percentile of each Core Web Vital overall, by device and by page, the slowest taps with what made them
// slow, and the frames of the page changes. Read-only.
//
//   node scripts/vitals-report.mjs --project futbolmanagement-dc6cb [--days 7] [--touch]
//
// Uses Application Default Credentials (gcloud auth application-default login). --touch: touch screens only.
// Uses the COMPILED functions/lib (vitalsLogic): cd functions && npm run build first.
import { initializeApp } from "firebase-admin/app";
import { getFirestore } from "firebase-admin/firestore";
import { isFillerInp } from "../lib/vitalsLogic.js";

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
// (browsers driven by automation — crawlers, tests — left out)
const all = snap.docs.map((d) => clean(d.data()));
const reports = all.filter((r) => !r.d?.bot && (!touchOnly || r.d?.touch));
const bots = all.length - all.filter((r) => !r.d?.bot).length;
// (the TTFB of a load that began in a hidden tab — the switch to a new deploy reloads tabs in the background — is no
// one's wait: lib/vitals marks it `bg` and it stays out)
const measured = reports.flatMap((r) => (r.m ?? []).map((m) => ({ ...m, d: r.d })));
const shown = measured.filter((m) => !m.a?.bg);
const background = measured.length - shown.length;
// (the INP a soft navigation reports with no tap behind it — web-vitals' filler, all «presentation» — is no one's
// tap: it stays out of the p75 and of the slowest taps, counted apart)
const rows = shown.filter((m) => !isFillerInp(m));
const fillers = shown.length - rows.length;
console.log(`${reports.length} envíos, ${rows.length} medidas, desde ${since}${touchOnly ? " (solo pantallas táctiles)" : ""}${bots ? ` (${bots} de robots fuera)` : ""}${background ? ` (${background} TTFB de pestañas ocultas fuera)` : ""}${fillers ? ` (${fillers} INP de relleno fuera)` : ""}\n`);

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
console.log("\ntoques más lentos (INP): página · elemento · ms (entrada / proceso / pintado) · js / estilo / pintura · script · «VT»: el toque arrancó una transición");
for (const m of worst("INP")) {
  const a = m.a ?? {};
  console.log(`  ${m.p} · ${a.el ?? "?"} · ${m.v} (${a.input ?? "?"}/${a.proc ?? "?"}/${a.pres ?? "?"}) · ${a.js ?? "?"}/${a.style ?? "?"}/${a.paint ?? "?"} · ${a.script ?? "-"} ${a.scriptMs ?? ""}${a.vt ? " · VT" : ""} [${m.d?.os}, dpr ${m.d?.dpr}]`);
}
// (the taps that started a View Transition against the rest: their «presentation» is the transition's first frame)
const inps = rows.filter((m) => m.n === "INP");
const withVt = inps.filter((m) => m.a?.vt).map((m) => m.v);
if (withVt.length) {
  const without = inps.filter((m) => !m.a?.vt).map((m) => m.v);
  console.log(`  toques que arrancaron una transición: p75 ${p75(withVt)} (${withVt.length}) · los demás: p75 ${p75(without) ?? "–"} (${without.length})`);
}
console.log("\ncambios de página más lentos (VT): de → a · fotograma más largo · fotogramas > 50 ms · duración · peor fotograma largo (LoAF, Chrome): ms = js / rAF / estilo+maquetación+pintado, maquetación forzada, script (nº de fotogramas largos) · GPU ≈ fotograma más largo − LoAF");
for (const m of worst("VT")) {
  const a = m.a ?? {};
  const lf = a.lf === undefined ? "" : ` · LoAF ${a.lf} = ${a.lfJs ?? "?"}/${a.lfRaf ?? "?"}/${a.lfLay ?? "?"}, forzada ${a.lfForced ?? 0}${a.lfScript ? `, ${a.lfScript}` : ""} (${a.lfN ?? 1}) · GPU ≈ ${Math.max(0, m.v - a.lf)}`;
  console.log(`  ${a.from ?? "?"} → ${m.p} (${a.kind}) · ${m.v} ms · ${a.slow ?? "?"} · ${a.dur ?? "?"} ms${lf} [${m.d?.os}, dpr ${m.d?.dpr}]`);
}
console.log("\nsaltos más grandes (CLS): página · elemento · valor");
for (const m of worst("CLS", 6)) console.log(`  ${m.p} · ${m.a?.el ?? "?"} · ${m.v} [${m.d?.os}]`);
console.log("\nLCP más lentos: página · elemento · ms (ttfb / espera / carga / pintado)");
for (const m of worst("LCP", 6)) console.log(`  ${m.p} · ${m.a?.el ?? "?"} · ${m.v} (${m.a?.ttfb ?? "?"}/${m.a?.wait ?? "?"}/${m.a?.load ?? "?"}/${m.a?.render ?? "?"}) [${m.d?.os}, ${m.nt}]`);

// (back/forward loads: how many came back from the back/forward cache, and why the others didn't — lib/vitals `nr`)
const bfLoads = rows.filter((m) => m.n === "TTFB" && (m.nt === "back-forward" || m.nt === "back-forward-cache"));
if (bfLoads.length) {
  const restored = bfLoads.filter((m) => m.nt === "back-forward-cache").length;
  const why = new Map();
  for (const m of bfLoads) for (const r of String(m.a?.nr ?? "").split(",").filter(Boolean)) why.set(r, (why.get(r) ?? 0) + 1);
  console.log(`\natrás/adelante: ${restored} de ${bfLoads.length} desde la bfcache; por qué no las demás: ${[...why].sort((a, b) => b[1] - a[1]).map(([r, n]) => `${r} ${n}`).join(" · ") || "sin dato"}`);
}
