import { test, expect, type Page } from "@playwright/test";
import { enterVestuario } from "./helpers";

// The vestuario (CL- boards): «¿Vas?» on its hub, and each block its own screen (/vestuario/entrenos,
// /vestuario/tablon). The porra lives on the match's Vestuario screen now (porra.crud).
const openBlock = async (page: Page, name: RegExp, url: RegExp) => {
  await page.getByRole("list", { name: "Lo del equipo" }).getByRole("button", { name }).click();
  await expect(page).toHaveURL(url);
};
const backToHub = async (page: Page) => {
  await page.getByRole("button", { name: "El vestuario" }).click();
  await expect(page).toHaveURL(/\/vestuario$/);
};

test("¿Vas? responde a la convocatoria, y entreno y tablón se guardan en tiempo real", async ({ page }) => {
  await enterVestuario(page);
  await expect(page.getByRole("heading", { level: 1, name: "El vestuario" })).toBeVisible();
  // Scoped to the page: the floating score (outside main) carries the rival too, sometimes hidden.
  await expect(page.getByRole("main").getByText(/Atlético Demo/).first()).toBeVisible();

  const rsvp = page.getByRole("radiogroup", { name: "¿Vas al partido?" });
  await rsvp.getByRole("radio", { name: "Duda" }).click();
  await expect(rsvp.getByRole("radio", { name: "Duda" })).toHaveAttribute("aria-checked", "true");
  await rsvp.getByRole("radio", { name: "Voy", exact: true }).click();
  await expect(rsvp.getByRole("radio", { name: "Voy", exact: true })).toHaveAttribute("aria-checked", "true");
  await expect(page.getByText(/^\d+ van · \d+ en duda/)).toBeVisible();

  // Entrenos: a confirmed training left by an earlier run is reopened first.
  await openBlock(page, /^Entrenos:/, /\/vestuario\/entrenos$/);
  const reopen = page.getByRole("button", { name: "Reabrir votación" });
  const slots = page.getByRole("list", { name: "Huecos propuestos" });
  await expect(reopen.or(slots).or(page.getByText(/Nadie ha propuesto huecos/)).first()).toBeVisible();
  if (await reopen.isVisible()) {
    await reopen.click();
    await expect(slots).toBeVisible();
  }
  if (!(await slots.isVisible())) {
    const when = new Date(Date.now() + 3 * 86_400_000);
    const day = new Date(when.getTime() - when.getTimezoneOffset() * 60_000).toISOString().slice(0, 10);
    await page.getByRole("button", { name: /Otro día · proponer entreno/ }).click();
    await page.getByLabel("Hueco 1 · día").fill(day);
    await page.getByLabel("Hueco 1 · desde").fill("20:00");
    await page.getByLabel("Hueco 1 · hasta").fill("21:30");
    await page.getByRole("button", { name: "Proponer entreno" }).click();
    await expect(slots).toBeVisible();
  }
  const firstSlot = slots.getByRole("button").first();
  if ((await firstSlot.getAttribute("aria-pressed")) !== "true") await firstSlot.click();
  await expect(firstSlot).toHaveAttribute("aria-pressed", "true");
  // As a captain, confirm the slot: the vote closes; then reopen it.
  await page.getByRole("group", { name: "Confirmar el entreno" }).getByRole("button").first().click();
  await expect(page.getByText(/votación cerrada/)).toBeVisible();
  await page.getByRole("button", { name: "Reabrir votación" }).click();
  await expect(slots).toBeVisible();
  await backToHub(page);

  // El tablón: the message shows at once.
  await openBlock(page, /^El tablón:/, /\/vestuario\/tablon$/);
  const text = `Balones y petos ${Date.now()}`;
  await page.getByPlaceholder("Escribe al vestuario…").fill(text);
  await page.getByRole("button", { name: "Publicar" }).click();
  await expect(page.getByRole("list", { name: "Mensajes del tablón" }).getByText(text)).toBeVisible();
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true);
});

test("lo que escribe un miembro aparece al instante en la pantalla de otro", async ({ browser }) => {
  const [a, b] = await Promise.all([browser.newContext(), browser.newContext()]).then((cs) => Promise.all(cs.map((c) => c.newPage())));
  await enterVestuario(a);
  await enterVestuario(b);
  const rsvp = a.getByRole("radiogroup", { name: "¿Vas al partido?" });
  const t0 = Date.now();
  await rsvp.getByRole("radio", { name: "Duda" }).click();
  await expect(rsvp.getByRole("radio", { name: "Duda" })).toHaveAttribute("aria-checked", "true");
  const tap = Date.now() - t0;

  await openBlock(a, /^El tablón:/, /\/vestuario\/tablon$/);
  await openBlock(b, /^El tablón:/, /\/vestuario\/tablon$/);
  // The board takes one message every 5 s per member (firestore.rules): let the previous test's one clear.
  await a.waitForTimeout(5000);
  const text = `En tiempo real ${Date.now()}`;
  await a.getByPlaceholder("Escribe al vestuario…").fill(text);
  const t1 = Date.now();
  await a.getByRole("button", { name: "Publicar" }).click();
  await expect(a.getByText(text)).toBeVisible();
  const mine = Date.now() - t1;
  await expect(b.getByText(text)).toBeVisible({ timeout: 5000 });
  const theirs = Date.now() - t1;
  test.info().annotations.push({ type: "latencia", description: `respuesta ${tap} ms · mensaje propio ${mine} ms · en la otra pantalla ${theirs} ms` });
  await backToHub(a);
  await a.getByRole("radiogroup", { name: "¿Vas al partido?" }).getByRole("radio", { name: "Voy", exact: true }).click();
});
