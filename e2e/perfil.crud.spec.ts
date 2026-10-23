import { test, expect, type Page } from "@playwright/test";
import { enterVestuario } from "./helpers";

// Mi página (/perfil, the TU boards) end to end against the emulators, as the seeded captain: the card (a ficha
// claimed first if the account has none: a captain's claim links at once), the tabs (each one an address),
// «Tu nombre» (a shirt name another player wears is refused; a free one is stamped on the card and «Deshacer» brings
// the old one back), «Tu apodo» (lowercase, no accents or spaces as you type; saved and put back), Ajustes › Tema on
// <html data-theme>, the studio (/perfil/compartir: a real PNG download) and Cuenta › «Salir en este dispositivo»
// back to the door. Reduced motion, so the walkout doesn't play; no WebGL anywhere on the page.

test.use({ contextOptions: { reducedMotion: "reduce" } });

const tabs = (page: Page) => page.getByRole("navigation", { name: "Secciones de tu página" });
const tab = (page: Page, name: RegExp) => tabs(page).getByRole("button", { name });
const cardName = (page: Page) => page.locator(".tu-card .tu-card__front .tu-card__name").first();

test("Mi página: la carta, las pestañas, tu nombre, el apodo, el tema, compartir y salir", async ({ page }) => {
  test.setTimeout(90_000);
  await page.addInitScript(() => {
    const w = window as unknown as { __webgl: number };
    w.__webgl = 0;
    const orig = HTMLCanvasElement.prototype.getContext;
    HTMLCanvasElement.prototype.getContext = function (this: HTMLCanvasElement, type: string, ...rest: unknown[]) {
      if (/webgl/i.test(type)) w.__webgl++;
      return (orig as (this: HTMLCanvasElement, t: string, ...r: unknown[]) => RenderingContext | null).call(this, type, ...rest);
    } as typeof orig;
  });

  await enterVestuario(page);
  await page.goto("/perfil");
  await expect(page.getByRole("heading", { level: 2, name: /^Tu (carta|carné)$/ })).toBeVisible();

  // ── the ficha: whatever an earlier run left, end up with a card of your own
  const more = page.getByRole("button", { name: "Más" });
  if (await page.getByRole("heading", { name: /^Tu petición: / }).isVisible()) {
    await more.click();
    await page.getByRole("menuitem", { name: "Cancelar la petición" }).click();
    await expect(page.getByText(/^Petición cancelada/).first()).toBeAttached();
  }
  const pick = page.getByRole("group", { name: "Fichas libres de la plantilla" });
  if (await pick.isVisible()) {
    await pick.getByRole("button").first().click();
    await page.getByRole("button", { name: /^Pedir la carta del / }).click();
  }
  // A captain's claim links at once: the card is his, with «Compartir mi carta» as the screen's action.
  await expect(page.getByRole("button", { name: "Compartir mi carta" })).toBeVisible({ timeout: 20_000 });
  await expect(page.getByRole("heading", { name: "Los seis números" })).toBeVisible();

  // ── the tabs: each one an address
  await tab(page, /^Temporada/).click();
  await expect(page).toHaveURL(/\/perfil\/temporada$/);
  await expect(page.getByRole("heading", { level: 2, name: "Temporada" })).toBeVisible();

  // ── Tu nombre › En la espalda
  await tab(page, /^Tu nombre/).click();
  await expect(page).toHaveURL(/\/perfil\/nombre$/);
  const shirt = page.getByLabel("Lo que va a tu espalda");
  const before = (await shirt.inputValue()).trim();
  expect(before.length).toBeGreaterThan(0);
  const taken = before.toLocaleUpperCase("es") === "DANI" ? "marcos" : "dani";
  await shirt.fill(taken);
  await expect(shirt).toHaveValue(taken.toLocaleUpperCase("es"));
  await expect(page.locator("#tu-shirt-v")).toContainText(/Ya la lleva el \d+ \(.+\): elige otro/);
  await expect(page.getByRole("button", { name: "Estampar" })).toHaveAttribute("aria-disabled", "true");
  await shirt.fill("PRUEBAS");
  await expect(page.locator("#tu-shirt-v")).toContainText("Libre: así quedará a tu espalda");
  await page.getByRole("button", { name: "Estampar" }).click();
  await expect(page.getByText("Estampado: así sale ya en tu ficha.").first()).toBeAttached({ timeout: 15_000 });
  await expect(shirt).toHaveValue("PRUEBAS", { timeout: 15_000 });
  // «Deshacer» inside the 6 s window brings the old name back
  await page.locator(".tu-undo").getByRole("button", { name: "Deshacer" }).click();
  await expect(shirt).toHaveValue(before, { timeout: 15_000 });
  await expect(page.getByText(`Deshecho: vuelve «${before}» a tu espalda.`).first()).toBeAttached();

  // ── Tu apodo: lowercase, no accents or spaces as you type; saved, then put back
  const nick = page.getByLabel("Tu apodo del vestuario");
  const nickBefore = await nick.inputValue();
  const [typed, nickNew] = nickBefore === "capitanprueba" ? ["Capitán Prueba Dos", "capitanpruebados"] : ["Capitán Prueba", "capitanprueba"];
  await nick.fill(typed);
  await expect(nick).toHaveValue(nickNew);
  await expect(page.getByText("Sin mayúsculas, tildes ni espacios: los quitamos al escribir (ñ pasa a n).")).toBeVisible();
  await expect(page.locator("#tu-nick-v")).toContainText("Libre: así te verán en el vestuario", { timeout: 15_000 });
  await page.getByRole("button", { name: "Guardar" }).click();
  await expect(page.getByText(`Guardado: ahora eres @${nickNew}.`).first()).toBeAttached({ timeout: 15_000 });
  await nick.fill(nickBefore);
  await expect(page.locator("#tu-nick-v")).toContainText("Libre: así te verán en el vestuario", { timeout: 15_000 });
  await page.getByRole("button", { name: "Guardar" }).click();
  await expect(page.getByText(`Guardado: ahora eres @${nickBefore}.`).first()).toBeAttached({ timeout: 15_000 });

  // ── Ajustes › Tema: Día / Noche on <html data-theme>
  await tab(page, /^Ajustes/).click();
  await expect(page).toHaveURL(/\/perfil\/ajustes$/);
  const theme = page.getByRole("group", { name: "Tema" });
  await theme.getByRole("button", { name: "Día" }).click();
  await expect(page.locator("html")).toHaveAttribute("data-theme", "light");
  await theme.getByRole("button", { name: "Noche" }).click();
  await expect(page.locator("html")).toHaveAttribute("data-theme", "dark");

  // ── the studio: /perfil/compartir, a real PNG
  await tab(page, /^Tu carta/).click();
  await expect(cardName(page)).not.toHaveText("");
  await page.getByRole("button", { name: "Compartir mi carta" }).click();
  await expect(page).toHaveURL(/\/perfil\/compartir$/);
  const studio = page.getByRole("dialog", { name: "Compartir mi carta" });
  await expect(studio).toBeVisible();
  let download = page.waitForEvent("download");
  await studio.getByRole("button", { name: "Descargar la imagen" }).click();
  expect((await download).suggestedFilename()).toMatch(/^carta-[a-z0-9-]+\.png$/);
  await studio.getByRole("button", { name: /Ya es oficial/ }).click();
  await studio.getByRole("button", { name: /^Post/ }).click();
  await expect(studio.getByRole("group", { name: "Cara" })).toHaveCount(0);
  download = page.waitForEvent("download");
  await studio.getByRole("button", { name: "Descargar la imagen" }).click();
  const png = await download;
  expect(png.suggestedFilename()).toMatch(/^oficial-[a-z0-9-]+\.png$/);
  expect(png.suggestedFilename()).not.toMatch(/admin|piti\.test|preview-admin/);
  await page.keyboard.press("Escape");
  await expect(studio).toHaveCount(0);
  await expect(page).toHaveURL(/\/perfil$/);

  expect(await page.evaluate(() => (window as unknown as { __webgl: number }).__webgl)).toBe(0);

  // ── Cuenta › Salir en este dispositivo (with its confirmation) → back at the door
  await tab(page, /^Cuenta/).click();
  await page.getByRole("button", { name: "Salir en este dispositivo" }).click();
  await page.getByRole("group", { name: "Confirmar la salida" }).getByRole("button", { name: "Sí, salir" }).click();
  await expect(page.getByRole("heading", { name: "Tu sitio en el Piti empieza en el vestuario" })).toBeVisible({ timeout: 20_000 });
});
