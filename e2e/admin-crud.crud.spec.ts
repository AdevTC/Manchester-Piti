import { test, expect, type Page } from "@playwright/test";
import { enterVestuario } from "./helpers";
test("Google permite votar una vez por cuenta y cambiar el voto", async ({
  page,
}) => {
  await enterVestuario(page);
  const first = (await page.getByRole("radio", { name: /Hugo/ }).isChecked())
    ? /Mario/
    : /Hugo/;
  await page.getByRole("radio", { name: first }).check();
  await page
    .getByRole("button", { name: /Votar al MVP|Cambiar mi voto/ })
    .click();
  await expect(page.getByText("Voto guardado")).toBeVisible();
  await page
    .getByRole("radio", { name: first.source === "Hugo" ? /Mario/ : /Hugo/ })
    .check();
  await page.getByRole("button", { name: "Cambiar mi voto" }).click();
  await expect(page.getByText("Voto guardado")).toBeVisible();
  await expect(
    page.getByText("1 voto del equipo", { exact: true }),
  ).toBeVisible();
});

// ── /admin/partidos (admin v2 «Sala de control»): «Nuevo partido» (modal) → the match workspace (Encuentro ·
// Convocatoria · Acta · Publicar) → the calendar, a draft, the acta and the publish peak ──
async function openPartidos(page: Page) {
  await enterVestuario(page);
  await page.getByRole("link", { name: /Administrar el club/ }).click();
  await page
    .getByRole("navigation", { name: "Sala de control" })
    .getByRole("link", { name: /^Partidos/ })
    .click();
  await expect(page).toHaveURL(/\/admin\/partidos/);
}
/** «Nuevo partido»: fills the modal and creates the draft (it opens on «Encuentro»); returns its id. */
async function nuevoPartido(page: Page, o: { rival: string; date: string; time: string; venue?: string }): Promise<string> {
  await page.getByRole("button", { name: "Nuevo partido" }).first().click();
  const modal = page.getByRole("dialog", { name: "Nuevo partido" });
  await expect(modal).toBeVisible();
  await modal.getByLabel("Rival", { exact: true }).fill(o.rival);
  const season = modal.getByLabel("Temporada", { exact: true });
  if (await season.count()) await season.selectOption("preview-season");
  await modal.getByLabel("Fecha", { exact: true }).fill(o.date);
  await modal.getByLabel("Hora (Madrid)").fill(o.time);
  await modal.getByRole("button", { name: "Crear y abrir" }).click();
  await expect(page.getByText(new RegExp(`${o.rival} creada`))).toBeVisible();
  await expect(page).toHaveURL(/\/admin\/partidos\/[^/?]+\?tab=encuentro/);
  if (o.venue) await page.getByLabel("Nombre del campo").fill(o.venue);
  return new URL(page.url()).pathname.split("/").pop() ?? "";
}
/** A Madrid calendar day relative to today, as the date field wants it. */
const madridDay = (days: number) =>
  new Intl.DateTimeFormat("sv-SE", { timeZone: "Europe/Madrid" }).format(Date.now() + days * 86400000);
/** The workspace's fixed footer (state, reason, buttons). */
const footer = (page: Page) => page.locator(".det .df");

test("programar, publicar en el calendario y reabrir un encuentro conserva sus datos", async ({ page }) => {
  await openPartidos(page);
  const rival = `Rival E2E ${Date.now()}`;
  await nuevoPartido(page, { rival, date: "2030-10-12", time: "18:30", venue: "Campo de integración" });
  await expect(footer(page).getByText("Sin publicar · aún no sale en el calendario")).toBeVisible();
  await footer(page).getByRole("button", { name: "Publicar en el calendario" }).click();
  await expect(page.getByText(/publicado · ya sale en el calendario/)).toBeVisible();
  await expect(footer(page).getByText("Por jugar · sáb 12 oct 18:30")).toBeVisible();
  // reopen it: the list finds it by its rival, the data is the saved one
  await page.reload();
  await page.getByRole("searchbox", { name: "Buscar partido" }).fill(rival);
  await page.getByRole("button", { name: new RegExp(rival) }).click();
  await expect(page.getByLabel("Rival", { exact: true })).toHaveValue(rival);
  await expect(page.getByLabel("Nombre del campo")).toHaveValue("Campo de integración");
  await expect(page.getByLabel("Fecha", { exact: true })).toHaveValue("2030-10-12");
  await expect(page.getByLabel("Hora (Madrid)")).toHaveValue("18:30");
});

test("el borrador se guarda sin modificar el encuentro público", async ({ page }) => {
  await openPartidos(page);
  const rival = `Borrador privado ${Date.now()}`;
  await nuevoPartido(page, { rival, date: "2030-11-02", time: "11:00" });
  await page.getByLabel("Nombre del campo").fill("Campo del borrador");
  await expect(page.getByText("● Cambios sin guardar")).toBeVisible();
  await footer(page).getByRole("button", { name: "Guardar borrador" }).click();
  await expect(page.getByText("Borrador guardado · solo lo ven los capitanes")).toBeVisible();
  await expect(footer(page).getByText(/^Guardado .* · hora de Madrid$/)).toBeVisible();
  await page.goto("/partidos");
  await expect(page.getByText(rival, { exact: true })).toHaveCount(0);
});

test("el acta: convocatoria en Convocar, gol con «¿Quién marcó?» y publicar cuando cuadra → la vitrina", async ({ page }) => {
  await openPartidos(page);
  const rival = `Acta E2E ${Date.now()}`;
  const id = await nuevoPartido(page, { rival, date: madridDay(-1), time: "10:00", venue: "Campo de pruebas" });
  // The field was just typed: save it (leaving with unsaved changes rightly asks «¿Salir sin guardar?»).
  await footer(page).getByRole("button", { name: "Guardar borrador" }).click();
  await expect(footer(page).getByText(/^Guardado .* · hora de Madrid$/)).toBeVisible();
  // Played yesterday without its seven: the Convocatoria tab sends to Convocar (the one convocatoria).
  // (Convocar's markup is phase V1b's: a row per player with «Siete» / «Banq.».)
  await page.getByRole("tab", { name: /Convocatoria/ }).click();
  await page.getByRole("button", { name: "Completarla en Convocar" }).click();
  await expect(page).toHaveURL(new RegExp(`/admin/convocar\\?j=${id}`));
  // Each tap writes the convocatoria (serialized, last one wins): wait until none is still travelling before
  // leaving the page (a reload would cut the last write — the app asks first, rightly).
  let inFlight = 0;
  page.on("request", (r) => r.url().includes("setConvocatoria") && inFlight++);
  page.on("requestfinished", (r) => r.url().includes("setConvocatoria") && inFlight--);
  page.on("requestfailed", (r) => r.url().includes("setConvocatoria") && inFlight--);
  for (const name of ["Álex", "Dani", "Marcos", "Pablo", "Sergio", "David", "Mario"])
    await page.locator(".pr", { hasText: name }).getByRole("button", { name: "Siete" }).click();
  await expect.poll(() => inFlight, { timeout: 10_000 }).toBe(0);
  await page.waitForTimeout(400); // a queued write starts right after the previous one ends
  await expect.poll(() => inFlight, { timeout: 10_000 }).toBe(0);
  // Acta: add the goal, name its scorer and its pass, then its minute.
  await page.goto(`/admin/partidos/${id}?tab=acta`);
  await page.getByRole("button", { name: "Gol del Piti" }).click();
  const picker = page.getByRole("dialog", { name: "¿Quién marcó?" });
  await expect(picker).toBeVisible();
  await picker.getByRole("button", { name: "Mario marcó el gol 1" }).click();
  await page.getByRole("dialog", { name: "¿Quién le dio el pase?" }).getByRole("button", { name: "Pase de Pablo" }).click();
  await expect(footer(page).getByText("No cuadra: falta el minuto del gol 1")).toBeVisible();
  await page.getByLabel("Minuto del gol 1", { exact: true }).fill("12");
  await expect(footer(page).getByText("Cuadra · 1 gol, con goleador")).toBeVisible();
  await footer(page).getByRole("button", { name: "Publicar acta" }).click();
  // The publish peak: FINAL → the vitrina → the hand-off.
  await expect(page).toHaveURL(/vitrina=true/);
  const peak = page.getByRole("region", { name: "Acta publicada" });
  await expect(peak.getByText("Acta publicada · la web ya lo cuenta")).toBeVisible();
  await expect(peak.getByRole("button", { name: "Compartir el cartel" })).toBeVisible();
  await peak.getByRole("button", { name: "Corregir el acta" }).click();
  await expect(footer(page).getByText("Publicada · la web ya lo cuenta")).toBeVisible();
});

// /admin as the FIRST page loaded (refresh, bookmark, push link): its styles must not depend on a site page
// having loaded the Celeste tokens first — desktop gets the side menu, not the phone layout.
test("el admin cargado directamente tiene su menú lateral y sus colores", async ({ page }) => {
  await page.setViewportSize({ width: 1280, height: 800 });
  await enterVestuario(page);
  await page.goto("/admin/partidos");
  const side = page.getByRole("navigation", { name: "Sala de control" });
  await expect(side).toBeVisible();
  await expect(page.getByRole("heading", { level: 1, name: "Partidos" })).toBeVisible();
  const root = page.locator(".vx.adm");
  await expect(root).toHaveCSS("container-type", "inline-size");
  expect(await root.evaluate((el) => getComputedStyle(el).getPropertyValue("--bg").trim())).not.toBe("");
});
