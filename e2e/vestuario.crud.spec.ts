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

  // A confirmed training left by an earlier run: reopen its vote first.
  const reopen = page.getByRole("button", { name: "Reabrir votación" });
  if (await reopen.isVisible()) await reopen.click();
  const slots = page.getByRole("group", { name: "Huecos propuestos" });
  if (!(await slots.isVisible())) {
    const when = new Date(Date.now() + 3 * 86_400_000);
    const day = new Date(when.getTime() - when.getTimezoneOffset() * 60_000).toISOString().slice(0, 10);
    await page.getByRole("button", { name: /Otro día/ }).click();
    await page.getByLabel("Hueco 1 · día").fill(day);
    await page.getByLabel("Hueco 1 · desde").fill("20:00");
    await page.getByLabel("Hueco 1 · hasta").fill("21:30");
    await page.getByRole("button", { name: "Proponer entreno" }).click();
  }
  await slots.getByRole("button").first().click();
  await expect(page.getByText(/tú ya votaste/)).toBeVisible();
  // As admin, confirm the slot: the card closes the vote and announces it; then reopen it.
  await page.getByRole("group", { name: "Confirmar el entreno" }).getByRole("button").first().click();
  await expect(page.getByRole("heading", { name: "Entreno confirmado" })).toBeVisible();
  await expect(page.getByRole("link", { name: /Entreno confirmado ·/ })).toBeVisible();
  await expect(page.getByText(/^Entreno confirmado: /).first()).toBeVisible();
  await page.getByRole("button", { name: "Reabrir votación" }).click();
  await expect(page.getByRole("heading", { name: "¿Cuándo entrenamos?" })).toBeVisible();

  const text = `Balones y petos ${Date.now()}`;
  await page.getByPlaceholder("Escribe al vestuario…").fill(text);
  await page.getByRole("button", { name: "Enviar" }).click();
  await expect(page.getByText(text)).toBeVisible();
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true);
});

test("lo que escribe un miembro aparece al instante en la pantalla de otro", async ({ browser }) => {
  const [a, b] = await Promise.all([browser.newContext(), browser.newContext()]).then((cs) => Promise.all(cs.map((c) => c.newPage())));
  await enterVestuario(a);
  await enterVestuario(b);
  const rsvp = a.getByRole("radiogroup", { name: "Tu respuesta a la convocatoria" });
  const t0 = Date.now();
  await rsvp.getByRole("radio", { name: "Duda" }).click();
  await expect(rsvp.getByRole("radio", { name: "Duda" })).toHaveAttribute("aria-checked", "true");
  const tap = Date.now() - t0;

  // The board takes one message every 5 s per member (firestore.rules): let the previous test's one clear.
  await a.waitForTimeout(5000);
  const text = `En tiempo real ${Date.now()}`;
  await a.getByPlaceholder("Escribe al vestuario…").fill(text);
  const t1 = Date.now();
  await a.getByRole("button", { name: "Enviar" }).click();
  await expect(a.getByText(text)).toBeVisible();
  const mine = Date.now() - t1;
  await expect(b.getByText(text)).toBeVisible({ timeout: 5000 });
  const theirs = Date.now() - t1;
  test.info().annotations.push({ type: "latencia", description: `respuesta ${tap} ms · mensaje propio ${mine} ms · en la otra pantalla ${theirs} ms` });
  await rsvp.getByRole("radio", { name: "Voy" }).click();
});
