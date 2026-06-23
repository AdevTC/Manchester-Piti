import { defineConfig } from 'vite'
import { fileURLToPath, URL } from 'node:url'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'

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
  plugins: [react(), tailwindcss()],
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
