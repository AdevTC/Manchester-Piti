/** Regenerate after editing the full catalogue; --check verifies a clean generated index. */
import { readFileSync, writeFileSync } from 'node:fs';
import { NARRATED_METRICS, NARRATED_CATALOG_SOURCE_SHA256 } from '../functions/src/narrated/catalog.ts';
import { renderCatalogIndex } from './catalog-index-source.mjs';

const target = new URL('../functions/src/narrated/catalogIndex.ts', import.meta.url);
const source = renderCatalogIndex(NARRATED_METRICS, NARRATED_CATALOG_SOURCE_SHA256);
if (process.argv.includes('--check')) {
  if (readFileSync(target, 'utf8').replace(/\r?\n/g, '\n') !== source.replace(/\r?\n/g, '\n')) {
    throw new Error('Catalogue index is stale. Run node scripts/generate-catalog-index.mjs.');
  }
} else {
  writeFileSync(target, source, 'utf8');
}
