// Server render of the public pages (vercel.json routes them here). Renders the page with the public
// data bundle and the same React code as the browser (dist-ssr, built by `pnpm build`), so the first
// paint has the real content without waiting for the JavaScript. Read fresh public data on every
// request so archived or deleted matches cannot reappear in a cached page.
// Any failure answers with the plain app shell: the page then boots exactly as without this.

// The bundle function directly (Madrid, next to Firestore).
const BUNDLE_URL = "https://europe-southwest1-futbolmanagement-dc6cb.cloudfunctions.net/clubBundle";
const PAGES = new Set(["/", "/partidos", "/stats", "/club", "/plantilla"]);
// The search params a page renders differently with (the rewrite keeps the visitor's query next to
// `p`): only the known values pass, so the server never renders a URL the browser would not.
const VIEWS = { "/partidos": new Set(["tabla", "numeros"]) };
/** The URL the server renders: the page's path, plus its `view` when it is one the page knows. */
export function pageUrl(searchParams) {
  const path = searchParams.get("p") || "/";
  const view = searchParams.get("view");
  return { path, url: view && VIEWS[path]?.has(view) ? `${path}?view=${view}` : path };
}
async function bundle() {
  const response = await fetch(BUNDLE_URL, { cache: "no-store" });
  if (!response.ok) throw new Error(`bundle ${response.status}`);
  return new Uint8Array(await response.arrayBuffer());
}

const html = (body) =>
  new Response(body, {
    headers: {
      "content-type": "text/html; charset=utf-8",
      "cache-control": "no-store",
      "cdn-cache-control": "no-store",
    },
  });

export async function GET(request) {
  const { path, url } = pageUrl(new URL(request.url).searchParams);
  try {
    if (!PAGES.has(path)) throw new Error(`not a server-rendered page: ${path}`);
    const [{ renderPage }, { template, routes }, bytes] = await Promise.all([
      import("../dist-ssr/entry-server.js"),
      import("../dist-ssr/shell.js"),
      bundle(),
    ]);
    const markup = await renderPage(url, bytes);
    const css = (routes.find(([re]) => new RegExp(re).test(path))?.[1] ?? []).filter((f) => f.endsWith(".css"));
    const head = css.map((href) => `<link rel="stylesheet" crossorigin href="${href}">`).join("");
    // Function replacers: `$` in the markup must not be read as a replacement pattern.
    const page = template.replace("<!--ssr-head-->", () => head).replace("<!--ssr-root-->", () => markup);
    return html(page);
  } catch (error) {
    console.error("render", path, error);
    try {
      const { shell } = await import("../dist-ssr/shell.js");
      return html(shell);
    } catch {
      const shell = await fetch(new URL("/shell.html", request.url)).then((r) => r.text());
      return html(shell);
    }
  }
}
