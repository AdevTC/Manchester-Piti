// Run after pnpm build. Render the actual server page against in-memory bundles:
// no Firebase connection, credentials, emulator or production writes are needed.
import assert from "node:assert/strict";
import { test } from "node:test";
import { GET } from "../api/render.js";

const root = "projects/demo-manchester-piti/databases/(default)/documents";
const rival = "Rival comprobación SSR";
const value = (v) => typeof v === "string" ? { stringValue: v }
  : typeof v === "boolean" ? { booleanValue: v } : { integerValue: String(v) };
const doc = (path, fields, query) => [
  { documentMetadata: { name: `${root}/${path}`, exists: true, queries: [query] } },
  { document: { name: `${root}/${path}`, fields: Object.fromEntries(Object.entries(fields).map(([k, v]) => [k, value(v)])) } },
];
function bundle(match) {
  const elements = [
    { metadata: { id: "ssr-lifecycle-test" } },
    ...doc("seasons/test", { name: "Temporada de prueba" }, "seasons"),
    ...(match ? doc("matches/test", match, "matches") : []),
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
