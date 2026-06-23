import { test, expect } from "@playwright/test";
import { appUrl, gotoPreview } from "./helpers";

// Navigation / URL-state E2E using the DEV `?preview` hatch (no real auth).
// These exercise the real router, the real Navbar, and the typed search params
// (season + tab) end to end — coverage that needs no Firestore writes.

test.describe("navigation (preview session)", () => {
  test("app shell loads with the primary navigation", async ({ page }) => {
    await gotoPreview(page);
    const nav = page.getByRole("navigation", { name: "Navegación principal" }).first();
    await expect(nav).toBeVisible();
    // Preview session is an admin, so the Admin tab is present.
    await expect(nav.getByRole("button", { name: "Admin" })).toBeVisible();
  });

  test("navigates MatchCenter → Stats → Plantilla via the nav rail", async ({ page }) => {
    await gotoPreview(page, "/");
    const nav = page.getByRole("navigation", { name: "Navegación principal" }).first();

    await nav.getByRole("button", { name: "Estadísticas" }).click();
    await expect(page).toHaveURL(/\/stats/);
    await expect(nav.getByRole("button", { name: "Estadísticas" })).toHaveAttribute(
      "aria-current",
      "page",
    );

    await nav.getByRole("button", { name: "Plantilla" }).click();
    await expect(page).toHaveURL(/\/plantilla/);
    // The Plantilla shell renders its mode tablist.
    await expect(page.getByRole("tablist", { name: "Modo de plantilla" })).toBeVisible();

    // Brand button returns to MatchCenter ("/").
    await page.getByRole("button", { name: /Manchester/ }).first().click();
    await expect(page).toHaveURL(/\/(\?|$)/);
  });

  test("season in the URL is honored on a deep link", async ({ page }) => {
    // Deep-link Stats with an explicit season param. The router validates it and
    // SeasonUrlSync seeds the context from it; the param survives in the URL.
    await gotoPreview(page, "/stats", { season: "all" });
    await expect(page).toHaveURL(/season=all/);
    await expect(page).toHaveURL(/\/stats/);
  });

  test("Stats tab in the URL deep-links and persists across reload", async ({ page }) => {
    await gotoPreview(page, "/stats", { tab: "compare" });
    await expect(page).toHaveURL(/tab=compare/);
    // The two Stats tab buttons render above the data (independent of loading),
    // so they are a stable anchor that the route mounted with the compare tab.
    const compareBtn = page.getByRole("button", { name: "Comparador Cara a Cara" });
    const summaryBtn = page.getByRole("button", { name: "Resumen y Récords" });
    await expect(compareBtn).toBeVisible();
    await expect(summaryBtn).toBeVisible();

    // Reload keeps the tab (search params are the source of truth, not state).
    await page.reload();
    await expect(page).toHaveURL(/tab=compare/);

    // Clicking the summary tab rewrites the URL param in place (preserving others).
    await summaryBtn.click();
    await expect(page).toHaveURL(/tab=general/);
  });

  test("Plantilla mode in the URL deep-links to the Pizarra tab", async ({ page }) => {
    await gotoPreview(page, "/plantilla", { mode: "pizarra" });
    await expect(page).toHaveURL(/mode=pizarra/);
    const pizarraTab = page.getByRole("tab", { name: /Pizarra/ });
    await expect(pizarraTab).toHaveAttribute("aria-selected", "true");
  });

  test("an invalid tab value falls back to the default (validateSearch .catch)", async ({
    page,
  }) => {
    // statsSearchSchema.tab has .catch("general"); a bogus value must not blank
    // the page — the router coerces it. We assert the Stats route still renders.
    await page.goto(appUrl("/stats", { tab: "bogus" }));
    await expect(
      page.getByRole("navigation", { name: "Navegación principal" }).first(),
    ).toBeVisible();
    await expect(page).toHaveURL(/\/stats/);
  });
});
