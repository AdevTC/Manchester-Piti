// Run after pnpm build. Render the actual server page against in-memory bundles:
// no Firebase connection, credentials, emulator or production writes are needed.
import assert from "node:assert/strict";
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

await test("?view=tabla reaches the server render; an unknown view renders the calendar", async () => {
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
    assert.ok(tabla.includes("Tabla de la clasificación"), "the table renders on the server");
    assert.ok(tabla.includes("Rayo Norte"));
    for (const query of ["", "&view=otra"]) {
      const html = await page(query);
      assert.ok(html.includes("data-ssr"));
      assert.ok(!html.includes("Tabla de la clasificación"), `no table for «${query}»`);
      assert.ok(html.includes("El calendario"));
    }
  } finally {
    globalThis.fetch = fetchBefore;
  }
});
