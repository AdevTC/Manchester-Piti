import { defineConfig, mergeConfig } from "vitest/config";
import viteConfig from "./vite.config";

// Dedicated Vitest config. Vitest reads this in preference to vite.config.ts
// (which stays a pure Vite config); we merge the app's Vite config so the `@`
// alias + React/Tailwind plugins apply, then layer the test settings on top.
//
// - environment: jsdom — the Phase 9 component/integration tests need DOM APIs.
//   It is a superset of the node env the pure src/lib/*.test.ts ran under
//   before, so those tests keep passing.
// - globals: true — exposes describe/it/expect without imports and powers
//   @testing-library's auto-cleanup.
// - setupFiles: registers jest-dom matchers + per-test cleanup.
// - include: widened to *.test.tsx (the previous default was *.test.ts only)
//   so the new component tests are picked up alongside the existing pure ones.
export default mergeConfig(
  viteConfig,
  defineConfig({
    test: {
      environment: "jsdom",
      globals: true,
      setupFiles: ["./src/test/setup.ts"],
      css: false,
      include: ["src/**/*.test.{ts,tsx}"],
    },
  }),
);
