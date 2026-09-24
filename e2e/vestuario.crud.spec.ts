import { test, expect } from "@playwright/test";
import { enterVestuario } from "./helpers";

test("el cartel responde a la convocatoria y guarda porra, entreno y tablón en tiempo real", async ({ page }) => {
  await enterVestuario(page);
  await expect(page.getByRole("heading", { level: 1 })).toBeVisible();
  await expect(page.getByText("Atlético Demo").first()).toBeVisible();

  const rsvp = page.getByRole("radiogroup", { name: "Tu respuesta a la convocatoria" });
  await rsvp.getByRole("radio", { name: "Duda" }).click();
  await expect(rsvp.getByRole("radio", { name: "Duda" })).toHaveAttribute("aria-checked", "true");
  await rsvp.getByRole("radio", { name: "Voy" }).click();
  await expect(page.getByText(/Contigo, \d+\./)).toBeVisible();

  await page.getByRole("button", { name: "Un gol más del Piti" }).click();
  await page.getByRole("button", { name: /Guardar mi porra|Cambiar mi porra/ }).click();
  await expect(page.getByRole("button", { name: "Porra guardada" })).toBeVisible();

  const slots = page.getByRole("group", { name: "Huecos propuestos" });
  if (!(await slots.isVisible())) {
    const when = new Date(Date.now() + 3 * 86_400_000);
    when.setMinutes(0, 0, 0);
    const local = new Date(when.getTime() - when.getTimezoneOffset() * 60_000).toISOString().slice(0, 16);
    await page.getByRole("button", { name: /Otro día/ }).click();
    await page.getByLabel("Hueco 1").fill(local);
    await page.getByRole("button", { name: "Proponer entreno" }).click();
  }
  await slots.getByRole("button").first().click();
  await expect(page.getByText(/tú ya votaste/)).toBeVisible();

  const text = `Balones y petos ${Date.now()}`;
  await page.getByPlaceholder("Escribe al vestuario…").fill(text);
  await page.getByRole("button", { name: "Enviar" }).click();
  await expect(page.getByText(text)).toBeVisible();
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true);
});
