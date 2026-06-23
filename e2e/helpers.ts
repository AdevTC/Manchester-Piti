import type { Page } from "@playwright/test";

// Shared E2E helpers.
//
// The app gates everything behind Google auth, with two DEV-only URL hatches:
//   • `?preview` — mocks an admin session WITHOUT touching Firebase Auth. Lets
//     the authenticated shell + routes render so navigation can be exercised.
//     Writes would hit `permission-denied` (no real auth), so preview specs only
//     read/navigate. Stripped from production builds (import.meta.env.DEV gate).
//   • `?login` — forces the login screen (unused here).
//
// For real CRUD persistence the emulator path is used instead (see auth.ts).

export const PREVIEW = "preview";

/** Build a URL on the app preserving/forcing the `?preview` hatch + extra search. */
export function appUrl(path = "/", search: Record<string, string> = {}): string {
  const params = new URLSearchParams({ [PREVIEW]: "", ...search });
  // URLSearchParams renders `preview=` ; the app only checks `.has("preview")`,
  // so the empty value is fine. Drop the trailing `=` for a cleaner URL.
  const qs = params.toString().replace(/preview=(&|$)/, "preview$1");
  return `${path}?${qs}`;
}

/** Navigate to a preview route and wait for the app shell (the main nav) to mount. */
export async function gotoPreview(
  page: Page,
  path = "/",
  search: Record<string, string> = {},
): Promise<void> {
  await page.goto(appUrl(path, search));
  // The Navbar's primary nav is the shell's stable landmark.
  await page
    .getByRole("navigation", { name: "Navegación principal" })
    .first()
    .waitFor({ state: "visible" });
}
