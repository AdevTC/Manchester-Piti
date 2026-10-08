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

// ── /admin/partidos: «Nuevo partido» (modal) → the match's tabs → publish, draft and the acta flow ──
async function openPartidos(page: Page) {
  await enterVestuario(page);
  await page.getByRole("link", { name: /Administrar el club/ }).click();
  await page
    .getByRole("navigation", { name: "Secciones de administración" })
    .getByRole("link", { name: /Partidos y actas/ })
    .click();
  await expect(page).toHaveURL(/\/admin\/partidos/);
}
/** «Nuevo partido»: fills the modal and creates the draft (it opens on «Encuentro»). */
async function nuevoPartido(page: Page, o: { rival: string; date: string; time: string; venue?: string }) {
  await page.getByRole("button", { name: "Nuevo partido" }).first().click();
  const modal = page.getByRole("dialog", { name: "Nuevo partido" });
  await expect(modal).toBeVisible();
  await modal.getByLabel("Rival", { exact: true }).fill(o.rival);
  const season = modal.getByLabel("Temporada", { exact: true });
  if (await season.count()) await season.selectOption("preview-season");
  await modal.getByLabel("Fecha", { exact: true }).fill(o.date);
  await modal.getByLabel("Hora (Madrid)").fill(o.time);
  if (o.venue) await modal.getByLabel("Campo", { exact: true }).fill(o.venue);
  await modal.getByRole("button", { name: "Crear partido" }).click();
  await expect(page.getByText(new RegExp(`${o.rival} creado`))).toBeVisible();
  await expect(page).toHaveURL(/\/admin\/partidos\/[^/?]+\?tab=encuentro/);
}
/** A Madrid calendar day relative to today, as the date field wants it. */
const madridDay = (days: number) =>
  new Intl.DateTimeFormat("sv-SE", { timeZone: "Europe/Madrid" }).format(Date.now() + days * 86400000);

test("programar, publicar y reabrir un encuentro conserva sus datos", async ({ page }) => {
  await openPartidos(page);
  const rival = `Rival E2E ${Date.now()}`;
  await nuevoPartido(page, { rival, date: "2030-10-12", time: "18:30", venue: "Campo de integración" });
  await page.getByRole("tab", { name: /Publicar/ }).click();
  await page.getByRole("button", { name: "Publicar encuentro" }).click();
  const modal = page.getByRole("dialog", { name: "¿Publicar el encuentro?" });
  await modal.getByRole("button", { name: "Publicar encuentro" }).click();
  await expect(page.getByText(/publicado · ya sale en el calendario/)).toBeVisible();
  // reopen it from the list: a match still to be played opens as its summary
  await page.getByRole("searchbox", { name: "Buscar partido" }).fill(rival);
  await page.getByRole("button", { name: new RegExp(rival) }).click();
  await page.getByRole("button", { name: "Editar el encuentro" }).click();
  await expect(page.getByLabel("Rival", { exact: true })).toHaveValue(rival);
  await expect(page.getByLabel("Campo (nombre y dirección)")).toHaveValue("Campo de integración");
  await expect(page.getByLabel("Fecha · hora de Madrid")).toHaveValue("2030-10-12T18:30");
});

test("el borrador se guarda sin modificar el encuentro público", async ({ page }) => {
  await openPartidos(page);
  const rival = `Borrador privado ${Date.now()}`;
  await nuevoPartido(page, { rival, date: "2030-11-02", time: "11:00" });
  await page.getByLabel("Campo (nombre y dirección)").fill("Campo del borrador");
  await expect(page.getByText("● Cambios sin guardar")).toBeVisible();
  await page.getByRole("button", { name: "Guardar borrador" }).click();
  await expect(page.getByText("Borrador guardado · solo lo ven los capitanes.")).toBeVisible();
  await expect(page.getByText(/✓ Guardado .* · hora de Madrid/)).toBeVisible();
  await page.goto("/partidos");
  await expect(page.getByText(rival, { exact: true })).toHaveCount(0);
});

test("el acta: convocatoria, gol con «¿Quién marcó?» y publicar cuando cuadra", async ({ page }) => {
  await openPartidos(page);
  const rival = `Acta E2E ${Date.now()}`;
  await nuevoPartido(page, { rival, date: madridDay(-1), time: "10:00", venue: "Campo de pruebas" });
  // Convocatoria: seven titulares, the rest not called up.
  await page.getByRole("tab", { name: /Convocatoria/ }).click();
  for (const name of ["Álex", "Dani", "Marcos", "Pablo", "Sergio", "David", "Mario"])
    await page.getByRole("group", { name: `Convocatoria de ${name}` }).getByRole("button", { name: "Titular" }).click();
  await page.getByRole("button", { name: /restantes como no convocados/ }).click();
  await expect(page.getByText("7 de 7 titulares")).toBeVisible();
  // Acta: it was played yesterday — mark it finished, add a goal and name its scorer.
  await page.getByRole("tab", { name: /Acta/ }).click();
  await page.getByRole("button", { name: "Marcar como finalizado" }).click();
  await page.getByRole("button", { name: "Añadir un gol del Piti" }).click();
  const picker = page.getByRole("dialog", { name: /Gol 1 · ¿Quién marcó\?/ });
  await expect(picker).toBeVisible();
  await picker.getByRole("button", { name: /lo marcó Mario, dorsal 7/ }).click();
  await page.getByRole("dialog", { name: /¿Quién dio el pase\?/ }).getByRole("button", { name: /Asistencia de Pablo/ }).click();
  await expect(page.getByText("No cuadra todavía")).toBeVisible();
  await page.getByLabel("Minuto del gol 1").fill("12");
  await expect(page.getByText("Cuadra · lista para publicar")).toBeVisible();
  await page.getByRole("button", { name: "Publicar acta" }).click();
  const modal = page.getByRole("dialog", { name: "¿Publicar el acta?" });
  await expect(modal.getByText("Mario 12′ (Pablo)")).toBeVisible();
  await modal.getByRole("button", { name: "Publicar acta" }).click();
  await expect(page.getByText(/Acta J\d+ publicada · web al día · MVP abierto 48 h\./)).toBeVisible();
  await expect(page.getByText("Acta publicada")).toBeVisible();
});
