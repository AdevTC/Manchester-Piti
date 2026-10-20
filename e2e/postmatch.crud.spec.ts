import { execFileSync } from 'node:child_process';
import { test, expect } from '@playwright/test';
import { enterVestuario } from './helpers';
test.beforeAll(()=>execFileSync(process.execPath,['functions/test/seed-postmatch.mjs'],{stdio:'inherit'}));
test.afterAll(()=>{
  execFileSync(process.execPath,['functions/test/seed-postmatch.mjs','--cleanup'],{stdio:'inherit'});
  execFileSync(process.execPath,['functions/test/seed-preview.mjs'],{stdio:'inherit'});
});

test('resumen personal, historial mensual y cobertura sin confundir ceros con ausencias',async({page},testInfo)=>{
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
  await summary.scrollIntoViewIfNeeded();await page.screenshot({path:testInfo.outputPath('postmatch-mobile.png')});
  await page.getByLabel('Periodo de la porra').selectOption('');
  await page.locator('.ph-history').scrollIntoViewIfNeeded();await page.screenshot({path:testInfo.outputPath('history-mobile.png')});
  await page.goto('/matches/preview-balance?tab=estadisticas');
  const workspace=page.getByRole('region',{name:'Todos los números, a tu medida'});
  await workspace.getByRole('group',{name:'Columnas habituales'}).getByRole('button',{name:'Pases y creación',exact:true}).click();
  const attempts=workspace.getByRole('button',{name:/^Total del Piti: Pases intentados,/});
  const failed=workspace.getByRole('button',{name:/^Total del Piti: Pases fallados,/});
  // Coverage belongs to each metric: one recorded pass is partial; no recorded miss is unknown.
  await expect(attempts.locator('strong')).toHaveText('1');
  await expect(attempts.getByText('Parcial',{exact:true})).toBeVisible();
  await expect(failed.locator('strong')).toHaveText('-');
  await expect(failed.getByText('Sin información',{exact:true})).toBeVisible();
  await attempts.click();
  const detail=page.getByRole('region',{name:'Pases intentados',exact:true});
  await expect(detail.locator('.an-detail__value')).toContainText('1 acciones');
  await expect(detail.locator('.an-detail__value')).toContainText('Parcial');
  await expect(detail.getByRole('region',{name:'Jugadas que sustentan la estadística'}).getByRole('listitem')).toHaveCount(1);
  await page.screenshot({path:testInfo.outputPath('coverage-mobile.png')});
  // The previous acta explicitly covers the whole game: here no passes really is zero.
  await page.goto('/matches/preview-balance-previous?tab=estadisticas');
  await workspace.getByRole('group',{name:'Columnas habituales'}).getByRole('button',{name:'Pases y creación',exact:true}).click();
  await expect(attempts.locator('strong')).toHaveText('0');
  await expect(attempts).toHaveAccessibleName(/Completo/);
  await expect(failed.locator('strong')).toHaveText('0');
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
