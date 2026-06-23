import fs from "node:fs";
import path from "node:path";
import {
  ADMIN_EMAIL,
  ADMIN_PASSWORD,
  AUTH_HOST,
  FIRESTORE_HOST,
  PROJECT_ID,
  clearFirestore,
  createAuthUser,
  seedDoc,
} from "./emulator";

// Playwright global setup. If the Firebase emulators are reachable, seed the
// CRUD preconditions and record them in e2e/.emulator-state.json. If they are
// NOT reachable (e.g. `pnpm test:e2e` run without `firebase emulators:exec`),
// write a state file marking the emulator unavailable so the CRUD spec skips
// itself with a clear reason instead of failing.

const STATE_FILE = path.join(import.meta.dirname, ".emulator-state.json");

async function emulatorsReachable(): Promise<boolean> {
  // A successful TCP connection (ANY HTTP response, even a 404) means the
  // emulator is up. Only a thrown fetch (ECONNREFUSED) means it's down. The
  // Firestore "list root documents" endpoint returns 404 on an empty database,
  // so we must NOT require r.ok here.
  const reachable = (url: string, init?: RequestInit) =>
    fetch(url, init).then(
      () => true,
      () => false,
    );
  const auth = await reachable(`http://${AUTH_HOST}/`);
  const firestore = await reachable(
    `http://${FIRESTORE_HOST}/v1/projects/${PROJECT_ID}/databases/(default)/documents`,
    { headers: { Authorization: "Bearer owner" } },
  );
  return auth && firestore;
}

export default async function globalSetup(): Promise<void> {
  const reachable = await emulatorsReachable();

  if (!reachable) {
    fs.writeFileSync(
      STATE_FILE,
      JSON.stringify(
        {
          emulatorAvailable: false,
          reason:
            "Firebase emulators (auth:9099 / firestore:8080) not reachable. Run with `pnpm test:e2e:ci` or start emulators first (`pnpm emulators`).",
        },
        null,
        2,
      ),
    );
    return;
  }

  // Clean slate, then seed: admin auth user + admin users-doc + one season.
  await clearFirestore();
  const adminUid = await createAuthUser(ADMIN_EMAIL, ADMIN_PASSWORD);

  await seedDoc("users", adminUid, {
    email: ADMIN_EMAIL,
    nickname: "e2eadmin",
    role: "superadmin",
    createdAt: new Date(),
  });

  const seasonId = "e2e-season";
  await seedDoc("seasons", seasonId, {
    name: "Temporada E2E",
    captainPlayerId: "",
    createdAt: new Date(),
  });

  fs.writeFileSync(
    STATE_FILE,
    JSON.stringify(
      {
        emulatorAvailable: true,
        adminUid,
        adminEmail: ADMIN_EMAIL,
        adminPassword: ADMIN_PASSWORD,
        seasonId,
        seasonName: "Temporada E2E",
      },
      null,
      2,
    ),
  );
}
