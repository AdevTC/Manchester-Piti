import { expect, test, type Locator, type Page } from "@playwright/test";
import { pathToFileURL } from "node:url";
import { resolve } from "node:path";
import { DEFAULT_ANALYSIS_PROFILE, type Observation } from "../functions/src/narrated/types";
import { callFunction, emulatorAdminToken } from "./helpers";

interface Fixture { id: string; seasonId: string; observations: Observation[]; participantCount: number; player: { id: string; name: string }; other?: { id: string; rival: string }; cleanup: () => Promise<void> }
const readOnlyDemo = process.env.E2E_WORKSPACE_READONLY === "1";
const emulatorDocuments = "http://127.0.0.1:8080/v1/projects/demo-manchester-piti/databases/(default)/documents";
function firestoreValue(value: unknown): unknown {
  if (typeof value === "string") return { stringValue: value };
  if (typeof value === "boolean") return { booleanValue: value };
  if (typeof value === "number") return { integerValue: String(value) };
  if (Array.isArray(value)) return { arrayValue: { values: value.map(firestoreValue) } };
  return { mapValue: { fields: Object.fromEntries(Object.entries(value as Record<string, unknown>).map(([key, value]) => [key, firestoreValue(value)])) } };
}
async function createOwnDocument(path: string, data: Record<string, unknown>) {
  const [collection, id] = path.split("/");
  if (!id?.startsWith("workspace-")) throw new Error("Solo fixtures propios de esta prueba.");
  const response = await fetch(`${emulatorDocuments}/${collection}?documentId=${encodeURIComponent(id)}`, { method: "POST", headers: { authorization: "Bearer owner", "content-type": "application/json" }, body: JSON.stringify({ fields: Object.fromEntries(Object.entries(data).map(([key, value]) => [key, firestoreValue(value)])) }) });
  if (!response.ok) throw new Error(`Fixture ${collection}: HTTP ${response.status}`);
}

/** The optional local pass reads the existing large demo without authentication, writes or reseeding.
 * Normal CI uses unique matches on the loopback demo emulators and deletes only those matches. */
async function fixture(): Promise<Fixture> {
  if (readOnlyDemo) {
    const module = await import(pathToFileURL(resolve(".emulator-data/narrated-demo-fixture.mjs")).href);
    const f = module.buildDemoFixture();
    return { id: f.expected.matchId, seasonId: f.season.id, observations: f.sheet.analysis.observations, participantCount: 10, player: { id: f.players[3].id, name: f.players[3].firstName }, cleanup: async () => {} };
  }
  const token = await emulatorAdminToken();
  const stamp = `${Date.now()}-${Math.random().toString(36).slice(2, 7)}`;
  const id = `workspace-e2e-${stamp}`, otherId = `workspace-other-${stamp}`, otherRival = `Muestra de tabla ${stamp}`;
  const seasonId = `workspace-season-${stamp}`;
  const players = Array.from({ length: 10 }, (_, i) => `workspace-player-${stamp}-${i}`);
  const observations: Observation[] = [
    { id: "a", kind: "pass", team: "us", actorId: players[1], receiverId: players[2], order: 1, period: 1, time: { from: 10, to: 10, precision: "exact" }, facts: { outcome: "complete" } },
    { id: "b", kind: "pass", team: "us", actorId: players[2], receiverId: players[1], order: 2, period: 1, time: { from: 20, to: 20, precision: "exact" }, facts: { outcome: "complete" } },
    { id: "c", kind: "pass", team: "us", actorId: players[2], intendedReceiverId: players[1], order: 3, period: 1, time: { from: 30, to: 30, precision: "exact" }, facts: { outcome: "failed" } },
    { id: "d", kind: "pass", team: "us", actorId: players[2], intendedReceiverId: players[1], order: 4, period: 2, time: { from: 1510, to: 1510, precision: "exact" }, facts: { outcome: "failed" } },
    { id: "e", kind: "pass", team: "us", actorId: players[3], receiverId: players[1], order: 5, period: 1, time: { from: 40, to: 40, precision: "exact" }, facts: { outcome: "complete" } },
    { id: "f", kind: "pass", team: "us", actorId: players[3], receiverId: players[1], order: 6, period: 2, time: { from: 1520, to: 1520, precision: "exact" }, facts: { outcome: "complete" } },
    ...[1, 2].map(period => ({ id: `period-${period}`, kind: "context" as const, team: "us" as const, order: 10 + period, period, facts: { intervalStart: (period - 1) * 1500, intervalEnd: period * 1500 } })),
  ];
  const sheet = { version: 2, revision: 0, seasonId, rival: `Tabla local ${stamp}`, competition: "Amistoso", date: Date.now() - 86400000, duration: 50, durationSeconds: 3000, venue: "Prueba local", home: true, status: "finished", starters: players.slice(0, 7), bench: players.slice(7), notCalled: [], events: [], goalsFor: 0, goalsAgainst: 0, report: "Partido ficticio para comprobar tablas y filtros.", analysis: { version: 2, revision: 0, profile: structuredClone(DEFAULT_ANALYSIS_PROFILE), observations, coverage: [{ family: "pass", team: "us", state: "complete" }, { family: "lineup", team: "us", state: "complete" }, { family: "substitution", team: "us", state: "complete" }] } };
  const created: string[] = [];
  const createdDocs: string[] = [];
  const cleanup = async () => {
    for (const matchId of created) await callFunction(token, "deleteMatch", { id: matchId });
    for (const path of createdDocs.reverse()) { const response = await fetch(`${emulatorDocuments}/${path}`, { method: "DELETE", headers: { authorization: "Bearer owner" } }); if (!response.ok && response.status !== 404) throw new Error(`Cleanup ${path}: HTTP ${response.status}`); }
  };
  try {
    await createOwnDocument(`seasons/${seasonId}`, { name: `E2E números ${stamp}`, startDate: "2026-07-01", endDate: "2027-06-30" }); createdDocs.push(`seasons/${seasonId}`);
    for (const [i, playerId] of players.entries()) {
      const name = ["Álex", "Dani", "Marcos", "Pablo E2E", "Sergio", "David", "Mario", "Hugo", "Lucas", "Nico"][i];
      await createOwnDocument(`players/${playerId}`, { firstName: name, shirtName: name, number: i + 1, seasons: [seasonId], active: true }); createdDocs.push(`players/${playerId}`);
    }
    await callFunction(token, "saveMatchSheet", { id, sheet, draft: false }); created.push(id);
    const additional = { ...observations[0], id: "other-failed", receiverId: undefined, intendedReceiverId: players[2], facts: { outcome: "failed" } };
    await callFunction(token, "saveMatchSheet", { id: otherId, sheet: { ...sheet, rival: otherRival, analysis: { ...sheet.analysis, observations: [additional] } }, draft: false }); created.push(otherId);
    return { id, seasonId: sheet.seasonId, observations, participantCount: 7, player: { id: players[3], name: "Pablo E2E" }, other: { id: otherId, rival: otherRival }, cleanup };
  } catch (error) { await cleanup(); throw error; }
}
const number = new Intl.NumberFormat("es-ES", { maximumFractionDigits: 2 });
function sample(observations: Observation[], playerId?: string, period?: number) {
  const passes = observations.filter(o => o.kind === "pass" && o.team === "us" && (!playerId || o.actorId === playerId) && (!period || o.period === period));
  const completed = passes.filter(o => o.facts.outcome === "complete").length;
  return { attempts: passes.length, percent: passes.length ? `${number.format(completed * 100 / passes.length)}%` : "-" };
}
async function checkTotal(workspace: Locator, observations: Observation[], playerId?: string, period?: number) {
  const expected = sample(observations, playerId, period);
  await expect(workspace.getByRole("button", { name: /^Total .*: Pases intentados,/ }).locator("strong")).toHaveText(String(expected.attempts));
  await expect(workspace.getByRole("button", { name: /^Total .*: Precisión de pase,/ }).locator("strong")).toHaveText(expected.percent);
}
async function checkLayout(page: Page, cards: Locator) {
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth + 1)).toBe(true);
  const problems = await cards.getByRole("button").evaluateAll(elements => {
    const rects = elements.map(element => element.getBoundingClientRect());
    const issues: string[] = [];
    rects.forEach((rect, i) => {
      rects.slice(i + 1).forEach(other => { if (Math.min(rect.right, other.right) - Math.max(rect.left, other.left) > 1 && Math.min(rect.bottom, other.bottom) - Math.max(rect.top, other.top) > 1) issues.push(`Tarjeta ${i} solapada`); });
      for (const child of elements[i].querySelectorAll(".an-highlight__figure, .an-highlight__figure strong")) if (child.scrollWidth > child.clientWidth + 1) issues.push(`Cifra ${i} desbordada`);
    });
    return issues;
  });
  expect(problems).toEqual([]);
}

test("Números: doce indicadores, tabla configurable, muestras y móvil sin desbordamientos", async ({ page, baseURL }, testInfo) => {
  test.setTimeout(100_000);
  expect(new URL(baseURL!).hostname).toBe("127.0.0.1");
  if (readOnlyDemo) expect(new URL(baseURL!).port).toBe("3102");
  const f = await fixture();
  try {
    // The full analysis lives in Números: the match's Números screen opens it with this match selected.
    await page.goto(`/partidos/${f.id}/numeros`);
    await page.getByRole("link", { name: "Abrir el análisis en Números" }).click();
    await expect(page).toHaveURL(/\/numeros\/juego(\/catalogo)?\?/);
    expect(JSON.parse(new URL(page.url()).searchParams.get("partidos") ?? "[]")).toEqual([f.id]);
    const panel = page.getByRole("region", { name: "Análisis de las jugadas" });
    const workspace = page.getByRole("region", { name: "Todos los números, a tu medida" });
    const cards = page.getByLabel("Indicadores de la selección");
    await expect(cards.getByRole("button")).toHaveCount(12);
    await expect(workspace).toBeVisible();
    await workspace.getByRole("group", { name: "Columnas habituales" }).getByRole("button", { name: "Pases y creación", exact: true }).click();
    const table = workspace.getByRole("table", { name: /^Estadísticas por jugador/ });
    await expect(table.locator("tbody tr")).toHaveCount(f.participantCount);
    await checkTotal(workspace, f.observations);
    const insights = page.getByRole("region", { name: "Dónde cambia el juego" });
    await expect(insights).toBeVisible();
    await insights.getByRole("combobox", { name: "Qué ver por tramos" }).selectOption("070");
    await insights.getByRole("region", { name: "Barras de 1.ª parte" }).getByRole("button").first().click();
    const segment = insights.getByRole("region", { name: "Detalle del tramo" });
    await expect(segment.locator(".ai-value strong")).toContainText("%");
    await expect(segment.getByRole("heading", { name: /Jugadas de esta muestra \([1-9]/ })).toBeVisible();
    await expect(segment.locator(".ai-evidence li").first()).toContainText("1.ª");
    await insights.getByRole("button", { name: "Quién conecta con quién" }).click();
    const matrix = insights.getByRole("table", { name: "Matriz dirigida de pases" });
    await expect(matrix.locator("tbody tr")).toHaveCount(f.participantCount);
    await matrix.getByRole("button", { name: /\. [1-9]\d* completados,/ }).first().click();
    const connection = insights.getByRole("region", { name: "Detalle de la conexión" });
    await expect(connection.getByRole("heading", { name: /Jugadas de esta muestra \([1-9]/ })).toBeVisible();
    await insights.getByRole("combobox", { name: "Color y cifra de la matriz" }).selectOption("accuracy");
    await expect(matrix.getByRole("button", { name: /\. [1-9]\d* completados,/ }).first().locator("strong")).toContainText("%");
    const readValues = async () => (await table.locator("tbody tr td:first-of-type strong").allTextContents()).map(value => Number(value.replace(/[^\d,-]/g, "").replace(",", ".")));
    const descending = await readValues(); expect(descending).toEqual([...descending].sort((a, b) => b - a));
    await workspace.getByRole("button", { name: "Ordenar por Pases intentados, de menor a mayor" }).click();
    const ascending = await readValues(); expect(ascending).toEqual([...ascending].sort((a, b) => a - b));
    await workspace.getByRole("button", { name: "Ordenar por Pases intentados, de mayor a menor" }).click();
    expect(await readValues()).toEqual(descending);

    await workspace.locator("summary").filter({ hasText: "Personalizar columnas" }).click();
    await workspace.getByRole("searchbox", { name: "Buscar columna" }).fill("378");
    await workspace.getByRole("checkbox").check();
    await workspace.locator("summary").filter({ hasText: "Personalizar columnas" }).click();
    await expect(table.locator("tbody tr td:last-child strong")).toHaveText(Array(f.participantCount).fill("-"));
    await expect(table.locator("tfoot tr td:last-child strong")).toHaveText("-");

    for (const viewport of [{ width: 1440, height: 1050 }, { width: 375, height: 812 }]) {
      await page.setViewportSize(viewport);
      await cards.scrollIntoViewIfNeeded();
      await expect(cards.getByRole("button")).toHaveCount(12);
      await checkLayout(page, cards);
      await cards.screenshot({ path: testInfo.outputPath(`analysis-cards-${viewport.width}.png`) });
      await workspace.scrollIntoViewIfNeeded();
      await workspace.screenshot({ path: testInfo.outputPath(`analysis-table-${viewport.width}.png`) });
      await insights.scrollIntoViewIfNeeded();
      expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth + 1)).toBe(true);
      await expect(insights.getByRole("region", { name: "Matriz de pases con desplazamiento horizontal" })).toBeVisible();
    }
    // The contextual total survives a local name search, which hides rows only.
    await workspace.getByRole("searchbox", { name: "Buscar jugador o dorsal" }).fill(f.player.name);
    await expect(table.locator("tbody tr")).toHaveCount(1);
    await checkTotal(workspace, f.observations);
    await workspace.getByRole("searchbox", { name: "Buscar jugador o dorsal" }).fill("");

    if (f.other) {
      await page.locator("summary[aria-label='Filtrar partidos']").click();
      await page.getByRole("checkbox", { name: new RegExp(f.other.rival) }).check();
      await expect(workspace.getByRole("button", { name: /^Total .*: Pases intentados,/ }).locator("strong")).toHaveText(String(sample(f.observations).attempts + 1));
      await page.getByRole("checkbox", { name: new RegExp(f.other.rival) }).uncheck();
      await page.locator("summary[aria-label='Filtrar partidos']").click();
    }
    await page.locator("summary[aria-label='Filtrar jugadores']").click();
    await page.getByRole("checkbox", { name: new RegExp(`^${f.player.name}$`, "i") }).check();
    await page.locator("summary[aria-label='Filtrar jugadores']").click();
    await expect(table.locator("tbody tr")).toHaveCount(1);
    await checkTotal(workspace, f.observations, f.player.id);
    await panel.getByRole("combobox", { name: "Parte", exact: true }).selectOption("2");
    await checkTotal(workspace, f.observations, f.player.id, 2);
    await page.reload();
    await workspace.getByRole("group", { name: "Columnas habituales" }).getByRole("button", { name: "Pases y creación", exact: true }).click();
    await checkTotal(workspace, f.observations, f.player.id, 2);
    await checkLayout(page, cards);
    await workspace.screenshot({ path: testInfo.outputPath("analysis-filtered-mobile.png") });
    // The second half only, in the bars by tramos, here in Números where the analysis lives.
    await expect(insights.getByRole("region", { name: "Barras de 2.ª parte" })).toBeVisible();
    await expect(insights.getByRole("region", { name: "Barras de 1.ª parte" })).toHaveCount(0);
    await insights.getByRole("button", { name: "Quién conecta con quién" }).click();
    await expect(matrix.locator("tbody tr")).toHaveCount(1);
    expect(await matrix.locator("thead th").count()).toBeGreaterThan(2);
    await matrix.getByRole("button", { name: /\. [1-9]\d* completados,/ }).first().click();
    await expect(connection.locator(".ai-evidence li").first()).toContainText("2.ª");
    // A play opens its match (its Números screen), carrying the selection in the address.
    await connection.getByRole("link", { name: /^Abrir partido/ }).first().click();
    await expect(page).toHaveURL(new RegExp(`/partidos/${f.id}/numeros\\?`));
    expect(new URL(page.url()).searchParams.get("period")).toBe("2");
    expect(JSON.parse(new URL(page.url()).searchParams.get("players") ?? "[]")).toEqual([f.player.id]);
    await expect(page.getByRole("link", { name: "Abrir el análisis en Números" })).toBeVisible();
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth + 1)).toBe(true);
  } finally { await f.cleanup(); }
});
