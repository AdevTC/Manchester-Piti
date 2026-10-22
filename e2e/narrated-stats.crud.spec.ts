import { expect, test } from "@playwright/test";
import type { AnalysisProfile, Observation } from "../functions/src/narrated/types";
import { callFunction, emulatorAdminToken, enterVestuario } from "./helpers";

const localDocuments = "http://127.0.0.1:8080/v1/projects/demo-manchester-piti/databases/(default)/documents";
function firestoreValue(data: unknown): unknown {
  if (typeof data === "string") return { stringValue: data };
  if (typeof data === "number") return { integerValue: String(data) };
  if (Array.isArray(data)) return { arrayValue: { values: data.map(firestoreValue) } };
  return { mapValue: { fields: Object.fromEntries(Object.entries(data as object).map(([key, value]) => [key, firestoreValue(value)])) } };
}
async function ownFixture(path: string, data?: Record<string, unknown>) {
  if (!/^(players|seasons)\/narrated-ui-/.test(path)) throw new Error("Solo fixtures propios del emulador.");
  const response = await fetch(`${localDocuments}/${path}`, {
    method: data ? "PATCH" : "DELETE",
    headers: { authorization: "Bearer owner", "content-type": "application/json" },
    ...(data ? { body: JSON.stringify({ fields: Object.fromEntries(Object.entries(data).map(([key, value]) => [key, firestoreValue(value)])) }) } : {}),
  });
  if (!response.ok && response.status !== 404) throw new Error(await response.text());
}

/** These own fixtures are created only by helpers hardcoded to loopback demo emulators. */
test("importar v2 conserva el acta, publica sus gráficos y comparte los filtros de Números", async ({ page }, testInfo) => {
  test.setTimeout(90_000);
  const token = await emulatorAdminToken();
  const stamp = Date.now();
  const id = `narrated-ui-${stamp}`, otherId = `narrated-ui-other-${stamp}`;
  const seasonId = `narrated-ui-season-${stamp}`;
  const rival = `Narración E2E ${stamp}`, otherRival = `Otra muestra E2E ${stamp}`;
  const players = Array.from({ length: 10 }, (_, i) => `narrated-ui-${stamp}-player-${i}`);
  const names = ["Álex", "Dani", "Marcos", "Pablo", "Sergio", "David", "Mario", "Hugo", "Lucas", "Nico"].map(name => `${name} ${stamp}`);
  const base = {
    version: 2, revision: 0, seasonId, competition: "Amistoso", date: stamp - 7 * 86400000,
    duration: 50, durationSeconds: 3000, venue: "Campo de prueba", home: true, status: "finished",
    starters: players.slice(0, 7), bench: players.slice(7), notCalled: [],
    events: [{ id: "preserved-goal", type: "goal", playerId: players[6], assistPlayerId: players[3], assistReviewed: true, minute: 20 }],
    goalsFor: 1, goalsAgainst: 0, report: "Acta de prueba de importación de estadísticas.",
  };
  const privateQuote = "FRAGMENTO_PRIVADO_E2E Marcos se la entrega a Pablo sin presión.";
  const created: string[] = [];
  try {
    await ownFixture(`seasons/${seasonId}`, { name: `Temporada de prueba ${stamp}` });
    await Promise.all(players.map((playerId, index) => ownFixture(`players/${playerId}`, { firstName: names[index], shirtName: names[index], number: index + 1, seasons: [seasonId] })));
    await callFunction(token, "saveMatchSheet", { id, draft: true, sheet: { ...base, rival } });
    created.push(id);
    await callFunction(token, "saveMatchSheet", { id: otherId, draft: false, sheet: { ...base, rival: otherRival, date: stamp - 8 * 86400000, events: [...base.events, { id: "other-pass", type: "pass", playerId: players[2], receiverId: players[3], minute: 5, period: 1, outcome: "complete" }] } });
    created.push(otherId);
    await enterVestuario(page);
    await page.goto(`/admin/partidos/${id}?tab=acta`);
    const editor = page.getByRole("region", { name: "Análisis detallado del acta" });
    await expect(editor).toBeVisible();
    await editor.getByText("Importar análisis de una narración", { exact: true }).click();
    await editor.getByRole("button", { name: "Copiar prompt y contexto" }).click();
    const context = JSON.parse(await editor.getByLabel("Contexto del partido (solo lectura)").inputValue()) as { format: string; matchId: string; baseRevision: number; profile: AnalysisProfile; existingAnalysis?: { revision: number } };
    expect(context.format).toBe("piti-context/v2");
    const observations: Observation[] = [
      { id: "rich-pass-1", kind: "pass", team: "us", actorId: players[2], receiverId: players[3], order: 1, period: 1, time: { from: 330, to: 330, precision: "exact" }, facts: { outcome: "complete", underPressure: false }, provenance: { outcome: { kind: "explicit", sourceId: "private-source" } } },
      { id: "rich-pass-2", kind: "pass", team: "us", actorId: players[3], intendedReceiverId: players[2], order: 2, period: 2, time: { from: 1630, to: 1630, precision: "exact" }, facts: { outcome: "failed" } },
      { id: "rich-recovery", kind: "recovery", team: "us", actorId: players[2], order: 3, period: 2, time: { from: 1640, to: 1640, precision: "exact" }, facts: {} },
    ];
    const bundle = { format: "piti-actions/v2", matchId: context.matchId, baseRevision: context.baseRevision, events: [], coverage: "partial", sources: [{ id: "private-source", quote: privateQuote }], analysis: { version: 2, revision: context.existingAnalysis?.revision ?? 0, profile: context.profile, observations, coverage: [{ family: "pass", team: "us", state: "complete" }] } };
    await editor.getByLabel("Análisis estructurado").fill(JSON.stringify(bundle));
    await editor.getByRole("button", { name: "Revisar importación" }).click();
    const review = editor.getByRole("region", { name: "Revisión de la importación" });
    await expect(review.getByRole("region", { name: "Observaciones detalladas" })).toContainText("3 observaciones del análisis");
    await review.getByRole("button", { name: "Incorporar al borrador" }).click();
    await expect(editor.getByText("Análisis incorporado al borrador. Revisa y publica el acta para actualizar la web.")).toBeVisible();
    await expect(editor.getByRole("region", { name: "Observaciones detalladas" })).toContainText("3 observaciones del análisis");
    await page.locator(".det .df").getByRole("button", { name: "Publicar acta", exact: true }).click();
    await expect(page.getByRole("region", { name: "Acta publicada", exact: true })).toBeVisible();

    await page.goto(`/partidos/${id}/numeros`);
    // The canonical goal survives an observations-only import, while the new passes reach the graphs.
    await expect(page.getByRole("status", { name: "Resultado: 1 a 0" })).toBeVisible();
    const technical = page.getByRole("region", { name: "Estadísticas detalladas" });
    await expect(technical.getByRole("heading", { name: "La red de pases" })).toBeVisible();
    await expect(technical.getByRole("button", { name: `Ver 1 pases de ${names[2]} a ${names[3]}` })).toBeVisible();
    await expect(page.locator("body")).not.toContainText(privateQuote);
    await page.getByRole("button", { name: "Catálogo de estadísticas" }).click();
    await page.getByRole("searchbox", { name: "Buscar estadística" }).fill("Pases intentados");
    await page.getByRole("list", { name: "Estadísticas del catálogo" }).getByRole("button", { name: /Pases intentados/ }).click();
    const detail = page.getByRole("region", { name: "Pases intentados", exact: true });
    await expect(detail.locator(".an-detail__value")).toContainText("2 acciones");
    await expect(detail.getByRole("region", { name: "Jugadas que sustentan la estadística" }).getByRole("listitem")).toHaveCount(2);
    await expect(detail).toContainText(`Pase · ${names[2]} → ${names[3]}`);
    await expect(detail).not.toContainText(privateQuote);

    await page.getByRole("link", { name: "Abrir esta selección en Números ↗" }).click();
    await expect(page).toHaveURL(/\/numeros\/juego(\/catalogo)?\?/);
    await expect(page.getByRole("region", { name: "Pases intentados", exact: true }).locator(".an-detail__value")).toContainText("2 acciones");
    expect(new URL(page.url()).searchParams.get("partidos")).toBe(id);
    await page.locator("summary[aria-label='Filtrar partidos']").click();
    await page.getByRole("checkbox", { name: new RegExp(otherRival) }).check();
    await expect(page.getByRole("region", { name: "Pases intentados", exact: true }).locator(".an-detail__value")).toContainText("3 acciones");
    expect(JSON.parse(new URL(page.url()).searchParams.get("matches") ?? "[]")).toEqual([id, otherId]);
    await page.locator("summary[aria-label='Filtrar jugadores']").click();
    await page.getByRole("checkbox", { name: names[2], exact: true }).check();
    await expect(page.getByRole("region", { name: "Pases intentados", exact: true }).locator(".an-detail__value")).toContainText("2 acciones");
    expect(JSON.parse(new URL(page.url()).searchParams.get("players") ?? "[]")).toEqual([players[2]]);
    await page.reload();
    await expect(page.getByRole("region", { name: "Pases intentados", exact: true }).locator(".an-detail__value")).toContainText("2 acciones");
    const downloadReady = page.waitForEvent("download");
    await page.getByRole("button", { name: "Exportar selección JSON" }).click();
    const download = await downloadReady;
    expect(download.suggestedFilename()).toMatch(/^piti-estadisticas-.*\.json$/);
    const stream = await download.createReadStream();
    const chunks: Buffer[] = [];
    for await (const chunk of stream!) chunks.push(Buffer.from(chunk));
    const exportedText = Buffer.concat(chunks).toString("utf8");
    const exported = JSON.parse(exportedText);
    expect(exportedText).not.toContain(privateQuote);
    expect(exportedText).not.toContain('"sourceRef"');
    expect(exported.metadata.matchIds).toEqual(expect.arrayContaining([id, otherId]));
    expect(exported.filters.playerIds).toEqual([players[2]]);
    expect(exported.results.find((metric: { id: string }) => metric.id === "067").value).toBe(2);
    expect(exported.matches.find((match: { id: string }) => match.id === id).analysis.observations).toHaveLength(3);
    await page.setViewportSize({ width: 1440, height: 1050 });
    await page.getByRole("region", { name: "Análisis de las jugadas" }).screenshot({ path: testInfo.outputPath("narrated-catalog-desktop.png") });
    await page.setViewportSize({ width: 390, height: 844 });
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true);
    await page.getByRole("region", { name: "Análisis de las jugadas" }).screenshot({ path: testInfo.outputPath("narrated-catalog-mobile.png") });
    await page.getByRole("button", { name: "Resumen del juego" }).click();
    const workspace = page.getByRole("region", { name: "Todos los números, a tu medida" });
    await expect(workspace.getByRole("table", { name: "Estadísticas por jugador" })).toContainText(names[2]);
    await expect(page.getByLabel("Gráficas de la selección")).toBeVisible();
  } finally {
    try {
      for (const createdId of created) await callFunction(token, "deleteMatch", { id: createdId });
    } finally {
      await Promise.all(players.map(playerId => ownFixture(`players/${playerId}`)));
      await ownFixture(`seasons/${seasonId}`);
    }
  }
});
