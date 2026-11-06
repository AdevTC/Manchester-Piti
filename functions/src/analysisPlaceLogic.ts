// Where a match's narrated analysis lives (pure: the web reads it too). It used to be a field of the match
// (`matches/{id}.analysis`): megabytes in every public read of the matches (the data bundle, the server-rendered
// pages, every listener) when only the game's charts and the notas use it. Now it is `matchAnalysis/{id}` =
// `{ analysis }`, public as the match, read only by what needs it. During the move both places can hold it: the
// one with the later revision is the match's (a function deployed before the web, or the web before the
// functions, or a copy not yet made: whichever order, nothing is lost). The move itself: scripts/migrate-analysis.mjs.
import type { NarratedAnalysis } from "./narrated/types.js";

export const ANALYSIS_COLLECTION = "matchAnalysis";

/** Its revision (every write adds one), or -1 for none. */
const revisionOf = (a: unknown): number => {
  const r = (a as { revision?: unknown } | null | undefined)?.revision;
  return typeof r === "number" && Number.isFinite(r) ? r : -1;
};
const isAnalysis = (a: unknown): a is NarratedAnalysis => !!a && typeof a === "object" && Array.isArray((a as { observations?: unknown }).observations);

/** The analysis stored in `matchAnalysis/{id}` (its document's data), if it holds one. */
export function storedAnalysis(doc: unknown): NarratedAnalysis | undefined {
  const a = (doc as { analysis?: unknown } | null | undefined)?.analysis;
  return isAnalysis(a) ? a : undefined;
}

/** The match's analysis: its own place's, or the old field of the match while it still has one and it is later (a
 *  write by a function from before the move). The same revision in both: its own place. */
export function effectiveAnalysis(stored: unknown, legacy: unknown): NarratedAnalysis | undefined {
  const s = isAnalysis(stored) ? stored : undefined;
  const l = isAnalysis(legacy) ? legacy : undefined;
  if (!s) return l;
  if (!l) return s;
  return revisionOf(l) > revisionOf(s) ? l : s;
}

/** A match with its analysis put back in (`stored`: the analysis of its `matchAnalysis/{id}`, see storedAnalysis; else
 *  its old field as it is): the shape every reader of `match.analysis` (the notas, the charts, the acta) always had.
 *  The same object when nothing changes, so what is memoised per match stays memoised. */
export function withAnalysis<T extends { analysis?: unknown }>(match: T, stored: NarratedAnalysis | undefined): T {
  const a = effectiveAnalysis(stored, match.analysis);
  return !a || a === match.analysis ? match : { ...match, analysis: a };
}

/** The match document's own `analysis` field on a write: kept (with the new analysis) only while the document still
 *  has it — so a web from before the move keeps reading it — and gone once the move's second step removed it. */
export const mirrorsLegacy = (matchData: { analysis?: unknown } | undefined | null): boolean => !!matchData && matchData.analysis !== undefined;
