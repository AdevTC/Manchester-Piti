import { test, expect } from "@playwright/test";

test("la plantilla: la percha abre al jugador, sus secciones, la búsqueda y el cara a cara que elige en la percha", async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto("/plantilla");
  await expect(page.getByRole("heading", { level: 1, name: "Plantilla" })).toBeVisible();
  const rail = page.getByRole("group", { name: "La plantilla en su percha: elige jugador" });
  await expect(page.locator(".pl-hint")).toContainText("10 camisetas");

  // A shirt opens the player at his own address (the percha folds into its strip).
  await rail.getByRole("button", { name: /^Hugo, dorsal 8/ }).click();
  await expect(page).toHaveURL(/\/jugadores\/preview-player-7$/);
  await expect(page.getByRole("heading", { level: 1, name: "Hugo" })).toBeVisible();
  await expect(page.locator(".pl-hero__kick")).toContainText("Delantero");

  // Each section is a screen with its address; the season reads the actas (the seed has one finished match).
  await page.getByRole("tab", { name: /^Temporada/ }).click();
  await expect(page).toHaveURL(/\/jugadores\/preview-player-7\/temporada$/);
  await expect(page.getByRole("tabpanel")).toContainText("Partidos");
  await page.getByRole("button", { name: /^Jugador siguiente: Lucas/ }).click();
  await expect(page.getByRole("heading", { level: 1, name: "Lucas" })).toBeVisible();
  await expect(page).toHaveURL(/\/jugadores\/preview-player-8\/temporada$/);

  // «Plantilla» goes back to the vestuario, whose search filters the percha.
  await page.getByRole("button", { name: "Plantilla", exact: true }).click();
  await expect(page).toHaveURL(/\/plantilla$/);
  await page.getByLabel("Buscar jugador").fill("luc");
  await expect(page.getByRole("group", { name: "La plantilla en su percha: elige jugador" }).getByRole("button")).toHaveCount(1);
  await page.getByLabel("Buscar jugador").fill("");

  // The duel: «Cambiar» marks a corner and the shirt tapped on the percha goes into it.
  await page.getByRole("button", { name: /^Cara a cara/ }).click();
  await expect(page).toHaveURL(/\/plantilla\/cara-a-cara\?/);
  await page.getByRole("button", { name: /^Jugador 2: .*Cambiar jugador/ }).click();
  await page.getByRole("button", { name: "Poner a Nico en la esquina 2" }).click();
  await expect(page.getByRole("button", { name: "Jugador 2: Nico. Cambiar jugador" })).toBeVisible();
  await expect(page).toHaveURL(/b=preview-player-9/);
  await expect(page.locator(".pl-duel")).toContainText("Edad");

  expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true);
});
