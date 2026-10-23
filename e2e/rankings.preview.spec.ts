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

  await page.goto("/numeros?temporada=preview-season");
  const leaders = page.getByRole("list", { name: "Líderes del período" });
  // Números: the shared lead said in words, both names and the figure
  const pichichi = leaders.getByRole("listitem").filter({ hasText: "Pichichi" });
  await expect(pichichi.getByText("Liderato compartido", { exact: true })).toBeVisible();
  await expect(pichichi.locator("b")).toHaveText("1");
  await expect(pichichi.getByRole("link", {name:"Hugo",exact:true})).toBeVisible();
  await expect(pichichi.getByRole("link", {name:"Mario",exact:true})).toBeVisible();
});
