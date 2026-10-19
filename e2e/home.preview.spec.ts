import { test, expect } from "@playwright/test";

test("la portada «Vidrio»: el titular y la lente, los sitios de la repisa, la temporada, el club con tu camiseta y el calendario", async ({ page }) => {
  await page.goto("/");
  // Hoy: the match day's headline and the lens with the match (the countdown, the score or the state in words).
  await expect(page.getByRole("heading", { level: 1 })).not.toBeEmpty();
  const lens = page.getByRole("region", { name: "El partido" });
  await expect(lens).toBeVisible();
  await expect(lens.getByRole("img").first()).toHaveAccessibleName(/./);

  // Hoy leads to the match (its plays, its previa, its acta) or to the calendar when there is none.
  const panel = page.getByRole("tabpanel");
  await expect(panel.locator('a[href^="/matches/"], a[href="/partidos"]').first()).toBeVisible();

  // The shelf: a fan has Hoy, Temporada and Club (Tú is a jugador's).
  const shelf = page.getByRole("tablist", { name: "Sitios de Inicio" });
  await expect(shelf.getByRole("tab")).toHaveCount(3);

  // Temporada: the table, the form, every jornada with its light.
  await shelf.getByRole("tab", { name: /Temporada/ }).click();
  await expect(page).toHaveURL(/#temporada$/);
  await expect(page.getByRole("tabpanel").getByRole("heading", { name: "La temporada" })).toBeVisible();
  await expect(page.getByRole("navigation", { name: "La temporada, jornada a jornada" })).toBeVisible();

  // Club: a fan's place for the vestuario's invitation, never an empty member slot.
  await shelf.getByRole("tab", { name: /Club/ }).click();
  await expect(page).toHaveURL(/#club$/);
  const club = page.getByRole("tabpanel");
  await expect(club.getByRole("heading", { name: "Pide entrar al vestuario" })).toBeVisible();
  await expect(club.getByRole("link", { name: "Pedir entrar" })).toHaveAttribute("href", "/vestuario");

  // «Ponte la del Piti»: the fan's name goes on the shirt.
  await club.getByLabel("Tu nombre", { exact: true }).fill("afición");
  await club.getByLabel("Dorsal", { exact: true }).fill("12");
  await expect(club.getByLabel("Tu nombre", { exact: true })).toHaveValue("AFICIÓN");
  await expect(club.getByRole("img", { name: /Tu camiseta con AFICIÓN y el dorsal 12/ })).toBeVisible();

  await club.getByRole("button", { name: /Suscribirme al calendario/ }).click();
  await expect(page.getByRole("link", { name: /iPhone o Mac/ })).toHaveAttribute("href", /^webcal:.*calendario\.ics$/);
  await expect(page.getByRole("link", { name: /Google Calendar/ })).toHaveAttribute("href", /calendar\.google\.com\/calendar\/r\?cid=webcal/);
  await page.keyboard.press("Escape");
  await expect(page.getByRole("link", { name: /iPhone o Mac/ })).toHaveCount(0);

  expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true);

  // A reload keeps the place (the hash), and the plantilla's door still leads there.
  await page.reload();
  await expect(page.getByRole("tab", { name: /Club/ })).toHaveAttribute("aria-selected", "true");
  await page.getByRole("link", { name: /Conoce a los .* en Plantilla/ }).click();
  await expect(page).toHaveURL(/\/plantilla(\?|$)/);
  await expect(page.getByRole("heading", { name: /Pichichi|el primer Pichichi|manda/ }).first()).toBeVisible();
});
