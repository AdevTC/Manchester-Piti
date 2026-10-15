// Ports the approved «La pizarra · FUT» canvas CSS to src/styles/pizarra.css. The design source lives
// outside the repo (the Design canvas page, split in pzf-src/: 1-data.js, 2-css.js with css + css2,
// 2b-layout.js with css3, 2c-fifa.js with css4); its templates are evaluated with the data module (the
// camera geometry: --fh, --vr, --cut, --kb and the LED positions). The canvas root `.mp.pz` becomes the
// app's `.vx.pzv` (tokens from vestuario.css): every rule is scoped under .pzv, keyframes get a pz-
// prefix, the light theme follows <html data-theme="light">, and since .pzv is itself the size container
// (.vx), container queries that targeted the root go to its children (custom properties inherit).
//
//   node scripts/port-pizarra-css.mjs <path to pzf-src>     (or PZ_DESIGN_SRC=<path> node scripts/…)
//
// Generated CSS is never edited by hand: app-only rules live in src/styles/pizarra-app.css.
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { createRequire } from "node:module";
import { fileURLToPath, pathToFileURL } from "node:url";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
// postcss through vite (a direct dependency that depends on it): pnpm does not hoist it to the root.
const require = createRequire(createRequire(path.join(ROOT, "package.json")).resolve("vite/package.json"));
const postcss = require("postcss");

const srcArg = process.argv[2] || process.env.PZ_DESIGN_SRC;
if (!srcArg) {
  console.error("Usage: node scripts/port-pizarra-css.mjs <design source dir (pzf-src)>  (or set PZ_DESIGN_SRC)");
  process.exit(1);
}
const SRC = path.resolve(srcArg);
const PARTS = ["1-data.js", "2-css.js", "2b-layout.js", "2c-fifa.js"];
for (const f of PARTS) {
  if (!fs.existsSync(path.join(SRC, f))) {
    console.error("Missing " + f + " in " + SRC);
    process.exit(1);
  }
}

// The data module imports its helpers relatively («./common3.mjs», next to the source dir): the temporary
// module (written outside the repo) imports them by absolute URL instead.
const read = (f) => fs.readFileSync(path.join(SRC, f), "utf8").replace(/\r\n/g, "\n");
const absImports = (code) => code.replace(/from\s+"(\.{1,2}\/[^"]+)"/g, (_, rel) => 'from "' + pathToFileURL(path.resolve(SRC, "..", rel)).href + '"');
const tmp = path.join(os.tmpdir(), "port-pizarra-css-" + process.pid + ".mjs");
fs.writeFileSync(tmp, absImports(PARTS.map(read).join("\n")) + "\nexport { css, css2, css3, css4 };\n");
let css;
try {
  const mod = await import(pathToFileURL(tmp).href + "?t=" + Date.now());
  css = [mod.css, mod.css2, mod.css3, mod.css4].join("\n");
} finally {
  fs.rmSync(tmp, { force: true });
}

const root = postcss.parse(css);
const frames = new Set();
root.walkAtRules("keyframes", (r) => frames.add(r.params.trim()));
root.walkAtRules("keyframes", (r) => (r.params = "pz-" + r.params.trim()));
const inAt = (n, name) => {
  for (let p = n.parent; p; p = p.parent) if (p.type === "atrule" && p.name === name) return true;
  return false;
};
const R = ".pzv";
const scope = (sel) => {
  sel = sel.trim();
  let light = false;
  // .pz[data-theme=light] … → [data-theme="light"] .pzv …
  if (/^\.pz\[data-theme=light\]/.test(sel)) {
    light = true;
    sel = sel.replace(/^\.pz\[data-theme=light\]/, ".pz");
  }
  sel = sel.replace(/\.mp-top\b/g, ".vx-top").replace(/\.mp-dock\b/g, ".vx-dock");
  if (/^\.pz(?![\w-])/.test(sel)) sel = sel.replace(/^\.pz(?![\w-])/, R);
  else sel = R + " " + sel;
  return (light ? '[data-theme="light"] ' : "") + sel;
};
root.walkRules((r) => {
  if (inAt(r, "keyframes")) return;
  r.selectors = r.selectors.map(scope).map((s) => (inAt(r, "container") && s === R ? R + " > *" : s));
});
root.walkDecls((d) => {
  if (d.prop === "animation" || d.prop === "animation-name") {
    d.value = d.value.replace(/[A-Za-z][\w-]*/g, (w) => (frames.has(w) ? "pz-" + w : w));
  }
});
const head = `/* La pizarra «FUT» (Celeste · elegida): the app screen — stadium, cromos, química as light, the
   command bar, the Acciones rail, the panel / sheet and the prompt bar. Generated from the Design canvas
   page (pzf-src: css + css2 + css3 + css4) by scripts/port-pizarra-css.mjs: every rule scoped under .pzv,
   keyframes prefixed with pz-, tokens from .vx (vestuario.css). App-only rules live in pizarra-app.css.
   Do not edit by hand. */
`;
fs.writeFileSync(path.join(ROOT, "src/styles/pizarra.css"), head + root.toString().trim() + "\n");
console.log("rules", root.nodes.length, "keyframes", frames.size);
