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
function sample(observations: Observation[], playerId?: string) {
  const passes = observations.filter(o => o.kind === "pass" && o.team === "us" && (!playerId || o.actorId === playerId));
  return { attempts: passes.length, completed: passes.filter(o => o.facts.outcome === "complete").length };
}
const noOverflow = (page: Page) => page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth + 1);
/** The row «Total del Piti» of «Todos los números, a tu medida» (its first column after the name). */
const totalOf = (workspace: Locator, column: number) => workspace.getByRole("row", { name: /^Total del Piti/ }).getByRole("cell").nth(column);
async function openTable(page: Page) {
  await page.getByRole("button", { name: /^Todos los números, a tu medida/ }).click();
  const workspace = page.getByRole("region", { name: "Todos los números, a tu medida" });
  await expect(workspace).toBeVisible();
  await workspace.getByRole("button", { name: "Pases y creación", exact: true }).click();
  return workspace;
}
async function pickInScope(page: Page, name: RegExp) {
  await page.getByRole("button", { name: /^Qué números ver/ }).click();
  const sheet = page.getByRole("dialog", { name: "Qué números ver" });
  await sheet.getByRole("button", { name }).click();
  await sheet.getByRole("button", { name: "Ver los números" }).click();
}

test("Números · El juego: De un vistazo, la tabla de trabajo con su total, los filtros y el móvil sin desbordamientos", async ({ page, baseURL }, testInfo) => {
  test.setTimeout(100_000);
  expect(new URL(baseURL!).hostname).toBe("127.0.0.1");
  if (readOnlyDemo) expect(new URL(baseURL!).port).toBe("3102");
  const f = await fixture();
  try {
    // The full analysis lives in Números: the match's Números screen opens El juego with this match selected.
    await page.goto(`/partidos/${f.id}/numeros`);
    await page.getByRole("link", { name: "Abrir el análisis en Números" }).click();
    await expect(page).toHaveURL(/\/numeros\/juego\?/);
    expect(new URL(page.url()).searchParams.get("partidos")).toBe(f.id);
    const all = sample(f.observations);
    // De un vistazo: the team's figures, the narrated ones «Parcial»
    const cards = page.getByRole("list", { name: "Indicadores de la selección" });
    await expect(cards.getByRole("button")).toHaveCount(16);
    const attempts = cards.getByRole("button", { name: /Pases intentados/ });
    await expect(attempts.locator(".nu-fig__v")).toHaveText(String(all.attempts));
    await expect(attempts.locator(".nu-fig__st")).toHaveText("Parcial");
    // Quién conecta con quién: the pair that most often finds each other
    await expect(page.locator(".nu-conn li").first()).toContainText("Pablo E2E → Dani");
    // The workspace grows in place with its own address; its total row is the narrated total
    const workspace = await openTable(page);
    await expect(page).toHaveURL(/\/numeros\/juego\/tabla\?/);
    const rows = workspace.locator(".nu-ws__r:not(.nu-ws__r--h):not(.nu-ws__r--f)");
    await expect(rows).toHaveCount(f.participantCount);
    await expect(totalOf(workspace, 1)).toHaveText(String(all.attempts));
    await expect(totalOf(workspace, 2)).toHaveText(String(all.completed));
    await workspace.screenshot({ path: testInfo.outputPath("analysis-table-1440.png") });
    await workspace.getByRole("button", { name: "Cerrar" }).click();

    if (f.other) {
      // another match of the period, picked in «Qué números ver», adds its pass
      await pickInScope(page, new RegExp(f.other.rival));
      expect(new URL(page.url()).searchParams.get("partidos")).toBe(`${f.id},${f.other.id}`);
      await expect(attempts.locator(".nu-fig__v")).toHaveText(String(all.attempts + 1));
      await pickInScope(page, new RegExp(f.other.rival));
    }
    // a player picked: the tables show him, the team's figures keep everyone
    await pickInScope(page, new RegExp(`^\\d+\\s*${f.player.name}$`));
    const one = await openTable(page);
    await expect(one.locator(".nu-ws__r:not(.nu-ws__r--h):not(.nu-ws__r--f)")).toHaveCount(1);
    await expect(totalOf(one, 1)).toHaveText(String(sample(f.observations, f.player.id).attempts));
    // the address keeps the screen and the selection
    await page.reload();
    const again = page.getByRole("region", { name: "Todos los números, a tu medida" });
    await again.getByRole("button", { name: "Pases y creación", exact: true }).click();
    await expect(totalOf(again, 1)).toHaveText(String(sample(f.observations, f.player.id).attempts));
    await page.getByRole("region", { name: "Todos los números, a tu medida" }).getByRole("button", { name: "Cerrar" }).click();
    // by halves only goals and cards are counted: the narrated figures say so instead of a wrong number
    await page.getByRole("radiogroup", { name: "Parte" }).getByRole("radio", { name: "2ª parte" }).click();
    expect(new URL(page.url()).searchParams.get("parte")).toBe("2");
    await expect(attempts.locator(".nu-fig__v")).toHaveText("–");
    await expect(attempts).toContainText("Por partes, solo goles y tarjetas");

    for (const viewport of [{ width: 1440, height: 1050 }, { width: 375, height: 812 }]) {
      await page.setViewportSize(viewport);
      await cards.scrollIntoViewIfNeeded();
      expect(await noOverflow(page)).toBe(true);
      await cards.screenshot({ path: testInfo.outputPath(`analysis-cards-${viewport.width}.png`) });
    }
    // A play's match opens from a figure's card: «Goles marcados» lists them; this match has none
    await page.getByRole("radiogroup", { name: "Parte" }).getByRole("radio", { name: "Todo" }).click();
    await cards.getByRole("button", { name: /Goles marcados/ }).click();
    const sheet = page.getByRole("dialog", { name: /Goles/ });
    await expect(sheet).toBeVisible();
    await expect(sheet).toContainText("Sin jugadas que mostrar en este período.");
    await expect.poll(() => new URL(page.url()).searchParams.get("metrica")).toBe("015");
  } finally { await f.cleanup(); }
});
