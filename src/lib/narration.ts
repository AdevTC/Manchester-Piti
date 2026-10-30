import { z } from "zod";
import { eventSchema } from "../../functions/src/eventSchema";
import { calculateLedger, isPendingDup, type MatchEvent, type MatchSheet } from "../../functions/src/matchEngine";
import { actionProblem } from "../../functions/src/matchAnalysis";
import { score } from "../pages/admin/acta/sheetModel";

const questionSchema = z.union([z.string().max(400), z.object({
  question: z.string().min(1).max(400), playerIds: z.array(z.string()).max(30).default([]),
  eventIds: z.array(z.string()).max(100).default([]), sourceRef: z.string().max(160).optional(),
  resolution: z.string().max(400).optional(),
})]);
import { analysisProblem, narratedAnalysisSchema, narrationSourcesSchema, observationSchema } from '../../functions/src/narrated/schema';
import type { Observation } from '../../functions/src/narrated/types';
import { narrationPrompt } from './narrationPrompt';
import { editNarratedObservation, synchronizeCanonicalAnalysis } from '../../functions/src/narrated/editing';

const legacyBundleSchema = z.object({
  format: z.literal("piti-actions/v1"), matchId: z.string(), baseRevision: z.number().int().min(0),
  coverage: z.enum(["partial", "complete"]).default("partial"), notes: z.string().max(2000).default(""),
  unresolved: z.array(questionSchema).max(100).default([]), events: z.array(eventSchema).max(2500),
});
const richBundleSchema = legacyBundleSchema.extend({ format: z.literal("piti-actions/v2"), events: z.array(eventSchema).max(2500).default([]), analysis: narratedAnalysisSchema, sources: narrationSourcesSchema.default([]) });
const bundleSchema = z.discriminatedUnion('format', [legacyBundleSchema, richBundleSchema]);
function readBundle(text: string) {
  if (new TextEncoder().encode(text).byteLength > 900000) throw new Error('El archivo supera 900 KB.');
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
// Only an incomplete on-pitch sequence can be kept for later correction. Unknown identities,
// malformed times, initial assignments and other validation failures remain blocking.
const sequenceIssue = (message: string) => /^Minuto [\d.]+: (?:el autor de la acción no estaba en el campo|el receptor no estaba en el campo|el cambio necesita un jugador en campo y otro disponible en el banquillo|el jugador no está disponible en el campo|el asistente debe ser otro jugador en campo)\.$/.test(message);
export function narrationSequenceReview(sheet: MatchSheet) {
  const ledger = calculateLedger(sheet, false, { allowUnattributedGoals: true });
  const called = new Set([...sheet.starters, ...sheet.bench]);
  const identityErrors: string[] = [];
  for (const event of sheet.events) {
    const refs = [event.playerId, event.receiverId, event.assistPlayerId, event.inPlayerId];
    if (refs.some(id => id && !called.has(id))) identityErrors.push(`Acción ${event.id}: todos los jugadores deben pertenecer a la convocatoria.`);
    if (event.playerId && event.playerId === event.inPlayerId) identityErrors.push(`Acción ${event.id}: quien entra y quien sale deben ser jugadores distintos.`);
    if (event.playerId && event.playerId === event.assistPlayerId) identityErrors.push(`Acción ${event.id}: el goleador no puede ser su propio asistente.`);
  }
  const validationErrors = [...new Set([...ledger.errors, ...identityErrors])];
  return { ledger, validationErrors, blockingErrors: validationErrors.filter(error => !sequenceIssue(error)), sequenceErrors: ledger.errors.filter(sequenceIssue) };
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
  const rich = b.format === 'piti-actions/v2';
  const importedIssues = rich ? (b.analysis.issues ?? []).map(q => ({ question: q.message, playerIds: [] as string[], eventIds: q.eventIds, resolution: q.resolved, sourceRef: undefined })) : [];
  const questions = [...b.unresolved, ...importedIssues].map((q, index) => ({ index, ...(typeof q === "string" ? { question: q, playerIds: [], eventIds: [], resolution: undefined, sourceRef: undefined } : q) }));
  let analysis = synchronizeCanonicalAnalysis(sheet.analysis, sheet.events, [...merged.values()], sheet.durationSeconds ?? sheet.duration * 60);
  const observationChanges: { kind: 'added' | 'updated' | 'unchanged'; before?: Observation; after: Observation }[] = [];
  if (rich) {
    if (new Set(b.analysis.observations.map(o => o.id)).size !== b.analysis.observations.length) throw new Error('Hay identificadores de observación repetidos dentro del análisis.');
    if (b.analysis.revision !== (sheet.analysis?.revision ?? 0)) throw new Error('El análisis detallado ha cambiado. Copia de nuevo el contexto antes de importar.');
    for (const o of b.analysis.observations) if (o.validity === 'void' && o.canonicalEventId) merged.delete(o.canonicalEventId);
    const observations = new Map((analysis?.observations ?? []).map(o => [o.id, o]));
    for (const o of b.analysis.observations) {
      const before = observations.get(o.id);
      observationChanges.push({ kind: before ? JSON.stringify(before) === JSON.stringify(o) ? 'unchanged' : 'updated' : 'added', before, after: o });
      observations.set(o.id, o);
    }
    const issues = new Map((sheet.analysis?.issues ?? []).map(q => [q.id,q]));
    for (const q of b.analysis.issues ?? []) issues.set(q.id,q);
    const pending = new Set([...issues.values()].filter(q => !q.resolved?.trim()).flatMap(q => q.eventIds));
    analysis = { ...b.analysis, observations: [...observations.values()].map(o => pending.has(o.id) || (o.canonicalEventId && pending.has(o.canonicalEventId)) ? { ...o, validity: 'pending' as const } : o), issues: [...issues.values()] };
    const issue = analysisProblem(analysis, [...merged.values()], [...sheet.starters,...sheet.bench,...sheet.notCalled], sheet.durationSeconds ?? sheet.duration * 60);
    if (issue) throw new Error(issue);
  }
  for (const change of observationChanges) change.after = analysis?.observations.find(o => o.id === change.after.id) ?? change.after;
  const sources = new Map((sheet.narrationSources ?? []).map(s => [s.id,s]));
  if (rich) for (const source of b.sources) sources.set(source.id,source);
  for (const q of questions) if (q.resolution?.trim() || q.sourceRef) { const id = `question-${b.baseRevision}-${q.index}`; sources.set(id,{ id,quote: [q.question,q.sourceRef,q.resolution].filter(Boolean).join(' · ').slice(0,1000) }); }
  narrationSourcesSchema.parse([...sources.values()]);
  const next = { ...sheet, events: [...merged.values()], analysisCoverage: b.coverage, analysisNotes: b.notes, ...(analysis ? { analysis } : {}), ...(sources.size ? { narrationSources: [...sources.values()] } : {}) };
  if (new TextEncoder().encode(JSON.stringify(next)).byteLength > 800000) throw new Error('El análisis y sus fuentes son demasiado grandes para un acta. Reduce los fragmentos.');
  const { validationErrors, blockingErrors } = narrationSequenceReview(next);
  const { gf, ga } = score({ events: next.events.filter(event => !isPendingDup(event)) });
  const questionErrors = questions.filter((q, index) => !q.resolution?.trim() && (!rich || index < b.unresolved.length)).map(q => q.question);
  const errors = [...questionErrors, ...validationErrors];
  const canImportWithIncidents = validationErrors.length > 0 && !blockingErrors.length && !questionErrors.length;
  return { sheet: { ...next, goalsFor: gf, goalsAgainst: ga }, errors, validationErrors, canImportWithIncidents, baseFingerprint: JSON.stringify(sheet),
    format: b.format, observationChanges, sources: rich ? b.sources : [], questions, changes, added: changes.filter(c => c.kind === "added").length,
    updated: changes.filter(c => c.kind === "updated").length, unchanged: changes.filter(c => c.kind === "unchanged").length,
    unknownTime: b.events.filter(e => e.timingUnknown).length };
}
/** Corrections remain inside the import until the whole preview is accepted. */
export function correctNarrationEvent(text: string, event: MatchEvent): string {
  const b = readBundle(text);
  if (!b.events.some(e => e.id === event.id)) throw new Error("Esta acción ya no está en la importación. Vuelve a revisarla.");
  const events = b.events.map(e => e.id === event.id ? eventSchema.parse(event) : e);
  if (b.format === 'piti-actions/v2') b.analysis = narratedAnalysisSchema.parse(synchronizeCanonicalAnalysis(b.analysis, b.events, events));
  b.events = events;
  return JSON.stringify(b, null, 2);
}
/** A human resolution is explicit and reviewable; it never guesses or silently rewrites an action. */
export function resolveNarrationQuestion(text: string, index: number, resolution: string): string {
  const b = readBundle(text);
  if (b.format === 'piti-actions/v2' && index >= b.unresolved.length) {
    const q = b.analysis.issues?.[index - b.unresolved.length];
    if (!q || !resolution.trim()) throw new Error('Explica cómo se ha resuelto la duda.');
    q.resolved = resolution.trim();
    return JSON.stringify(bundleSchema.parse(b), null, 2);
  }
  const question = b.unresolved[index];
  if (question == null) throw new Error("La duda ya no está en la importación. Vuelve a revisarla.");
  if (!resolution.trim()) throw new Error("Explica cómo has resuelto la duda y corrige las acciones afectadas antes de confirmar.");
  b.unresolved[index] = typeof question === "string" ? { question, playerIds: [], eventIds: [], resolution: resolution.trim() } : { ...question, resolution: resolution.trim() };
  return JSON.stringify(bundleSchema.parse(b), null, 2);
}
export function correctNarrationObservation(text: string, observation: Observation, existingEvents: MatchEvent[] = []): string {
  const b = readBundle(text);
  if (b.format !== 'piti-actions/v2' || !b.analysis.observations.some(o => o.id === observation.id)) throw new Error('Esta observación no está en la importación.');
  const merged = new Map(existingEvents.map(e => [e.id, e]));
  for (const e of b.events) merged.set(e.id, e);
  const edited = editNarratedObservation({ events: [...merged.values()], analysis: b.analysis }, observationSchema.parse(observation));
  b.analysis = edited.analysis;
  const importedIds = new Set(b.events.map(e => e.id));
  if (observation.canonicalEventId) importedIds.add(observation.canonicalEventId);
  b.events = edited.events.filter(e => importedIds.has(e.id));
  return JSON.stringify(b, null, 2);
}
export function narrationContext(matchId: string, sheet: MatchSheet, roster: { id: string; name: string; number: number | null }[]) {
  return narrationPrompt(matchId, sheet, roster);
}
