import { expect, test } from "@playwright/test";
import type { AnalysisProfile, Observation } from "../functions/src/narrated/types";
import { callFunction, emulatorAdminToken, enterVestuario } from "./helpers";

/** These own fixtures are created only by helpers hardcoded to loopback demo emulators. */
test("importar v2 conserva el acta, publica sus gráficos y comparte los filtros de Números", async ({ page }, testInfo) => {
  test.setTimeout(90_000);
  const token = await emulatorAdminToken();
  await callFunction(token, "requestAccess", { name: "Capitán" });
  const stamp = Date.now();
  const id = `narrated-ui-${stamp}`, otherId = `narrated-ui-other-${stamp}`;
  const rival = `Narración E2E ${stamp}`, otherRival = `Otra muestra E2E ${stamp}`;
  const players = Array.from({ length: 10 }, (_, i) => `preview-player-${i}`);
  const base = {
    version: 2, revision: 0, seasonId: "preview-season", competition: "Amistoso", date: stamp - 7 * 86400000,
    duration: 50, durationSeconds: 3000, venue: "Campo de prueba", home: true, status: "finished",
    starters: players.slice(0, 7), bench: players.slice(7), notCalled: [],
    events: [{ id: "preserved-goal", type: "goal", playerId: players[6], assistPlayerId: players[3], assistReviewed: true, minute: 20 }],
    goalsFor: 1, goalsAgainst: 0, report: "Acta de prueba de importación de estadísticas.",
  };
  const privateQuote = "FRAGMENTO_PRIVADO_E2E Marcos se la entrega a Pablo sin presión.";
  const created: string[] = [];
  try {
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

    await page.goto(`/matches/${id}?tab=estadisticas`);
    // The canonical goal survives an observations-only import, while the new passes reach the graphs.
    await expect(page.getByRole("status", { name: "Resultado: 1 a 0" })).toBeVisible();
    const technical = page.getByRole("region", { name: "Estadísticas detalladas" });
    await expect(technical.getByRole("heading", { name: "La red de pases" })).toBeVisible();
    await expect(technical.getByRole("button", { name: "Ver 1 pases de Marcos a Pablo" })).toBeVisible();
    await expect(page.locator("body")).not.toContainText(privateQuote);
    await page.getByRole("button", { name: "Catálogo de estadísticas" }).click();
    await page.getByRole("searchbox", { name: "Buscar estadística" }).fill("Pases intentados");
    await page.getByRole("list", { name: "Estadísticas del catálogo" }).getByRole("button", { name: /Pases intentados/ }).click();
    const detail = page.getByRole("region", { name: "Pases intentados", exact: true });
    await expect(detail.locator(".an-detail__value")).toContainText("2 acciones");
    await expect(detail.getByRole("region", { name: "Jugadas que sustentan la estadística" }).getByRole("listitem")).toHaveCount(2);
    await expect(detail).toContainText("Pase · Marcos → Pablo");
    await expect(detail).not.toContainText(privateQuote);

    await page.getByRole("link", { name: "Abrir esta selección en Números ↗" }).click();
    await expect(page).toHaveURL(/\/stats\?/);
    await expect(page.getByRole("region", { name: "Pases intentados", exact: true }).locator(".an-detail__value")).toContainText("2 acciones");
    expect(JSON.parse(new URL(page.url()).searchParams.get("matches") ?? "[]")).toEqual([id]);
    await page.locator("summary[aria-label='Filtrar partidos']").click();
    await page.getByRole("checkbox", { name: new RegExp(otherRival) }).check();
    await expect(page.getByRole("region", { name: "Pases intentados", exact: true }).locator(".an-detail__value")).toContainText("3 acciones");
    expect(JSON.parse(new URL(page.url()).searchParams.get("matches") ?? "[]")).toEqual([id, otherId]);
    await page.locator("summary[aria-label='Filtrar jugadores']").click();
    await page.getByRole("checkbox", { name: /^Marcos$/i }).check();
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
    await expect(page.getByRole("table", { name: "Estadísticas de los jugadores seleccionados" })).toContainText("Marcos");
    await expect(page.getByLabel("Gráficas de la selección")).toBeVisible();
  } finally {
    for (const createdId of created) await callFunction(token, "deleteMatch", { id: createdId });
  }
});
