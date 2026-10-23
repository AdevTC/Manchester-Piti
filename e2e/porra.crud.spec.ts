import { execFileSync } from "node:child_process";
import { test, expect } from "@playwright/test";
import { enterVestuario } from "./helpers";

// The porra is for the seeded next match («preview-next», open until kick-off). Other specs play, re-date or
// add matches: the preview seed (idempotent) puts that fixture back as the next one, scheduled and open.
test.beforeAll(() => execFileSync(process.execPath, ["functions/test/seed-preview.mjs"], { stdio: "inherit" }));

test("la porra conserva goleador y asistencia entre vestuario y partido, también en móvil", async ({ page }) => {
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
  // Client-side navigation to the match's Vestuario screen: one «Tu goleador» and an optional asistencia.
  await expect(page).toHaveURL(/\/partidos\/preview-next\/vestuario(\?|$)/);
  const porra = page.getByRole("region", { name: "Tu porra", exact: true });
  const more = page.locator(".ves-more").getByRole("button", { name: "Ver todo" });
  const unfold = async () => {
    await expect(porra.or(more).first()).toBeVisible();
    if (!(await porra.isVisible())) await more.click();
    await expect(porra).toBeVisible();
  };
  await unfold();
  // The vestuario's porra is the match's: one goal, the same goleador and no asistencia.
  await expect(porra.getByRole("img", { name: /^Tu porra: 1 a \d+$/ })).toBeVisible();
  await porra.getByRole("button", { name: "Cambiar mi porra" }).click();
  const steps = porra.getByRole("group", { name: "Tu porra: Piti contra Atlético Demo" });
  await expect(steps).toBeVisible();
  await expect(porra.getByLabel("Tu goleador")).toHaveValue(scorer);
  await expect(porra.getByLabel("Asistencia (si quieres)")).toHaveValue("");
  await steps.getByRole("button", { name: "Un gol más del Piti" }).click();
  await porra.getByLabel("Asistencia (si quieres)").selectOption({ index: 1 });
  const assist = await porra.getByLabel("Asistencia (si quieres)").inputValue();
  expect(assist).not.toBe("");
  expect(assist).not.toBe(scorer);
  await porra.getByRole("button", { name: "Cambiar mi porra" }).click();
  await expect(porra.getByRole("img", { name: /^Tu porra: 2 a \d+$/ })).toBeVisible();
  const reopen = async () => {
    await unfold();
    await porra.getByRole("button", { name: "Cambiar mi porra" }).click();
  };
  await page.reload();
  await reopen();
  await expect(porra.getByLabel("Tu goleador")).toHaveValue(scorer);
  await expect(porra.getByLabel("Asistencia (si quieres)")).toHaveValue(assist);
  await porra.getByRole("button", { name: "Cómo se puntúa" }).click();
  await expect(porra.getByText(/^Resultado exacto: 3 puntos/)).toBeVisible();
  await page.setViewportSize({ width: 390, height: 844 });
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true);
  await porra.getByRole("button", { name: "Ocultar cómo se puntúa" }).click();
  await porra.scrollIntoViewIfNeeded();
  await page.screenshot({ path: ".emulator-data/porra-mobile.png" });
  await page.setViewportSize({ width: 1280, height: 950 });
  await porra.scrollIntoViewIfNeeded();
  await page.screenshot({ path: ".emulator-data/porra-desktop.png" });
  await page.getByRole("button", { name: "Cambiar a tema oscuro" }).click();
  await page.reload();
  await reopen();
  await expect(porra.getByLabel("Asistencia (si quieres)")).toHaveValue(assist);
  await porra.scrollIntoViewIfNeeded();
  await page.screenshot({ path: ".emulator-data/porra-dark.png", animations: "disabled" });
});
