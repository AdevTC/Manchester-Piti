import { execFileSync } from "node:child_process";
import { test, expect } from "@playwright/test";
import { enterVestuario } from "./helpers";

// The porra is for the seeded next match («preview-next», open until kick-off). Other specs play, re-date or
// add matches: the preview seed (idempotent) puts that fixture back as the next one, scheduled and open.
test.beforeAll(() => execFileSync(process.execPath, ["functions/test/seed-preview.mjs"], { stdio: "inherit" }));

test("la porra conserva goleadores y asistencias entre vestuario y partido, también en móvil", async ({ page }) => {
  await enterVestuario(page);
  const form = page.locator(".pr-form");
  // The form is the seeded fixture's, and editable (its saved porra loaded) before the score is reset.
  await expect(form.getByRole("group", { name: "Tu porra: Piti contra Atlético Demo" })).toBeVisible();
  await expect(form.getByText("Cargando tu porra…")).not.toBeVisible();
  await expect(form.getByRole("button", { name: "Un gol más del Piti" })).toBeEnabled();
  const minus = form.getByRole("button", { name: "Un gol menos del Piti" });
  while (await minus.isEnabled()) await minus.click();
  await form.getByRole("button", { name: "Un gol más del Piti" }).click();
  await expect(form.getByRole("button", { name: /Guardar mi porra|Cambiar mi porra/ })).toBeDisabled();
  await form.getByLabel("Goleador del gol 1").selectOption({ index: 1 });
  const scorer = await form.getByLabel("Goleador del gol 1").inputValue();
  await form.getByLabel("Asistencia del gol 1").selectOption("none");
  await form.getByRole("button", { name: /Guardar mi porra|Cambiar mi porra/ }).click();
  await expect(form.getByRole("button", { name: "Porra guardada" })).toBeVisible();
  await page.getByRole("link", { name: "La porra, en la ficha del partido" }).click();
  // Client-side navigation: the vestuario's form must not answer for the ficha's.
  await expect(page).toHaveURL(/\/partidos\/preview-next(\?|$)/);
  await expect(form.getByRole("group", { name: "Tu porra: Piti contra Atlético Demo" })).toBeVisible();
  await expect(form.getByLabel("Goleador del gol 1")).toHaveValue(scorer);
  await expect(form.getByLabel("Asistencia del gol 1")).toHaveValue("none");
  await form.getByRole("button", { name: "Un gol más del Piti" }).click();
  await form.getByLabel("Goleador del gol 2").selectOption(scorer);
  await form.getByLabel("Asistencia del gol 2").selectOption({ index: 2 });
  const assist = await form.getByLabel("Asistencia del gol 2").inputValue();
  expect(assist).not.toBe(scorer);
  await form.getByRole("button", { name: "Cambiar mi porra" }).click();
  await expect(form.getByRole("button", { name: "Porra guardada" })).toBeVisible();
  await page.reload();
  await expect(form.getByLabel("Asistencia del gol 2")).toHaveValue(assist);
  await form.getByRole("button", { name: /Cómo se puntúa/ }).click();
  await expect(form.getByRole("heading", { name: "Los puntos de la porra" })).toBeVisible();
  await page.setViewportSize({ width: 390, height: 844 });
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true);
  await form.getByRole("button", { name: /Cómo se puntúa/ }).click();
  await form.scrollIntoViewIfNeeded();
  await page.screenshot({ path: ".emulator-data/porra-mobile.png" });
  await page.setViewportSize({ width: 1280, height: 950 });
  await form.scrollIntoViewIfNeeded();
  await page.screenshot({ path: ".emulator-data/porra-desktop.png" });
  await page.getByRole("button", { name: "Cambiar a tema oscuro" }).click();
  await page.reload();
  await expect(form.getByLabel("Asistencia del gol 2")).toHaveValue(assist);
  await form.scrollIntoViewIfNeeded();
  await page.screenshot({ path: ".emulator-data/porra-dark.png", animations: "disabled" });
});
