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
    await page.goto(`/admin/partidos/${id}/acta/narracion`);
    // (r12: the narrated analysis is its own screen, /acta/narracion)
    const editor = page.getByRole("region", { name: "El análisis narrado", exact: true });
    await expect(editor).toBeVisible();
        await editor.getByRole("button", { name: "Copiar prompt y contexto" }).click();
    const context = JSON.parse(await editor.getByLabel("Contexto del partido (solo lectura)").inputValue()) as { format: string; matchId: string; baseRevision: number; profile: AnalysisProfile; existingAnalysis?: { revision: number } };
    expect(context.format).toBe("piti-context/v2");
    const observations: Observation[] = [
      { id: "rich-pass-1", kind: "pass", team: "us", actorId: players[2], receiverId: players[3], order: 1, period: 1, time: { from: 330, to: 330, precision: "exact" }, facts: { outcome: "complete", underPressure: false }, provenance: { outcome: { kind: "explicit", sourceId: "private-source" } } },
      { id: "rich-pass-2", kind: "pass", team: "us", actorId: players[3], intendedReceiverId: players[2], order: 2, period: 2, time: { from: 1630, to: 1630, precision: "exact" }, facts: { outcome: "failed" } },
      { id: "rich-recovery", kind: "recovery", team: "us", actorId: players[2], order: 3, period: 2, time: { from: 1640, to: 1640, precision: "exact" }, facts: {} },
    ];
    const bundle = { format: "piti-actions/v2", matchId: context.matchId, baseRevision: context.baseRevision, events: [], coverage: "partial", sources: [{ id: "private-source", quote: privateQuote }], analysis: { version: 2, revision: context.existingAnalysis?.revision ?? 0, profile: context.profile, observations, coverage: [{ family: "pass", team: "us", state: "complete" }] } };
    await editor.getByLabel("O pega el análisis estructurado").fill(JSON.stringify(bundle));
    await editor.getByRole("button", { name: "Revisar importación" }).click();
    const review = editor.getByRole("region", { name: "Revisión de la importación" });
    await expect(review.getByRole("region", { name: "Observaciones detalladas" })).toContainText("3 observaciones del análisis");
    await review.getByRole("button", { name: "Incorporar al borrador" }).click();
    await expect(page.getByText("Análisis incorporado al borrador · se guarda con el acta")).toBeVisible();
    await expect(editor.getByRole("region", { name: "Observaciones detalladas" })).toContainText("3 observaciones del análisis");
    // (only a draft so far: «Ir a publicar», then «Publicar el acta» says what it does)
    await page.locator(".ac-foot").getByRole("button", { name: "Ir a publicar", exact: true }).click();
    await page.locator(".ac-foot").getByRole("button", { name: "Publicar el acta", exact: true }).click();
    await page.getByRole("dialog", { name: /^¿Publicar el acta de la/ }).getByRole("button", { name: "Publicar el acta" }).click();
    await expect(page.getByRole("region", { name: "Después del partido", exact: true })).toBeVisible();

    await page.goto(`/partidos/${id}/numeros`);
    // The canonical goal survives an observations-only import, while the new passes reach the numbers.
    await expect(page.getByRole("img", { name: /^Manchester Piti 1, .+ 0$/ })).toBeVisible();
    // The analysis lives in Números now: the match's Números screen opens El juego with this match.
    await page.getByRole("link", { name: "Abrir el análisis en Estadísticas" }).click();
    await expect(page).toHaveURL(/\/estadisticas\/juego\?/);
    expect(new URL(page.url()).searchParams.get("partidos")).toBe(id);
    await expect(page.locator(".nu-conn").getByRole("listitem").filter({ hasText: `${names[2]} → ${names[3]}` })).toContainText("1");
    await expect(page.locator("body")).not.toContainText(privateQuote);
    // the catalogue grows in place; a statistic opens its card with its value and who did it
    await page.getByRole("button", { name: /^Catálogo de estadísticas/ }).click();
    await expect(page).toHaveURL(/\/estadisticas\/juego\/catalogo\?/);
    await page.getByRole("searchbox", { name: "Buscar estadística" }).fill("Pases intentados");
    await page.locator(".nu-cat").getByRole("button", { name: /Pases intentados/ }).first().click();
    const detail = page.getByRole("dialog", { name: /Pases intentados/ });
    await expect(detail.locator(".nu-mt__v b")).toHaveText("2");
    await expect(detail.locator(".nu-mt__v")).toContainText("Completo");
    await expect(detail.locator(".nu-ev").getByRole("listitem")).toHaveCount(2);
    await expect(detail.locator(".nu-ev")).toContainText(names[2]);
    await expect(detail).not.toContainText(privateQuote);
    await detail.getByRole("button", { name: "Cerrar" }).click();
    await page.getByRole("region", { name: "Una ficha para cada estadística" }).getByRole("button", { name: "Cerrar" }).click();

    // «Qué números ver»: both cards and tables follow the selected matches and player.
    const pick = async (name: RegExp) => {
      await page.getByRole("button", { name: /^Qué números ver/ }).click();
      const sheet = page.getByRole("dialog", { name: "Qué números ver" });
      await sheet.getByRole("button", { name }).click();
      await sheet.getByRole("button", { name: "Ver los números" }).click();
    };
    const attempts = page.getByRole("list", { name: "Indicadores de la selección" }).getByRole("button", { name: /Pases intentados/ }).locator(".nu-fig__v");
    await expect(attempts).toHaveText("2");
    await pick(new RegExp(otherRival));
    await expect(attempts).toHaveText("3");
    expect(new URL(page.url()).searchParams.get("partidos")).toBe(`${id},${otherId}`);
    await pick(new RegExp(`^\\d+\\s*${names[2]}$`));
    // (the address names him as the boards do: his name's word)
    expect(new URL(page.url()).searchParams.get("jugadores")).toBe(`marcos-${stamp}`);
    await page.reload();
    await expect(attempts).toHaveText("2");
    await page.getByRole("button", { name: /^Todos los números, a tu medida/ }).click();
    const workspace = page.getByRole("region", { name: "Todos los números, a tu medida" });
    await workspace.getByRole("button", { name: "Pases y creación", exact: true }).click();
    await expect(workspace.getByRole("row", { name: /^Total de los jugadores seleccionados/ }).getByRole("cell").nth(1)).toHaveText("2");
    await expect(workspace).toContainText(names[2]);
    await workspace.getByRole("button", { name: "Cerrar" }).click();

    // the selection exported in JSON: the matches, the filters and the figures, never the private narration
    const downloadReady = page.waitForEvent("download");
    await page.getByRole("button", { name: "Exportar la selección en JSON" }).click();
    const download = await downloadReady;
    expect(download.suggestedFilename()).toMatch(/^piti-estadisticas-.*\.json$/);
    const stream = await download.createReadStream();
    const chunks: Buffer[] = [];
    for await (const chunk of stream!) chunks.push(Buffer.from(chunk));
    const exportedText = Buffer.concat(chunks).toString("utf8");
    const exported = JSON.parse(exportedText);
    expect(exportedText).not.toContain(privateQuote);
    expect(exportedText).not.toContain('"sourceRef"');
    expect(exported.partidos.map((m: { id: string }) => m.id)).toEqual(expect.arrayContaining([id, otherId]));
    expect(exported.filtros.jugadores).toEqual([players[2]]);
    expect(String(exported.deUnVistazo.find((metric: { id: string }) => metric.id === "067").valor)).toBe("2");
    await page.setViewportSize({ width: 1440, height: 1050 });
    await page.locator(".nu-screen").screenshot({ path: testInfo.outputPath("narrated-juego-desktop.png") });
    await page.setViewportSize({ width: 390, height: 844 });
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true);
    await page.locator(".nu-screen").screenshot({ path: testInfo.outputPath("narrated-juego-mobile.png") });
  } finally {
    try {
      for (const createdId of created) await callFunction(token, "deleteMatch", { id: createdId });
    } finally {
      await Promise.all(players.map(playerId => ownFixture(`players/${playerId}`)));
      await ownFixture(`seasons/${seasonId}`);
    }
  }
});
