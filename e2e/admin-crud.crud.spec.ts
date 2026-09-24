import { test, expect } from "@playwright/test";
import { enterVestuario } from "./helpers";
test("Google y clave permiten votar una vez por cuenta y cambiar el voto", async ({
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
test("programar, publicar y reabrir un encuentro conserva sus datos", async ({
  page,
}) => {
  await enterVestuario(page);
  await page.getByRole("link", { name: /Administrar el club/ }).click();
  await page.getByRole("button", { name: "Nuevo partido" }).click();
  const rival = `Rival E2E ${Date.now()}`;
  await page
    .getByRole("combobox", { name: "Temporada", exact: true })
    .selectOption("preview-season");
  await page.getByLabel("Rival", { exact: true }).fill(rival);
  await page.getByLabel("Fecha y hora (Madrid)").fill("2030-10-12T18:30");
  await page.getByLabel("Campo", { exact: true }).fill("Campo de integración");
  await page.getByRole("button", { name: /Revisión/ }).click();
  await page.getByRole("button", { name: /Publicar/ }).click();
  await expect(
    page.getByText(
      "Partido publicado. Calendario, perfiles y estadísticas actualizados.",
    ),
  ).toBeVisible();
  await page.getByRole("button", { name: "Todos los partidos" }).click();
  await page.getByRole("button").filter({ hasText: rival }).click();
  await expect(page.getByLabel("Rival", { exact: true })).toHaveValue(rival);
  await expect(page.getByLabel("Campo", { exact: true })).toHaveValue(
    "Campo de integración",
  );
  await expect(page.getByLabel("Fecha y hora (Madrid)")).toHaveValue(
    "2030-10-12T18:30",
  );
});
test("el borrador se guarda sin modificar el encuentro público", async ({
  page,
}) => {
  await enterVestuario(page);
  await page.getByRole("link", { name: /Administrar el club/ }).click();
  await page.getByRole("button", { name: "Nuevo partido" }).click();
  const rival = `Borrador privado ${Date.now()}`;
  await page
    .getByRole("combobox", { name: "Temporada", exact: true })
    .selectOption("preview-season");
  await page.getByLabel("Rival", { exact: true }).fill(rival);
  await page.getByRole("button", { name: /Guardar borrador/ }).click();
  await expect(
    page.getByText("Borrador guardado. Solo lo ven los administradores."),
  ).toBeVisible();
  await page
    .getByRole("navigation", { name: "Navegación principal" })
    .getByRole("link", { name: "Partidos", exact: true })
    .click();
  await expect(page.getByText(rival, { exact: true })).toHaveCount(0);
});
