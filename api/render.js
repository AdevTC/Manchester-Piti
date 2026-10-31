// Server render of the public pages (vercel.json routes them here), and the permanent redirects of the old
// addresses whose parameters move too (/stats?view=…, /partidos?view=…, /matches/<id>?tab=…: the router's
// own table, src/lib/legacyUrls, built into dist-ssr). Renders the page with the public
// data bundle and the same React code as the browser (dist-ssr, built by `pnpm build`), so the first
// paint has the real content without waiting for the JavaScript. The rendered pages stay a minute in Vercel's
// CDN cache, and every write to the public data deletes them from it (functions/src/htmlCache.ts), so archived
// or deleted matches cannot reappear in a cached page.
// Any failure answers with the plain app shell: the page then boots exactly as without this.

// The bundle as the browsers get it, from Vercel's CDN (api/bundle.js: cached under «club-bundle», deleted with
// the pages on every write), and the function itself when that can't answer (a protected preview deployment).
const BUNDLE_PATH = "/datos/club.bundle";
const BUNDLE_URL = "https://europe-southwest1-futbolmanagement-dc6cb.cloudfunctions.net/clubBundle";
// The addresses rendered here (vite.config.ts SSR_PAGES says the same for `vite preview`): each screen of the
// public pages. Anything else gets the plain shell and the browser renders it.
export const PAGES = [
  /^\/$/,
  /^\/hoy\/(campo|jugadas)$/,
  /^\/camiseta$/,
  /^\/partidos(\/(tabla|balance))?$/,
  /^\/estadisticas(\/(y-si|jugadores(\/(campo(\/puestos)?|evolucion))?|campo(\/(puestos|sistemas))?|juego(\/(tabla|catalogo))?|rivales|records(\/(marcas|cromos|evolucion))?))?$/,
  /^\/plantilla(\/(album|cara-a-cara))?$/,
  /^\/jugadores\/[A-Za-z0-9_-]+(\/(temporada|jornadas|juego|analisis|cromo))?$/,
  /^\/club(\/(vitrina(\/[A-Za-z0-9_-]+)?|historia|equipo(\/camiseta)?|gente))?$/,
];
const isPage = (path) => PAGES.some((re) => re.test(path));
/** What vercel.json's rewrites add to the query: `p`, and Vercel also appends each named segment of the
 *  source (`/matches/:id`, `/hoy/:screen`, `/estadisticas/:path*`…). None of them is the visitor's: a redirect that
 *  kept them would send `/partidos/<id>/siete?id=<id>`. */
const REWRITE_PARAMS = ["p", "id", "screen", "path"];
/** The page the rewrite asks for (`p`) and the visitor's own query (the rewrite keeps it next to `p`). The
 *  server renders the path alone: a query is state the browser paints (dist-ssr/shell.js drops the markup). */
export function pageUrl(searchParams) {
  const path = (searchParams.get("p") || "/").replace(/(.)\/+$/, "$1");
  const query = new URLSearchParams(searchParams);
  for (const k of REWRITE_PARAMS) query.delete(k);
  const search = query.toString();
  return { path, url: path, href: path + (search ? `?${search}` : "") };
}
async function bundle(origin) {
  try {
    const cdn = await fetch(new URL(BUNDLE_PATH, origin), { signal: AbortSignal.timeout(8_000) });
    if (cdn.ok && (cdn.headers.get("content-type") ?? "").includes("octet-stream")) return new Uint8Array(await cdn.arrayBuffer());
  } catch {
    /* the function, below */
  }
  const response = await fetch(BUNDLE_URL, { cache: "no-store" });
  if (!response.ok) throw new Error(`bundle ${response.status}`);
  return new Uint8Array(await response.arrayBuffer());
}

/** A server-rendered page: cached on Vercel's CDN for a minute (tag «club-html», deleted when the public data
 *  changes: functions/src/htmlCache.ts), then served for a few minutes more while a fresh one renders behind it.
 *  The browser always asks again (the service worker serves returning visitors the shell anyway). */
const page = (body) =>
  new Response(body, {
    headers: {
      "content-type": "text/html; charset=utf-8",
      "cache-control": "public, max-age=0, must-revalidate",
      "vercel-cdn-cache-control": "max-age=60, stale-while-revalidate=300, stale-if-error=86400",
      "vercel-cache-tag": "club-html",
    },
  });

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
    const [{ template, routes }, bytes] = await Promise.all([import("../dist-ssr/shell.js"), bundle(new URL(request.url).origin)]);
    const { renderPage } = server;
    // (one instant for the whole page: its clocks read it, and the browser takes the page over at it too)
    const now = Date.now();
    const markup = await renderPage(url, bytes, now);
    const css = (routes.find(([re]) => new RegExp(re).test(path))?.[1] ?? []).filter((f) => f.endsWith(".css"));
    const head = css.map((file) => `<link rel="stylesheet" crossorigin href="${file}">`).join("");
    // The data and the instant the page was painted with go in it too: the browser takes the page over from
    // them (src/main.tsx) and primes its cache with the bundle instead of downloading it again (src/lib/bundle.ts).
    const data = `<script type="application/json" id="club-bundle" data-at="${now}">${server.inlineBundle(bytes)}</script>`;
    // Function replacers: `$` in the markup must not be read as a replacement pattern.
    const body = template
      .replace("<!--ssr-head-->", () => head)
      .replace("<!--ssr-root--></div>", () => `${markup}</div>${data}`);
    return page(body);
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
