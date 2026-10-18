import { test, expect } from "@playwright/test";

test("la portada es la luz del partido: el titular, el marcador del campo, la jornada, la temporada y tu camiseta", async ({ page }) => {
  await page.goto("/");
  // The scheduled fixture owns the hero: its headline, the club scoreboard and «Arrastra el sol» or the light now.
  await expect(page.getByRole("heading", { level: 1 })).not.toBeEmpty();
  await expect(page.getByRole("img", { name: /^Marcador del campo/ })).toBeVisible();

  // The phase block leads to the match (the previa before it, the match itself once it is on).
  await expect(page.getByRole("region", { name: /Lo que hay que saber|A punto de empezar|Hasta el|Así va|Así fue|Ya está el acta|La crónica|Así quedó|Qué pasa ahora/ }).getByRole("link", { name: /Ver la previa|Seguir el partido|Ver el partido|Leer el acta|Leer la crónica/ })).toHaveAttribute("href", /^\/matches\//);

  // The season: form, table, pichichi; what comes next, each kick-off with its light.
  await expect(page.getByRole("heading", { name: "La temporada" })).toBeVisible();
  await expect(page.getByRole("heading", { name: "Lo que viene" })).toBeVisible();

  // A fan's «Tu partido» is the vestuario's invitation, never an empty member slot.
  await expect(page.getByRole("heading", { name: "Pide entrar al vestuario" })).toBeVisible();

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

  expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true);

  await page.getByRole("link", { name: /Conoce a los .* en Plantilla/ }).click();
  await expect(page).toHaveURL(/\/plantilla(\?|$)/);
  await expect(page.getByRole("heading", { name: /Pichichi|el primer Pichichi|manda/ }).first()).toBeVisible();
});
