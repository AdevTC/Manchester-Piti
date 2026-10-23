// Server render of the public pages (vercel.json routes them here), and the permanent redirects of the old
// addresses whose parameters move too (/stats?view=…, /partidos?view=…, /matches/<id>?tab=…: the router's
// own table, src/lib/legacyUrls, built into dist-ssr). Renders the page with the public
// data bundle and the same React code as the browser (dist-ssr, built by `pnpm build`), so the first
// paint has the real content without waiting for the JavaScript. Read fresh public data on every
// request so archived or deleted matches cannot reappear in a cached page.
// Any failure answers with the plain app shell: the page then boots exactly as without this.

// The bundle function directly (Madrid, next to Firestore).
const BUNDLE_URL = "https://europe-southwest1-futbolmanagement-dc6cb.cloudfunctions.net/clubBundle";
// The addresses rendered here (vite.config.ts SSR_PAGES says the same for `vite preview`): each screen of the
// public pages. Anything else gets the plain shell and the browser renders it.
export const PAGES = [
  /^\/$/,
  /^\/hoy\/(campo|jugadas)$/,
  /^\/camiseta$/,
  /^\/partidos(\/(tabla|balance))?$/,
  /^\/numeros(\/(y-si|jugadores|campo(\/(puestos|sistemas))?|juego(\/(tabla|catalogo))?|rivales|records(\/(marcas|cromos|evolucion))?))?$/,
  /^\/plantilla(\/(album|cara-a-cara))?$/,
  /^\/jugadores\/[A-Za-z0-9_-]+(\/(temporada|jornadas|juego|analisis|cromo))?$/,
  /^\/club(\/(vitrina(\/[A-Za-z0-9_-]+)?|historia|equipo(\/camiseta)?|gente))?$/,
];
const isPage = (path) => PAGES.some((re) => re.test(path));
/** The page the rewrite asks for (`p`) and the visitor's own query (the rewrite keeps it next to `p`). The
 *  server renders the path alone: a query is state the browser paints (dist-ssr/shell.js drops the markup). */
export function pageUrl(searchParams) {
  const path = (searchParams.get("p") || "/").replace(/(.)\/+$/, "$1");
  const query = new URLSearchParams(searchParams);
  query.delete("p");
  const search = query.toString();
  return { path, url: path, href: path + (search ? `?${search}` : "") };
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

const moved = (location) =>
  new Response(null, { status: 308, headers: { location, "cache-control": "public, max-age=3600", "cdn-cache-control": "public, max-age=86400" } });

export async function GET(request) {
  const { path, url, href } = pageUrl(new URL(request.url).searchParams);
  try {
    const server = await import("../dist-ssr/entry-server.js");
    const to = server.legacyHref(href);
    if (to) return moved(to);
    if (!isPage(path)) throw new Error(`not a server-rendered page: ${path}`);
    const [{ template, routes }, bytes] = await Promise.all([import("../dist-ssr/shell.js"), bundle()]);
    const { renderPage } = server;
    const markup = await renderPage(url, bytes);
    const css = (routes.find(([re]) => new RegExp(re).test(path))?.[1] ?? []).filter((f) => f.endsWith(".css"));
    const head = css.map((file) => `<link rel="stylesheet" crossorigin href="${file}">`).join("");
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
