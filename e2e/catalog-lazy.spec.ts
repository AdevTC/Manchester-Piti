import { expect, test, type Page } from "@playwright/test";
import { DEFAULT_ANALYSIS_PROFILE } from "../functions/src/narrated/types";
import { callFunction, emulatorAdminToken } from "./helpers";

const documents = "http://127.0.0.1:8080/v1/projects/demo-manchester-piti/databases/(default)/documents";
function value(data: unknown): unknown {
  if (typeof data === "string") return { stringValue: data };
  if (typeof data === "number") return { integerValue: String(data) };
  if (typeof data === "boolean") return { booleanValue: data };
  if (Array.isArray(data)) return { arrayValue: { values: data.map(value) } };
  return { mapValue: { fields: Object.fromEntries(Object.entries(data as Record<string, unknown>).map(([key, item]) => [key, value(item)])) } };
}

/** Unique fixtures on the loopback demo project: no reseed and no changes to the user's demo. */
async function fixture() {
  const token = await emulatorAdminToken();
  const stamp = `${Date.now()}-${Math.random().toString(36).slice(2, 7)}`;
  const id = `catalog-lazy-match-${stamp}`, seasonId = `catalog-lazy-season-${stamp}`;
  const players = Array.from({ length: 7 }, (_, index) => `catalog-lazy-player-${stamp}-${index}`);
  const created: string[] = [];
  let saved = false;
  const create = async (collection: string, ownId: string, data: Record<string, unknown>) => {
    if (!ownId.startsWith("catalog-lazy-")) throw new Error("Sólo fixtures propios del catálogo.");
    const response = await fetch(`${documents}/${collection}?documentId=${encodeURIComponent(ownId)}`, {
      method: "POST", headers: { authorization: "Bearer owner", "content-type": "application/json" },
      body: JSON.stringify({ fields: Object.fromEntries(Object.entries(data).map(([key, item]) => [key, value(item)])) }),
    });
    if (!response.ok) throw new Error(`Fixture ${collection}: HTTP ${response.status}`);
    created.push(`${collection}/${ownId}`);
  };
  const cleanup = async () => {
    if (saved) await callFunction(token, "deleteMatch", { id });
    for (const path of [...created].reverse()) {
      const response = await fetch(`${documents}/${path}`, { method: "DELETE", headers: { authorization: "Bearer owner" } });
      if (!response.ok && response.status !== 404) throw new Error(`Cleanup propio: HTTP ${response.status}`);
    }
  };
  try {
    await create("seasons", seasonId, { name: `Catálogo E2E ${stamp}`, startDate: "2026-07-01", endDate: "2027-06-30" });
    for (const [index, player] of players.entries()) await create("players", player, { firstName: `Jugador catálogo ${index + 1}`, number: index + 1, active: true, seasons: [seasonId] });
    const sheet = {
      version: 2, revision: 0, seasonId, rival: `Catálogo local ${stamp}`, competition: "Amistoso", date: Date.now() - 86_400_000,
      duration: 50, durationSeconds: 3000, status: "finished", home: true, venue: "Prueba local", starters: players, bench: [], notCalled: [],
      goalsFor: 0, goalsAgainst: 0, events: [], report: "Fixture aislada para comprobar la carga progresiva del catálogo.",
      analysis: { version: 2, revision: 0, profile: structuredClone(DEFAULT_ANALYSIS_PROFILE),
        observations: [
          { id: "pass-1", kind: "pass", team: "us", actorId: players[1], receiverId: players[2], order: 1, period: 1, time: { from: 10, to: 10, precision: "exact" }, facts: { outcome: "complete" } },
          { id: "pass-2", kind: "pass", team: "us", actorId: players[2], intendedReceiverId: players[1], order: 2, period: 2, time: { from: 1600, to: 1600, precision: "exact" }, facts: { outcome: "failed" } },
        ], coverage: [{ family: "pass", team: "us", state: "complete" }] },
    };
    await callFunction(token, "saveMatchSheet", { id, sheet, draft: false }); saved = true;
    return { id, seasonId, cleanup };
  } catch (error) { await cleanup(); throw error; }
}

const noOverflow = (page: Page) => page.evaluate(() => document.documentElement.scrollWidth <= innerWidth + 1);

test("Catálogo: carga 24 al acercarse, reinicia filtros y conserva contexto al abrir una ficha", async ({ page, baseURL }, testInfo) => {
  test.setTimeout(90_000);
  expect(new URL(baseURL!).hostname).toBe("127.0.0.1");
  const f = await fixture();
  try {
    await page.setViewportSize({ width: 1440, height: 1000 });
    await page.goto(`/numeros/juego/catalogo?temporada=${f.seasonId}&partidos=${f.id}`);
    const list = page.getByRole("list", { name: "Estadísticas del catálogo", exact: true });
    const rows = list.locator(":scope > li");
    await expect(rows).toHaveCount(24);
    await rows.last().scrollIntoViewIfNeeded();
    await page.mouse.wheel(0, 350);
    await expect(rows).toHaveCount(48);
    // Reaching the old page end adds one batch, not the entire remaining catalogue.
    await expect(page.getByRole("button", { name: /^Mostrar más \(48 de/ })).toBeAttached();

    const search = page.getByRole("searchbox", { name: "Buscar estadística", exact: true });
    await search.fill("pases");
    await expect(rows).toHaveCount(24);
    const first = list.getByRole("button", { name: /067 Pases intentados/ });
    await expect(first).toBeVisible();
    await first.click();
    const detail = page.getByRole("dialog", { name: /Pases intentados/ });
    await expect(detail).toBeVisible();
    await expect(detail.locator(".nu-mt__v > b")).toHaveText("2");
    expect(new URL(page.url()).searchParams.get("partidos")).toBe(f.id);
    expect(new URL(page.url()).searchParams.get("temporada")).toBe(f.seasonId);
    await detail.getByRole("button", { name: "Cerrar", exact: true }).click();
    await expect(detail).not.toBeVisible();
    await expect(search).toHaveValue("pases");
    await expect(rows).toHaveCount(24);

    await search.fill("");
    await rows.last().scrollIntoViewIfNeeded();
    await page.mouse.wheel(0, 350);
    await expect(rows).toHaveCount(48);
    const families = page.getByRole("list", { name: "Familias del catálogo" });
    await families.getByRole("button", { name: "Goles y marcador", exact: true }).click();
    await expect(rows).toHaveCount(14);
    await families.getByRole("button", { name: "Todas", exact: true }).click();
    await expect(rows).toHaveCount(24);
    await search.scrollIntoViewIfNeeded();
    await page.screenshot({ path: testInfo.outputPath("catalog-desktop.png") });

    await page.setViewportSize({ width: 375, height: 812 });
    await search.fill("pases");
    await expect(rows).toHaveCount(24);
    await expect.poll(() => noOverflow(page)).toBe(true);
    await first.click();
    await expect(detail).toBeVisible();
    await expect.poll(() => noOverflow(page)).toBe(true);
    await detail.getByRole("button", { name: "Cerrar", exact: true }).click();
    await expect(search).toHaveValue("pases");
    await list.locator(":scope > li").first().scrollIntoViewIfNeeded();
    await page.screenshot({ path: testInfo.outputPath("catalog-mobile.png") });
  } finally { await f.cleanup(); }
});

test("Catálogo: Mostrar más sigue disponible sin IntersectionObserver", async ({ page, baseURL }) => {
  test.setTimeout(90_000);
  expect(new URL(baseURL!).hostname).toBe("127.0.0.1");
  await page.addInitScript(() => Object.defineProperty(window, "IntersectionObserver", { value: undefined, configurable: true }));
  const f = await fixture();
  try {
    await page.goto(`/numeros/juego/catalogo?temporada=${f.seasonId}&partidos=${f.id}`);
    const rows = page.getByRole("list", { name: "Estadísticas del catálogo", exact: true }).locator(":scope > li");
    await expect(rows).toHaveCount(24);
    await page.getByRole("button", { name: /^Mostrar más \(24 de/ }).click();
    await expect(rows).toHaveCount(48);
  } finally { await f.cleanup(); }
});
