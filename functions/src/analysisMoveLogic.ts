// The one-off move of the narrated analyses out of the match documents (functions/scripts/migrate-analysis.mjs), as
// pure decisions per match, so the script's plan is tested without Firestore. Two steps, each its own run:
// 1. copy: `matches/{id}.analysis` → `matchAnalysis/{id}` where the latter is missing or older;
// 2. remove (--quitar-campo): the old field goes, only where its own place holds it already (same or later revision,
//    and the same content when the revision is the same). Never the other way round.
import { effectiveAnalysis, storedAnalysis } from "./analysisPlaceLogic.js";

export type MoveStep = "copiar" | "quitar";
/** What a match gets: «copiar» / «quitar» (a write), «nada» (nothing to do), «falta copiar» (step 2 refuses it). */
export type MoveAction = "copiar" | "quitar" | "nada" | "falta copiar";

const revisionOf = (a: { revision?: unknown } | undefined) => (typeof a?.revision === "number" ? a.revision : -1);
/** The same JSON whatever the order of its keys. */
export function canonical(v: unknown): string {
  if (Array.isArray(v)) return `[${v.map(canonical).join(",")}]`;
  if (v && typeof v === "object" && !(v as { toMillis?: unknown }).toMillis)
    return `{${Object.keys(v as Record<string, unknown>).sort().map((k) => `${JSON.stringify(k)}:${canonical((v as Record<string, unknown>)[k])}`).join(",")}}`;
  return JSON.stringify(v) ?? "null";
}

/** `legacy`: the match document's `analysis` field; `place`: its `matchAnalysis/{id}` document's data. */
export function planMove(step: MoveStep, legacy: unknown, place: unknown): MoveAction {
  if (legacy === undefined) return "nada";
  const stored = storedAnalysis(place);
  if (step === "copiar") {
    // (a field that isn't an analysis is left for step 2 to report, never copied)
    const valid = effectiveAnalysis(undefined, legacy);
    if (!valid) return "nada";
    return !stored || revisionOf(stored) < revisionOf(valid) ? "copiar" : "nada";
  }
  if (!stored) return "falta copiar";
  const l = legacy as { revision?: unknown };
  if (revisionOf(stored) > revisionOf(l)) return "quitar";
  return revisionOf(stored) === revisionOf(l) && canonical(stored) === canonical(legacy) ? "quitar" : "falta copiar";
}
