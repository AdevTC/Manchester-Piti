import { test, expect, type Page } from "@playwright/test";
import { clearAdminAvailability, enterVestuario } from "./helpers";

// «Tú» (/perfil, the four places and Ajustes) end to end against the emulators, as the seeded captain: his card
// (a ficha claimed in the vestuario first if the account has none: a captain's claim links at once), the bar
// between Tú · Partidos · Juego · Vitrina (each one an address), an old address normalised (/perfil/temporada →
// /perfil/partidos), «Lo que te toca» answering the convocatoria in place («Voy», with its toast), Ajustes › Tu
// nombre (a shirt name another player wears is refused; a free one is stamped and «Deshacer» brings the old one
// back), the apodo (lowercase, no accents or spaces as you type; saved and put back), Ajustes › Apariencia › Tema on
// <html data-theme>, the studio (/perfil/compartir over Tu vitrina: a real PNG download) and Ajustes › Cuenta ›
// «Salir en este dispositivo» back to the door. Reduced motion, so the walkout doesn't play; no WebGL on the page.

test.use({ contextOptions: { reducedMotion: "reduce" } });

// The convocatoria «¿Vas?» starts open: the vestuario spec (and an earlier attempt) leave it answered.
test.beforeEach(() => clearAdminAvailability("preview-next"));

const bar = (page: Page) => page.getByRole("navigation", { name: "Tu página" });
/** A place's button in the bar: its name, then its live hint («Partidos 1 jugado · media 4,7»). */
const place = (page: Page, name: "Tú" | "Partidos" | "Juego" | "Vitrina") => bar(page).getByRole("button", { name: new RegExp(`^${name}\\s`) });
const gear = (page: Page) => bar(page).getByRole("button", { name: /^Ajustes/ });
/** An Ajustes section in its index («Tu nombre PRUEBAS · @capi_prueba», «Apariencia Noche»…). */
const section = (page: Page, name: RegExp) => page.getByRole("navigation", { name: "Ajustes" }).getByRole("button", { name });
/** The toast (a live region, and the visible strip with «Deshacer»). */
const said = (page: Page, text: string) => page.getByText(text, { exact: true }).first();

/** /perfil as a player: whatever an earlier run left (a request waiting, no ficha), end up with his card. */
async function withCard(page: Page) {
  await page.goto("/perfil");
  await expect(page.getByRole("heading", { level: 2, name: "Lo que te toca" })).toBeVisible({ timeout: 20_000 });
  // A request still waiting (the sobre cerrado): cancel it, with its confirmation.
  const petition = page.getByRole("button", { name: "Ver mi petición" });
  if (await petition.isVisible()) {
    await petition.click();
    await page.getByRole("button", { name: "Cancelar la petición" }).click();
    await page.getByRole("group", { name: /^¿Cancelar tu petición/ }).getByRole("button", { name: "Sí, cancelar" }).click();
    await expect(said(page, "Petición cancelada. Puedes pedir otra carta cuando quieras.")).toBeAttached();
    await expect(page.getByRole("button", { name: "Elegir mi ficha" })).toBeVisible({ timeout: 15_000 });
  }
  // No ficha (a socio's carné): «Elegir mi ficha» → the vestuario's one claim flow; a captain's claim links at once.
  const choose = page.getByRole("button", { name: "Elegir mi ficha" });
  if (await choose.isVisible()) {
    await choose.click();
    await expect(page).toHaveURL(/\/vestuario\/ficha$/);
    const free = page.getByRole("group", { name: "Elige tu nombre" }).getByRole("radio").first();
    await free.check({ force: true }); // (a visually hidden native radio inside its shirt's label)
    await expect(free).toBeChecked();
    await page.getByRole("button", { name: "Es mi ficha", exact: true }).click();
    await expect(page.getByText("Ir a mi ficha")).toBeVisible({ timeout: 20_000 });
    await page.goto("/perfil");
  }
  // A player's page: his four places in the bar, Tú the one shown.
  await expect(place(page, "Partidos")).toBeVisible({ timeout: 20_000 });
  await expect(place(page, "Tú")).toHaveAttribute("aria-current", "page");
}

test("Tú: la carta, las cuatro plazas, una dirección vieja y «Lo que te toca» (Voy)", async ({ page }) => {
  test.setTimeout(90_000);
  await enterVestuario(page);
  await withCard(page);

  // ── the bar: each place an address, the one shown marked
  await place(page, "Partidos").click();
  await expect(page).toHaveURL(/\/perfil\/partidos$/);
  await expect(place(page, "Partidos")).toHaveAttribute("aria-current", "page");
  await expect(page.getByRole("main").getByText(/^Tus partidos · /)).toBeVisible();
  await place(page, "Juego").click();
  await expect(page).toHaveURL(/\/perfil\/juego$/);
  await expect(place(page, "Juego")).toHaveAttribute("aria-current", "page");
  await expect(page.getByRole("heading", { name: "Dónde has jugado" })).toBeVisible();
  await place(page, "Vitrina").click();
  await expect(page).toHaveURL(/\/perfil\/vitrina$/);
  await expect(place(page, "Vitrina")).toHaveAttribute("aria-current", "page");
  await expect(page.getByRole("button", { name: "Compartir mi carta" })).toBeVisible();
  // (off Tú, the masthead's mini card goes back to it too)
  await expect(page.getByRole("button", { name: /^Volver a tu carta/ })).toBeVisible();
  await place(page, "Tú").click();
  await expect(page).toHaveURL(/\/perfil$/);
  await expect(place(page, "Tú")).toHaveAttribute("aria-current", "page");

  // ── an old address (push notifications, old links) lands on its place, normalised
  await page.goto("/perfil/temporada");
  await expect(page).toHaveURL(/\/perfil\/partidos$/);
  await expect(place(page, "Partidos")).toHaveAttribute("aria-current", "page");
  await place(page, "Tú").click();
  await expect(page).toHaveURL(/\/perfil$/);

  // ── «Lo que te toca»: the convocatoria answered in place, the toast says so, it moves to «Lo que ya has hecho»
  const todo = page.getByRole("list", { name: "Lo que te toca" });
  const rsvp = todo.getByRole("listitem", { name: /Atlético Demo\?$/ });
  await expect(rsvp).toBeVisible({ timeout: 15_000 });
  await rsvp.getByRole("button", { name: "Voy", exact: true }).click();
  await expect(said(page, "Apuntado: vas. El capitán ya lo ve.")).toBeAttached({ timeout: 15_000 });
  const done = page.getByRole("list", { name: "Lo que ya has hecho" });
  await expect(done.getByRole("listitem").filter({ hasText: /^Vas / })).toBeVisible();
  await expect(done.getByRole("button", { name: /^Cambiar: Vas / })).toBeVisible();
});

test("Tú › Ajustes: tu nombre, el apodo, el tema; el estudio y salir", async ({ page }) => {
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
  await withCard(page);

  // ── the gear: Ajustes, then Tu nombre › En la espalda
  await gear(page).click();
  await expect(page).toHaveURL(/\/perfil\/ajustes$/);
  await expect(gear(page)).toHaveAttribute("aria-current", "page");
  await section(page, /^Tu nombre/).click();
  await expect(page).toHaveURL(/\/perfil\/ajustes\/nombre$/);
  const shirt = page.getByRole("textbox", { name: /^Lo que va a tu espalda/ });
  const before = (await shirt.inputValue()).trim();
  expect(before.length).toBeGreaterThan(0);
  const taken = before.toLocaleUpperCase("es") === "DANI" ? "marcos" : "dani";
  await shirt.fill(taken);
  await expect(shirt).toHaveValue(taken.toLocaleUpperCase("es"));
  await expect(page.locator("#tc-shirt-v")).toContainText(/Ya la lleva el \d+ \(.+\): elige otro/);
  await expect(page.getByRole("button", { name: "Estampar" })).toHaveAttribute("aria-disabled", "true");
  await shirt.fill("PRUEBAS");
  await expect(page.locator("#tc-shirt-v")).toContainText("Libre: así quedará a tu espalda");
  await page.getByRole("button", { name: "Estampar" }).click();
  await expect(said(page, "Estampado: así sale ya en tu ficha.")).toBeAttached({ timeout: 15_000 });
  await expect(shirt).toHaveValue("PRUEBAS", { timeout: 15_000 });
  // «Deshacer» inside the 6 s window brings the old name back
  await page.locator(".tk-toast").getByRole("button", { name: "Deshacer" }).click();
  await expect(shirt).toHaveValue(before, { timeout: 15_000 });
  await expect(said(page, `Deshecho: vuelve «${before}» a tu espalda.`)).toBeAttached();

  // ── Tu apodo del vestuario: lowercase, no accents or spaces as you type; saved, then put back
  const nick = page.getByRole("textbox", { name: /^Apodo/ });
  const nickBefore = await nick.inputValue();
  const [typed, nickNew] = nickBefore === "capitanprueba" ? ["Capitán Prueba Dos", "capitanpruebados"] : ["Capitán Prueba", "capitanprueba"];
  await nick.fill(typed);
  await expect(nick).toHaveValue(nickNew);
  await expect(page.getByText("Sin mayúsculas, tildes ni espacios: los quitamos al escribir (ñ pasa a n).")).toBeVisible();
  await expect(page.locator("#tc-nick-v")).toContainText("Libre: así te verán en el vestuario", { timeout: 15_000 });
  await page.getByRole("button", { name: "Guardar", exact: true }).click();
  await expect(said(page, `Guardado: ahora eres @${nickNew}.`)).toBeAttached({ timeout: 15_000 });
  await nick.fill(nickBefore);
  await expect(page.locator("#tc-nick-v")).toContainText("Libre: así te verán en el vestuario", { timeout: 15_000 });
  await page.getByRole("button", { name: "Guardar", exact: true }).click();
  await expect(said(page, `Guardado: ahora eres @${nickBefore}.`)).toBeAttached({ timeout: 15_000 });

  // ── Ajustes › Apariencia › Tema: Día / Noche on <html data-theme>
  await section(page, /^Apariencia/).click();
  await expect(page).toHaveURL(/\/perfil\/ajustes\/apariencia$/);
  const theme = page.getByRole("group", { name: "Tema" });
  await theme.getByRole("button", { name: "Día" }).click();
  await expect(page.locator("html")).toHaveAttribute("data-theme", "light");
  await theme.getByRole("button", { name: "Noche" }).click();
  await expect(page.locator("html")).toHaveAttribute("data-theme", "dark");

  // ── the studio: Tu vitrina › «Compartir mi carta» → /perfil/compartir, a real PNG
  await place(page, "Vitrina").click();
  await expect(page).toHaveURL(/\/perfil\/vitrina$/);
  await page.getByRole("button", { name: "Compartir mi carta" }).click();
  await expect(page).toHaveURL(/\/perfil\/compartir$/);
  const studio = page.getByRole("dialog", { name: "Compartir mi carta" });
  await expect(studio).toBeVisible();
  let download = page.waitForEvent("download");
  await studio.getByRole("button", { name: "Descargar", exact: true }).click();
  expect((await download).suggestedFilename()).toMatch(/^carta-[a-z0-9-]+\.png$/);
  await studio.getByRole("group", { name: "Diseño" }).getByRole("button", { name: "¡Ya es oficial!" }).click();
  await studio.getByRole("group", { name: "Formato" }).getByRole("button", { name: "Post 4:5" }).click();
  await expect(studio.getByRole("group", { name: "Cara" })).toHaveCount(0);
  download = page.waitForEvent("download");
  await studio.getByRole("button", { name: "Descargar", exact: true }).click();
  const png = await download;
  expect(png.suggestedFilename()).toMatch(/^oficial-[a-z0-9-]+\.png$/);
  expect(png.suggestedFilename()).not.toMatch(/admin|piti\.test|preview-admin/);
  await page.keyboard.press("Escape");
  await expect(studio).toHaveCount(0);
  await expect(page).toHaveURL(/\/perfil\/vitrina$/);

  expect(await page.evaluate(() => (window as unknown as { __webgl: number }).__webgl)).toBe(0);

  // ── Ajustes › Cuenta › Salir en este dispositivo (with its confirmation) → back at the door
  await gear(page).click();
  await section(page, /^Cuenta/).click();
  await expect(page).toHaveURL(/\/perfil\/ajustes\/cuenta$/);
  await page.getByRole("button", { name: "Salir en este dispositivo" }).click();
  await page.getByRole("group", { name: /^¿Salir aquí\?/ }).getByRole("button", { name: "Sí, salir" }).click();
  await expect(page.getByRole("heading", { name: "Tu sitio en el Piti empieza en el vestuario" })).toBeVisible({ timeout: 20_000 });
});
