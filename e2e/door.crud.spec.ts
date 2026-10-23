import { execFileSync } from "node:child_process";
import { test, expect } from "@playwright/test";
import { enterVestuario } from "./helpers";

// The fan must start outside the door: no membership, request, profile or shirt left by an earlier run or
// spec. The preview seed (idempotent) puts «Fichaje de prueba» back there.
test.beforeAll(() => execFileSync(process.execPath, ["functions/test/seed-preview.mjs"], { stdio: "inherit" }));

test("la puerta: un fichaje elige camiseta, pide acceso y el capitán le abre", async ({ browser }) => {
  // Two browsers, the captain's undo window and the walkout: more than the default 30 s on a busy CI runner.
  test.setTimeout(90_000);
  const fanCtx = await browser.newContext();
  const fan = await fanCtx.newPage();
  await fan.goto("/vestuario");
  await expect(fan.getByRole("button", { name: "Entrar con Google" })).toBeVisible();
  await fan.getByRole("button", { name: "Fichaje de prueba · Solo emulador" }).click();
  await expect(fan.getByRole("heading", { name: /Quién/ })).toBeVisible();

  // Pick the first free shirt of «Elige tu camiseta» (CL- boards: the vestuario's door).
  const shirts = fan.getByRole("list", { name: "Elige tu camiseta" });
  const shirt = shirts.locator("button.cb-shirt:not([disabled])").first();
  const label = (await shirt.locator("b").textContent())!.trim();
  await shirt.click();
  await expect(shirt).toHaveAttribute("aria-pressed", "true");
  await fan.getByRole("button", { name: "Pedir acceso" }).click();
  await expect(fan.getByRole("heading", { name: /En la puerta/i })).toBeVisible();

  // «Cambiar ficha» reopens the shirts, and asking again keeps waiting.
  await fan.getByRole("button", { name: "Cambiar ficha" }).click();
  await expect(fan.getByRole("heading", { name: /Quién/ })).toBeVisible();
  await shirts.locator("button.cb-shirt").filter({ hasText: label }).first().click();
  await fan.getByRole("button", { name: "Pedir acceso" }).click();
  await expect(fan.getByRole("heading", { name: /En la puerta/i })).toBeVisible();

  // The captain sees the request in «La puerta» and opens it (after the undo window).
  const capCtx = await browser.newContext();
  const cap = await capCtx.newPage();
  await enterVestuario(cap);
  await cap.getByRole("button", { name: "Abrir la puerta" }).click();
  await expect(cap).toHaveURL(/\/vestuario\/puerta$/);
  const knocking = cap.getByRole("list", { name: "Llamando a la puerta" });
  await expect(knocking).toContainText(label);
  await knocking.getByRole("button", { name: /^Abrir a / }).first().click();
  await expect(cap.getByRole("button", { name: "Deshacer" })).toBeVisible();

  // The waiting screen changes by itself: the door opens, then the walkout.
  await expect(fan.getByRole("button", { name: "Salir al campo" })).toBeVisible({ timeout: 20_000 });
  await fan.getByRole("button", { name: "Salir al campo" }).click();
  await expect(fan.getByRole("heading", { name: new RegExp(`Bienvenido al vestuario, ${label}`, "i") })).toBeVisible();
  await fan.getByRole("button", { name: "Entrar al vestuario" }).click();
  await expect(fan.getByRole("radiogroup", { name: "¿Vas al partido?" })).toBeVisible();

  await fanCtx.close();
  await capCtx.close();
});
