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
  // (the render reads the bundle the browsers get, from the site's CDN: api/bundle.js, deleted with the pages on
  // every write; each render asks again)
  globalThis.fetch = async (url) => {
    assert.equal(String(url), "https://piti.test/datos/club.bundle");
    requests++;
    return new Response(bytes, { headers: { "content-type": "application/octet-stream" } });
  };
  try {
    for (const [match, visible] of [[active, true], [{ ...active, individuallyArchived: true }, false], [null, false], [active, true]]) {
      bytes = bundle(match);
      const response = await GET(new Request("https://piti.test/api/render?p=/partidos"));
      const html = await response.text();
      assert.equal(response.status, 200);
      // (each render reads the bundle afresh; Vercel's CDN keeps the page under «club-html», fresh a minute and then
      // once more up to a day, and every write to the public data deletes it: functions/src/htmlCache.ts)
      assert.equal(response.headers.get("cache-control"), "public, max-age=0, must-revalidate");
      assert.equal(response.headers.get("vercel-cdn-cache-control"), "max-age=60, stale-while-revalidate=86400, stale-if-error=86400");
      assert.equal(response.headers.get("vercel-cache-tag"), "club-html");
      const [markup, rest] = html.split('<script type="application/json" id="club-bundle"');
      assert.equal(markup.includes(rival), visible);
      assert.ok(html.includes("data-ssr"), "must render actual page, not fallback shell");
      // The page carries the data it was painted with (no «<» inside it) and that instant, for the browser to take over.
      const inline = rest?.match(/^ data-at="(\d+)" data-until="(\d+)">([^<]*)<\/script>/);
      assert.ok(inline, "must carry its bundle");
      // (and until when its texts that read the clock hold: at most the end of its Madrid day, src/ssr/paintedUntil.ts)
      const left = Number(inline[2]) - Number(inline[1]);
      assert.ok(left > 0 && left <= 25 * 3_600_000, `data-until ${left} ms after data-at`);
      // (the same bundle /datos/club.bundle serves: an archived match is still a document, which the app's mappers drop)
      assert.equal(inline[3].includes(rival), match !== null);
      assert.ok(!html.includes('rel="preload" href="/datos/club.bundle"'), "no second download of the bundle");
    }
    assert.equal(requests, 4);
  } finally {
    globalThis.fetch = fetchBefore;
  }
});

await test("Tabla and Balance are their own server-rendered addresses; Jornadas paints at /partidos", async () => {
  const fetchBefore = globalThis.fetch;
  const active = { seasonId: "test", rival, date: Date.now() + 86400000, status: "scheduled", home: true };
  const rows = [
    { team: "Rayo Norte", pj: 8, g: 6, e: 1, p: 1, gf: 25, gc: 8, pts: 19, isUs: false },
    { team: "Manchester Piti", pj: 8, g: 5, e: 3, p: 0, gf: 20, gc: 9, pts: 18, isUs: true },
  ];
  const bytes = bundle(active, { competition: "Liga F7", jornada: 8, updatedAt: new Date(), updatedBy: "u", rows });
  globalThis.fetch = async () => new Response(bytes);
  try {
    const page = async (path) => (await GET(new Request(`https://piti.test/api/render?p=${path}`))).text();
    const tabla = await page("/partidos/tabla");
    assert.ok(tabla.includes("data-ssr"), "must render actual page, not fallback shell");
    // (the page's root names its screen: pa--jornadas, pa--tabla, pa--balance)
    assert.ok(tabla.includes("pa pa--tabla"), "the table is the screen the server paints");
    assert.ok(tabla.includes("Rayo Norte"));
    assert.ok((await page("/partidos/balance")).includes("pa pa--balance"), "Balance is the screen the server paints");
    const jornadas = await page("/partidos");
    assert.ok(jornadas.includes("data-ssr"));
    assert.ok(jornadas.includes("pa pa--jornadas"), "Jornadas at /partidos");
    for (const path of ["/estadisticas", "/estadisticas/jugadores", "/club/historia", "/plantilla/album"]) assert.ok((await page(path)).includes("data-ssr"), `${path} is server-rendered`);
    assert.ok(!(await page("/estadisticas/nada")).includes("data-ssr"), "an unknown screen gets the plain shell");
  } finally {
    globalThis.fetch = fetchBefore;
  }
});

// The match's own address, the link that gets shared, arrives painted like the other public pages; its other screens
// (El siete, Números, Vestuario) and la mesa keep the shell.
await test("El partido is server-rendered at /partidos/<id>; its other screens are not", async () => {
  const fetchBefore = globalThis.fetch;
  const bytes = bundle({ seasonId: "test", rival, date: Date.now() - 3 * 86400000, status: "finished", home: true, goalsFor: 3, goalsAgainst: 1 });
  globalThis.fetch = async () => new Response(bytes);
  try {
    const page = async (path) => (await GET(new Request(`https://piti.test/api/render?p=${path}&id=test`))).text();
    const html = await page("/partidos/test");
    assert.ok(html.includes("data-ssr"), "must render actual page, not fallback shell");
    const [markup] = html.split('<script type="application/json" id="club-bundle"');
    assert.ok(markup.includes('class="vx vd-pg pp '), "the match page");
    assert.ok(markup.includes(rival), "with its match");
    assert.ok(!markup.includes("pp-404"), "found");
    // (its own stylesheets come with it: the route's files, vite.config.ts ROUTE_CHUNKS)
    assert.match(html, /<link rel="stylesheet" crossorigin href="\/assets\/MatchPage-[\w-]+\.css">/);
    assert.ok((await page("/partidos/nada")).includes("pp-404"), "a match that isn't there is the page's own «no encontrado»");
    for (const path of ["/partidos/test/siete", "/partidos/test/numeros", "/partidos/test/vestuario", "/partidos/test/mesa"]) assert.ok(!(await page(path)).includes("data-ssr"), `${path} keeps the shell`);
  } finally {
    globalThis.fetch = fetchBefore;
  }
});

await test("the old addresses answer a permanent redirect with their parameters, before any data is read", async () => {
  const fetchBefore = globalThis.fetch;
  globalThis.fetch = async () => {
    throw new Error("a redirect reads no data");
  };
  try {
    for (const [request, location] of [
      ["p=/partidos&view=tabla&temporada=t0", "/partidos/tabla?temporada=t0"],
      ["p=/partidos&view=numeros", "/partidos/balance"],
      ["p=/stats", "/estadisticas"],
      ["p=/stats&view=players&season=t1", "/estadisticas/jugadores?temporada=t1"],
      ["p=/stats&view=compare&a=alcides&b=erik", "/plantilla/cara-a-cara?a=alcides&b=erik"],
      ["p=/matches/j1", "/partidos/j1"],
      ["p=/matches/j1&tab=campo", "/partidos/j1/siete"],
      ["p=/matches/j1&tab=vestuario", "/partidos/j1/vestuario"],
      // (as Vercel calls it: the rewrite also appends its named segments, never part of the new address)
      ["p=/matches/j1&id=j1&tab=campo", "/partidos/j1/siete"],
      ["p=/numeros/records/marcas&path=records/marcas", "/estadisticas/records/marcas"],
      ["p=/estadisticas/jugadores&path=jugadores&view=minutes", "/estadisticas/jugadores?ranking=minutos&ver=todo"],
    ]) {
      const response = await GET(new Request(`https://piti.test/api/render?${request}`));
      assert.equal(response.status, 308, request);
      assert.equal(response.headers.get("location"), location, request);
    }
  } finally {
    globalThis.fetch = fetchBefore;
  }
});

// The server render links the home's stylesheets with Inicio's before the kit's (.vd-scoreline's 150 px, .vd-score's
// line-height and letter-spacing), so the lens's own score, kick-off time and word must outrank the kit's single class
// rather than tie with it: a tie put a 150 px score over the names on a phone.
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
      ["in-score", ["font-size"]],
      ["in-kick", ["font-size"]],
      ["pp-word", ["font-size", "line-height", "letter-spacing"]],
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

// Estadísticas' headline is Anton, a face no other page's first screen uses: the server-rendered page preloads it with
// its stylesheets (vite.config.ts ROUTE_FONTS), so the headline is painted in Anton from the start instead of swapping
// from Archivo a moment later. The other pages don't fetch it.
await test("the server-rendered Estadísticas preloads its headline's face, and only Estadísticas does", async () => {
  const fetchBefore = globalThis.fetch;
  const bytes = bundle({ seasonId: "test", rival, date: Date.now() + 86400000, status: "scheduled", home: true });
  globalThis.fetch = async () => new Response(bytes);
  try {
    const fonts = async (p) => [...(await (await GET(new Request(`https://piti.test/api/render?p=${p}`))).text()).matchAll(/<link rel="preload" as="font" type="font\/woff2" crossorigin href="([^"]+)">/g)].map((m) => m[1]);
    const stats = await fonts("/estadisticas");
    assert.equal(stats.length, 1);
    assert.match(stats[0], /^\/assets\/anton-latin-400-normal-[\w-]+\.woff2$/);
    readFileSync(new URL(`../dist${stats[0]}`, import.meta.url));
    assert.deepEqual(await fonts("/estadisticas/jugadores"), stats);
    assert.deepEqual(await fonts("/"), []);
    assert.deepEqual(await fonts("/partidos"), []);
  } finally {
    globalThis.fetch = fetchBefore;
  }
});
