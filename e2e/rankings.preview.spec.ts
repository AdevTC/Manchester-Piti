import { test, expect } from "@playwright/test";
import { callFunction, emulatorAdminToken, seasonMatches } from "./helpers";

// The tie is the seed's: Mario and Hugo, one goal each in «preview-finished». Other specs publish their own
// actas in the preview season (admin-crud's goal by Mario breaks the tie): remove those played matches first.
const SEEDED = new Set(["preview-next", "preview-finished"]);
test.beforeAll(async () => {
  const token = await emulatorAdminToken();
  for (const match of await seasonMatches("preview-season"))
    if (!SEEDED.has(match.id) && match.status === "finished") await callFunction(token, "deleteMatch", { id: match.id });
});

test("los goleadores empatados conservan puesto y medalla entre plantilla y estadísticas", async ({ page }) => {
  // (Partidos' boards — Jornadas, Tabla, Balance — no longer carry the goleadores: the shared lead is said in
  // Plantilla's race and in Números' leaders)
  await page.goto("/plantilla?season=preview-season");
  // Plantilla's podium: both on the first step, the place said shared
  await expect(page.locator(".pl-big")).toHaveText("Pichichi compartido: Mario y Hugo, 1 gol.");
  await expect(page.locator(".pl-podium .pl-step.is-p1 .pl-step__b")).toHaveCount(2);
  await expect(page.locator(".pl-podium .pl-step.is-p2 .pl-step__b")).toHaveCount(0);
  await expect(page.locator(".pl-podium").getByText("Puesto 1, compartido")).toHaveCount(2);
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true);

  await page.goto("/estadisticas?temporada=preview-season");
  // Números: the shared lead said in words in the race and in Jugadores, both names and the figure
  await expect(page.locator(".nu-race__cap")).toContainText("En cabeza tras la J");
  await expect(page.locator(".nu-race__cap b")).toContainText(/(Hugo y Mario|Mario y Hugo), 1/);
  await expect(page.locator(".nu-said")).toContainText(/Pichichi compartido: (Hugo y Mario|Mario y Hugo), con 1\./);
  await page.goto("/estadisticas/jugadores?temporada=preview-season");
  await expect(page.getByRole("heading", { level: 2, name: /^(Hugo y Mario|Mario y Hugo), 1 gol$/ })).toBeVisible();
  const podium = page.getByRole("list", { name: "Los primeros" });
  await expect(podium.locator(".nu-podium__rk")).toHaveText(["1º", "1º"]);
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true);
});
