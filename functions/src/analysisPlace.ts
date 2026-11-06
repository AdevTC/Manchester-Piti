// A match's narrated analysis in its own document, `matchAnalysis/{id}` = { analysis, updatedAt } (analysisPlaceLogic.ts
// says why). Read with the match in its transaction (runMatchTransaction's `analysis` option), written next to it.
import { FieldValue } from "firebase-admin/firestore";
import { db } from "./common.js";
import { ANALYSIS_COLLECTION, effectiveAnalysis, mirrorsLegacy, storedAnalysis, withAnalysis } from "./analysisPlaceLogic.js";
import type { NarratedAnalysis } from "./narrated/types.js";

export const analysisRef = (id: string) => db.doc(`${ANALYSIS_COLLECTION}/${id}`);

/** The match's analysis from its two snapshots (its place, and the match with the old field while it has it). */
export const analysisOf = (place: FirebaseFirestore.DocumentSnapshot | undefined, match: FirebaseFirestore.DocumentSnapshot | undefined): NarratedAnalysis | undefined =>
  effectiveAnalysis(storedAnalysis(place?.data()), match?.get("analysis"));

/** The match's analysis now, outside a transaction. */
export async function readAnalysis(id: string): Promise<NarratedAnalysis | undefined> {
  const [place, match] = await db.getAll(analysisRef(id), db.doc(`matches/${id}`));
  return analysisOf(place, match);
}

/** These matches (read with `.select` or whole) with their analyses put back in, as the notas read them: one read of
 *  their `matchAnalysis` documents. */
export async function withStoredAnalyses<T extends { id: string; analysis?: unknown }>(matches: T[]): Promise<T[]> {
  if (!matches.length) return matches;
  const places = await db.getAll(...matches.map((m) => analysisRef(m.id)));
  return matches.map((m, i) => withAnalysis(m, storedAnalysis(places[i].data())));
}

/**
 * Writes the match's analysis to its place, in the match's transaction, and says what the match document gets: the
 * same analysis in its old field only while that document still has one (mirrorsLegacy: a web from before the move
 * reads it there); nothing once the move's second step has removed it.
 */
export function writeAnalysis(tx: FirebaseFirestore.Transaction, id: string, analysis: NarratedAnalysis, matchData: { analysis?: unknown } | undefined): { analysis?: NarratedAnalysis } {
  tx.set(analysisRef(id), { analysis, updatedAt: FieldValue.serverTimestamp() });
  return mirrorsLegacy(matchData) ? { analysis } : {};
}
