// Server render of the public pages (vercel.json routes them here). Renders the page with the public
// data bundle and the same React code as the browser (dist-ssr, built by `pnpm build`), so the first
// paint has the real content without waiting for the JavaScript. Vercel's CDN keeps each page a
// minute and serves the previous copy while it refreshes, like the data bundle itself.
// Any failure answers with the plain app shell: the page then boots exactly as without this.

// The bundle function directly (Madrid, next to Firestore); it memoizes its build for 30 s.
const BUNDLE_URL = "https://europe-southwest1-futbolmanagement-dc6cb.cloudfunctions.net/clubBundle";
const PAGES = new Set(["/", "/partidos", "/stats", "/club", "/plantilla"]);
const MEMO_MS = 30_000;

let memo = null;
function bundle() {
  if (!memo || Date.now() - memo.at > MEMO_MS) {
    const bytes = fetch(BUNDLE_URL).then(async (r) => {
      if (!r.ok) throw new Error(`bundle ${r.status}`);
      return new Uint8Array(await r.arrayBuffer());
    });
    memo = { at: Date.now(), bytes };
    bytes.catch(() => {
      if (memo?.bytes === bytes) memo = null;
    });
  }
  return memo.bytes;
}

const html = (body, cdn) =>
  new Response(body, {
    headers: {
      "content-type": "text/html; charset=utf-8",
      // Browsers always ask again (the CDN answers); the CDN serves a stale copy while it re-renders.
      "cache-control": "public, max-age=0, must-revalidate",
      "cdn-cache-control": cdn,
    },
  });

export async function GET(request) {
  const path = new URL(request.url).searchParams.get("p") || "/";
  try {
    if (!PAGES.has(path)) throw new Error(`not a server-rendered page: ${path}`);
    const [{ renderPage }, { template, routes }, bytes] = await Promise.all([
      import("../dist-ssr/entry-server.js"),
      import("../dist-ssr/shell.js"),
      bundle(),
    ]);
    const markup = await renderPage(path, bytes);
    const css = (routes.find(([re]) => new RegExp(re).test(path))?.[1] ?? []).filter((f) => f.endsWith(".css"));
    const head = css.map((href) => `<link rel="stylesheet" crossorigin href="${href}">`).join("");
    // Function replacers: `$` in the markup must not be read as a replacement pattern.
    const page = template.replace("<!--ssr-head-->", () => head).replace("<!--ssr-root-->", () => markup);
    return html(page, "max-age=60, stale-while-revalidate=86400");
  } catch (error) {
    console.error("render", path, error);
    try {
      const { shell } = await import("../dist-ssr/shell.js");
      return html(shell, "max-age=10");
    } catch {
      const shell = await fetch(new URL("/shell.html", request.url)).then((r) => r.text());
      return html(shell, "max-age=10");
    }
  }
}
