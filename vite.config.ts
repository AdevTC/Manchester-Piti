import { defineConfig } from 'vite'
import { fileURLToPath, URL } from 'node:url'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'
import { VitePWA } from 'vite-plugin-pwa'

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

export default defineConfig({
  plugins: [
    react(),
    tailwindcss(),
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
        navigateFallbackDenylist: [/^\/calendario\.ics/, /^\/compartir\//, /^\/social\//, /^\/__\//],
        runtimeCaching: [
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
    },
  },
  server: {
    port: 3000,
    strictPort: true,
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
            { name: 'firebase', test: vendor('@firebase', 'firebase', 'idb', 're2js') },
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
