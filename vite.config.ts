import { defineConfig } from 'vite'
import { fileURLToPath, URL } from 'node:url'
import react, { reactCompilerPreset } from '@vitejs/plugin-react'
import babel from '@rolldown/plugin-babel'
import tailwindcss from '@tailwindcss/vite'
import { VitePWA } from 'vite-plugin-pwa'
import type { Plugin } from 'vite'

// https://vite.dev/config/
// Match a node_modules package by exact name, anchored on the package
// directory boundary (the segment right after the final `node_modules/`), so
// e.g. `react` does not also match `react-dom` or `lucide-react`. Tolerates
// both POSIX and Windows separators in the module id (pnpm nests packages).
const sep = '[\\\\/]' // matches / or \ in the module id
const vendor = (...packages: [string, ...string[]]): RegExp => {
  const escaped = packages.map((p) => p.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'))
  return new RegExp(`${sep}node_modules${sep}(?:${escaped.join('|')})${sep}`)
}

// Preload the two faces that paint the first screen of the Celeste pages (headline + body), so they
// arrive with the CSS instead of after it: no late swap re-flowing the text (CLS) and earlier LCP.
const CRITICAL_FONTS = [/anybody-latin-standard-normal-.*\.woff2$/, /geist-latin-wght-normal-.*\.woff2$/]
const preloadCriticalFonts = (): Plugin => ({
  name: 'preload-critical-fonts',
  apply: 'build',
  transformIndexHtml: {
    order: 'post',
    handler(_html, ctx) {
      const files = Object.keys(ctx.bundle ?? {}).filter((f) => CRITICAL_FONTS.some((re) => re.test(f)))
      return files.map((f) => ({
        tag: 'link',
        attrs: { rel: 'preload', as: 'font', type: 'font/woff2', href: '/' + f, crossorigin: '' },
        injectTo: 'head-prepend' as const,
      }))
    },
  },
})

// The page's own code is a lazy chunk the router asks for only after the entry has run. Starting it
// from the HTML, by URL, removes that wait (one round trip less before the first paint with content).
const ROUTE_CHUNKS: [RegExp, string][] = [
  [/^\/$/, 'src/pages/Home.tsx'],
  [/^\/plantilla\/?$/, 'src/pages/squad/SquadPage.tsx'],
  [/^\/partidos\/?$/, 'src/pages/Fixtures.tsx'],
  [/^\/stats\/?$/, 'src/pages/ClubStats.tsx'],
  [/^\/club\/?$/, 'src/pages/Club.tsx'],
  [/^\/vestuario\/?$/, 'src/pages/vestuario/VestuarioPage.tsx'],
  [/^\/matches\//, 'src/pages/MatchDetail.tsx'],
  [/^\/jugadores\//, 'src/pages/PlayerProfile.tsx'],
]
const preloadRouteChunk = (): Plugin => ({
  name: 'preload-route-chunk',
  apply: 'build',
  transformIndexHtml: {
    order: 'post',
    handler(_html, ctx) {
      const bundle = ctx.bundle ?? {}
      const chunks = Object.values(bundle).filter((c) => c.type === 'chunk')
      const byFile = new Map(chunks.map((c) => [c.fileName, c]))
      const graph = (root: (typeof chunks)[number], skip = new Set<string>()) => {
        const seen = new Set<string>()
        const walk = (c: (typeof chunks)[number]) => {
          if (seen.has(c.fileName) || skip.has(c.fileName)) return
          seen.add(c.fileName)
          for (const css of c.viteMetadata?.importedCss ?? []) seen.add(css)
          for (const i of c.imports) {
            const next = byFile.get(i)
            if (next) walk(next)
          }
        }
        walk(root)
        return seen
      }
      // The HTML already loads the entry and everything it imports: only add the page's own files.
      const entry = chunks.find((c) => c.isEntry)
      const loaded = entry ? graph(entry) : new Set<string>()
      const files = (route: (typeof chunks)[number]) => [...graph(route, loaded)].filter((f) => !loaded.has(f)).map((f) => '/' + f)
      const map = ROUTE_CHUNKS.flatMap(([re, src]) => {
        const chunk = chunks.find((c) => c.isDynamicEntry && c.facadeModuleId?.replace(/\\/g, '/').endsWith(src))
        return chunk ? [[re.source, files(chunk)] as const] : []
      })
      // Tiny inline script: match the URL, add <link rel=modulepreload|preload> for its chunk graph.
      const script =
        `(function(){var p=location.pathname,m=${JSON.stringify(map)};` +
        `for(var i=0;i<m.length;i++){if(new RegExp(m[i][0]).test(p)){m[i][1].forEach(function(h){` +
        `var l=document.createElement('link');if(/\\.css$/.test(h)){l.rel='preload';l.as='style'}else{l.rel='modulepreload'}` +
        `l.crossOrigin='';l.href=h;document.head.appendChild(l)});break}}})()`
      return [{ tag: 'script', children: script, injectTo: 'head' as const }]
    },
  },
})

export default defineConfig({
  plugins: [
    react(),
    // React Compiler 1.0 (stable Babel path): automatic memoisation, fewer re-renders.
    babel({ presets: [reactCompilerPreset()] }),
    tailwindcss(),
    preloadCriticalFonts(),
    preloadRouteChunk(),
    // Service worker (Workbox, generateSW): the app shell, every hashed chunk and the
    // self-hosted fonts are precached, so repeat visits start without the network and
    // route changes never wait for a download. A new deploy activates on the next load.
    // Firestore/Auth traffic is cross-origin and never touched.
    VitePWA({
      registerType: 'autoUpdate',
      injectRegister: 'script-defer',
      manifest: false, // public/manifest.webmanifest stays the source of truth
      workbox: {
        globPatterns: ['**/*.{js,css,html,woff2,svg,webp}'],
        // Not precached: latin-ext faces (only fetched for rare letters), the 3D assets (runtime cache
        // below) and the admin-only screens.
        globIgnores: ['**/*-latin-ext-*', 'models/**', 'assets/AdminHub-*', 'assets/ContentEditor-*'],
        // The three.js chunk is ~590 KB minified: above Workbox's 2 MiB default it would be skipped silently.
        maximumFileSizeToCacheInBytes: 3 * 1024 * 1024,
        cleanupOutdatedCaches: true,
        navigateFallback: 'index.html',
        // Served by Cloud Functions through vercel.json rewrites: never answer them with the SPA.
        navigateFallbackDenylist: [/^\/calendario\.ics/, /^\/compartir\//, /^\/social\//, /^\/__\//, /^\/datos\//],
        runtimeCaching: [
          {
            // Public data bundle: the last copy at once on repeat visits, a fresh one fetched behind it.
            urlPattern: ({ url, sameOrigin }) => sameOrigin && url.pathname === '/datos/club.bundle',
            handler: 'StaleWhileRevalidate',
            options: { cacheName: 'piti-data', expiration: { maxEntries: 2 } },
          },
          {
            // The 3D model and kit textures: served from the device, refreshed in the background.
            urlPattern: ({ url, sameOrigin }) => sameOrigin && url.pathname.startsWith('/models/'),
            handler: 'StaleWhileRevalidate',
            options: { cacheName: 'piti-models', expiration: { maxEntries: 20 } },
          },
          {
            urlPattern: ({ url, sameOrigin }) => sameOrigin && /^\/(crest|grain)[\w-]*\.(png|webp)$/.test(url.pathname),
            handler: 'StaleWhileRevalidate',
            options: { cacheName: 'piti-images', expiration: { maxEntries: 20 } },
          },
        ],
      },
    }),
  ],
  resolve: {
    alias: {
      '@': fileURLToPath(new URL('./src', import.meta.url)),
      // Firestore bundles the RE2 engine for Pipelines, which we never use (see the stub).
      re2js: fileURLToPath(new URL('./src/lib/re2js-stub.ts', import.meta.url)),
    },
  },
  // ES-module workers (stills.worker.ts uses import.meta and shares three with the page build).
  worker: { format: 'es' },
  server: {
    port: 3000,
    strictPort: true,
    // Against the emulators, serve the data bundle like the Vercel rewrite does in production.
    proxy: process.env.VITE_USE_FIREBASE_EMULATOR === '1'
      ? { '/datos/club.bundle': { target: 'http://127.0.0.1:5001', rewrite: () => '/demo-manchester-piti/europe-southwest1/clubBundle' } }
      : undefined,
  },
  preview: {
    proxy: process.env.VITE_USE_FIREBASE_EMULATOR === '1'
      ? { '/datos/club.bundle': { target: 'http://127.0.0.1:5001', rewrite: () => '/demo-manchester-piti/europe-southwest1/clubBundle' } }
      : undefined,
  },
  build: {
    // Vite 8 bundles with Rolldown; the object form of `manualChunks` is
    // removed and the function form is deprecated. Chunk grouping now lives in
    // `rolldownOptions.output.codeSplitting.groups` (https://rolldown.rs).
    // Route-level code-splitting (lazyRouteComponent) stays intact; these
    // groups only pull shared heavy vendors out of the auto-named shared chunk.
    rolldownOptions: {
      output: {
        codeSplitting: {
          groups: [
            { name: 'firebase', test: vendor('@firebase', 'firebase', 'idb') },
            { name: 'motion', test: vendor('motion-dom', 'framer-motion', 'motion-utils') },
            // React core lands in the `motion` chunk, not here: motion pulls it
            // in as a transitive dep and Rolldown keeps it there. Harmless —
            // both are vendor chunks on the entry path. `react-dom` + `scheduler`
            // land in this `react-vendor` chunk (verified via build sourcemaps).
            { name: 'react-vendor', test: vendor('react', 'react-dom', 'scheduler') },
          ],
        },
      },
    },
  },
})
