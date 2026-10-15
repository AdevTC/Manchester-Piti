// Ports the approved /admin v2 «Sala de control» canvas CSS (scripts/admin-design/ad-v2-full-css.mjs) to
// src/styles/admin.css. The canvas root `.mp.v2f` becomes the app's `.vx.adm` (tokens from vestuario.css),
// its mode classes stay on the root (`.d` desktop / `.m` phone: AdminLayout sets them from the frame width,
// 1000 px), every rule is scoped under .adm, keyframes get an ad- prefix and the light theme follows
// <html data-theme="light">. Specificity is preserved (every selector gains exactly one class):
//   .v2f X                   → .vx.adm X
//   .v2f[data-theme=light] X → [data-theme="light"] .vx.adm X
//   .v2f:not([data-theme=light]) X → :root:not([data-theme="light"]) .vx.adm X
//   .m X                     → .adm.m X          (.v2f.m X → .vx.adm.m X)
//   X                        → .adm X
// The result marks: the canvas names them V / E / D; the app's alphabet is G · E · P (resultLetter /
// RESULT_WORD, functions/src/result.ts), so `.ved.V` → `.ved.G` and `.ved.D` → `.ved.P` (same weight).
//
//   node scripts/port-admin-css.mjs [design source .mjs]     (default: scripts/admin-design/ad-v2-full-css.mjs)
//   node scripts/port-admin-css.mjs --check                  (exit 1 when admin.css differs from the port)
//
// Generated CSS is never edited by hand: app-only rules live in src/styles/admin-app.css, or go into the
// design source and are ported again.
import fs from "node:fs";
import path from "node:path";
import { createRequire } from "node:module";
import { fileURLToPath, pathToFileURL } from "node:url";
import { RESULT_WORD } from "../functions/src/result.ts";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
// postcss through vite (a direct dependency that depends on it): pnpm does not hoist it to the root.
const require = createRequire(createRequire(path.join(ROOT, "package.json")).resolve("vite/package.json"));
const postcss = require("postcss");
const OUT = path.join(ROOT, "src/styles/admin.css");

const args = process.argv.slice(2);
const CHECK = args.includes("--check"); // compare with admin.css instead of writing it (src/styles/adminCss.test.ts)
const srcArg = args.find((a) => !a.startsWith("--")) || process.env.AD_DESIGN_SRC || path.join(ROOT, "scripts/admin-design/ad-v2-full-css.mjs");
const { css } = await import(pathToFileURL(path.resolve(srcArg)).href);
const root = postcss.parse(css);

// ── the result letters: canvas letter → its word → the app's letter for that word ──
const CANVAS_WORD = { V: "victoria", E: "empate", D: "derrota" };
const LETTER = Object.fromEntries(
  Object.entries(CANVAS_WORD).map(([canvas, word]) => {
    const app = Object.keys(RESULT_WORD).find((k) => RESULT_WORD[k] === word);
    if (!app) throw new Error(`No result letter means «${word}» (functions/src/result.ts)`);
    return [canvas, app];
  }),
);
// in every compound that is a result mark (.ved), rename the canvas letter classes
const RESULT_CLASS = new RegExp(`\\.(${Object.keys(LETTER).join("|")})(?![\\w-])`, "g");
const toAppLetters = (sel) =>
  sel
    .split(/(\s*[\s>+~]\s*)/)
    .map((part) => (/\.ved(?![\w-])/.test(part) ? part.replace(RESULT_CLASS, (_, l) => "." + LETTER[l]) : part))
    .join("");

const frames = new Set();
root.walkAtRules("keyframes", (r) => frames.add(r.params.trim()));
root.walkAtRules("keyframes", (r) => (r.params = "ad-" + r.params.trim()));
const inAt = (n, name) => {
  for (let p = n.parent; p; p = p.parent) if (p.type === "atrule" && p.name === name) return true;
  return false;
};

const LIGHT = "[data-theme=light]";
const NOT_LIGHT = ":not([data-theme=light])";
const scope = (sel) => {
  sel = sel.trim();
  // `:where(.v2f) button` → `:where(.vx.adm) button`
  if (sel.startsWith(":where(.v2f)")) return sel.replace(":where(.v2f)", ":where(.vx.adm)");
  const m = /^([^\s>+~]+)(.*)$/s.exec(sel);
  const head = m[1];
  const rest = m[2];
  const isV2f = /^\.v2f(?![\w-])/.test(head);
  const isM = /^\.m(?![\w-])/.test(head);
  if (isV2f || isM) {
    let h = isV2f ? head.replace(/^\.v2f/, "") : head.replace(/^\.m(?![\w-])/, "");
    let pre = "";
    if (h.includes(NOT_LIGHT)) {
      pre = ':root:not([data-theme="light"]) ';
      h = h.replace(NOT_LIGHT, "");
    } else if (h.includes(LIGHT)) {
      pre = '[data-theme="light"] ';
      h = h.replace(LIGHT, "");
    }
    // `.v2f` → `.vx.adm`; `.m` alone → `.adm.m`; `.v2f.m` → `.vx.adm.m`
    const base = isV2f ? ".vx.adm" : ".adm.m";
    return pre + base + h + rest;
  }
  return ".adm " + sel;
};
root.walkRules((r) => {
  if (inAt(r, "keyframes")) return;
  r.selectors = r.selectors.map(scope).map(toAppLetters);
});
root.walkDecls((d) => {
  if (d.prop === "animation" || d.prop === "animation-name") {
    d.value = d.value.replace(/[A-Za-z][\w-]*/g, (w) => (frames.has(w) ? "ad-" + w : w));
  }
});
const head = `/* /admin v2 «Sala de control» (Celeste · quiet app shell): the 60 px header, the 224 px rail and the phone
   bar, Hoy (the peg wall, the LED scoreboard), Partidos (master–detail, the match workspace, the acta, the
   publish peak and its vitrina), Convocar, Fichas, Plantilla (peg wall + cromo drawer), Temporadas, Capitanes,
   Contenido, the ⌘K palette, modals, sheets and the lower thirds. Generated from the Design canvas
   (scripts/admin-design/ad-v2-full-css.mjs) by \`node scripts/port-admin-css.mjs\`: every rule scoped under
   .adm (root = .vx.adm, its mode = .d desktop / .m phone, set by AdminLayout from the frame width), keyframes
   prefixed with ad-, the result marks in G · E · P, tokens from .vx (vestuario.css). App-only rules live in
   admin-app.css. Do not edit by hand. */
`;
const text = head + root.toString().trim() + "\n";
if (CHECK) {
  const current = fs.readFileSync(OUT, "utf8").replace(/\r\n/g, "\n");
  if (current !== text) {
    const at = [...text].findIndex((c, i) => c !== current[i]);
    const line = text.slice(0, at).split("\n").length;
    console.error(`src/styles/admin.css is not what the port writes (first difference on line ${line}): run \`node scripts/port-admin-css.mjs\`.`);
    process.exit(1);
  }
} else fs.writeFileSync(OUT, text);

// ── checks: every rule scoped, no canvas letter left, custom properties used but defined nowhere ──
const unscoped = [];
const canvasLetters = [];
root.walkRules((r) => {
  if (inAt(r, "keyframes")) return;
  for (const s of r.selectors) {
    if (!/\.adm|\.vx\.adm/.test(s)) unscoped.push(s);
    if (s.split(/\s*[\s>+~]\s*/).some((part) => /\.ved(?![\w-])/.test(part) && /\.(V|D)(?![\w-])/.test(part))) canvasLetters.push(s);
  }
});
const defined = new Set(["--ltb"]); // --ltb: set inline by AdminLayout on phones
for (const f of ["src/styles/admin.css", "src/styles/vestuario.css", "src/styles/admin-app.css"]) {
  const file = path.join(ROOT, f);
  if (!fs.existsSync(file)) continue;
  for (const x of fs.readFileSync(file, "utf8").matchAll(/(--[\w-]+)\s*:/g)) defined.add(x[1]);
}
const used = new Set([...text.matchAll(/var\((--[\w-]+)/g)].map((x) => x[1]));
const missing = [...used].filter((v) => !defined.has(v));
console.log("rules", root.nodes.length, "keyframes", frames.size, "missing vars", missing, "unscoped", unscoped, "canvas letters", canvasLetters);
if (unscoped.length || canvasLetters.length) process.exitCode = 1;
