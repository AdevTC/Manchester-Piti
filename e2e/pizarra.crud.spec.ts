import { test, expect, type Page } from "@playwright/test";
import { enterPizarra, SEASON } from "./pizarraKit";

// r14 «La pizarra» end to end: the frame and the addresses. Every place has its own address under /pizarra/*, and
// the old ones (r13's #panels, la mesa's ?desde=mesa, /pizarra/dibujar, ?con=) land on the new place, keeping the
// season. The flows of each place live in their own specs (pizarra-*.crud.spec.ts).

const places = (page: Page) => page.getByRole("navigation", { name: "La pizarra" });
const here = (page: Page) => places(page).locator('button[aria-current="page"]');

test("la pizarra: cada sitio con su dirección, y las direcciones viejas llevan a las nuevas", async ({ page }) => {
  await enterPizarra(page, "/pizarra");
  // /pizarra is el Siete, in the season asked for
  await expect(page).toHaveURL(/\/pizarra\/siete\?/);
  expect(new URL(page.url()).searchParams.get("season")).toBe(SEASON);
  await expect(here(page)).toHaveAccessibleName(/^Siete:/);
  // no site footer around it, nothing scrolls sideways
  await expect(page.locator(".club-footer")).toHaveCount(0);

  // the places by the bar: each one its own address
  for (const [name, path] of [["Plan", "/pizarra/plan"], ["Jugadas", "/pizarra/jugadas"], ["Partido", "/pizarra/partido"], ["Tableros", "/pizarra/tableros"], ["Pachanga", "/pizarra/pachanga"], ["Siete", "/pizarra/siete"]] as const) {
    await places(page).getByRole("button", { name: new RegExp("^" + name + ":") }).click();
    await expect(page).toHaveURL(new RegExp(path.replace(/\//g, "\\/") + "\\?"));
    await expect(here(page)).toHaveAccessibleName(new RegExp("^" + name + ":"));
    expect(new URL(page.url()).searchParams.get("season")).toBe(SEASON);
  }
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true);

  // the old addresses (the search, a notice, la mesa, a link someone kept) → the new places, with the season
  const moves: [string, RegExp][] = [
    [`/pizarra?season=${SEASON}#charla`, /\/pizarra\/charla\?/],
    [`/pizarra?season=${SEASON}#quimica`, /\/pizarra\/siete\?.*capa=quimica/],
    [`/pizarra?season=${SEASON}#jugadas`, /\/pizarra\/jugadas\?/],
    [`/pizarra?season=${SEASON}#tableros`, /\/pizarra\/tableros\?/],
    [`/pizarra?season=${SEASON}#pachanga`, /\/pizarra\/pachanga\?/],
    [`/pizarra/dibujar?season=${SEASON}`, /\/pizarra\/siete\?.*modo=dibujar/],
    [`/pizarra?desde=mesa&partido=preview-next&season=${SEASON}`, /\/pizarra\/partido\?.*desde=mesa/],
  ];
  for (const [from, to] of moves) {
    await page.goto(from);
    await expect(page).toHaveURL(to);
    expect(new URL(page.url()).searchParams.get("season")).toBe(SEASON);
    expect(new URL(page.url()).hash).toBe("");
  }
  // an address the pizarra doesn't have: its own «not here», with the way back to the Siete
  await page.goto(`/pizarra/nada-por-aqui?season=${SEASON}`);
  await expect(page.getByRole("heading", { level: 1, name: "Esta parte de la pizarra no existe" })).toBeVisible();
  await page.getByRole("button", { name: "Volver al siete" }).click();
  await expect(page).toHaveURL(/\/pizarra\/siete\?/);
  await expect(here(page)).toHaveAccessibleName(/^Siete:/);
});
