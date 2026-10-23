// Run after pnpm build. Firebase loads after the first paint (src/lib/fb.ts): neither the entry nor the code of a
// page every visitor opens may import it statically, or it is downloaded and run again before anything shows.
// Walks the built chunks' static imports from the entry and each public page's chunks (dist-ssr/shell.js routes).
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { gzipSync } from "node:zlib";
import { routes } from "../dist-ssr/shell.js";

// The pages behind the door load Firebase with their code (la mesa, Tú): only the others are checked.
const PRIVATE = /mesa|perfil|avisos/;
const shell = readFileSync("dist/shell.html", "utf8");
const entry = shell.match(/<script type="module" crossorigin src="([^"]+)"/)?.[1];
assert.ok(entry, "dist/shell.html has no entry script");
const read = (file) => readFileSync(`dist${file}`, "utf8");
const imports = (file) => [...read(file).matchAll(/(?:^|[;}\n])\s*import\s*(?:[\w${},*\s]+?from\s*)?["']\.\/([^"']+\.js)["']/g)].map((m) => `/assets/${m[1]}`);
function closure(starts) {
  const from = new Map();
  const queue = starts.map((s) => [s, null]);
  while (queue.length) {
    const [file, by] = queue.shift();
    if (from.has(file)) continue;
    from.set(file, by);
    for (const next of imports(file)) queue.push([next, file]);
  }
  return from;
}
const chain = (from, file) => {
  const path = [];
  for (let f = file; f; f = from.get(f)) path.unshift(f.replace("/assets/", ""));
  return path.join(" → ");
};
for (const [re, files] of [["(entry)", []], ...routes.filter(([re]) => !PRIVATE.test(re))]) {
  const from = closure([entry, ...files.filter((f) => f.endsWith(".js"))]);
  const firebase = [...from.keys()].filter((f) => /\/firebase-[\w-]+\.js$/.test(f));
  const kb = [...from.keys()].reduce((n, f) => n + gzipSync(read(f)).length, 0) / 1024;
  assert.deepEqual(firebase.map((f) => chain(from, f)), [], `${re} loads Firebase before the first paint`);
  console.log(`check-boot: ${re} ${from.size} chunks, ${kb.toFixed(1)} KB gzip, no Firebase`);
}
