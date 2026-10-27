import { execFileSync } from "node:child_process";
import { test, expect } from "@playwright/test";
import { clearAdminPorra, enterVestuario } from "./helpers";

// The porra is for the seeded next match («preview-next», open until kick-off). Other specs play, re-date or
// add matches: the preview seed (idempotent) puts that fixture back as the next one, scheduled and open.
test.beforeAll(() => execFileSync(process.execPath, ["functions/test/seed-preview.mjs"], { stdio: "inherit" }));
// Every attempt starts with no porra saved. A retry used to meet what its failed attempt left: the same 1–0 its
// first save sets, so the button read «Porra guardada» (disabled) and the retry waited for «Guardar» until it timed out.
test.beforeEach(() => clearAdminPorra("preview-next"));

test("la porra conserva goleador y asistencia al recargar el partido, también en móvil", async ({ page }) => {
  // (four page loads, two saves through the functions emulator, three screenshots: 24–32 s on CI against the
  // default 30, so it gets triple)
  test.slow();
  await enterVestuario(page);
  // The porra lives on the match's Vestuario screen (CL- boards: the vestuario keeps «¿Vas?» and its blocks).
  await page.goto("/partidos/preview-next/vestuario");
  const porra = page.getByRole("region", { name: "Tu porra", exact: true });
  const more = page.locator(".ves-more").getByRole("button", { name: "Ver todo" });
  const unfold = async () => {
    await expect(porra.or(more).first()).toBeVisible();
    if (!(await porra.isVisible())) await more.click();
    await expect(porra).toBeVisible();
  };
  await unfold();
  const steps = porra.getByRole("group", { name: "Tu porra: Piti contra Atlético Demo" });
  const change = porra.getByRole("button", { name: "Cambiar mi porra" });
  await expect(steps.or(change).first()).toBeVisible();
  if (!(await steps.isVisible())) await change.click();
  await expect(steps).toBeVisible();
  const minus = steps.getByRole("button", { name: "Un gol menos del Piti" });
  while (await minus.isEnabled()) await minus.click();
  await steps.getByRole("button", { name: "Un gol más del Piti" }).click();
  await porra.getByLabel("Tu goleador").selectOption({ index: 1 });
  const scorer = await porra.getByLabel("Tu goleador").inputValue();
  await porra.getByLabel("Asistencia (si quieres)").selectOption("");
  await porra.getByRole("button", { name: /Guardar mi porra|Cambiar mi porra/ }).click();
  // Saved: one goal; it opens again with the same goleador and no asistencia.
  await expect(porra.getByRole("img", { name: /^Tu porra: 1 a \d+$/ })).toBeVisible();
  await porra.getByRole("button", { name: "Cambiar mi porra" }).click();
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
