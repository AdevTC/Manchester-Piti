// api/bundle.js: the data bundle through Vercel's CDN, compressed, cached a minute under «club-bundle» (which
// api/purge.js deletes with the pages); a failing function is never cached.
import assert from "node:assert/strict";
import { gunzipSync } from "node:zlib";
import { test } from "node:test";
import { BUNDLE_FUNCTION, GET } from "../api/bundle.js";

await test("passes the function's bundle on, compressed and tagged for the CDN", async () => {
  const fetchBefore = globalThis.fetch;
  const body = Buffer.from('144{"metadata":{"id":"club-publico"}}');
  globalThis.fetch = async (url, init) => {
    assert.equal(String(url), BUNDLE_FUNCTION);
    assert.equal(init?.headers?.["accept-encoding"], "identity");
    return new Response(body, { headers: { "content-type": "application/octet-stream" } });
  };
  try {
    const res = await GET();
    assert.equal(res.status, 200);
    assert.equal(res.headers.get("content-type"), "application/octet-stream");
    assert.equal(res.headers.get("content-encoding"), "gzip");
    assert.equal(res.headers.get("vercel-cache-tag"), "club-bundle");
    assert.match(res.headers.get("vercel-cdn-cache-control") ?? "", /^max-age=60\b/);
    assert.deepEqual(gunzipSync(Buffer.from(await res.arrayBuffer())), body);
  } finally {
    globalThis.fetch = fetchBefore;
  }
});

await test("a failing function answers 502, never cached", async () => {
  const fetchBefore = globalThis.fetch;
  globalThis.fetch = async () => new Response(null, { status: 500 });
  try {
    const res = await GET();
    assert.equal(res.status, 502);
    assert.equal(res.headers.get("cache-control"), "no-store");
    assert.equal(res.headers.get("vercel-cache-tag"), null);
  } finally {
    globalThis.fetch = fetchBefore;
  }
});
