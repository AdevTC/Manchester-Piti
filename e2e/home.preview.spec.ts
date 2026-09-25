import { test, expect } from "@playwright/test";

test("la portada es el día de partido: titular, jugador del momento, temporada y tu camiseta", async ({ page }) => {
  await page.goto("/");
  // The seed's finished match (2–1, two hours ago) drives the headline.
  await expect(page.getByRole("heading", { level: 1 })).toHaveText(/^¡Victoria! 2⁠?–⁠?1 ante Atlético Demo\.$/);
  // Its first scorer is the player of the moment, with a link to the ficha.
  const moment = page.getByRole("article", { name: "Mario" });
  await expect(moment).toContainText("Goleador del último partido");
  await expect(moment.getByRole("link", { name: /Ver su ficha/ })).toHaveAttribute("href", /\/jugadores\//);

  // The season row: last result and what comes next.
  await expect(page.getByRole("link", { name: /PITI.*2–1.*Atlético Demo/ })).toBeVisible();
  await expect(page.getByRole("heading", { name: "Lo que viene" })).toBeVisible();

  // «Ponte la del Piti»: the fan's name goes on the shirt.
  await page.getByLabel("Tu nombre", { exact: true }).fill("afición");
  await page.getByLabel("Dorsal", { exact: true }).fill("12");
  await expect(page.getByLabel("Tu nombre", { exact: true })).toHaveValue("AFICIÓN");
  await expect(page.getByRole("img", { name: /Tu camiseta con AFICIÓN y el dorsal 12/ }).or(page.locator(".hm-fan3d .vx-shirt-flat"))).toBeVisible();

  await page.getByRole("button", { name: /Suscribirme al calendario/ }).click();
  await expect(page.getByRole("link", { name: /iPhone o Mac/ })).toHaveAttribute("href", /^webcal:.*calendario\.ics$/);
  await expect(page.getByRole("link", { name: /Google Calendar/ })).toHaveAttribute("href", /calendar\.google\.com\/calendar\/r\?cid=webcal/);
  await page.keyboard.press("Escape");
  await expect(page.getByRole("link", { name: /iPhone o Mac/ })).toHaveCount(0);

  await page.getByRole("link", { name: /Conoce a los/ }).click();
  await expect(page).toHaveURL(/\/plantilla(\?|$)/);
  await expect(page.getByRole("heading", { name: /Pichichi|el primer Pichichi|manda/ }).first()).toBeVisible();
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true);
});
