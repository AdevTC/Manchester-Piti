import { test, expect, type Page } from "@playwright/test";
import { callFunction, emulatorAdminToken, enterVestuario } from "./helpers";
test("Google permite votar una vez por cuenta y cambiar el voto", async ({
  page,
}) => {
  await enterVestuario(page);
  // The MVP is voted on the match's own Vestuario: the seeded finished match, its vote open for 48 hours. Two of
  // the players who played, whichever they are.
  await page.goto("/partidos/preview-finished/vestuario");
  const ballot = page.getByRole("radiogroup", { name: "Vota al MVP" });
  const change = page.getByRole("button", { name: "Cambiar tu voto" });
  // (a vote from an earlier run folds the ballot into «La carrera del MVP»: open it again)
  await expect(ballot.or(change).first()).toBeVisible();
  if (await change.isVisible()) await change.click();
  const radios = ballot.getByRole("radio");
  await expect(radios.nth(1)).toBeVisible();
  const [first, second] = (await radios.nth(0).getAttribute("aria-checked")) === "true" ? [radios.nth(1), radios.nth(0)] : [radios.nth(0), radios.nth(1)];
  await first.click();
  await page.getByRole("button", { name: /Votar al MVP|Cambiar mi voto/ }).click();
  await expect(page.getByText(/^Voto guardado: /).first()).toBeVisible();
  // one vote per account: changing it moves the same vote, the team still has one
  await change.click();
  await second.click();
  await page.getByRole("button", { name: "Cambiar mi voto" }).click();
  await expect(page.getByText(/^Voto guardado: /).first()).toBeVisible();
  await change.click();
  // (while the vote is open the race stays hidden: «1 de N ya han votado»)
  await expect(page.getByText(/^1( de \d+)? ya han votado/).first()).toBeVisible();
  await expect(second).toHaveAttribute("aria-checked", "true");
});

// ── /admin/partidos (admin v2 «Sala de control»): «Nuevo partido» (modal) → the match workspace (Encuentro ·
// Convocatoria · Acta · Publicar) → the calendar, a draft, the acta and the publish peak ──
async function openPartidos(page: Page) {
  await enterVestuario(page);
  // (the vestuario's «Modo capitán» strip links to the Sala de control)
  await page.getByRole("link", { name: "Sala de control" }).click();
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
  await expect(page.getByText(new RegExp(`Borrador · ${o.rival} creado`))).toBeVisible();
  // (r12: the new match opens on its Datos station)
  await expect(page).toHaveURL(/\/admin\/partidos\/[^/?]+\/datos/);
  if (o.venue) await page.getByLabel("Nombre del campo").fill(o.venue);
  return new URL(page.url()).pathname.split("/")[3] ?? "";
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
  // reopen it: the season's list finds it by its rival, the data is the saved one
  await page.goto("/admin/partidos");
  await page.getByRole("searchbox", { name: "Buscar partido" }).fill(rival);
  await page.getByRole("button", { name: new RegExp(rival) }).click();
  await page.getByRole("navigation", { name: "Las estaciones del partido" }).getByRole("link", { name: /^2 de 6 · Datos/ }).click();
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
  // The shared clock needs it in the calendar: scheduled for tomorrow, published, then played now.
  const id = await nuevoPartido(page, { rival, date: madridDay(1), time: "10:00", venue: "Campo de pruebas" });
  await footer(page).getByRole("button", { name: "Publicar en el calendario" }).click();
  await expect(page.getByText(/publicado · ya sale en el calendario/)).toBeVisible();
  // Nobody has whistled it yet, so it is still «por jugar»: its Convocatoria station is Convocar (the one
  // convocatoria; r12's carril). (Convocar's markup is phase V1b's: a row per player with «Siete» / «Banq.».)
  await page.getByRole("navigation", { name: "Las estaciones del partido" }).getByRole("link", { name: /^1 de 6 · Convocatoria/ }).click();
  await expect(page).toHaveURL(new RegExp(`/admin/partidos/${id}/convocatoria`));
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
  // Played on the shared clock: a match is «jugado» once it is whistled. La mesa drives the clock (its own
  // spec covers it); here the callable is driven directly, then the acta.
  const token = await emulatorAdminToken();
  let revision = 0;
  for (const action of ["start", "halftime", "second", "finish"]) {
    const done = (await callFunction(token, "controlMatchClock", { matchId: id, action, revision })) as { clock: { revision: number } };
    revision = done.clock.revision;
  }
  await page.goto(`/admin/partidos/${id}?tab=acta`);
  // Its acta says it was played yesterday (so the home's seeded last result stays the latest).
  await page.getByRole("tab", { name: /Encuentro/ }).click();
  await page.getByLabel("Fecha", { exact: true }).fill(madridDay(-1));
  await page.getByRole("tab", { name: /^Acta/ }).click();
  // Acta: add the goal, name its scorer and its pass, then its minute.
  await page.getByRole("button", { name: "Gol del Piti" }).click();
  const picker = page.getByRole("dialog", { name: "¿Quién marcó?" });
  await expect(picker).toBeVisible();
  await picker.getByRole("button", { name: "Mario marcó el gol 1" }).click();
  await page.getByRole("dialog", { name: "¿Quién le dio el pase?" }).getByRole("button", { name: "Pase de Pablo" }).click();
  await expect(footer(page).getByText("No cuadra: falta el minuto del gol 1")).toBeVisible();
  await page.getByLabel("Minuto del gol 1", { exact: true }).fill("0"); // whistled seconds after kick-off: only the 0′ fits
  await expect(footer(page).getByText("Cuadra · 1 gol, con goleador")).toBeVisible();
  await footer(page).getByRole("button", { name: "Publicar acta" }).click();
  // The publish peak: FINAL → the vitrina → the hand-off.
  await expect(page).toHaveURL(new RegExp(`/admin/partidos/${id}/despues`));
  const peak = page.getByRole("region", { name: "Acta publicada" });
  await expect(peak.getByText("Acta publicada · la web ya lo cuenta")).toBeVisible();
  await expect(peak.getByRole("button", { name: "Compartir el cartel" })).toBeVisible();
  await peak.getByRole("button", { name: "Corregir el acta" }).click();
  await expect(footer(page).getByText("Publicada · la web ya lo cuenta")).toBeVisible();
});

// /admin as the FIRST page loaded (refresh, bookmark, push link): its styles must not depend on a site page
// having loaded the Celeste tokens first — desktop gets the bar with the capsule (r12), not the phone's dock.
test("el admin cargado directamente tiene su barra con los cinco sitios y sus colores", async ({ page }) => {
  await page.setViewportSize({ width: 1280, height: 800 });
  await enterVestuario(page);
  await page.goto("/admin/partidos");
  const side = page.getByRole("navigation", { name: "Sala de control" });
  await expect(side).toBeVisible();
  await expect(side.getByRole("link")).toHaveCount(5);
  await expect(side.getByRole("link", { name: /^Partidos/ })).toHaveAttribute("aria-current", "page");
  await expect(page.locator(".sc-dock")).toHaveCount(0);
  await expect(page.getByRole("heading", { level: 1, name: "Partidos" })).toBeVisible();
  const root = page.locator(".vx.adm");
  await expect(root).toHaveCSS("container-type", "inline-size");
  expect(await root.evaluate((el) => getComputedStyle(el).getPropertyValue("--bg").trim())).not.toBe("");
});
