import { expect, test } from '@playwright/test';
import { callFunction, emulatorAdminToken, enterVestuario } from './helpers';
import { DEFAULT_ANALYSIS_PROFILE } from '../functions/src/narrated/types';

const base = 'http://127.0.0.1:8080/v1/projects/demo-manchester-piti/databases/(default)/documents';
function value(data: unknown): unknown {
  if (typeof data === 'string') return { stringValue: data };
  if (typeof data === 'number') return { integerValue: String(data) };
  if (Array.isArray(data)) return { arrayValue: { values: data.map(value) } };
  return { mapValue: { fields: Object.fromEntries(Object.entries(data as object).map(([key, v]) => [key, value(v)])) } };
}
async function ownDocument(path: string, data?: Record<string, unknown>) {
  if (!path.split('/')[1]?.startsWith('narrated-crud-')) throw new Error('Solo fixtures propios.');
  const response = await fetch(`${base}/${path}`, { method: data ? 'PATCH' : 'DELETE', headers: { authorization: 'Bearer owner', 'content-type': 'application/json' }, ...(data ? { body: JSON.stringify({ fields: Object.fromEntries(Object.entries(data).map(([key, v]) => [key, value(v)])) }) } : {}) });
  if (!response.ok && response.status !== 404) throw new Error(await response.text());
}

test('el administrador corrige, añade y borra detalles de un acta publicada y conserva las fuentes originales', async ({ page }, testInfo) => {
  test.setTimeout(120000);
  const prefix = `narrated-crud-${Date.now()}`, matchId = `${prefix}-match`, seasonId = `${prefix}-season`, ids = Array.from({ length: 8 }, (_, i) => `${prefix}-p${i}`);
  const token = await emulatorAdminToken();
  const quote = 'Cita original privada: cambio en el minuto dos.';
  const savedNumbers = async () => {
    const response = await fetch(`${base}/matches/${matchId}`, { headers: { authorization: 'Bearer owner' } });
    const fields = (await response.json()).fields;
    const rows = fields.ledger.mapValue.fields;
    return { minutes: Number(rows[ids[0]].mapValue.fields.minutes.integerValue ?? rows[ids[0]].mapValue.fields.minutes.doubleValue), passes: Number(rows[ids[1]].mapValue.fields.passesCompleted?.integerValue ?? 0) };
  };
  try {
    await ownDocument(`seasons/${seasonId}`, { name: 'Prueba local de edición', title: 'Prueba local de edición' });
    await Promise.all(ids.map((id, i) => ownDocument(`players/${id}`, { firstName: `Jugador ${i + 1}`, lastName: 'Edición', number: i + 1, seasons: [seasonId] })));
    await callFunction(token, 'saveMatchSheet', { id: matchId, sources: [{ id: 'original', quote }], sheet: {
      version: 2, revision: 0, seasonId, rival: 'Rival de prueba CRUD', competition: 'Prueba local', date: Date.now() - 86400000, duration: 50, durationSeconds: 3000, home: true, venue: 'Local', status: 'finished', starters: ids.slice(0, 7), bench: [ids[7]], notCalled: [], goalsFor: 0, goalsAgainst: 0, report: '',
      events: [{ id: 'sub', type: 'substitution', minute: 2, elapsedSeconds: 120, playerId: ids[0], inPlayerId: ids[7] }],
      analysis: { version: 2, revision: 0, profile: DEFAULT_ANALYSIS_PROFILE, coverage: [], observations: [{ id: 'detail-sub', canonicalEventId: 'sub', kind: 'substitution', team: 'us', actorId: ids[0], order: 1, time: { from: 120, to: 120, precision: 'exact' }, facts: { inPlayerId: ids[7] }, provenance: { time: { kind: 'explicit', sourceId: 'original' } } }] },
    } });
    await enterVestuario(page);
    await page.goto(`/admin/partidos/${matchId}?tab=acta`);
    await page.getByRole('button', { name: 'Editar detalle', exact: true }).click();
    await page.getByLabel('Desde (segundos)', { exact: true }).fill('180');
    await page.getByRole('button', { name: 'Guardar detalle', exact: true }).click();
    await page.getByRole('button', { name: 'Añadir detalle', exact: true }).click();
    await page.getByRole('combobox', { name: 'Autor del detalle', exact: true }).selectOption(ids[1], { timeout: 10000 });
    await page.getByRole('combobox', { name: 'Receptor del detalle', exact: true }).selectOption(ids[2], { timeout: 10000 });
    await page.getByLabel('Desde (segundos)', { exact: true }).fill('240');
    await page.setViewportSize({ width: 1440, height: 1000 });
    await page.getByRole('group', { name: 'Editar observación' }).scrollIntoViewIfNeeded();
    await page.screenshot({ path: testInfo.outputPath('narrated-admin-desktop.png') });
    // The form is still unapplied: rotating must preserve its local values and the acta buffer.
    await page.setViewportSize({ width: 390, height: 844 });
    await expect(page.locator('.vx.adm')).toHaveClass(/\bm\b/);
    await expect(page.getByRole('group', { name: 'Editar observación' })).toBeVisible();
    await expect(page.getByRole('combobox', { name: 'Autor del detalle', exact: true })).toHaveValue(ids[1]);
    await expect(page.getByRole('combobox', { name: 'Receptor del detalle', exact: true })).toHaveValue(ids[2]);
    await expect(page.getByLabel('Desde (segundos)', { exact: true })).toHaveValue('240');
    await page.getByRole('group', { name: 'Editar observación' }).scrollIntoViewIfNeeded();
    await page.screenshot({ path: testInfo.outputPath('narrated-admin-rotation-mobile.png') });
    await page.setViewportSize({ width: 1440, height: 1000 });
    await expect(page.locator('.vx.adm')).toHaveClass(/\bd\b/);
    await expect(page.getByRole('group', { name: 'Editar observación' })).toBeVisible();
    await expect(page.getByRole('combobox', { name: 'Autor del detalle', exact: true })).toHaveValue(ids[1]);
    await expect(page.getByRole('combobox', { name: 'Receptor del detalle', exact: true })).toHaveValue(ids[2]);
    await expect(page.getByLabel('Desde (segundos)', { exact: true })).toHaveValue('240');
    await page.getByRole('button', { name: 'Guardar detalle', exact: true }).click();
    await page.getByRole('button', { name: 'Editar cobertura y reglas', exact: true }).click();
    await page.getByRole('button', { name: 'Añadir cobertura', exact: true }).click();
    await page.getByRole('combobox', { name: 'Cobertura 1', exact: true }).selectOption('complete');
    await page.getByLabel('Inicio del tramo 1', { exact: true }).fill('0');
    await page.getByLabel('Final del tramo 1', { exact: true }).fill('3000');
    await page.getByRole('button', { name: 'Guardar cobertura y reglas', exact: true }).click();
    await page.getByRole('button', { name: 'Guardar cambios', exact: true }).click();
    await expect.poll(savedNumbers).toEqual({ minutes: 3, passes: 1 });
    await page.reload();
    await expect(page.getByRole('heading', { name: '2 observaciones del análisis' })).toBeVisible();
    await page.setViewportSize({ width: 390, height: 844 });
    await page.reload();
    await page.locator('.ae-review-events > li').filter({ has: page.getByText('Pase', { exact: true }) }).getByRole('button', { name: 'Editar detalle' }).click();
    await expect(page.getByRole('group', { name: 'Editar observación' })).toBeVisible();
    await page.getByRole('group', { name: 'Editar observación' }).scrollIntoViewIfNeeded();
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth + 1)).toBe(true);
    await page.screenshot({ path: testInfo.outputPath('narrated-admin-mobile.png') });
    await page.getByRole('group', { name: 'Editar observación' }).getByRole('button', { name: 'Cancelar', exact: true }).click();
    await page.setViewportSize({ width: 1440, height: 1000 });
    await page.reload();
    await page.getByText('Historial privado de fuentes', { exact: true }).click();
    await page.getByRole('button', { name: 'Consultar historial privado' }).click();
    await page.locator('.ae-history details').filter({ hasText: '1 fuentes' }).first().locator('summary').click();
    await expect(page.getByText(quote, { exact: true })).toBeVisible();
    await page.goto(`/matches/${matchId}?tab=estadisticas`);
    await expect(page.getByRole('button', { name: /^Total .*: Pases intentados,/ }).locator('strong')).toHaveText('1');
    await page.goto(`/admin/partidos/${matchId}?tab=acta`);
    const pass = page.locator('.ae-review-events > li').filter({ has: page.getByText('Pase', { exact: true }) });
    await pass.getByRole('button', { name: /^Borrar detalle/ }).click();
    await page.getByRole('button', { name: 'Guardar cambios', exact: true }).click();
    await expect.poll(savedNumbers).toEqual({ minutes: 3, passes: 0 });
    await page.reload();
    await expect(page.getByRole('heading', { name: '1 observaciones del análisis' })).toBeVisible();
    await page.goto(`/matches/${matchId}?tab=estadisticas`);
    await expect(page.getByRole('button', { name: /^Total .*: Pases intentados,/ }).locator('strong')).toHaveText('0');
  } catch (error) {
    console.error('Fallo previo a la limpieza de la fixture:', error);
    throw error;
  } finally {
    try { await callFunction(token, 'deleteMatch', { id: matchId }); }
    finally { await Promise.all(ids.map(id => ownDocument(`players/${id}`))); await ownDocument(`seasons/${seasonId}`); }
  }
});
