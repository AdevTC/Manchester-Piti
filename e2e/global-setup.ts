import { execFileSync } from "node:child_process";
// A demo project and loopback endpoints are hardcoded in the seed. Fail rather
// than silently skipping private flows when an emulator is unavailable.
export default function globalSetup() {
  execFileSync(process.execPath, ["functions/test/seed-preview.mjs"], {
    stdio: "inherit",
  });
}
