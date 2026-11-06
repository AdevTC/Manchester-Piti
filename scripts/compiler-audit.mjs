// One-off audit: runs the React Compiler (the same Babel plugin the build uses) over src/ and lists every component
// or hook it skips or fails on, with the reason. The build never says so: a skipped function just ships unmemoised.
// Usage: node scripts/compiler-audit.mjs [path-filter]      (e.g. `node scripts/compiler-audit.mjs pages/partidos`)
// Prints one line per finding (file:line  name  kind  reason) and a count per kind; exit 0 always (it is a report).
import { readFileSync, readdirSync, statSync } from "node:fs";
import { join, relative, sep } from "node:path";
import { createRequire } from "node:module";
import { pathToFileURL } from "node:url";

// BABEL_CORE=<dir of an @babel/core> audits with that Babel instead of the one the build uses (to compare 7 and 8).
const { transformAsync } = process.env.BABEL_CORE
  ? createRequire(pathToFileURL(process.env.BABEL_CORE + "/").href)("@babel/core")
  : await import("@babel/core");

const ROOT = "src";
const filter = process.argv[2] ?? "";
/** The same files the Vite preset hands to the compiler (see reactCompilerPreset's code filter). */
const CODE_FILTER = /forwardRef|memo|\b(?:[A-Z]|use[A-Z0-9])/;

function walk(dir, out = []) {
  for (const name of readdirSync(dir)) {
    const p = join(dir, name);
    if (statSync(p).isDirectory()) walk(p, out);
    else if (/\.(tsx?|jsx?)$/.test(name) && !/\.(test|spec)\.|\.d\.ts$/.test(name)) out.push(p);
  }
  return out;
}

const files = walk(ROOT).filter((f) => f.split(sep).join("/").includes(filter));
const findings = [];
let compiled = 0;

for (const file of files) {
  const code = readFileSync(file, "utf8");
  if (!CODE_FILTER.test(code)) continue;
  const rel = relative(".", file).split(sep).join("/");
  const logger = {
    logEvent(_filename, event) {
      if (event.kind === "CompileSuccess") {
        compiled++;
        return;
      }
      if (!["CompileError", "CompileSkip", "PipelineError", "CompileUnexpectedThrow"].includes(event.kind)) return;
      const detail = event.detail ?? {};
      const opts = detail.options ?? detail;
      const loc = event.fnLoc ?? opts.loc ?? detail.loc ?? null;
      // where in the function the compiler gave up (a diagnostic keeps it in its first detail)
      const at = opts.loc ?? detail.loc ?? opts.details?.find((d) => d.loc)?.loc ?? null;
      const reason = String(opts.reason ?? event.reason ?? event.data ?? detail.message ?? "").split("\n")[0];
      const description = String(opts.description ?? "").split("\n")[0];
      const fnLine = loc?.start?.line;
      findings.push({
        file: rel,
        line: fnLine ?? "?",
        name: `${fnLine ? (code.split("\n")[fnLine - 1].match(/(?:function|const|let)\s+([\w$]+)/)?.[1] ?? "") : ""}${at?.start?.line && at.start.line !== fnLine ? ` (L${at.start.line})` : ""}`,
        kind: event.kind,
        category: opts.category ?? "",
        reason: description ? `${reason} — ${description}` : reason,
      });
    },
  };
  try {
    await transformAsync(code, {
      filename: file,
      babelrc: false,
      configFile: false,
      parserOpts: { plugins: /\.[jt]sx$/.test(file) ? ["typescript", "jsx"] : ["typescript"] },
      plugins: [["babel-plugin-react-compiler", { panicThreshold: "none", logger }]],
    });
  } catch (err) {
    findings.push({ file: rel, line: "?", name: "", kind: "BabelError", category: "", reason: String(err.message).split("\n")[0] });
  }
}

findings.sort((a, b) => a.file.localeCompare(b.file) || Number(a.line) - Number(b.line));
for (const f of findings) console.log(`${f.file}:${f.line}\t${f.name || "(anónima)"}\t${f.kind}${f.category ? `/${f.category}` : ""}\t${f.reason}`);
const byKind = {};
for (const f of findings) byKind[f.kind] = (byKind[f.kind] ?? 0) + 1;
console.log(`\n${compiled} funciones compiladas; omitidas o con error: ${JSON.stringify(byKind)}`);
