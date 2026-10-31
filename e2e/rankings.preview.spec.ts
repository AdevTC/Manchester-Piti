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
  // Estadísticas: the shared lead said in words under la carrera and in «Lo que dicen los números», and in Jugadores,
  // both names and the figure
  await expect(page.getByRole("list", { name: "La carrera de goles" })).toBeVisible();
  await expect(page.getByRole("region", { name: "La carrera" }).getByText(/^En cabeza tras la J\d+: (Hugo y Mario|Mario y Hugo), 1/)).toBeVisible();
  await expect(page.getByRole("region", { name: "Lo que dicen los números" }).getByRole("listitem").filter({ hasText: /Pichichi compartido: (Hugo y Mario|Mario y Hugo), con 1\./ })).toHaveCount(1);
  await page.goto("/estadisticas/jugadores?temporada=preview-season");
  await expect(page.getByRole("heading", { level: 2, name: /^(Hugo y Mario|Mario y Hugo), 1 gol$/ })).toBeVisible();
  // the podium: the two on the first step, each «1º, name: 1», nobody else on it
  const podium = page.locator(".nx-podium").getByRole("button");
  await expect(podium).toHaveCount(2);
  for (const name of ["Hugo", "Mario"]) await expect(page.locator(".nx-podium").getByRole("button", { name: new RegExp(`^1º, ${name}: 1`) })).toHaveCount(1);
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true);
});
