// The page's inline scripts as FIXED text: what changes from one build to the next (the file names) travels beside
// them as JSON in <script type="application/json"> (data the browser never runs, outside the Content-Security-Policy).
// Fixed text → a fixed sha256, the one the CSP in vercel.json lists (src/lib/vercelHeaders.test.ts checks it, and
// scripts/ssr-shell.mjs checks the built pages). The theme script is index.html's own (one line: CRLF or LF, the same hash).
// Used by vite.config.ts (the shell's route preload) and scripts/ssr-shell.mjs (the server-rendered page's boot).
import { createHash } from "node:crypto";
import { createRequire } from "node:module";

/** The `id` of the route preload's data: [[route regex source, [files]], …] (vite.config.ts preloadRouteChunk). */
export const ROUTE_ASSETS_ID = "route-assets";
/** Match the URL, add <link rel=modulepreload|preload> for its chunk graph (and its faces). */
export const ROUTE_PRELOAD_JS =
  `(function(){var p=location.pathname,e=document.getElementById('${ROUTE_ASSETS_ID}');if(!e)return;var m=JSON.parse(e.textContent);` +
  `for(var i=0;i<m.length;i++){if(new RegExp(m[i][0]).test(p)){m[i][1].forEach(function(h){` +
  `var l=document.createElement('link');if(/\\.css$/.test(h)){l.rel='preload';l.as='style'}else if(/\\.woff2$/.test(h)){l.rel='preload';l.as='font';l.type='font/woff2'}else{l.rel='modulepreload'}` +
  `l.crossOrigin='';l.href=h;document.head.appendChild(l)});break}}})()`;

/** The `id` of the boot's data: { f: the entry's preloads, m: the routes' files, e: the entry, w: registerSW.js or "" }. */
export const SSR_BOOT_ID = "ssr-boot";
/**
 * The server-rendered page's boot (scripts/ssr-shell.mjs): with a URL or saved season the server can't know about,
 * the markup is dropped and the app boots as from the shell — the same for a copy the CDN kept past its `data-until`
 * (src/ssr/paintedUntil.ts); otherwise the JavaScript starts after the first paint.
 */
export const SSR_BOOT_JS =
  `(function(){var d=document.documentElement,r=document.getElementById("root"),s;` +
  `try{s=localStorage.getItem("selected_season_id")}catch(e){}` +
  `var spa=!!location.search||!!(s&&s!=="all"),c=document.getElementById("club-bundle"),u=c&&+c.getAttribute("data-until");if(u&&Date.now()>u)spa=true;if(spa){r.innerHTML="";d.removeAttribute("data-ssr")}` +
  `var done=0;function go(){if(done)return;done=1;var b=JSON.parse(document.getElementById("${SSR_BOOT_ID}").textContent),h=document.head,p=location.pathname,f=b.f,m=b.m,i;` +
  `for(i=0;i<m.length;i++)if(new RegExp(m[i][0]).test(p)){f=f.concat(m[i][1]);break}` +
  `f.forEach(function(u){if(/\\.(css|woff2)$/.test(u))return;var l=document.createElement("link");l.rel="modulepreload";l.crossOrigin="";l.href=u;h.appendChild(l)});` +
  `var e=document.createElement("script");e.type="module";e.crossOrigin="";e.src=b.e;h.appendChild(e);` +
  `if(b.w){var w=document.createElement("script");w.src=b.w;w.defer=true;h.appendChild(w)}}` +
  `if(spa)return go();` +
  `try{new PerformanceObserver(function(l){if(l.getEntriesByName("first-contentful-paint").length)setTimeout(go,0)}).observe({type:"paint",buffered:true})}catch(e){}` +
  `setTimeout(go,1500)})()`;

/**
 * TanStack Router's own inline script in every server-rendered page (scrollRestoration: true, src/router.tsx): its
 * scroll restoration, as the router's server build writes it (the library's text, so a router upgrade that changes
 * it fails the CSP check), inside react-router's <ScriptOnce>, which adds the «remove me» tail.
 */
export function routerScrollScript() {
  const fromReactRouter = createRequire(createRequire(import.meta.url).resolve("@tanstack/react-router"));
  const { getScrollRestorationScriptForRouter } = fromReactRouter("@tanstack/router-core/scroll-restoration-script");
  return getScrollRestorationScriptForRouter({ options: { scrollRestoration: true }, latestLocation: {} }) + ";document.currentScript.remove()";
}

/** JSON inside a <script type="application/json">: a «<» never closes the element. */
export const jsonScript = (id, value) => `<script type="application/json" id="${id}">${JSON.stringify(value).replace(/</g, "\\u003c")}</script>`;

/** The CSP source of an inline script's exact text. */
export const cspHash = (code) => `'sha256-${createHash("sha256").update(code, "utf8").digest("base64")}'`;

/** Every inline <script> without a src that the browser runs (no type, or a JavaScript one): its text. */
export function inlineScripts(html) {
  return [...html.matchAll(/<script\b([^>]*)>([\s\S]*?)<\/script>/gi)]
    .filter(([, attrs]) => {
      if (/\bsrc\s*=/i.test(attrs)) return false;
      const type = /\btype\s*=\s*["']?([^"'\s>]+)/i.exec(attrs)?.[1]?.toLowerCase();
      return !type || type === "module" || type === "text/javascript";
    })
    .map(([, , code]) => code);
}
