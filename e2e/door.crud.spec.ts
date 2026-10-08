import { test, expect } from "@playwright/test";
import { enterVestuario } from "./helpers";

test("la puerta: un fichaje elige camiseta, pide acceso y el capitán le abre", async ({ browser }) => {
  // Two browsers, the captain's undo window and the walkout: more than the default 30 s on a busy CI runner.
  test.setTimeout(90_000);
  const fanCtx = await browser.newContext();
  const fan = await fanCtx.newPage();
  await fan.goto("/vestuario");
  await expect(fan.getByRole("button", { name: "Entrar con Google" })).toBeVisible();
  await fan.getByRole("button", { name: "Fichaje de prueba · Solo emulador" }).click();
  await expect(fan.getByRole("heading", { name: /Quién/ })).toBeVisible();

  // Pick the first free shirt; the LED marcador engraves it.
  const shirt = fan.locator(".fc:not([disabled]):not(.otro)").first();
  const label = (await shirt.locator("b").textContent())!.trim();
  await shirt.click();
  await expect(shirt).toHaveAttribute("aria-pressed", "true");
  await fan.getByRole("button", { name: "Pedir acceso" }).click();
  await expect(fan.getByRole("heading", { name: /En la puerta/i })).toBeVisible();

  // A step already done is a way back: «Tu ficha» reopens the shirts, and asking again keeps waiting.
  await fan.getByRole("button", { name: /Volver a «Tu ficha»/ }).click();
  await expect(fan.getByRole("heading", { name: /Quién/ })).toBeVisible();
  await fan.locator(".fc").filter({ hasText: label }).first().click();
  await fan.getByRole("button", { name: "Pedir acceso" }).click();
  await expect(fan.getByRole("heading", { name: /En la puerta/i })).toBeVisible();

  // The captain sees the request on the swipe card and approves it (after the undo window).
  const capCtx = await browser.newContext();
  const cap = await capCtx.newPage();
  await enterVestuario(cap);
  const card = cap.locator(".sw-card");
  await expect(card).toContainText(label);
  await cap.locator(".sw-acts .ok").click();
  await expect(cap.getByRole("button", { name: "Deshacer" })).toBeVisible();

  // The waiting screen changes by itself: the spot lights up, then the walkout.
  await expect(fan.getByRole("button", { name: "Salir al campo" })).toBeVisible({ timeout: 20_000 });
  await fan.getByRole("button", { name: "Salir al campo" }).click();
  await expect(fan.getByRole("heading", { name: label })).toBeVisible();
  await fan.getByRole("button", { name: "Entrar al vestuario" }).click();
  await expect(fan.getByRole("radiogroup", { name: "Tu respuesta a la convocatoria" })).toBeVisible();

  await fanCtx.close();
  await capCtx.close();
});
