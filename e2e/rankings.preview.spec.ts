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

test("los goleadores empatados conservan puesto y medalla entre partidos, plantilla y estadísticas", async ({ page }) => {
  await page.goto("/partidos?season=preview-season");
  await expect(page.getByRole("heading", { name: "Pichichi compartido · 1 gol" })).toBeVisible();
  const table = page.locator(".pt-pich");
  await expect(table.locator("i.gold")).toHaveCount(2);
  await expect(table.getByLabel("Puesto 1, compartido")).toHaveCount(2);

  await page.goto("/plantilla?season=preview-season");
  await expect(page.getByRole("heading", { name: "Pichichi compartido: 1 gol." })).toBeVisible();
  await expect(page.locator(".hm-race .hm-pod.gold")).toHaveCount(2);
  await expect(page.locator(".hm-race .hm-pod.silver")).toHaveCount(0);
  await expect(page.locator(".hm-race").getByLabel("Puesto 1, compartido")).toHaveCount(2);
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true);

  await page.goto("/stats?season=preview-season");
  const leaders = page.getByRole("list", { name: "Líderes del período" });
  await expect(leaders.getByRole("link", {name:"Hugo",exact:true})).toBeVisible();
  await expect(leaders.getByRole("link", {name:"Mario",exact:true})).toBeVisible();
});
