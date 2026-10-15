import { z } from "zod";
import { eventSchema } from "../../functions/src/eventSchema";
import { calculateLedger, type MatchEvent, type MatchSheet } from "../../functions/src/matchEngine";
import { actionProblem } from "../../functions/src/matchAnalysis";

const questionSchema = z.union([z.string().max(400), z.object({
  question: z.string().min(1).max(400), playerIds: z.array(z.string()).max(30).default([]),
  eventIds: z.array(z.string()).max(100).default([]), sourceRef: z.string().max(160).optional(),
  resolution: z.string().max(400).optional(),
})]);
const bundleSchema = z.object({
  format: z.literal("piti-actions/v1"), matchId: z.string(), baseRevision: z.number().int().min(0),
  coverage: z.enum(["partial", "complete"]).default("partial"), notes: z.string().max(2000).default(""),
  unresolved: z.array(questionSchema).max(100).default([]), events: z.array(eventSchema).max(2500),
});
function readBundle(text: string) {
  let json: unknown;
  try { json = JSON.parse(text.replace(/^```(?:json)?\s*|\s*```$/g, "")); } catch { throw new Error("No se puede leer el archivo de acciones. Pega el JSON completo generado a partir de la narración."); }
  const parsed = bundleSchema.safeParse(json);
  if (!parsed.success) throw new Error(parsed.error.issues.slice(0, 8).map(e => `${e.path.join(".")}: ${e.message}`).join("\n"));
  return parsed.data;
}
export interface NarrationChange {
  kind: "added" | "updated" | "unchanged";
  before?: MatchEvent;
  after: MatchEvent;
  fields: { key: keyof MatchEvent; before: MatchEvent[keyof MatchEvent]; after: MatchEvent[keyof MatchEvent] }[];
}
/** Stable ids make re-import idempotent; the backend also compares the match revision at publication. */
export function previewNarration(text: string, matchId: string, sheet: MatchSheet) {
  const b = readBundle(text);
  if (b.matchId !== matchId) throw new Error("Este análisis corresponde a otro partido.");
  if (b.baseRevision !== (sheet.revision ?? 0)) throw new Error("El acta ha cambiado desde que se preparó la narración. Exporta el contexto actualizado para fusionarla sin perder jugadas.");
  if (new Set(b.events.map(e => e.id)).size !== b.events.length) throw new Error("Hay identificadores de jugada repetidos dentro del análisis.");
  const merged = new Map(sheet.events.map(e => [e.id, e]));
  const changes: NarrationChange[] = [];
  for (const e of b.events) {
    const issue = actionProblem(e); if (issue) throw new Error(`${e.id}: ${issue}`);
    const before = merged.get(e.id);
    const after: MatchEvent = { ...e, source: e.source ?? before?.source ?? "narration" };
    const keys = [...new Set([...Object.keys(before ?? {}), ...Object.keys(after)])] as (keyof MatchEvent)[];
    const fields = keys.filter(key => key !== "id" && before?.[key] !== after[key]).map(key => ({ key, before: before?.[key], after: after[key] }));
    changes.push({ kind: before ? fields.length ? "updated" : "unchanged" : "added", before, after, fields });
    merged.set(e.id, after);
  }
  if (merged.size > 2500) throw new Error("El acta admite 2500 acciones. Divide el análisis en menos acciones o revisa duplicados.");
  const questions = b.unresolved.map((q, index) => ({ index, ...(typeof q === "string" ? { question: q, playerIds: [], eventIds: [], resolution: undefined, sourceRef: undefined } : q) }));
  const next = { ...sheet, events: [...merged.values()], analysisCoverage: b.coverage, analysisNotes: b.notes };
  const ledger = calculateLedger(next, false, { allowUnattributedGoals: true });
  const errors = [...questions.filter(q => !q.resolution?.trim()).map(q => q.question), ...ledger.errors];
  return { sheet: { ...next, goalsFor: ledger.goalsFor, goalsAgainst: ledger.goalsAgainst }, errors, validationErrors: ledger.errors, baseFingerprint: JSON.stringify(sheet),
    questions, changes, added: changes.filter(c => c.kind === "added").length,
    updated: changes.filter(c => c.kind === "updated").length, unchanged: changes.filter(c => c.kind === "unchanged").length,
    unknownTime: b.events.filter(e => e.timingUnknown).length };
}
/** Corrections remain inside the import until the whole preview is accepted. */
export function correctNarrationEvent(text: string, event: MatchEvent): string {
  const b = readBundle(text);
  if (!b.events.some(e => e.id === event.id)) throw new Error("Esta acción ya no está en la importación. Vuelve a revisarla.");
  b.events = b.events.map(e => e.id === event.id ? eventSchema.parse(event) : e);
  return JSON.stringify(b, null, 2);
}
/** A human resolution is explicit and reviewable; it never guesses or silently rewrites an action. */
export function resolveNarrationQuestion(text: string, index: number, resolution: string): string {
  const b = readBundle(text);
  const question = b.unresolved[index];
  if (question == null) throw new Error("La duda ya no está en la importación. Vuelve a revisarla.");
  if (!resolution.trim()) throw new Error("Explica cómo has resuelto la duda y corrige las acciones afectadas antes de confirmar.");
  b.unresolved[index] = typeof question === "string" ? { question, playerIds: [], eventIds: [], resolution: resolution.trim() } : { ...question, resolution: resolution.trim() };
  return JSON.stringify(bundleSchema.parse(b), null, 2);
}
export function narrationContext(matchId: string, sheet: MatchSheet, roster: { id: string; name: string; number: number | null }[]) {
  return JSON.stringify({ format: "piti-context/v1", matchId, baseRevision: sheet.revision ?? 0, rival: sheet.rival, date: sheet.date, duration: sheet.duration, durationSeconds: sheet.durationSeconds, clock: sheet.clock, starters: sheet.starters, bench: sheet.bench, roster, existingEvents: sheet.events, instructions: "Devuelve piti-actions/v1 con los mismos matchId y baseRevision. Conserva los ids de jugadas existentes al corregirlas y usa ids estables para las nuevas. Nunca dupliques un gol como remate, un pase fallado como pérdida ni una intercepción como recuperación. No inventes autor, receptor, minuto, coordenadas ni resultado. Usa timingUnknown:true solo en acciones técnicas sin tiempo; los goles y cambios necesitan minuto. Los segundos de juego excluyen el descanso. outcome: complete/incomplete en pases; on_target/off_target/blocked/woodwork en tiros; won/lost en duelos. Marca coverage:partial salvo narración íntegra. En sourceRef conserva el fragmento literal de la narración que sustenta cada acción (máximo 160 caracteres), si existe. Detalla dudas en unresolved como objetos {question, playerIds, eventIds, sourceRef}; vincula solo ids conocidos, sin inventarlos. No rellenes resolution: la resuelve la persona que revisa. No publiques hasta resolverlas." }, null, 2);
}
