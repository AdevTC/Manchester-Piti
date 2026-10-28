import { test, expect } from "@playwright/test";
import { callFunction, emulatorAdminToken, enterVestuario } from "./helpers";

// La mesa is for the admins and the match's anotadores: anyone else gets the door and the way back to the match
// page (where the directo is followed). «preview-next» comes from the preview seed (global setup).
test("la mesa: un aficionado ve «Solo para quien anota» y vuelve al partido", async ({ page }) => {
  await page.goto("/partidos/preview-next/mesa");
  await expect(page.getByRole("heading", { name: "Solo para quien anota" })).toBeVisible();
  await expect(page.getByRole("button", { name: /Gol del Piti/ })).toHaveCount(0);
  await page.getByRole("button", { name: "Volver al partido" }).click();
  await expect(page).toHaveURL(/\/partidos\/preview-next(\/|\?|$)/);
});

test("el antiguo «En juego» de la sala lleva a la mesa", async ({ page }) => {
  await page.goto("/admin/en-juego/preview-next");
  await expect(page).toHaveURL(/\/partidos\/preview-next\/mesa(\?|$)/);
});

test("un partido que no existe abre «No encontramos el partido»", async ({ page }) => {
  await enterVestuario(page);
  await page.goto("/partidos/no-existe-e2e/mesa");
  await expect(page.getByRole("heading", { name: "No encontramos el partido" })).toBeVisible();
});

// The whole match at la mesa (r12), on a match of its own (deleted at the end): the whistle, «Gol del Piti» left
// «por completar», the break, the end, Final asking «¿Quién marcó?» before it lets the acta out (B-MESA-03), the
// hold to publish, and the closed door afterwards (B-MESA-12).
test("la mesa de principio a fin: pitar, gol sin autor, descanso, final, completar el goleador, publicar y la puerta", async ({ page }) => {
  test.setTimeout(120_000);
  const token = await emulatorAdminToken();
  const id = `mesa-e2e-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`;
  const players = Array.from({ length: 9 }, (_, i) => `preview-player-${i}`);
  const sheet = {
    version: 2, revision: 0, seasonId: "preview-season", rival: "Mesa Pruebas", competition: "Amistoso", date: Date.now() - 60_000, duration: 50, venue: "Campo de pruebas",
    home: true, status: "scheduled", starters: players.slice(0, 7), bench: players.slice(7), notCalled: [], events: [], goalsFor: 0, goalsAgainst: 0, report: "",
  };
  await callFunction(token, "saveMatchSheet", { id, sheet, draft: false });
  try {
    await enterVestuario(page);
    await page.goto(`/partidos/${id}/mesa`);
    await expect(page.getByRole("heading", { name: /listo para pitar/ })).toBeVisible();
    await page.getByRole("button", { name: /Pitar el inicio/ }).click();

    const gol = page.getByRole("button", { name: /^Gol del Piti/ });
    await expect(gol).toBeVisible();
    await gol.click();
    await expect(page.getByText("¿Quién marcó?")).toBeVisible();
    await page.getByRole("button", { name: "Lo apunto luego" }).click();
    await expect(page.getByText("Gol sin autor")).toBeVisible();
    await expect(page.getByLabel(/^Manchester Piti 1, Mesa Pruebas 0$/)).toBeVisible();
    // (it goes up: the presence says so once the server has it)
    await expect(page.getByLabel(/al día$/)).toBeVisible({ timeout: 20_000 });

    // (the phone's Atrás closes the sheet and stays at la mesa; Adelante opens it again)
    await page.getByRole("button", { name: /^Reloj/ }).click();
    await expect(page).toHaveURL(/[?&]hoja=reloj/);
    await expect(page.getByRole("dialog", { name: /^El reloj/ })).toBeVisible();
    await page.goBack();
    await expect(page.getByRole("dialog")).toHaveCount(0);
    await expect(page).toHaveURL(new RegExp(`/partidos/${id}/mesa`));
    await expect(gol).toBeVisible();
    await page.goForward();
    await expect(page.getByRole("dialog", { name: /^El reloj/ })).toBeVisible();
    await page.getByRole("button", { name: "Fin de la 1ª" }).click();
    await page.getByRole("button", { name: "¿Seguro? Toca otra vez" }).click();
    await expect(page.getByRole("heading", { name: /^Descanso · la 1ª acabó/ })).toBeVisible();
    await page.getByRole("button", { name: "Arrancar la 2ª parte" }).click();
    await expect(gol).toBeVisible();

    await page.getByRole("button", { name: /^Reloj/ }).click();
    await page.getByRole("button", { name: "Fin del partido" }).click();
    await page.getByRole("button", { name: "¿Seguro? Toca otra vez" }).click();
    await expect(page.getByRole("heading", { name: "Repasa y firma" })).toBeVisible();
    await expect(page.getByText("Falta quién marcó algún gol: elígelo arriba")).toBeVisible();
    await page.getByRole("group", { name: /^¿Quién marcó el gol del/ }).getByRole("button").first().click();
    await expect(page.getByText("Todos los goles con goleador")).toBeVisible({ timeout: 20_000 });

    const hold = page.getByRole("button", { name: /Mantén para publicar/ });
    await hold.focus();
    await page.keyboard.down("Enter");
    await page.waitForTimeout(1_400);
    await page.keyboard.up("Enter");
    await expect(page.getByRole("heading", { name: "Acta publicada" })).toBeVisible({ timeout: 30_000 });

    await page.reload();
    await expect(page.getByRole("heading", { name: "Acta publicada · la mesa está cerrada" })).toBeVisible();
    await expect(page.getByRole("button", { name: /Pitar el inicio/ })).toHaveCount(0);
  } finally {
    await callFunction(token, "deleteMatch", { id }).catch(() => undefined);
  }
});
