import { execFileSync } from 'node:child_process';
import { test, expect, type Page } from '@playwright/test';
import { enterVestuario } from './helpers';
test.beforeAll(()=>execFileSync(process.execPath,['functions/test/seed-postmatch.mjs'],{stdio:'inherit'}));
test.afterAll(()=>{
  execFileSync(process.execPath,['functions/test/seed-postmatch.mjs','--cleanup'],{stdio:'inherit'});
  execFileSync(process.execPath,['functions/test/seed-preview.mjs'],{stdio:'inherit'});
});

/** A block of the match's Vestuario screen, unfolded when it sits under «Ver todo». */
async function vestuarioBlock(page:Page,name:string){
  const block=page.getByRole('region',{name,exact:true});
  const more=page.locator('.ves-more').getByRole('button',{name:'Ver todo'});
  await expect(block.or(more).first()).toBeVisible();
  if(!(await block.isVisible())) await more.click();
  await expect(block).toBeVisible();
  return block;
}

test('resumen personal en el vestuario del partido y cobertura sin confundir ceros con ausencias',async({page},testInfo)=>{
  await enterVestuario(page);
  await page.goto('/partidos/preview-balance/vestuario');
  // «Tu partido»: the minutes from the acta and the porra's points (2–0 with Mario and Pablo's assist)
  const summary=await vestuarioBlock(page,'Tu partido');
  await expect(summary.locator('.vd-count').filter({hasText:'minutos'}).locator('b')).toHaveText('50′');
  await expect(summary.locator('.vd-count').filter({hasText:'puntos de porra'}).locator('b')).toHaveText('16');
  await page.setViewportSize({width:390,height:844});
  await expect.poll(()=>page.evaluate(()=>document.documentElement.scrollWidth<=window.innerWidth)).toBe(true);
  await summary.scrollIntoViewIfNeeded();await page.screenshot({path:testInfo.outputPath('postmatch-mobile.png')});
  // The analysis lives in Números: the match's Números screen opens it for this match.
  await page.goto('/partidos/preview-balance/numeros');
  await page.getByRole('link',{name:'Abrir el análisis en Estadísticas'}).click();
  await expect(page).toHaveURL(/\/estadisticas\/juego\?/);
  // Coverage belongs to each figure: one recorded pass is partial; a figure the acta never narrated says «–».
  const cards=page.getByRole('list',{name:'Indicadores de la selección'});
  const attempts=cards.getByRole('button',{name:/Pases intentados/});
  await expect(attempts.locator('.nu-fig__v')).toHaveText('1');
  await expect(attempts.locator('.nu-fig__st')).toHaveText('Parcial');
  await attempts.click();
  const detail=page.getByRole('dialog',{name:/Pases intentados/});
  await expect(detail.locator('.nu-mt__v b')).toHaveText('1');
  await expect(detail.locator('.nu-mt__v')).toContainText('Parcial');
  await expect(detail.locator('.nu-ev').getByRole('listitem')).toHaveCount(1);
  await page.screenshot({path:testInfo.outputPath('coverage-mobile.png')});
  // The previous acta explicitly covers the whole game: here no passes really is zero, a number and not «–».
  await page.goto('/estadisticas/juego?temporada=todas&partidos=preview-balance-previous');
  await expect(attempts.locator('.nu-fig__v')).toHaveText('0');
});

// (the boards dropped «+20′ respecto a tu anterior partido» from «Tu partido»; «Tu recorrido en la porra» is on Mi
// página, /perfil#porra: a player's at the end of Temporada, reached from «Lo tuyo en el vestuario › Tu porra»)
test('historial mensual de la porra en Mi página',async({page},testInfo)=>{
  await enterVestuario(page);
  await page.goto('/perfil#porra');
  await expect(page).toHaveURL(/\/perfil\/temporada#porra$/);
  await expect(page.getByRole('heading',{name:'16 puntos esta temporada'})).toBeVisible();
  await page.goto('/perfil/temporada');
  await page.getByRole('button',{name:/^Tu porra/}).click();
  await expect(page.getByRole('heading',{name:'16 puntos esta temporada'})).toBeVisible();
  await page.getByLabel('Periodo de la porra').selectOption('2026-09');
  await expect(page.getByRole('heading',{name:'0 puntos este mes'})).toBeVisible();
  await expect(page.getByRole('cell',{name:'Sin apuesta',exact:true})).toBeVisible();
  await page.setViewportSize({width:390,height:844});
  await expect.poll(()=>page.evaluate(()=>document.documentElement.scrollWidth<=window.innerWidth)).toBe(true);
  await page.getByLabel('Periodo de la porra').selectOption('');
  await page.locator('.ph-history').scrollIntoViewIfNeeded();await page.screenshot({path:testInfo.outputPath('history-mobile.png')});
});

test('la mesa: «Gol del Piti» con su goleador llega una sola vez al partido (live-<requestId>)',async({page})=>{
  test.setTimeout(60000);
  await enterVestuario(page);
  const requests: { action: string; requestId?: string; event?: { type: string; playerId?: string } }[] = [];
  page.on('request', request => {
    if (request.method() === 'POST' && new URL(request.url()).pathname.endsWith('/liveEvent')) requests.push(request.postDataJSON().data);
  });
  await page.goto('/partidos/preview-bench/mesa');
  // (r12: the goal counts at one tap; then the pitch asks «¿Quién marcó?» and his shirt answers)
  await page.getByRole('button',{name:/^Gol del Piti/}).click();
  await expect(page.getByText('¿Quién marcó?')).toBeVisible();
  await page.getByRole('button',{name:/^mario\b.*: marcó él$/i}).click();
  await expect.poll(()=>requests.filter(r=>r.action==='add').length).toBeGreaterThan(0);
  const add=requests.find(r=>r.action==='add')!;
  expect(add).toMatchObject({action:'add',event:{type:'goal'}});
  expect(add.requestId).toBeTruthy();
  const plays=async()=>{
    const stored=await page.request.get('http://127.0.0.1:8080/v1/projects/demo-manchester-piti/databases/(default)/documents/matches/preview-bench');
    expect(stored.ok()).toBe(true);
    const events=((await stored.json()).fields.events.arrayValue.values ?? []) as {mapValue:{fields:{id:{stringValue:string};playerId?:{stringValue:string}}}}[];
    return events.filter(event=>event.mapValue.fields.id.stringValue===`live-${add.requestId}`);
  };
  await expect.poll(async()=>(await plays()).length).toBe(1);
  // (the scorer reaches that same play, in its add or as its edit)
  await expect.poll(async()=>(await plays())[0]?.mapValue.fields.playerId?.stringValue).toBe('improvement-player-6');
  // (a retry of the same play keeps its requestId: still once after the queue settles and a reload)
  await page.reload();
  await expect(page.getByRole('button',{name:/^Gol del Piti/})).toBeVisible();
  expect((await plays()).length).toBe(1);
});
