import { globSync, readFileSync } from "node:fs";
import { configDefaults, defineConfig, mergeConfig } from "vitest/config";
import viteConfig from "./vite.config";

// Dedicated Vitest config. Vitest reads this in preference to vite.config.ts
// (which stays a pure Vite config); we merge the app's Vite config so the `@`
// alias + React/Tailwind plugins apply, then layer the test settings on top.
//
// Two projects:
// - unit: the pure *.test.ts files, in a node worker without per-file isolation — modules and the environment are
//   loaded once per worker instead of once per file (~3 s for ~280 files instead of minutes under jsdom).
// - dom: everything else, as before — jsdom, one fresh environment per file, setupFiles registering jest-dom
//   matchers, per-test cleanup and the jsdom polyfills Radix needs.
// A *.test.ts goes to dom when it says `// @vitest-environment jsdom` (it needs window/document; in node it fails
// with «window is not defined») or uses vi.mock/vi.doMock (shared workers leak module mocks into other files).
// - globals: true — exposes describe/it/expect without imports and powers @testing-library's auto-cleanup.
const NEEDS_ISOLATION = /@vitest-environment jsdom|vi\.(mock|doMock)\(/;
const unitTests = globSync("src/**/*.test.ts")
  .map((file) => file.replaceAll("\\", "/"))
  .filter((file) => !NEEDS_ISOLATION.test(readFileSync(file, "utf8")));

// vite.config.ts is a function (client vs server-render build): resolve it for this run first. Its
// `ssr.noExternal: true` (the server render bundles its dependencies) is dropped here: inherited by Vitest it made
// every worker transform and hold React, Firebase, Zod… as source text (~114 MB of strings per worker).
export default defineConfig((env) =>
  mergeConfig(
    { ...viteConfig(env), ssr: {} },
    defineConfig({
      test: {
        globals: true,
        css: false,
        // Default is one fork per core (23 here, 150–500 MB each under jsdom): two parallel sessions testing at
        // once ate ~8 GB and lagged the PC. 6 keeps a full run fast; VITEST_MAX_WORKERS overrides it.
        maxWorkers: process.env.VITEST_MAX_WORKERS ?? 6,
        projects: [
          {
            extends: true,
            test: { name: "unit", environment: "node", isolate: false, include: unitTests },
          },
          {
            extends: true,
            test: {
              name: "dom",
              environment: "jsdom",
              // V8 grows the heap lazily when RAM is plentiful: a page test retaining ~200 MB swelled its fork to
              // ~600 MB of garbage. A 320 MB old space makes it collect sooner (forks peak ~400 MB, same speed).
              execArgv: ["--max-old-space-size=320"],
              setupFiles: ["./src/test/setup.ts"],
              include: ["src/**/*.test.{ts,tsx}"],
              exclude: [...configDefaults.exclude, ...unitTests],
            },
          },
        ],
      },
    }),
  ),
);
