import { execFileSync } from 'node:child_process';
import { test, expect } from '@playwright/test';
import { enterVestuario } from './helpers';
test.beforeAll(()=>execFileSync(process.execPath,['functions/test/seed-postmatch.mjs'],{stdio:'inherit'}));
test.afterAll(()=>{
  execFileSync(process.execPath,['functions/test/seed-postmatch.mjs','--cleanup'],{stdio:'inherit'});
  execFileSync(process.execPath,['functions/test/seed-preview.mjs'],{stdio:'inherit'});
});

test('resumen personal, historial mensual y cobertura sin confundir ceros con ausencias',async({page})=>{
  await enterVestuario(page);
  await page.goto('/matches/preview-balance?tab=vestuario');
  const summary=page.getByRole('region',{name:'Tu resumen del partido'});
  await expect(summary.getByText('50′',{exact:true})).toBeVisible();
  await expect(summary.getByText('+20′ respecto a tu anterior partido')).toBeVisible();
  await expect(summary.getByText('16',{exact:true})).toBeVisible();
  await page.getByText('Historial de la porra · evolución y clasificación mensual',{exact:true}).click();
  await expect(page.getByRole('heading',{name:'16 puntos esta temporada'})).toBeVisible();
  await page.getByLabel('Periodo de la porra').selectOption('2026-09');
  await expect(page.getByRole('heading',{name:'0 puntos este mes'})).toBeVisible();
  await expect(page.getByRole('cell',{name:'Sin apuesta',exact:true})).toBeVisible();
  await page.setViewportSize({width:390,height:844});
  await expect.poll(()=>page.evaluate(()=>document.documentElement.scrollWidth<=window.innerWidth)).toBe(true);
  await summary.scrollIntoViewIfNeeded();await page.screenshot({path:'.emulator-data/postmatch-mobile.png'});
  await page.getByLabel('Periodo de la porra').selectOption('');
  await page.locator('.ph-history').scrollIntoViewIfNeeded();await page.screenshot({path:'.emulator-data/history-mobile.png'});
  await page.goto('/matches/preview-balance?tab=estadisticas');
  await expect(page.locator('.ts-coverage').getByText('Cobertura parcial',{exact:true})).toBeVisible();
  await expect(page.getByRole('table',{name:/Ordenados por/}).getByRole('cell',{name:'—',exact:true}).first()).toBeVisible();
  await page.getByRole('checkbox',{name:'Comparar solo actas completas'}).check();
  await expect(page.getByText('0 de 0 actas con narración completa · 0 acciones sin minuto.')).toBeVisible();
  await page.screenshot({path:'.emulator-data/coverage-mobile.png'});
});

test('la mesa: «Gol del Piti» con su goleador llega una sola vez al partido (live-<requestId>)',async({page})=>{
  test.setTimeout(60000);
  await enterVestuario(page);
  const requests: { action: string; requestId?: string; event?: { type: string; playerId?: string } }[] = [];
  page.on('request', request => {
    if (request.method() === 'POST' && new URL(request.url()).pathname.endsWith('/liveEvent')) requests.push(request.postDataJSON().data);
  });
  await page.goto('/matches/preview-bench/mesa');
  await page.getByRole('button',{name:'Gol del Piti',exact:true}).click();
  const sheet=page.getByRole('dialog',{name:'¿Quién marcó?'});
  await sheet.getByRole('button',{name:/Mario/}).click();
  await expect.poll(()=>requests.filter(r=>r.action==='add').length).toBeGreaterThan(0);
  const add=requests.find(r=>r.action==='add')!;
  expect(add).toMatchObject({action:'add',event:{type:'goal',playerId:'improvement-player-6'}});
  expect(add.requestId).toBeTruthy();
  const goals=async()=>{
    const stored=await page.request.get('http://127.0.0.1:8080/v1/projects/demo-manchester-piti/databases/(default)/documents/matches/preview-bench');
    expect(stored.ok()).toBe(true);
    const events=((await stored.json()).fields.events.arrayValue.values ?? []) as {mapValue:{fields:{id:{stringValue:string}}}}[];
    return events.filter(event=>event.mapValue.fields.id.stringValue===`live-${add.requestId}`).length;
  };
  await expect.poll(goals).toBe(1);
  // (a retry of the same play keeps its requestId: still once after the queue settles and a reload)
  await page.reload();
  await expect(page.getByRole('button',{name:'Gol del Piti',exact:true})).toBeVisible();
  expect(await goals()).toBe(1);
});
