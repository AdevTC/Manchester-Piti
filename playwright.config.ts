import { defineConfig, devices } from "@playwright/test";

// Playwright E2E (Phase 10). Two spec groups, each served by its OWN dev server
// so their Firebase wiring never conflicts:
//
//   • *.preview.spec.ts — no real auth. Uses the DEV `?preview` hatch to render
//     the authenticated shell and exercise navigation / season-in-URL /
//     tab-in-URL. Served on PORT_PREVIEW WITHOUT the emulator flag (real prod
//     Firestore reads succeed; these specs only navigate, never write).
//   • *.crud.spec.ts — real CRUD persistence. Served on PORT_CRUD WITH
//     VITE_USE_FIREBASE_EMULATOR=1 so the app connects to the Auth + Firestore
//     emulators (see src/firebase.ts). Needs the emulators running:
//     `pnpm test:e2e:ci` boots them via `firebase emulators:exec`; locally you
//     can `pnpm emulators` first. When they're down the spec skips itself.
//
// Two dedicated ports (not the dev default 3000) so a normal `pnpm dev` the
// developer may have running never collides.

const PORT_PREVIEW = Number(process.env.E2E_PORT_PREVIEW ?? 3100);
const PORT_CRUD = Number(process.env.E2E_PORT_CRUD ?? 3101);
const URL_PREVIEW = `http://127.0.0.1:${PORT_PREVIEW}`;
const URL_CRUD = `http://127.0.0.1:${PORT_CRUD}`;

const chrome = devices["Desktop Chrome"];

export default defineConfig({
  testDir: "./e2e",
  fullyParallel: false,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 1 : 0,
  workers: 1,
  reporter: process.env.CI ? [["list"], ["html", { open: "never" }]] : "list",
  timeout: 30_000,
  expect: { timeout: 10_000 },
  // Seeds the emulator (admin user + season) when reachable; otherwise records
  // "unavailable" so the CRUD spec skips with a clear reason.
  globalSetup: "./e2e/global-setup.ts",

  use: {
    trace: "on-first-retry",
    screenshot: "only-on-failure",
  },

  projects: [
    {
      name: "preview",
      testMatch: /.*\.preview\.spec\.ts/,
      use: { ...chrome, baseURL: URL_PREVIEW },
    },
    {
      name: "crud",
      testMatch: /.*\.crud\.spec\.ts/,
      use: { ...chrome, baseURL: URL_CRUD },
    },
  ],

  // Two servers, one per project. Both bind 127.0.0.1 so the health check (which
  // hits 127.0.0.1) matches the listener. reuseExistingServer locally; fresh in CI.
  webServer: [
    {
      command: `pnpm dev --port ${PORT_PREVIEW} --strictPort --host 127.0.0.1`,
      url: URL_PREVIEW,
      reuseExistingServer: !process.env.CI,
      timeout: 120_000,
      stdout: "ignore",
      stderr: "pipe",
    },
    {
      command: `pnpm dev --port ${PORT_CRUD} --strictPort --host 127.0.0.1`,
      url: URL_CRUD,
      reuseExistingServer: !process.env.CI,
      timeout: 120_000,
      stdout: "ignore",
      stderr: "pipe",
      env: { VITE_USE_FIREBASE_EMULATOR: "1" },
    },
  ],
});
