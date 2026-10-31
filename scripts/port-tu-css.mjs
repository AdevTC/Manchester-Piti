// Ports the approved «Tú» prototypes' CSS (the Design canvas: TuCarta.dc.html — concept B, prefix tc-, the base —,
// TuTemporada.dc.html — C's river and focus, tt- — and TuFicha.dc.html — A's match sheet, tf-) plus the rules of
// the canvas kit vx.css they use (vx-* renamed tk-*) into src/styles/tu/: tu.css (shell + kit) and one file per
// place. The app's page root is <main class="tup nx">, the size container `nx` (palco.css): every selector is
// scoped `.tup …`; the prototype's `.nx--phone X` becomes `@container nx (max-width:699px)`, `.nx--desk X`
// `(min-width:700px)`, its `@container vx` the app's `nx`; the light theme stays `:root[data-theme="light"]`; the
// toast lives outside the container (`.tu-pg>`). Fonts, body and the prototype's own frame/top bars are dropped.
//
//   node scripts/port-tu-css.mjs <folder with TuCarta.dc.html, TuTemporada.dc.html, TuFicha.dc.html, vx.css>
//
// Each output keeps whatever follows its «/* ── by hand ── */» marker (the app's pins, written by hand), so the
// port can run again without losing them.
import fs from "node:fs";
import path from "node:path";
import { createRequire } from "node:module";
import { fileURLToPath } from "node:url";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const require = createRequire(createRequire(path.join(ROOT, "package.json")).resolve("vite/package.json"));
const postcss = require("postcss");

const SRC = process.argv[2] || process.env.TU_DESIGN_SRC;
if (!SRC) {
  console.error("Usage: node scripts/port-tu-css.mjs <design folder>  (or set TU_DESIGN_SRC)");
  process.exit(1);
}
const OUT = path.join(ROOT, "src/styles/tu");
const MARK = "/* ── by hand ── */";
const read = (f) => fs.readFileSync(path.join(SRC, f), "utf8");
const helmetCss = (html) => {
  const m = /<helmet>\s*<style>([\s\S]*?)<\/style>\s*<\/helmet>/.exec(html);
  if (!m) throw new Error("no <helmet><style>");
  return m[1];
};

// ── which output each section of each prototype goes to (by its comment), null: dropped
const FILES = ["tu", "tu-tu", "tu-partidos", "tu-juego", "tu-vitrina", "tu-ajustes", "tu-avisos"];
const SECTIONS = {
  TuCarta: [
    [/PARTIDOS/, "tu-partidos"],
    [/JUEGO/, "tu-juego"],
    [/VITRINA|the road|trophy wall/, "tu-vitrina"],
    [/AJUSTES/, "tu-ajustes"],
    [/AVISOS/, "tu-avisos"],
    [/under the stage/, "tu-tu"],
    [/.*/, "tu"],
  ],
  TuTemporada: [
    [/Prefix tt-|nota chip|the river|next jornada|river on the phone|the focus|Partidos/, "tu-partidos"],
    [/selected states|tablet/, "tail"],
    [/.*/, null],
  ],
  TuFicha: [
    [/the nota \(|match sheet|^\s*Partidos\s*$/, "tu-partidos"],
    [/.*/, null],
  ],
};

const ROOTISH = /^(\.nx|\.nx-kit|\.tc|\.tt|\.tf|\.vx|\.nx--desk|\.nx--phone|\.nx--scroll|:root|\[data-theme[^\]]*\]|\.(?:tc|tt|tf)-l-[\w-]+)$/;
const SIMPLE = /(\.[\w-]+|\[[^\]]+\]|::?[\w-]+(?:\([^)]*\))?|#[\w-]+|\*|[a-z][\w-]*)/gi;
const OUTSIDE = /\.(?:tc|tt|tf|tk)-toast\b/;

/** One selector → { sel, flag } (flag: "" | "phone" | "desk"), or null when it is the prototype's frame. */
function mapSelector(raw) {
  const sel = raw.trim().replace(/\.vx-/g, ".tk-");
  if (/\.nx--scroll|\.nx-scroller|\.nx-top\b|\.nx-ptop\b|\.nx-wrap\b|^body\b|^html\b/.test(sel)) return null;
  const parts = sel.split(/(\s*[>+~]\s*|\s+)/);
  let flag = "";
  let light = false;
  let place = "";
  let i = 0;
  // the leading compounds made only of root tokens (the prototype's root and its state classes)
  for (; i < parts.length; i += 2) {
    const comp = parts[i];
    const simples = comp.match(SIMPLE) ?? [];
    if (!simples.length || simples.join("") !== comp || !simples.every((s) => ROOTISH.test(s))) break;
    for (const s of simples) {
      if (s === ".nx--phone") flag = "phone";
      else if (s === ".nx--desk") flag = "desk";
      else if (s.startsWith("[data-theme") || s === ":root") light = light || /light/.test(s);
      else if (/-l-/.test(s)) place += s;
    }
    if (/light/.test(comp)) light = true;
  }
  const rest = parts.slice(i).join("").replace(/^\s*[>+~]?\s*/, (m) => (m.trim() ? ` ${m.trim()} ` : " "));
  const root = OUTSIDE.test(sel) ? ".tu-pg" : `.tup${place}`;
  const body = rest.trim() ? `${root}${rest.startsWith(" ") ? "" : " "}${rest}`.replace(/\s+/g, " ") : root;
  return { sel: `${light ? ':root[data-theme="light"] ' : ""}${body}`.trim(), flag };
}

const renameValue = (v) => v.replace(/\bvx-/g, "tk-");
const CQ = { phone: "@container nx (max-width:699px)", desk: "@container nx (min-width:700px)" };

/** A rule → its ported rules (split by flag), as text; `keep(sel)` filters the prototype's selectors. */
function portRule(rule, keep) {
  const by = { "": [], phone: [], desk: [] };
  for (const s of rule.selectors) {
    if (!keep(s)) continue;
    const m = mapSelector(s);
    if (m) by[m.flag].push(m.sel);
  }
  const decls = rule.nodes
    .filter((n) => n.type === "decl")
    .map((d) => `${d.prop}:${renameValue(d.value)}${d.important ? "!important" : ""}`)
    .join(";");
  const out = [];
  for (const flag of ["", "phone", "desk"]) {
    if (!by[flag].length) continue;
    const r = `${[...new Set(by[flag])].join(",")}{${decls}}`;
    out.push(flag ? `${CQ[flag]}{${r}}` : r);
  }
  return out;
}

/** A node (rule or at-rule) → ported text lines. */
function portNode(node, keep) {
  if (node.type === "rule") return portRule(node, keep);
  if (node.type !== "atrule") return [];
  if (node.name === "font-face" || node.name === "import") return [];
  if (node.name === "keyframes") return [`@keyframes ${renameValue(node.params)}{${node.nodes.map((n) => n.toString()).join("")}}`];
  const inner = (node.nodes ?? []).flatMap((n) => portNode(n, keep));
  if (!inner.length) return [];
  const params = node.name === "container" ? node.params.replace(/^vx\b/, "nx") : node.params;
  return [`@${node.name} ${params}{\n${inner.join("\n")}\n}`];
}

// ── the three prototypes, section by section
const outputs = Object.fromEntries(FILES.map((f) => [f, []]));
const classes = (s) => new Set([...s.matchAll(/\.((?:tc|tt|tf)-[\w-]+)/g)].map((m) => m[1]));
const usedVx = new Set();
const PROTOS = ["TuCarta", "TuTemporada", "TuFicha"];
for (const name of PROTOS) {
  const html = read(`${name}.dc.html`);
  for (const m of html.matchAll(/\bvx-[\w-]+/g)) usedVx.add(m[0]);
  const css = postcss.parse(helmetCss(html));
  // (before its first comment: B's helpers are the shell's, C's the river's, A's its own page frame)
  let bucket = { TuCarta: "tu", TuTemporada: "tu-partidos", TuFicha: null }[name];
  const keptTt = new Set();
  const tail = [];
  // (its own classes, and its root's custom properties: `.tt{--tt-gold:…}`)
  const own = (s) => /\.(?:tc|tt|tf|vx)-/.test(s) || /^\s*(?::root\[[^\]]*\]\s*)?\.(?:tc|tt|tf)\s*$/.test(s);
  for (const node of css.nodes) {
    if (node.type === "comment") {
      const hit = SECTIONS[name].find(([re]) => re.test(node.text));
      bucket = hit ? hit[1] : bucket;
      continue;
    }
    if (bucket === null) continue;
    if (bucket === "tail") {
      tail.push(node);
      continue;
    }
    if (name !== "TuCarta") for (const c of classes(node.toString())) keptTt.add(c);
    outputs[bucket].push(...portNode(node, own));
  }
  // (C's «selected states» and tablet rules: only those about the pieces kept)
  for (const node of tail) {
    const keepTail = (s) => [...classes(s)].some((c) => keptTt.has(c));
    outputs["tu-partidos"].push(...portNode(node, keepTail));
  }
}

// ── the kit: the vx.css rules whose selectors name a vx- class the prototypes use
const kit = postcss.parse(read("vx.css"));
const usesKit = (s) => [...s.matchAll(/\.(vx-[\w-]+)/g)].some((m) => usedVx.has(m[1])) && !/\.nx-(?:top|ptop|wrap|scroller)\b/.test(s);
const kitOut = kit.nodes.flatMap((n) => portNode(n, usesKit));

// ── write
const HEAD = {
  tu: "«Tú»: the shell (the stage and its card, the masthead, the bar, «Lo que te toca», the nota chip, a place's head, the door, the states, the sheets) and the kit (tk-, the canvas vx-)",
  "tu-tu": "«Tú» › Tú: under the stage (the next match · your form · the next thing for your card)",
  "tu-partidos": "«Tú» › Tus partidos: B's place (head, chart, figures, jornada list), C's river and focus (tt-), A's table and match sheet (tf-)",
  "tu-juego": "«Tú» › Tu juego: the pitch, the proposal, the rank ladders, the partner, the comparison",
  "tu-vitrina": "«Tú» › Tu vitrina: the road, the tiers, the reward wall, the cromos",
  "tu-ajustes": "«Tú» › Ajustes: the index and its sections",
  "tu-avisos": "«Tú» › La bandeja: the filters, the stacks, «Este móvil»",
};
fs.mkdirSync(OUT, { recursive: true });
for (const f of FILES) {
  const file = path.join(OUT, `${f}.css`);
  const prev = fs.existsSync(file) ? fs.readFileSync(file, "utf8") : "";
  const handIdx = prev.indexOf(MARK);
  const hand = handIdx >= 0 ? prev.slice(handIdx) : `${MARK}\n`;
  const body = f === "tu" ? [...outputs.tu, "", "/* the kit (canvas vx.css → tk-) */", ...kitOut] : outputs[f];
  const head = `/* ${HEAD[f]}.\n   Ported from the Design canvas by scripts/port-tu-css.mjs: scoped .tup (the container nx), phone = @container nx\n   (max-width:699px). Above the «by hand» marker it is regenerated; below it, the app's own rules. */\n`;
  fs.writeFileSync(file, `${head}${body.join("\n")}\n\n${hand.replace(/\s*$/, "\n")}`.replace(/\r?\n/g, "\r\n"));
  console.log(`${f}.css: ${body.length} rules`);
}
