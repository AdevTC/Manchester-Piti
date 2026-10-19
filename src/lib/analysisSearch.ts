import { z } from "zod";

/** Page-local scopes: an unknown id deliberately selects nothing, never the whole club. */
const ids = z.union([z.string().transform(value => value.split(",")), z.array(z.string())])
  .transform(values => [...new Set(values.map(value => value.trim()).filter(Boolean))].slice(0, 300))
  .refine(values => values.every(value => value.length <= 128))
  .optional().catch(undefined);

export const analysisSearchFields = {
  analysis: z.enum(["summary", "catalog"]).optional().catch(undefined),
  family: z.string().max(160).optional().catch(undefined),
  metric: z.string().regex(/^(\d{3}|A\d{2})$/).optional().catch(undefined),
  q: z.string().max(160).optional().catch(undefined),
  excluded: z.boolean().optional().catch(undefined),
  players: ids,
  team: z.enum(["us", "opponent"]).optional().catch(undefined),
  period: z.union([z.number(), z.string().regex(/^[1-8]$/).transform(Number)]).pipe(z.number().int().min(1).max(8)).optional().catch(undefined),
};
export const statsScopeSearchFields = { seasons: ids, matches: ids };
export const analysisSearchSchema = z.object(analysisSearchFields);
export type AnalysisSearch = z.infer<typeof analysisSearchSchema>;
export type StatsScopeSearch = { seasons?: string[]; matches?: string[]; players?: string[] };

export function scopeSeasons(search: StatsScopeSearch, fallback: string): string[] {
  return search.seasons !== undefined ? search.seasons : fallback === "all" ? [] : [fallback];
}
export function inScope(id: string | undefined, selected: readonly string[] | undefined): boolean {
  return !selected?.length || (!!id && selected.includes(id));
}
