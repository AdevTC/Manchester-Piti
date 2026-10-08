import { test, expect, type Page } from "@playwright/test";
import { enterVestuario } from "./helpers";

// La pizarra end to end against the emulators: a new board, «Sugerir siete» to 7/7 (saved: it is there
// after a reload), published as the official for the next match (the seeded admin is a captain), the
// team's reaction, a stroke on the grass, a jugada stepped paso by paso and the charla opened and left.
// Under Playwright (navigator.webdriver) the 3D stadium never starts: everything runs on the 2D board.

const modes = (page: Page) => page.getByRole("navigation", { name: "Modos de la pizarra" });
const toMode = (page: Page, name: string) => modes(page).getByRole("button", { name: new RegExp("^(nuevo\\s*)?" + name + "$", "i") }).click();

test("la pizarra: sugerir el siete, guardarlo, publicarlo, reaccionar, dibujar, la jugada y la charla", async ({ page }) => {
  await enterVestuario(page);
  await page.goto("/pizarra");
  const app = page.getByRole("region", { name: "La pizarra" });
  await expect(app).toBeVisible();
  // the Celeste page for everyone (no switch any more): no site footer around it
  await expect(page.locator(".pzv")).toBeVisible();
  await expect(page.locator(".club-footer")).toHaveCount(0);

  // a fresh board, so earlier runs don't matter
  await toMode(page, "Tableros");
  await page.getByRole("button", { name: "Nuevo", exact: true }).click();
  await expect(page.getByText("Tablero nuevo: toca un hueco para empezar")).toBeVisible();
  await toMode(page, "Siete");

  // «Sugerir siete»: the pack opens and the seven are on the pitch
  await page.getByRole("button", { name: "Sugerir siete por forma reciente: abre un sobre" }).click();
  await expect(page.locator(".bar .val b")).toHaveText("7/7");
  await expect(page.locator(".bar .bname small")).toContainText("Guardado");

  // saved: a reload brings the same seven back
  await page.reload();
  await expect(page.locator(".bar .val b")).toHaveText("7/7");

  // published as the official for the next match
  await toMode(page, "Tableros");
  await page.getByRole("group", { name: "Sección de tableros" }).getByRole("button", { name: "Oficial" }).click();
  await page.getByRole("button", { name: "Publicar mi tablero como oficial" }).click();
  const anyway = page.getByRole("button", { name: "Publicar igualmente" });
  if (await anyway.isVisible()) await anyway.click();
  await expect(page.getByText(/^Publicado: el equipo ya lo ve como oficial/)).toBeVisible();

  // the team's reaction to it
  const reac = page.getByRole("group", { name: "¿De acuerdo con el siete oficial?" });
  const ok = reac.getByRole("button", { name: /^De acuerdo/ });
  if ((await ok.getAttribute("aria-pressed")) === "true") await ok.click();
  await ok.click();
  await expect(ok).toHaveAttribute("aria-pressed", "true");

  // a stroke of light on the grass
  await toMode(page, "Dibujar");
  const frame = page.locator("[data-frame]");
  const box = await frame.boundingBox();
  if (!box) throw new Error("El campo no está en pantalla");
  await page.mouse.move(box.x + box.width * 0.3, box.y + box.height * 0.7);
  await page.mouse.down();
  for (let k = 1; k <= 8; k++) await page.mouse.move(box.x + box.width * (0.3 + 0.04 * k), box.y + box.height * (0.7 - 0.04 * k));
  await page.mouse.up();
  await expect(page.getByRole("button", { name: /^Borrar el trazo 1:/ })).toBeVisible();

  // a jugada, paso by paso (2D: the stadium never starts under automation)
  await toMode(page, "Jugadas");
  const bug = page.getByRole("button", { name: /^Repetición:/ });
  await expect(bug).toHaveAccessibleName(/paso 1 de 4/);
  await page.getByRole("button", { name: "Paso siguiente" }).click();
  await expect(bug).toHaveAccessibleName(/paso 2 de 4/);
  await page.getByRole("button", { name: "Reproducir la repetición" }).click();
  await expect(page.getByText("Este dispositivo no muestra el estadio 3D: la jugada se ve con la cámara 2D que sigue al balón.")).toBeVisible();
  await page.getByRole("button", { name: "Pausar la repetición" }).click();
  await expect(page.locator(".p3d canvas")).toHaveCount(0);

  // la charla: the system first, a step on by hand, and out
  await page.getByRole("button", { name: "La charla: presentar el siete" }).click();
  const counter = page.getByRole("status", { name: /^Paso \d+\/\d+/ });
  await expect(counter).toHaveAccessibleName(/^Paso 1\/\d+: sistema/);
  await expect(page.locator(".ch-lt")).toContainText("Así salimos");
  await page.getByRole("button", { name: "Paso siguiente" }).click();
  await expect(counter).toHaveAccessibleName(/^Paso 2\/\d+: los siete/);
  await expect(page.getByRole("button", { name: "Reproducir la charla" })).toBeVisible();
  await page.getByRole("button", { name: "Salir", exact: true }).click();
  await expect(counter).toHaveCount(0);
  await expect(page.locator(".p3d canvas")).toHaveCount(0);
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true);
});
