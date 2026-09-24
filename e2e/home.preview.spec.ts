import { test, expect } from "@playwright/test";

test("la portada cuenta la temporada y viste la camiseta de cada jugador", async ({ page }) => {
  await page.goto("/");
  await expect(page.getByRole("heading", { level: 1 })).toContainText("MANCHESTER");
  // The seed's finished match (2–1, two hours ago) drives the headline.
  await expect(page.getByText("¡Victoria! 2–1 ante Atlético Demo.")).toBeVisible();

  const rail = page.getByRole("group", { name: "Elige jugador" });
  await rail.getByRole("button", { name: /Hugo/ }).click();
  await expect(page.getByRole("heading", { level: 2, name: "Hugo" })).toBeVisible();
  await expect(page.getByRole("img", { name: /Camiseta de Hugo, dorsal 8/ }).or(page.locator(".vx-shirt-flat"))).toBeVisible();

  await page.keyboard.press("ArrowRight");
  await expect(page.getByRole("heading", { level: 2, name: "Lucas" })).toBeVisible();

  await expect(page.getByRole("heading", { name: /partido/ }).first()).toBeVisible();
  await page.getByRole("button", { name: /Suscribirme al calendario/ }).click();
  await expect(page.getByRole("link", { name: /iPhone o Mac/ })).toHaveAttribute("href", /^webcal:.*calendario\.ics$/);
  await expect(page.getByRole("link", { name: /Google Calendar/ })).toHaveAttribute("href", /calendar\.google\.com\/calendar\/r\?cid=webcal/);
  await page.keyboard.press("Escape");
  await expect(page.getByRole("link", { name: /iPhone o Mac/ })).toHaveCount(0);
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true);
});
