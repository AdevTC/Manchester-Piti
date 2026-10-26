import { test, expect } from "@playwright/test";

test("la portada «Vidrio»: el titular y la lente, las pantallas, la temporada, el club con tu camiseta y el calendario", async ({ page }) => {
  // (it walks eleven addresses, the first of them compiled cold by the dev server: 1.4 min on this PC)
  test.setTimeout(180_000);
  await page.goto("/");
  // Hoy: the match day's headline and the lens with the match (the countdown, the score or the state in words).
  await expect(page.getByRole("heading", { level: 1 })).not.toBeEmpty();
  const lens = page.getByRole("region", { name: /^El (partido de hoy|próximo partido)$/ });
  await expect(lens).toBeVisible();
  await expect(lens.getByRole("img").first()).toHaveAccessibleName(/./);

  // Hoy leads to the match (its plays, its previa, its acta) or to the calendar when there is none.
  const center = page.locator(".in-center");
  await expect(center.locator('a[href^="/partidos/"], a[href="/partidos"]').first()).toBeVisible();

  // «Por la casa»: every door of the house, the shirt's among them.
  const doors = page.getByRole("region", { name: "Por la casa" });
  await expect(doors.getByRole("link")).toHaveCount(6);

  // The screens: each its own address, the score capsule leading back home.
  for (const path of ["/hoy/campo", "/hoy/jugadas"]) {
    await page.goto(path);
    await expect(page.getByRole("heading", { level: 1 })).not.toBeEmpty();
    await expect(page.getByRole("link", { name: /^Volver a Inicio: / })).toBeVisible();
  }
  await page.getByRole("navigation", { name: "Seguir" }).getByRole("link", { name: "Inicio" }).click();
  await expect(page).toHaveURL(/\/$/);
  await expect(page.getByRole("region", { name: "Por la casa" })).toBeVisible();

  // Lo tuyo is a jugador's: a fan who asks for it (or for the old #tu) goes home.
  await page.goto("/plantilla");
  await page.goto("/#tu");
  await expect(page).toHaveURL(/\/$/);
  await expect(page.getByRole("region", { name: "Por la casa" })).toBeVisible();

  // Temporada: the season is Partidos' (every jornada with its light) and the old #temporada is Números.
  await page.getByRole("region", { name: "Por la casa" }).getByRole("link", { name: /^Partidos/ }).click();
  await expect(page).toHaveURL(/\/partidos$/);
  await expect(page.getByRole("slider", { name: /^La temporada entera/ })).toBeVisible();
  await page.goto("/#temporada");
  await expect(page).toHaveURL(/\/estadisticas$/);
  await expect(page.getByRole("heading", { level: 1, name: "Estadísticas" })).toBeVisible();

  // «Ponte la del Piti»: the fan's name goes on the shirt, and a fan is invited into the vestuario.
  await page.goto("/");
  await page.getByRole("region", { name: "Por la casa" }).getByRole("link", { name: /^Ponte la del Piti/ }).click();
  await expect(page).toHaveURL(/\/camiseta$/);
  const shirt = page.getByRole("region", { name: "Ponte la del Piti" });
  await shirt.getByLabel("Tu nombre", { exact: true }).fill("afición");
  await shirt.getByLabel("Dorsal", { exact: true }).fill("12");
  await expect(shirt.getByLabel("Tu nombre", { exact: true })).toHaveValue("AFICIÓN");
  await expect(shirt.getByRole("img", { name: /con AFICIÓN y el 12 a la espalda/ })).toBeVisible();
  await expect(shirt.getByRole("link", { name: "Pedir entrar" })).toHaveAttribute("href", "/vestuario");

  expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true);

  // A reload keeps the screen (the address).
  await page.reload();
  await expect(page).toHaveURL(/\/camiseta$/);
  await expect(page.getByRole("heading", { level: 1, name: "Ponte la del Piti" })).toBeVisible();

  // Club: the old #club is the club's page; its calendar lives in La gente (CL- boards).
  await page.goto("/#club");
  await expect(page).toHaveURL(/\/club$/);
  await page.getByRole("button", { name: /^La gente\./ }).click();
  await expect(page).toHaveURL(/\/club\/gente$/);
  await page.getByRole("button", { name: "Suscribirme al calendario" }).click();
  await expect(page.getByRole("link", { name: /iPhone o Mac/ })).toHaveAttribute("href", /^webcal:.*calendario\.ics$/);
  await expect(page.getByRole("link", { name: /Google Calendar/ })).toHaveAttribute("href", /calendar\.google\.com\/calendar\/r\?cid=webcal/);
  await page.keyboard.press("Escape");
  await expect(page.getByRole("link", { name: /iPhone o Mac/ })).toHaveCount(0);

  // The plantilla's door still leads there.
  await page.goto("/");
  await page.getByRole("region", { name: "Por la casa" }).getByRole("link", { name: /^Plantilla/ }).click();
  await expect(page).toHaveURL(/\/plantilla(\?|$)/);
  await expect(page.getByRole("heading", { name: /Pichichi|el primer Pichichi|manda/ }).first()).toBeVisible();
});
