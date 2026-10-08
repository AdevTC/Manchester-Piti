import { test, expect, type Page } from "@playwright/test";
import { enterVestuario } from "./helpers";

// /profile «La carta» end to end against the emulators, as the seeded captain: the card on its pedestal
// (a ficha claimed first if the account has none: a captain's claim links at once), «Tu nombre» (a shirt
// name another player wears is refused; a free one is stamped on the card and «Deshacer» brings the old
// one back), «Tu apodo» (lowercase, no accents or spaces as you type; saved and put back), the tabs by
// keyboard (the #hash follows), Ajustes › Tema on <html data-theme>, the share studio (Diseño, Formato
// and a real PNG download) and Cuenta › «Salir en este dispositivo» back to the door. Reduced motion, so
// the walkout intro doesn't play; and no WebGL anywhere on the page (the card is CSS, the image 2D canvas).

test.use({ contextOptions: { reducedMotion: "reduce" } });

const cta = (page: Page) => page.locator("#pe-top .cta");
const cardName = (page: Page) => page.locator("#pe-top .cd .fc.ft .cf-nm");

test("el perfil: la carta, tu nombre, el apodo, las pestañas, el tema, compartir y salir", async ({ page }) => {
  test.setTimeout(90_000);
  // Count any WebGL context the page asks for (there must be none on /profile).
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
  await page.goto("/profile");
  await expect(page.getByRole("heading", { level: 1, name: /^Tu perfil · / })).toBeAttached();
  await expect(page.locator("#pe-top button.cd")).toBeVisible();
  await expect(page.getByText(/^Videomarcador: /)).toBeAttached();

  // ── the ficha: whatever an earlier run left, end up with a card of your own
  const petition = cta(page).getByRole("button", { name: "Ver mi petición" });
  if (await petition.isVisible()) {
    await cta(page).getByRole("button", { name: "Cancelar" }).click();
    await expect(page.getByText("Petición cancelada")).toBeVisible();
  }
  const claim = cta(page).getByRole("button", { name: "Reclamar mi ficha" });
  if (await claim.isVisible()) {
    await claim.click();
    const free = page.getByRole("group", { name: "Cartas libres de la plantilla" }).getByRole("button").first();
    await free.click();
    await expect(free).toHaveAttribute("aria-pressed", "true");
    await page.getByRole("button", { name: /^Pedir la carta del / }).click();
  }
  // A captain's claim links at once: the card is yours.
  await expect(cta(page).getByRole("button", { name: /^Ver el (dorso|frente)$/ })).toBeVisible({ timeout: 20_000 });
  await expect(page.getByText(/^Videomarcador: ¡YA ES OFICIAL! · /)).toBeAttached();

  // ── Tu nombre › En la espalda
  const before = ((await cardName(page).textContent()) ?? "").trim();
  expect(before.length).toBeGreaterThan(0);
  const shirt = page.getByLabel("Lo que va a tu espalda");
  await shirt.scrollIntoViewIfNeeded();
  // another player's name (the seed's squad), compared without case or accents
  const taken = before.toLocaleUpperCase("es") === "DANI" ? "marcos" : "dani";
  await shirt.fill(taken);
  await expect(shirt).toHaveValue(taken.toLocaleUpperCase("es"));
  await expect(page.locator("#pe-shirt-v")).toContainText(/Ya la lleva el \d+ \(.+\): elige otro/);
  await expect(page.getByRole("button", { name: "Estampar" })).toBeDisabled();
  await shirt.fill("PRUEBAS");
  await expect(page.locator("#pe-shirt-v")).toContainText("Libre: así quedará a tu espalda");
  await page.getByRole("button", { name: "Estampar" }).click();
  await expect(cardName(page)).toHaveText("PRUEBAS", { timeout: 15_000 });
  await expect(page.getByText("Estampado: así sale ya en tu ficha")).toBeVisible();
  // «Deshacer» inside the 6 s window brings the old name back
  await page.locator("#pe-top .undo").getByRole("button", { name: "Deshacer" }).click();
  await expect(cardName(page)).toHaveText(before, { timeout: 15_000 });
  await expect(page.getByText(`Deshecho: vuelve «${before}» a tu espalda`)).toBeVisible();

  // ── Tu nombre › Tu apodo: lowercase, no accents or spaces as you type; saved, then put back
  const nick = page.getByLabel("Apodo del vestuario");
  const nickBefore = await nick.inputValue();
  // Whatever an earlier run left, the new handle differs from the current one.
  const [typed, nickNew] = nickBefore === "capitanprueba" ? ["Capitán Prueba Dos", "capitanpruebados"] : ["Capitán Prueba", "capitanprueba"];
  await nick.fill(typed);
  await expect(nick).toHaveValue(nickNew);
  await expect(page.getByText("Sin mayúsculas, tildes ni espacios: los quitamos al escribir (ñ pasa a n).")).toBeVisible();
  await expect(page.locator("#pe-nick-v")).toContainText("Libre: así te verán en el vestuario", { timeout: 15_000 });
  await page.getByRole("button", { name: "Guardar" }).click();
  await expect(page.getByText(`Guardado: ahora eres @${nickNew}`)).toBeVisible({ timeout: 15_000 });
  await nick.fill(nickBefore);
  await expect(page.locator("#pe-nick-v")).toContainText("Libre: así te verán en el vestuario", { timeout: 15_000 });
  await page.getByRole("button", { name: "Guardar" }).click();
  await expect(page.getByText(`Guardado: ahora eres @${nickBefore}`)).toBeVisible({ timeout: 15_000 });

  // ── the tabs by keyboard: → moves the tab and the #hash
  const tabs = page.getByRole("tablist", { name: "Secciones de tu perfil" });
  await tabs.getByRole("tab", { name: /Tu carta/ }).focus();
  await page.keyboard.press("ArrowRight");
  await expect(tabs.getByRole("tab", { name: /Temporada/ })).toHaveAttribute("aria-selected", "true");
  await expect(tabs.getByRole("tab", { name: /Temporada/ })).toBeFocused();
  await expect(page).toHaveURL(/#temporada$/);
  await expect(page.getByRole("heading", { name: "Tus números" })).toBeVisible();

  // ── Ajustes › Tema: Día / Noche on <html data-theme>
  await tabs.getByRole("tab", { name: /Ajustes/ }).click();
  await expect(page).toHaveURL(/#ajustes$/);
  const theme = page.getByRole("group", { name: /^Tema: / });
  for (let i = 0; i < 3 && (await theme.getAttribute("aria-label")) !== "Tema: Día"; i++) await theme.getByRole("button", { name: "Tema: siguiente" }).click();
  await expect(theme).toHaveAttribute("aria-label", "Tema: Día");
  await expect(page.locator("html")).toHaveAttribute("data-theme", "light");
  await theme.getByRole("button", { name: "Tema: siguiente" }).click();
  await expect(theme).toHaveAttribute("aria-label", "Tema: Noche");
  await expect(page.locator("html")).toHaveAttribute("data-theme", "dark");

  // ── the share studio: Diseño, Formato, a real PNG
  await cta(page).getByRole("button", { name: /Compartir mi carta/ }).click();
  const studio = page.getByRole("dialog", { name: /Compartir mi carta/ });
  await expect(studio).toBeVisible();
  await expect(studio.getByRole("img", { name: /^Vista previa \(historia 9:16\): tu carta/ })).toBeVisible();
  let download = page.waitForEvent("download");
  await studio.getByRole("button", { name: /Descargar imagen/ }).click();
  expect((await download).suggestedFilename()).toMatch(/^carta-[a-z0-9-]+\.png$/);
  await expect(page.getByText(/^Imagen guardada · carta-[a-z0-9-]+\.png$/)).toBeVisible();
  await studio.getByRole("button", { name: /Ya es oficial/ }).click();
  await studio.getByRole("button", { name: /^Post/ }).click();
  const poster = studio.getByRole("img", { name: /^Vista previa del póster \(post 4:5\): ¡Ya es oficial!/ });
  await expect(poster).toBeVisible();
  await expect(poster).toHaveClass(/\bpost\b/);
  await expect(studio.getByRole("group", { name: "Cara" })).toHaveCount(0);
  download = page.waitForEvent("download");
  await studio.getByRole("button", { name: /Descargad/ }).click();
  const png = await download;
  expect(png.suggestedFilename()).toMatch(/^oficial-[a-z0-9-]+\.png$/);
  expect(png.suggestedFilename()).not.toMatch(/admin|piti\.test|preview-admin/);
  await page.keyboard.press("Escape");
  await expect(studio).toHaveCount(0);
  await expect(cta(page).getByRole("button", { name: /Compartir mi carta/ })).toBeFocused();

  // no WebGL on /profile
  expect(await page.evaluate(() => (window as unknown as { __webgl: number }).__webgl)).toBe(0);

  // ── Cuenta › Salir en este dispositivo (with its confirmation) → back at the door
  await page.getByRole("tablist", { name: "Secciones de tu perfil" }).getByRole("tab", { name: /Cuenta/ }).click();
  await page.getByRole("button", { name: "Salir en este dispositivo" }).click();
  await page.getByRole("group", { name: "Confirmar la salida" }).getByRole("button", { name: "Sí, salir" }).click();
  await expect(page.getByRole("button", { name: "Entrar con Google" })).toBeVisible({ timeout: 20_000 });
});
