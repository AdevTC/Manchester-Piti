/** Reproduce the metadata from the read-only workbook extraction, without inventing calculations. */
import { readFileSync, writeFileSync, mkdirSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { createHash } from 'node:crypto';

const input = resolve(process.argv[2] ?? '.emulator-data/audio-catalog.json');
const raw = readFileSync(input, 'utf8');
const workbook = JSON.parse(raw);
const rows = (sheet) => workbook[sheet].map((cells, i) => ({ cells, source: { sheet, row: i + 1 } }));
const numbered = (sheet) => rows(sheet).filter(({ cells }) => Number.isInteger(cells[0]));
const prefixed = (prefix) => rows('Reglas de extracción').filter(({ cells }) => new RegExp(`^${prefix}\\d{2}$`).test(cells[0]));
const id = (value) => typeof value === 'number' ? String(value).padStart(3, '0') : value;
const audio = new Map(numbered('Viables solo audio').map((row) => [row.cells[0], row]));
const rules = prefixed('R').map(({ cells: r, source }) => ({ id: r[0], family: r[1], name: r[2], requirements: r[3], calculation: r[4], limitations: r[5], catalogIds: r[6], source }));
const params = prefixed('P').map(({ cells: r, source }) => ({ id: r[0], name: r[1], value: r[2], limitations: r[3], source }));
const profiles = prefixed('PC').map(({ cells: r, source }) => ({ id: r[0], key: r[1], value: r[2], explanation: r[3], source }));
const events = prefixed('E').map(({ cells: r, source }) => ({ id: r[0], name: r[1], fields: r[2], direct: r[3], derived: r[4], limitations: r[5], source }));
const schema = prefixed('S').map(({ cells: r, source }) => ({ id: r[0], name: r[1], fields: r[2], purpose: r[3], source }));
const acceptance = prefixed('T').map(({ cells: r, source }) => ({ id: r[0], name: r[1], input: r[2], expected: r[3], prohibited: r[4], source }));
const targets = (expression) => {
  const found = new Set();
  for (const m of expression.matchAll(/\b(A?\d{2,3})(?:\s*[–-]\s*(A?\d{2,3}))?\b/g)) {
    if (!m[2]) found.add(id(/^A/.test(m[1]) ? m[1] : Number(m[1])));
    else {
      const extension = m[1].startsWith('A');
      for (let n = Number(m[1].replace('A', '')); n <= Number(m[2].replace('A', '')); n++) found.add(extension ? `A${String(n).padStart(2, '0')}` : id(n));
    }
  }
  return found;
};
const ruleTargets = rules.map((rule) => ({ rule, ids: targets(rule.catalogIds) }));
const parameterRanges = {
  P01: '001–014,182,184,191,219–228,271–290,319–322,364,379–400',
  P02: '001–014,133–134,182,184–197,205,210–212,219–228,255–267,276,279,319–322,364,379–400,A01–A04,A12',
  P03: '210,A03', P04: '001–014,133–134,182,184–197,205,210–212,219–228,255–267,276,279,319–322,364,379–400,A01–A04,A12',
  P05: '210–212,A01–A04', P06: '206–210,A01–A10', P07: '165–174,201–210,A01–A10',
  P08: '067–104,114–119,124–130,190,226–228,247,289,386,399',
  P09: '067–104,114–119,124–130,190,226–228,247,289,386,399',
  P10: '067–104,114–119,124–130,190,226–228,247,289,386,399',
  P11: '185–197', P12: '133,266', P13: '205,279', P14: '105–111', P15: '087–103,122,127–130,143,145–146,178–180,190,197,204,207–208,229–250,263,267,287,317–322,325–342',
  P16: '391–400', P17: '001–400,A01–A12', P18: '001–400,A01–A12',
  P19: '067–104,114–119,124–130,190,226–228,247,289,386,399', P20: '028,105,107–109', P21: '110–111',
  P22: '104–111,133–134,147–149,178–179,185–196,201–250,255–267,279,290,335–340,397–400,A01–A10',
  P23: '275', P24: '378',
};
const parameterTargets = Object.entries(parameterRanges).map(([parameterId, range]) => ({ parameterId, ids: targets(range) }));
const links = (metricId) => ({
  ruleIds: ruleTargets.filter((r) => r.ids.has(metricId)).map((r) => r.rule.id),
  parameterIds: parameterTargets.filter((r) => r.ids.has(metricId)).map((r) => r.parameterId),
});
const metrics = numbered('Catálogo').map(({ cells: r, source }) => {
  const row = audio.get(r[0]);
  if (!row) throw new Error(`Missing audio viability: ${r[0]}`);
  const a = row.cells;
  const included = a.length === 10;
  return {
    id: id(r[0]), originalId: r[0], category: r[1], name: r[2], scope: r[3], dataRequirements: r[4], definition: r[5], method: r[6], football7Note: r[7] ?? '', references: r[8] ? String(r[8]).split(/\r?\n/).filter(Boolean) : [],
    audio: { viability: included ? (a[3] === 'Viable' ? 'viable' : 'conditional') : 'excluded', obtention: included ? a[4] : '', evidence: included ? a[5] : a[4], extraction: included ? a[6] : '', whatToNarrate: included ? a[7] : '', condition: included ? a[8] : a[5], scope: included ? a[9] : a[3], source: row.source },
    ...links(id(r[0])), source,
  };
});
for (const { cells: r, source } of prefixed('A')) {
  metrics.push({ id: r[0], originalId: null, category: r[1], name: r[2], scope: 'Según atribución y cobertura de los eventos', dataRequirements: 'E', definition: r[4], method: r[6], football7Note: '', references: [], audio: { viability: 'extension', obtention: r[6], evidence: r[3], extraction: r[4], whatToNarrate: r[3], condition: r[5], scope: 'Según atribución y cobertura de los eventos', source }, ...links(r[0]), source });
}
const counts = Object.fromEntries(['viable', 'conditional', 'excluded', 'extension'].map((v) => [v, metrics.filter((m) => m.audio.viability === v).length]));
if (metrics.length !== 412 || new Set(metrics.map((m) => m.id)).size !== 412 || counts.viable !== 98 || counts.conditional !== 211 || counts.excluded !== 91 || counts.extension !== 12 || rules.length !== 63 || params.length !== 24 || profiles.length !== 78 || events.length !== 30 || schema.length !== 8 || acceptance.length !== 16) throw new Error(`Unexpected source inventory: ${JSON.stringify(counts)}`);
const guide = rows('Guía').filter(({ cells }) => cells.some(Boolean)).map(({ cells, source }) => ({ title: cells[0] ?? '', text: cells.slice(1).filter(Boolean).join('\n'), source }));
const narrationGuide = rows('Viables solo audio').filter(({ cells, source }) => source.row > 319 && source.row < 427 && typeof cells[0] === 'string' && cells.some(Boolean)).map(({ cells, source }) => ({ title: cells[0], text: cells.slice(1).filter(Boolean).join('\n'), source }));
const header = `/** Generated by scripts/generate-audio-catalog.mjs. Definitions are not proof of implemented calculations. */
export type NarratedMetricId = string;
export type NarratedAudioViability = 'viable' | 'conditional' | 'excluded' | 'extension';
export interface NarratedCatalogSource { sheet: string; row: number }
export interface NarratedMetricDefinition {
  id: NarratedMetricId; originalId: number | null; category: string; name: string; scope: string;
  dataRequirements: string; definition: string; method: string; football7Note: string; references: string[];
  audio: { viability: NarratedAudioViability; obtention: string; evidence: string; extraction: string; whatToNarrate: string; condition: string; scope: string; source: NarratedCatalogSource };
  ruleIds: string[]; parameterIds: string[]; source: NarratedCatalogSource;
}
export const NARRATED_CATALOG_SOURCE_SHA256 = '${createHash('sha256').update(raw).digest('hex')}';
`;
const declarations = [
  ['NARRATED_METRICS', metrics, 'NarratedMetricDefinition[]'], ['NARRATED_EXTRACTION_RULES', rules], ['NARRATED_PARAMETERS', params], ['NARRATED_PROFILE_DEFAULTS', profiles], ['NARRATED_EVENT_TYPES', events], ['NARRATED_SCHEMA_REQUIREMENTS', schema], ['NARRATED_ACCEPTANCE_CASES', acceptance], ['NARRATED_CATALOG_GUIDE', guide], ['NARRATED_NARRATION_GUIDE', narrationGuide],
].map(([name, data, type]) => `export const ${name}${type ? `: ${type}` : ''} = ${JSON.stringify(data, null, 2)};`).join('\n\n');
const text = `${header}\n${declarations}\n\nexport const NARRATED_METRIC_BY_ID: ReadonlyMap<NarratedMetricId, NarratedMetricDefinition> = new Map(NARRATED_METRICS.map((metric) => [metric.id, metric]));\n`;
const write = (path, value) => { mkdirSync(dirname(path), { recursive: true }); writeFileSync(path, value.replace(/\r?\n/g, '\r\n'), 'utf8'); };
write('functions/src/narrated/catalog.ts', text);
const esc = (value) => String(value ?? '').replaceAll('|', '\\|').replace(/\r?\n/g, '<br>');
const md = [
  '# Matriz de estadísticas de narración', '',
  'Fuente: extracción íntegra del libro facilitado por el usuario. Las 400 métricas originales conservan sus IDs; A01–A12 son las 12 extensiones de la hoja «Reglas de extracción». La conversación con el asistente recibe la narración fuera de la web. La web prepara el prompt de administración e importa acciones revisables; este catálogo no incorpora captura, transcripción ni análisis de audio en la aplicación.', '',
  '**Viabilidad del método: 98 viables, 211 condicionadas, 91 excluidas y 12 extensiones.** Las 321 métricas viables, condicionadas y extensiones tienen receta en el registro ejecutable; las pruebas verifican esa correspondencia. Su resultado depende de los hechos, cobertura y parámetros exigidos en cada ficha. Las 91 excluidas conservan el motivo de no disponibilidad y no producen una cifra.', '',
  '## Contrato y límites', '',
  '- IDs estables de tres cifras (`001`–`400`) y extensiones `A01`–`A12`. Campos originales y fuente de hoja/fila conservados en `functions/src/narrated/catalog.ts`.',
  '- Eventos canónicos versionados, acción/intervención/duelo/posesión separados, actor y equipo independientes, resultado pendiente distinto de fallo, validez, cantidad, evidencia y procedencia por atributo. Un resumen agregado no fabrica eventos individuales ni se suma otra vez a acciones que ya incluye.',
  '- Cobertura por familia, equipo e intervalo. `complete`, `partial`, `unknown`, `not_configured`, `not_applicable` y `no_sample` no son intercambiables. Cero necesita cobertura suficiente; proporciones agregan numeradores y denominadores, nunca medias de porcentajes.',
  '- Reloj del partido separado del audio, precisión explícita, intervalos `[inicio, fin)`, minutos como unión de tandas excluyendo descanso/banquillo. La secuencia puede ser conocida aunque su duración no lo sea.',
  '- Resultado de pase, entrada, intercepción o despeje independiente del control posterior. Los estados de control son propio, rival, disputado, fuera y desconocido. Recuperación amplia 206 incluye balón disputado; A01–A03 exigen control rival intermedio. Recuperación rápida: 0 ≤ Δt < X, X inicial 5 s; no implica presión.',
  '- No fabricar xG, xA, xPass, coordenadas, distancias, velocidades, tracking o calificaciones de proveedores. Etiquetas tácticas y ocasión clara conservan su origen como juicio declarado.',
  '- Los enlaces `ruleIds` reproducen los rangos de la hoja. `parameterIds` son un mapa de dependencias conservador del proyecto para revisar perfiles; no sustituyen una precondición ejecutable por receta.', '',
  '## Perfil inicial que exige atención', '',
  'El perfil efectivo de la web `piti-narration`, versión 1, adapta el perfil de referencia del libro e incluye en pases los de juego abierto, centros y saques con el pie; separa banda y distribución con la mano. Desvío rival confirmado hace fallido el pase aunque un compañero recupere. Una acción intencional de primeras acredita recepción. Las cadenas de asistencia necesitan continuidad conocida y la política explícita de la hoja.', '',
  'SCA/GCA (110–111), ventanas de presión, retención (133/266), progresión tras banda (267), portería a cero individual (275) y valoración propia (378) requieren configurar lo indicado en sus parámetros; no existe un valor universal implícito. Presión no hereda automáticamente el umbral de recuperación rápida. El índice GPI (197) exige reproducir sus zonas, acciones y excepciones, o debe nombrarse como indicador propio.', '',
  '## Matriz completa', '',
  '| ID | Categoría / métrica | Viabilidad | Evidencia mínima | Cálculo / definición | Condición y límite | Reglas / parámetros |',
  '| --- | --- | --- | --- | --- | --- | --- |',
  ...metrics.map((m) => `| ${m.id} | ${esc(m.category)} · **${esc(m.name)}** | ${{ viable: 'Viable', conditional: 'Condicionada', excluded: 'Excluida del método', extension: 'Extensión condicionada' }[m.audio.viability]} | ${esc(m.audio.evidence)} | ${esc(m.audio.extraction || m.definition)} | ${esc(m.audio.condition)} | ${m.ruleIds.join(', ')} / ${m.parameterIds.join(', ')} |`), '',
  '## Reglas de extracción (63)', '',
  '| ID | Familia / regla | Datos necesarios | Operación | Prevención de errores | IDs originales |', '| --- | --- | --- | --- | --- | --- |',
  ...rules.map((r) => `| ${r.id} | ${esc(r.family)} · ${esc(r.name)} | ${esc(r.requirements)} | ${esc(r.calculation)} | ${esc(r.limitations)} | ${esc(r.catalogIds)} |`), '',
  '## Parámetros (24)', '', '| ID | Parámetro | Valor o configuración | Límite |', '| --- | --- | --- | --- |',
  ...params.map((p) => `| ${p.id} | ${esc(p.name)} | ${esc(p.value)} | ${esc(p.limitations)} |`), '',
  '## Perfil de referencia (78 campos)', '', '| ID | Campo | Valor | Explicación |', '| --- | --- | --- | --- |',
  ...profiles.map((p) => `| ${p.id} | ${esc(p.key)} | ${esc(p.value)} | ${esc(p.explanation)} |`), '',
  '## Eventos canónicos (30 familias)', '', '| ID | Evento | Campos | Directo | Derivado | Límite |', '| --- | --- | --- | --- | --- | --- |',
  ...events.map((p) => `| ${p.id} | ${esc(p.name)} | ${esc(p.fields)} | ${esc(p.direct)} | ${esc(p.derived)} | ${esc(p.limitations)} |`), '',
  '## Casos de aceptación de la fuente (16)', '', '| ID | Caso | Entrada | Esperado | No permitido |', '| --- | --- | --- | --- | --- |',
  ...acceptance.map((p) => `| ${p.id} | ${esc(p.name)} | ${esc(p.input)} | ${esc(p.expected)} | ${esc(p.prohibited)} |`), '',
  '## Guía original', '', ...guide.flatMap((g) => [`**${g.title}**`, '', g.text, '']),
  '## Reproducción y trazabilidad', '',
  'Ejecutar `node scripts/generate-audio-catalog.mjs ruta/a/audio-catalog.json` sobre una extracción completa y de solo lectura de las cuatro hojas. El generador comprueba 412 IDs únicos, el reparto de viabilidad y los totales de reglas, parámetros, perfil, familias, estructura y aceptación. No accede a Firebase ni analiza datos reales.', '',
  `SHA-256 de la extracción: \`${createHash('sha256').update(raw).digest('hex')}\`.`, '',
].join('\n');
write('docs/matriz-estadisticas-audio.md', md);
console.log(JSON.stringify({ metrics: metrics.length, counts, rules: rules.length, parameters: params.length, profile: profiles.length, events: events.length, acceptance: acceptance.length }));
