import { expect, test } from '@playwright/test';
import { DEFAULT_ANALYSIS_PROFILE } from '../functions/src/narrated/types';
import { callFunction, emulatorAdminToken, enterVestuario } from './helpers';

const documents = 'http://127.0.0.1:8080/v1/projects/demo-manchester-piti/databases/(default)/documents';
function firestoreValue(value: unknown): unknown {
  if (typeof value === 'string') return { stringValue: value };
  if (typeof value === 'number') return { integerValue: String(value) };
  if (Array.isArray(value)) return { arrayValue: { values: value.map(firestoreValue) } };
  return { mapValue: { fields: Object.fromEntries(Object.entries(value as object).map(([key, item]) => [key, firestoreValue(item)])) } };
}
async function ownFixture(path: string, value?: Record<string, unknown>) {
  if (!/^(players|seasons)\/narration-draft-/.test(path)) throw new Error('Solo fixtures propios del emulador.');
  const response = await fetch(`${documents}/${path}`, {
    method: value ? 'PATCH' : 'DELETE', headers: { authorization: 'Bearer owner', 'content-type': 'application/json' },
    ...(value ? { body: JSON.stringify({ fields: Object.fromEntries(Object.entries(value).map(([key, item]) => [key, firestoreValue(item)])) }) } : {}),
  });
  if (!response.ok && response.status !== 404) throw new Error(await response.text());
}

test('una narración con una reentrada pendiente se conserva como borrador, nunca como acta publicada', async ({ page }, testInfo) => {
  test.setTimeout(90_000);
  const prefix = `narration-draft-${Date.now()}`, matchId = `${prefix}-match`, seasonId = `${prefix}-season`;
  const players = Array.from({ length: 8 }, (_, index) => `${prefix}-player-${index}`);
  const token = await emulatorAdminToken();
  const writes: boolean[] = [];
  page.on('request', request => {
    if (request.method() === 'POST' && request.url().endsWith('/saveMatchSheet')) writes.push(request.postDataJSON().data.draft);
  });
  const events = [
    { id: 'sub', type: 'substitution', playerId: players[0], inPlayerId: players[7], minute: 1, elapsedSeconds: 60 },
    { id: 'goal', type: 'goal', playerId: players[0], minute: 3, elapsedSeconds: 180, assistReviewed: true },
  ];
  const savedDraft = async () => {
    const response = await fetch(`${documents}/matchDrafts/${matchId}`, { headers: { authorization: 'Bearer owner' } });
    if (!response.ok) throw new Error(await response.text());
    const { fields } = await response.json();
    return {
      score: Number(fields.goalsFor.integerValue),
      events: fields.events.arrayValue.values?.map((row: { mapValue: { fields: { id: { stringValue: string } } } }) => row.mapValue.fields.id.stringValue) ?? [],
      observations: fields.analysis?.mapValue.fields.observations.arrayValue.values?.length ?? 0,
    };
  };
  try {
    await ownFixture(`seasons/${seasonId}`, { name: 'Prueba de borrador con incidencias' });
    await Promise.all(players.map((id, index) => ownFixture(`players/${id}`, { firstName: `Jugador ${index + 1}`, lastName: 'Borrador', number: index + 1, seasons: [seasonId] })));
    await callFunction(token, 'saveMatchSheet', { id: matchId, draft: true, sheet: {
      version: 2, revision: 0, seasonId, rival: 'Rival de prueba de borrador', competition: 'Prueba local', date: Date.now() - 86400000,
      duration: 50, durationSeconds: 3000, home: true, venue: 'Local', status: 'finished', starters: players.slice(0, 7), bench: [players[7]], notCalled: [], goalsFor: 0, goalsAgainst: 0, report: '', events: [],
    } });
    await enterVestuario(page);
    await page.goto(`/admin/partidos/${matchId}/acta/narracion`);
    const editor = page.getByRole('region', { name: 'El análisis narrado' });
    await editor.getByLabel('O pega el análisis estructurado').fill(JSON.stringify({
      format: 'piti-actions/v2', matchId, baseRevision: 0, events,
      analysis: { version: 2, revision: 0, profile: DEFAULT_ANALYSIS_PROFILE, coverage: [], observations: [
        { id: 'detail-sub', canonicalEventId: 'sub', kind: 'substitution', team: 'us', actorId: players[0], order: 1, time: { from: 60, to: 60, precision: 'exact' }, facts: { inPlayerId: players[7] } },
        { id: 'detail-goal', canonicalEventId: 'goal', kind: 'goal', team: 'us', actorId: players[0], order: 2, time: { from: 180, to: 180, precision: 'exact' }, facts: {} },
      ] },
    }));
    // Pasting now opens review automatically, but never incorporates or publishes it.
    await expect(editor.getByRole('button', { name: 'Incorporar al acta', exact: true })).toBeDisabled();
    await expect(editor.getByRole('button', { name: 'Incorporar al borrador con incidencias', exact: true })).toBeEnabled();
    await editor.getByRole('button', { name: 'Incorporar al borrador con incidencias', exact: true }).click();
    await expect(editor.getByRole('alert')).toContainText('Minutos provisionales');
    const footer = editor.locator('.sac-foot');
    await footer.getByRole('button', { name: 'Guardar borrador', exact: true }).click();
    await expect.poll(savedDraft).toEqual({ score: 1, events: ['sub', 'goal'], observations: 2 });
    await expect(page.getByText('Borrador guardado · solo lo ven los capitanes', { exact: true })).toBeVisible();
    await page.reload();
    await expect(editor.getByRole('alert')).toContainText('Minutos provisionales');
    await footer.getByRole('button', { name: 'Ir a publicar', exact: true }).click();
    const publication = page.getByRole('region', { name: 'Publicar el acta', exact: true });
    const publish = publication.getByRole('button', { name: 'Publicar el acta', exact: true });
    await expect(publish).toHaveAttribute('aria-disabled', 'true');
    // This aria-disabled button still receives keyboard events; its handler must also refuse publication.
    await publish.focus();
    await publish.press('Enter');
    await expect(publication.getByText(/No se puede publicar todavía:/)).toBeVisible();
    await expect(page.getByRole('dialog')).toHaveCount(0);
    expect(writes).toEqual([true]);
    const publicMatch = await fetch(`${documents}/matches/${matchId}`, { headers: { authorization: 'Bearer owner' } });
    expect(publicMatch.status).toBe(404);
    await page.goto(`/admin/partidos/${matchId}/acta/narracion`);
    await editor.getByText('Ver 1 incidencias de la secuencia', { exact: true }).click();
    await expect(editor.getByRole('alert')).toContainText('el jugador no está disponible en el campo');
    await page.setViewportSize({ width: 390, height: 844 });
    await editor.getByRole('alert').scrollIntoViewIfNeeded();
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth + 1)).toBe(true);
    await page.screenshot({ path: testInfo.outputPath('borrador-con-incidencias-mobile.png') });
  } finally {
    try { await callFunction(token, 'deleteMatch', { id: matchId }); }
    finally { await Promise.all(players.map(id => ownFixture(`players/${id}`))); await ownFixture(`seasons/${seasonId}`); }
  }
});
