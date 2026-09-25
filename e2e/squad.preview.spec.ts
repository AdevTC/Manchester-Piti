import { test, expect } from "@playwright/test";

test("la plantilla: percha, ficha en ventana, búsqueda y cara a cara con selector", async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto("/plantilla");
  await expect(page.getByRole("heading", { level: 1 })).toContainText("10 camisetas");
  // Nothing is picked until the viewer taps a shirt.
  await expect(page.getByRole("dialog")).toHaveCount(0);

  const rail = page.getByRole("group", { name: "Elige jugador" });
  await rail.getByRole("button", { name: /^Hugo/ }).click();
  const ficha = page.getByRole("dialog", { name: "Hugo" });
  await expect(ficha).toBeVisible();
  await expect(ficha.getByText("Delantero").first()).toBeVisible();

  // The season tab reads the actas (the seed has one finished match).
  await ficha.getByRole("tab", { name: /Temporada/ }).click();
  await expect(ficha.getByRole("tabpanel")).toContainText("Partidos");
  await ficha.getByRole("button", { name: "Jugador siguiente" }).click();
  await expect(page.getByRole("dialog", { name: "Lucas" })).toBeVisible();
  await page.keyboard.press("Escape");
  await expect(page.getByRole("dialog")).toHaveCount(0);

  await page.getByLabel("Buscar jugador").fill("luc");
  await expect(rail.getByRole("button")).toHaveCount(1);
  await page.getByLabel("Buscar jugador").fill("");

  // Either corner of the duel opens the picker; choosing closes it and fills the corner.
  await page.getByRole("button", { name: /^Jugador 2: .*Cambiar jugador/ }).click();
  const picker = page.getByRole("dialog", { name: "Elige jugador" });
  await picker.getByRole("button", { name: /^Nico/ }).click();
  await expect(picker).toHaveCount(0);
  await expect(page.getByRole("button", { name: "Jugador 2: Nico. Cambiar jugador" })).toBeVisible();
  await expect(page.getByRole("listitem", { name: /^Edad: .*, Nico / })).toBeVisible();

  expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true);
});
