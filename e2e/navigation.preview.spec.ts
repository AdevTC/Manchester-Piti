import { test, expect } from "@playwright/test";
test("web pública, navegación y detalle sin iniciar sesión", async ({
  page,
}) => {
  await page.goto("/");
  // the headline follows the match day (the seed's date decides the phase): it is there, with the lens of the match
  await expect(page.getByRole("heading", { level: 1 })).not.toBeEmpty();
  await expect(page.getByRole("region", { name: "El partido" })).toBeVisible();
  const nav = page.getByRole("navigation", { name: "Navegación principal" });
  await nav.getByRole("link", { name: "Partidos", exact: true }).click();
  await expect(page).toHaveURL(/\/partidos/);
  await expect(page.getByRole("heading", { level: 1, name: "Partidos" })).toBeVisible();
  await expect(page.getByRole("combobox", { name: "Temporada" })).toBeVisible();
  await expect(page.getByRole("searchbox", { name: "Buscar rival" })).toBeVisible();
  await page.goto("/matches/preview-finished");
  await expect(page.getByRole("status", { name: "Resultado: 2 a 1" })).toBeVisible();
  await expect(
    page.getByRole("button", { name: "Cartel cuadrado" }),
  ).toBeVisible();
});

test("cabecera sin accesos duplicados ni etiquetas partidas en escritorio compacto y ambas paletas", async ({ page }) => {
  await page.goto("/");
  for (const theme of ["dark", "light"]) {
    await page.evaluate((value) => { document.documentElement.dataset.theme = value; }, theme);
    for (const width of [1100, 1220, 1280, 1440]) {
      await page.setViewportSize({ width, height: 900 });
      const header = page.locator(".vx-top");
      await expect(header.getByRole("link", { name: "Entrar al vestuario" })).toHaveCount(1);
      const nav = header.getByRole("navigation", { name: "Navegación principal" });
      await expect(nav).toBeVisible();
      await expect(nav.getByRole("link", { name: "El club", exact: true })).toBeVisible();
      expect(await header.evaluate((element) => {
        const children = [...element.children].map((child) => child.getBoundingClientRect());
        const links = [...element.querySelectorAll(".vx-nav a")];
        return children.every((box) => box.left >= 0 && box.right <= innerWidth) && children.every((box, i) => !i || box.left >= children[i - 1].right) && links.every((link) => getComputedStyle(link).whiteSpace === "nowrap");
      })).toBe(true);
    }
  }
});
test("jugador, datos de temporada y reparto real de minutos", async ({
  page,
}) => {
  await page.goto("/jugadores/preview-player-7?season=preview-season");
  await expect(
    page.getByRole("heading", { name: "Hugo", exact: true }),
  ).toBeVisible();
  await expect(page.getByText("40′", { exact: true }).first()).toBeVisible();
  await page.goto("/stats?season=preview-season");
  await page.getByRole("button", { name: "Minutos", exact: true }).click();
  const row = page
    .getByRole("table", { name: "Minutos y convocatorias" })
    .getByRole("row")
    .filter({ hasText: "Hugo" });
  await expect(row.getByRole("cell").first()).toHaveText("40");
});
test("el club, con su vitrina, trofeos y contacto", async ({ page }) => {
  await page.goto("/club");
  await expect(page.getByRole("heading", { level: 1, name: "El club" })).toBeVisible();
  await expect(page.getByRole("heading", { name: "La sala de trofeos" })).toBeVisible();
  await expect(page.getByRole("button", { name: /la sala/ })).toBeVisible();
  await expect(page.getByRole("heading", { name: "Clasificados" })).toBeVisible();
});
test("la puerta no pide clave y admin está protegido", async ({
  page,
}) => {
  await page.goto("/admin");
  await expect(
    page.getByRole("button", { name: "Entrar con Google" }),
  ).toBeVisible();
  await expect(page.getByLabel("Clave del vestuario")).toHaveCount(0);
  await expect(page.getByRole("button", { name: "Nuevo partido" })).toHaveCount(
    0,
  );
});
test("navegación móvil sin desbordamiento", async ({ page }) => {
  for (const width of [390, 320]) {
    await page.setViewportSize({ width, height: 844 });
    await page.goto("/");
    const nav = page.getByRole("navigation", { name: "Navegación móvil" });
    await expect(nav).toBeVisible();
    await expect(page.locator(".vx-top").getByRole("link", { name: "Entrar al vestuario" })).toBeVisible();
    await nav.getByRole("link", { name: "Plantilla" }).click();
    await expect(page.getByLabel("Buscar jugador")).toBeVisible();
    expect(await page.locator(".vx-top").evaluate((element) => [...element.children].every((child) => child.getBoundingClientRect().right <= innerWidth))).toBe(true);
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true);
  }
});
