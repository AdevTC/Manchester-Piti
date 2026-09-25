import { test, expect } from "@playwright/test";

test("la plantilla: percha, ficha con pestañas, búsqueda y cara a cara", async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto("/plantilla");
  await expect(page.getByRole("heading", { level: 1 })).toContainText("10 camisetas");

  const rail = page.getByRole("group", { name: "Elige jugador" });
  await rail.getByRole("button", { name: /^Hugo/ }).click();
  const ficha = page.locator("#sq-ficha");
  await expect(ficha.getByRole("heading", { level: 2, name: "Hugo" })).toBeVisible();
  await expect(ficha.getByText("Delantero").first()).toBeVisible();

  // The season tab reads the actas (the seed has one finished match).
  await ficha.getByRole("tab", { name: /Temporada/ }).click();
  await expect(ficha.getByRole("tabpanel")).toContainText("Partidos");

  await page.getByLabel("Buscar jugador").fill("luc");
  await expect(rail.getByRole("button")).toHaveCount(1);
  await page.getByLabel("Buscar jugador").fill("");

  // Any card sends its player to the head-to-head against the one in the ficha.
  await page.getByRole("button", { name: "Comparar a Nico" }).click();
  await expect(page.getByRole("listitem", { name: /^Edad: Hugo .*, Nico / })).toBeVisible();
  await expect(page.getByRole("button", { name: "Comparar a Nico" })).toHaveAttribute("aria-pressed", "true");

  expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true);
});
