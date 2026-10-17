import { test, expect } from "@playwright/test";

// La mesa is for the admins and the match's anotadores: anyone else gets the gate and the way back to the
// match page (where the directo is followed). «preview-next» comes from the preview seed (global setup).
test("la mesa: un aficionado ve «Solo para quien anota» y vuelve al partido", async ({ page }) => {
  await page.goto("/matches/preview-next/mesa");
  await expect(page.getByRole("heading", { name: "Solo para quien anota" })).toBeVisible();
  await expect(page.getByRole("button", { name: "Gol del Piti" })).toHaveCount(0);
  await page.getByRole("link", { name: "Volver al partido" }).click();
  await expect(page).toHaveURL(/\/matches\/preview-next(\?|$)/);
});

test("el antiguo «En juego» de la sala lleva a la mesa", async ({ page }) => {
  await page.goto("/admin/en-juego/preview-next");
  await expect(page).toHaveURL(/\/matches\/preview-next\/mesa(\?|$)/);
});
