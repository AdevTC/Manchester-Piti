import { z } from "zod";
import { eventSchema } from "../../functions/src/eventSchema";
import { calculateLedger, type MatchSheet } from "../../functions/src/matchEngine";
import { actionProblem } from "../../functions/src/matchAnalysis";
const bundleSchema = z.object({
  format: z.literal("piti-actions/v1"), matchId: z.string(), baseRevision: z.number().int().min(0),
  coverage: z.enum(["partial", "complete"]).default("partial"), notes: z.string().max(2000).default(""),
  unresolved: z.array(z.string().max(400)).max(100).default([]), events: z.array(eventSchema).max(2500),
});
/** Stable ids make re-import idempotent; the backend also compares the match revision at publication. */
export function previewNarration(text: string, matchId: string, sheet: MatchSheet) {
  let json: unknown;
  try { json = JSON.parse(text.replace(/^```(?:json)?\s*|\s*```$/g, "")); } catch { throw new Error("No se puede leer el archivo de acciones. Pega el JSON completo generado a partir de la narración."); }
  const parsed = bundleSchema.safeParse(json);
  if (!parsed.success) throw new Error(parsed.error.issues.slice(0, 8).map(e => `${e.path.join(".")}: ${e.message}`).join("\n"));
  const b = parsed.data;
  if (b.matchId !== matchId) throw new Error("Este análisis corresponde a otro partido.");
  if (b.baseRevision !== (sheet.revision ?? 0)) throw new Error("El acta ha cambiado desde que se preparó la narración. Exporta el contexto actualizado para fusionarla sin perder jugadas.");
  if (new Set(b.events.map(e => e.id)).size !== b.events.length) throw new Error("Hay identificadores de jugada repetidos dentro del análisis.");
  const merged = new Map(sheet.events.map(e => [e.id, e]));
  for (const e of b.events) { const issue = actionProblem(e); if (issue) throw new Error(issue); merged.set(e.id, { ...e, source: e.source ?? "narration" }); }
  if (merged.size > 2500) throw new Error("El acta admite 2500 acciones. Divide el análisis en menos acciones o revisa duplicados.");
  const next = { ...sheet, events: [...merged.values()], analysisCoverage: b.coverage, analysisNotes: b.notes };
  const ledger = calculateLedger(next, false, { allowUnattributedGoals: true });
  const errors = [...b.unresolved, ...ledger.errors];
  return { sheet: { ...next, goalsFor: ledger.goalsFor, goalsAgainst: ledger.goalsAgainst }, errors, added: b.events.filter(e => !sheet.events.some(old => old.id === e.id)).length, updated: b.events.filter(e => sheet.events.some(old => old.id === e.id)).length, unknownTime: b.events.filter(e => e.timingUnknown).length };
}
export function narrationContext(matchId: string, sheet: MatchSheet, roster: { id: string; name: string; number: number | null }[]) {
  return JSON.stringify({ format: "piti-context/v1", matchId, baseRevision: sheet.revision ?? 0, rival: sheet.rival, date: sheet.date, duration: sheet.duration, durationSeconds: sheet.durationSeconds, clock: sheet.clock, starters: sheet.starters, bench: sheet.bench, roster, existingEvents: sheet.events, instructions: "Devuelve piti-actions/v1 con los mismos matchId y baseRevision. Conserva los ids de jugadas existentes al corregirlas y usa ids estables para las nuevas. Nunca dupliques un gol como remate, un pase fallado como pérdida ni una intercepción como recuperación. No inventes autor, receptor, minuto, coordenadas ni resultado. Usa timingUnknown:true solo en acciones técnicas sin tiempo; los goles y cambios necesitan minuto. Los segundos de juego excluyen el descanso. outcome: complete/incomplete en pases; on_target/off_target/blocked/woodwork en tiros; won/lost en duelos. Marca coverage:partial salvo narración íntegra. Detalla dudas en unresolved y no publiques hasta resolverlas." }, null, 2);
}
