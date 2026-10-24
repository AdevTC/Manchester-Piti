import { describe, expect, it } from 'vitest';
import { NARRATED_METRICS as full, NARRATED_CATALOG_SOURCE_SHA256 as sourceHash } from '../../functions/src/narrated/catalog';
import { NARRATED_METRICS as index, NARRATED_METRIC_BY_ID, NARRATED_CATALOG_SOURCE_SHA256 } from '../../functions/src/narrated/catalogIndex';

describe('generated runtime catalogue', () => {
  it('preserves every runtime field and ID from the complete catalogue', () => {
    expect(index).toHaveLength(412);
    expect(NARRATED_METRIC_BY_ID.size).toBe(full.length);
    expect(NARRATED_CATALOG_SOURCE_SHA256).toBe(sourceHash);
    expect(index).toEqual(full.map(({ id, name, category, scope, parameterIds, audio }) => ({
      id, name, category, scope, parameterIds,
      audio: { viability: audio.viability, condition: audio.condition },
    })));
    for (const metric of index) expect(NARRATED_METRIC_BY_ID.get(metric.id)).toBe(metric);
  });
  it('keeps full descriptions and extraction evidence out of runtime selectors', () => {
    for (const metric of index) {
      expect(metric).not.toHaveProperty('definition');
      expect(metric).not.toHaveProperty('dataRequirements');
      expect(metric.audio).not.toHaveProperty('evidence');
      expect(metric.audio).not.toHaveProperty('whatToNarrate');
    }
    expect(index.filter(metric => metric.audio.viability !== 'excluded')).toHaveLength(321);
  });
});
