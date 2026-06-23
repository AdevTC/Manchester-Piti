import { defineConfig } from "vitest/config";

// Dedicated Vitest config for the Firestore security-rules tests. These run
// against the Firestore EMULATOR (not jsdom) and are intentionally kept apart
// from the app's `pnpm test` suite (vitest.config.ts globs only `src/**`).
//
// - environment: node — the rules tests use the Firebase JS SDK against the
//   emulator over the network; no DOM is needed.
// - include: only `test/rules/**` so this config never picks up the src suite.
// - no setupFiles / no jsdom polyfills — those are app-suite concerns.
// - testTimeout bumped: emulator round-trips (get()/exists() rule lookups +
//   clearFirestore between tests) are slower than pure unit assertions.
//
// Booted via `pnpm test:rules`, which wraps this in `firebase emulators:exec`.
export default defineConfig({
  test: {
    environment: "node",
    globals: true,
    include: ["test/rules/**/*.test.ts"],
    testTimeout: 20000,
    hookTimeout: 30000,
  },
});
