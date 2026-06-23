import fs from "node:fs";
import path from "node:path";
import { test, expect, type Page } from "@playwright/test";
import { FIRESTORE_HOST, PROJECT_ID, readDoc, seedDoc } from "./emulator";

// Real CRUD-persistence E2E against the Firebase Emulator Suite.
//
// This is the verification gap the agent could never close in a browser: real
// Admin writes (create/edit/delete) by a genuinely-authenticated admin, through
// the REAL production firestore.rules, asserted to PERSIST.
//
// Auth strategy:
//   1. global-setup seeds the Auth emulator with an admin user and seeds (via
//      the privileged "owner" REST token) that user's `users/{uid}` doc with
//      role 'superadmin' plus one season — recorded in .emulator-state.json.
//   2. Here we sign in for REAL via window.__mpEmulatorSignIn (a DEV+emulator-only
//      hook in src/firebase.ts) so onAuthStateChanged fires with a real session
//      and AuthContext loads the admin profile.
//   3. We then drive the real Admin UI; every write goes through the real rules
//      (isAdmin() reads the seeded users-doc). Persistence is asserted by reading
//      the doc straight back out of the emulator.
//
// If the emulator isn't reachable, the whole describe skips with a clear reason.

const STATE_FILE = path.join(import.meta.dirname, ".emulator-state.json");

interface EmulatorState {
  emulatorAvailable: boolean;
  reason?: string;
  adminUid?: string;
  adminEmail?: string;
  adminPassword?: string;
  seasonId?: string;
  seasonName?: string;
}

function readState(): EmulatorState {
  try {
    return JSON.parse(fs.readFileSync(STATE_FILE, "utf8")) as EmulatorState;
  } catch {
    return { emulatorAvailable: false, reason: "No .emulator-state.json (global setup did not run)." };
  }
}

const state = readState();

test.describe("Admin CRUD persistence (Firebase emulator)", () => {
  test.skip(
    !state.emulatorAvailable,
    `Firebase emulator unavailable — ${state.reason ?? "not seeded"}. Run \`pnpm test:e2e:ci\`.`,
  );

  // Sign in as the seeded admin so AuthContext renders the authenticated shell.
  async function signInAsAdmin(page: Page): Promise<void> {
    const nav = page.getByRole("navigation", { name: "Navegación principal" }).first();
    const adminTab = nav.getByRole("button", { name: "Admin" });

    // Retry the whole sign-in→render loop. Two transient conditions are handled:
    //  • auth/network-request-failed — the Auth emulator's first request after
    //    connectAuthEmulator can race its config fetch.
    //  • "Execution context was destroyed" — a SUCCESSFUL sign-in fires
    //    onAuthStateChanged, which navigates (RouterProvider mounts) and tears
    //    down the evaluate's context mid-call. That's success, not failure: we
    //    confirm it by waiting for the Admin tab below.
    for (let attempt = 0; attempt < 5; attempt++) {
      await page.goto("/");
      await page.waitForFunction(
        () =>
          typeof (window as unknown as { __mpEmulatorSignIn?: unknown }).__mpEmulatorSignIn ===
          "function",
        undefined,
        { timeout: 15_000 },
      );
      try {
        await page.evaluate(
          ([email, password]) =>
            (
              window as unknown as {
                __mpEmulatorSignIn: (e: string, p: string) => Promise<unknown>;
              }
            ).__mpEmulatorSignIn(email, password),
          [state.adminEmail as string, state.adminPassword as string],
        );
      } catch (e) {
        const msg = (e as Error).message ?? "";
        if (msg.includes("Execution context was destroyed")) {
          // Sign-in succeeded and triggered navigation — fall through to assert.
        } else if (msg.includes("auth/network-request-failed")) {
          await page.waitForTimeout(500);
          continue; // retry the whole flow
        } else {
          throw e;
        }
      }
      if (await adminTab.isVisible().catch(() => false)) break;
      // Give the auth-state listener a beat to render the shell, then re-check.
      if (await adminTab.waitFor({ state: "visible", timeout: 8_000 }).then(() => true, () => false))
        break;
    }
    await expect(adminTab).toBeVisible({ timeout: 15_000 });
  }

  test("player: create → edit → delete persists through the real rules", async ({ page }) => {
    await signInAsAdmin(page);
    await page.goto("/admin?tab=roster");

    const stamp = Date.now();
    const firstName = `E2E Jugador ${stamp}`;
    const shirtName = "E2ETEST";
    const number = 87;

    // CREATE — fill by stable RHF `name` attributes (placeholders are ambiguous).
    await page.locator('input[name="firstName"]').fill(firstName);
    await page.locator('input[name="shirtName"]').fill(shirtName);
    await page.locator('input[name="number"]').fill(String(number));
    await page.getByRole("button", { name: "Registrar Jugador" }).click();

    await expect(page.getByText("¡Jugador registrado en la plantilla!")).toBeVisible();
    // It shows in the realtime roster (shirtName is upper-cased by the mutation).
    await expect(page.getByText(`("${shirtName}")`)).toBeVisible();

    // PERSISTENCE: read the doc straight out of the emulator. Find its id by
    // matching shirtName among the players collection.
    const playerId = await findDocIdByField("players", "shirtName", shirtName);
    expect(playerId, "created player should exist in Firestore").not.toBeNull();
    const created = await readDoc("players", playerId as string);
    expect(created?.shirtName).toEqual({ stringValue: shirtName });
    expect(created?.number).toEqual({ integerValue: String(number) });

    // EDIT — open the editor for this player's roster row, change the dorsal,
    // save. The row is the div that has BOTH the shirtName text AND an Editar
    // button (so we target the row, not a nested span).
    const rosterRow = page
      .locator("div")
      .filter({ hasText: `("${shirtName}")` })
      .filter({ has: page.getByRole("button", { name: "Editar" }) })
      .last();
    await rosterRow.getByRole("button", { name: "Editar" }).click();
    const newNumber = 88;
    await page.locator('input[name="number"]').fill(String(newNumber));
    await page.getByRole("button", { name: "Guardar Cambios" }).click();
    await expect(page.getByText("¡Jugador actualizado correctamente!")).toBeVisible();

    // PERSISTENCE of the edit.
    await expect
      .poll(async () => {
        const f = await readDoc("players", playerId as string);
        return f?.number;
      })
      .toEqual({ integerValue: String(newNumber) });

    // DELETE — confirm the window.confirm dialog.
    page.once("dialog", (d) => void d.accept());
    await page
      .locator("div")
      .filter({ hasText: `("${shirtName}")` })
      .filter({ has: page.getByRole("button", { name: "Eliminar" }) })
      .last()
      .getByRole("button", { name: "Eliminar" })
      .click();
    await expect(page.getByText("¡Jugador eliminado correctamente!")).toBeVisible();

    // PERSISTENCE of the delete: the doc is gone from Firestore.
    await expect
      .poll(async () => readDoc("players", playerId as string))
      .toBeNull();
  });

  test("match: create persists through the real rules", async ({ page }) => {
    // The Admin match form only renders when BOTH a season AND at least one
    // player exist. The season is seeded in global-setup; seed a player here
    // (rules-bypassing REST) so the form shows. This is just a precondition —
    // the match WRITE itself still goes through the real rules from the browser.
    await seedDoc("players", "e2e-match-fixture-player", {
      firstName: "Fixture",
      lastName: "Player",
      shirtName: "FIX",
      number: 1,
      active: true,
    });

    await signInAsAdmin(page);
    await page.goto("/admin?tab=matches");

    const rival = `Rival E2E ${Date.now()}`;

    // Season select (Radix combobox). There are several comboboxes on the page
    // (the Navbar season picker, the match season + competition selects), so
    // scope to the match form's one via its placeholder text "Selecciona la
    // Temporada", then pick the seeded season from the portal-rendered listbox.
    const main = page.getByRole("main");
    await main.getByRole("combobox").filter({ hasText: "Selecciona la Temporada" }).click();
    await page.getByRole("option", { name: state.seasonName as string }).click();

    await page.locator('input[name="rival"]').fill(rival);
    await page.locator('input[type="datetime-local"]').fill("2026-05-01T18:00");
    await page.locator('input[name="goalsFor"]').fill("3");
    await page.locator('input[name="goalsAgainst"]').fill("1");

    await page.getByRole("button", { name: "Guardar Partido Registrado" }).click();
    await expect(page.getByText("¡Partido registrado con éxito!")).toBeVisible({ timeout: 15_000 });

    // PERSISTENCE: the match exists in Firestore with the rival we typed.
    const matchId = await findDocIdByField("matches", "rival", rival);
    expect(matchId, "created match should exist in Firestore").not.toBeNull();
    const created = await readDoc("matches", matchId as string);
    expect(created?.rival).toEqual({ stringValue: rival });
    expect(created?.goalsFor).toEqual({ integerValue: "3" });
    expect(created?.seasonId).toEqual({ stringValue: state.seasonId as string });
  });
});

// Direct emulator read sanity-check (no browser): proves the seed + REST path
// works independent of the UI.
test.describe("emulator seed sanity", () => {
  test.skip(!state.emulatorAvailable, "Firebase emulator unavailable.");

  test("the seeded admin users-doc is readable from the emulator", async () => {
    const fields = await readDoc("users", state.adminUid as string);
    expect(fields).not.toBeNull();
    expect(fields?.role).toEqual({ stringValue: "superadmin" });
  });
});

// ── helper ───────────────────────────────────────────────────────────────────

/** List a collection (rules-bypassing) and return the first doc id whose given
 *  string field equals `value`, or null. */
async function findDocIdByField(
  collection: string,
  field: string,
  value: string,
): Promise<string | null> {
  const res = await fetch(
    `http://${FIRESTORE_HOST}/v1/projects/${PROJECT_ID}/databases/(default)/documents/${collection}?pageSize=300`,
    { headers: { Authorization: "Bearer owner" } },
  );
  if (!res.ok) return null;
  const body = (await res.json()) as {
    documents?: { name: string; fields?: Record<string, { stringValue?: string }> }[];
  };
  for (const d of body.documents ?? []) {
    if (d.fields?.[field]?.stringValue === value) {
      return d.name.split("/").pop() ?? null;
    }
  }
  return null;
}
