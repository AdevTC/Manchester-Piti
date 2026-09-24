import { test, expect } from "@playwright/test";
test("web pública, navegación y detalle sin iniciar sesión", async ({
  page,
}) => {
  await page.goto("/");
  await expect(page.getByRole("heading", { level: 1 })).toContainText(
    "MANCHESTER",
  );
  const nav = page.getByRole("navigation", { name: "Navegación principal" });
  await nav.getByRole("link", { name: "Partidos", exact: true }).click();
  await expect(page).toHaveURL(/\/partidos/);
  await page.goto("/matches/preview-finished");
  await expect(page.getByText("2 : 1", { exact: true })).toBeVisible();
  await expect(
    page.getByRole("button", { name: "Cartel cuadrado" }),
  ).toBeVisible();
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
  const row = page.getByRole("row").filter({ hasText: "Hugo" });
  await expect(row.getByRole("cell").nth(1)).toHaveText("40");
});
test("la clave nunca se pide antes de Google y admin está protegido", async ({
  page,
}) => {
  await page.goto("/admin");
  await expect(
    page.getByRole("button", { name: "Continuar con Google" }),
  ).toBeVisible();
  await expect(page.getByLabel("Clave del vestuario")).toHaveCount(0);
  await expect(page.getByRole("button", { name: "Nuevo partido" })).toHaveCount(
    0,
  );
});
test("navegación móvil sin desbordamiento", async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto("/");
  const nav = page.getByRole("navigation", { name: "Navegación móvil" });
  await expect(nav).toBeVisible();
  await nav.getByRole("link", { name: "Plantilla" }).click();
  await expect(page.getByLabel("Buscar jugador")).toBeVisible();
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= window.innerWidth,
    ),
  ).toBe(true);
});
