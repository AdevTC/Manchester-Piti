// Run after pnpm build. Render the actual server page against in-memory bundles:
// no Firebase connection, credentials, emulator or production writes are needed.
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { test } from "node:test";
import { GET } from "../api/render.js";

const root = "projects/demo-manchester-piti/databases/(default)/documents";
const rival = "Rival comprobación SSR";
const value = (v) => typeof v === "string" ? { stringValue: v }
  : typeof v === "boolean" ? { booleanValue: v }
  : v instanceof Date ? { timestampValue: v.toISOString() }
  : Array.isArray(v) ? { arrayValue: { values: v.map(value) } }
  : typeof v === "object" ? { mapValue: { fields: Object.fromEntries(Object.entries(v).map(([k, x]) => [k, value(x)])) } }
  : { integerValue: String(v) };
const doc = (path, fields, query) => [
  { documentMetadata: { name: `${root}/${path}`, exists: true, queries: [query] } },
  { document: { name: `${root}/${path}`, fields: Object.fromEntries(Object.entries(fields).map(([k, v]) => [k, value(v)])) } },
];
function bundle(match, standings) {
  const elements = [
    { metadata: { id: "ssr-lifecycle-test" } },
    ...doc("seasons/test", { name: "Temporada de prueba" }, "seasons"),
    ...(match ? doc("matches/test", match, "matches") : []),
    ...(standings ? doc("standings/test", standings, "standings") : []),
  ];
  return Buffer.concat(elements.flatMap(element => {
    const bytes = Buffer.from(JSON.stringify(element));
    return [Buffer.from(String(bytes.length)), bytes];
  }));
}

await test("public HTML follows archive, deletion and restoration without serving an earlier snapshot", async () => {
  const fetchBefore = globalThis.fetch;
  const active = { seasonId: "test", rival, date: Date.now() + 86400000, status: "scheduled", home: true };
  let bytes = bundle(active);
  let requests = 0;
  globalThis.fetch = async (url, options) => {
    assert.equal(String(url), "https://europe-southwest1-futbolmanagement-dc6cb.cloudfunctions.net/clubBundle");
    assert.equal(options?.cache, "no-store");
    requests++;
    return new Response(bytes);
  };
  try {
    for (const [match, visible] of [[active, true], [{ ...active, individuallyArchived: true }, false], [null, false], [active, true]]) {
      bytes = bundle(match);
      const response = await GET(new Request("https://piti.test/api/render?p=/partidos"));
      const html = await response.text();
      assert.equal(response.status, 200);
      assert.equal(response.headers.get("cache-control"), "no-store");
      assert.equal(response.headers.get("cdn-cache-control"), "no-store");
      assert.equal(html.includes(rival), visible);
      assert.ok(html.includes("data-ssr"), "must render actual page, not fallback shell");
    }
    assert.equal(requests, 4);
  } finally {
    globalThis.fetch = fetchBefore;
  }
});

await test("?view=tabla and ?view=numeros reach the server render; an unknown view renders Jornadas", async () => {
  const fetchBefore = globalThis.fetch;
  const active = { seasonId: "test", rival, date: Date.now() + 86400000, status: "scheduled", home: true };
  const rows = [
    { team: "Rayo Norte", pj: 8, g: 6, e: 1, p: 1, gf: 25, gc: 8, pts: 19, isUs: false },
    { team: "Manchester Piti", pj: 8, g: 5, e: 3, p: 0, gf: 20, gc: 9, pts: 18, isUs: true },
  ];
  const bytes = bundle(active, { competition: "Liga F7", jornada: 8, updatedAt: new Date(), updatedBy: "u", rows });
  globalThis.fetch = async () => new Response(bytes);
  try {
    const page = async (query) => (await GET(new Request(`https://piti.test/api/render?p=/partidos${query}`))).text();
    const tabla = await page("&view=tabla");
    assert.ok(tabla.includes("data-ssr"), "must render actual page, not fallback shell");
    assert.ok(tabla.includes("vp-panel--tabla is-on"), "the table is the vista the server paints");
    assert.ok(tabla.includes("Rayo Norte"));
    assert.ok((await page("&view=numeros")).includes("vp-panel--numeros is-on"), "Números is the vista the server paints");
    for (const query of ["", "&view=otra"]) {
      const html = await page(query);
      assert.ok(html.includes("data-ssr"));
      assert.ok(!html.includes("vp-panel--tabla is-on"), `not the table for «${query}»`);
      assert.ok(html.includes("vp-panel--jornadas is-on"), `Jornadas for «${query}»`);
    }
  } finally {
    globalThis.fetch = fetchBefore;
  }
});

// The server render links the home's stylesheets with Inicio's before the kit's (.vd-scoreline's 150 px, .vd-score's
// nowrap), so the lens's own score and word must outrank the kit's single class rather than tie with it: a tie put
// «Pendiente del acta» on one line over both crests on a phone, and a 150 px score over the names.
await test("the server-rendered home's lens score and word outrank the kit's rules whatever their stylesheets' order", async () => {
  const fetchBefore = globalThis.fetch;
  const bytes = bundle({ seasonId: "test", rival, date: Date.now() + 86400000, status: "scheduled", home: true });
  globalThis.fetch = async () => new Response(bytes);
  try {
    const html = await (await GET(new Request("https://piti.test/api/render?p=/"))).text();
    assert.ok(html.includes("data-ssr"), "must render actual page, not fallback shell");
    const css = [...html.matchAll(/<link rel="stylesheet" crossorigin href="([^"]+)">/g)].map((m) => readFileSync(new URL(`../dist${m[1]}`, import.meta.url), "utf8")).join("\n");
    const rules = [...css.matchAll(/([^{}]+)\{([^{}]*)\}/g)];
    // (a selector's classes, attributes and pseudo-classes: the middle of its specificity)
    const classes = (selector) => (selector.match(/\.[\w-]+|\[[^\]]+\]|:(?!:)[\w-]+/g) ?? []).length;
    for (const [cls, props] of [
      ["vi-score", ["font-size"]],
      ["vi-word__t", ["font-size", "line-height", "white-space", "letter-spacing"]],
    ]) {
      const named = new RegExp(`\\.${cls}(?![\\w-])`);
      const selectors = rules.flatMap(([, prelude, decls]) => (props.some((p) => new RegExp(`(?:^|;)\\s*${p}\\s*:`).test(decls)) ? prelude.split(",").filter((s) => named.test(s)) : []));
      assert.ok(selectors.length > 0, `the rules that size .${cls} are in the home's stylesheets`);
      for (const s of selectors) assert.ok(classes(s) > 1, `«${s.trim()}» ties with the kit's one class`);
    }
  } finally {
    globalThis.fetch = fetchBefore;
  }
});
