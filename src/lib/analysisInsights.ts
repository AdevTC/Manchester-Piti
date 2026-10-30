import { evaluateNarrated, prepareNarrated } from "../../functions/src/narrated/engine";
import { isKind, isPass, isShot, passComplete, periodInterval, quantity, type ScopedObservation } from "../../functions/src/narrated/operators";
import type { AnalysisFilters, MetricResult, NarratedMatch } from "../../functions/src/narrated/types";
import { buildAnalysisWorkspace, selectAnalysisMatches, workspaceMetricValue, type WorkspacePerson } from "./analysisWorkspace";

export const INSIGHT_METRICS = [
  { id: "067", label: "Pases intentados" },
  { id: "070", label: "Precisión de pase" },
  { id: "029", label: "Remates" },
  { id: "201", label: "Pérdidas" },
  { id: "206", label: "Recuperaciones" },
] as const;
export interface InsightSegment {
  key: string;
  period: number;
  from: number;
  to: number;
  matches: number;
  completeMatches: number;
  playedSeconds: number;
  result: MetricResult;
}
export interface InsightTimeline { segments: InsightSegment[]; omittedMatches: number; uncertainActions: number; matchCount: number }
export interface PassConnection {
  from: string;
  to: string;
  attempts: number;
  completed: number;
  failed: number;
  unknown: number;
  volume: MetricResult;
  accuracy: MetricResult;
}
export interface PassMatrix {
  senders: WorkspacePerson[];
  receivers: WorkspacePerson[];
  cells: PassConnection[];
  unattributed: number;
  pending: number;
  attempts: number;
  matchCount: number;
}

function empty(id: string, unit = "acciones"): MetricResult {
  return { id, unit, value: null, status: "no_sample", observed: 0, pending: 0, evidenceEventIds: [], ruleId: `piti.${id}`, ruleVersion: 1, parameters: {}, reason: "No hay muestra para este tramo." };
}

/** Counts are pooled and percentages use pooled opportunities, never a mean of percentages. */
function pool(results: MetricResult[], id: string): MetricResult {
  if (!results.length) return empty(id, id === "070" ? "%" : "acciones");
  const observed = results.reduce((n, r) => n + r.observed, 0);
  const pending = results.reduce((n, r) => n + r.pending, 0);
  const complete = results.every(r => r.status === "complete" || r.status === "no_sample");
  const numerator = results.reduce((n, r) => n + (r.numerator ?? 0), 0);
  const denominator = results.reduce((n, r) => n + (r.denominator ?? 0), 0);
  const known = results.flatMap(r => workspaceMetricValue(r) == null ? [] : [r.value!]);
  const sum = known.reduce((n, value) => n + value, 0);
  const ratio = id === "070";
  const value = ratio ? denominator > 0 ? numerator / denominator * 100 : null : complete || sum > 0 ? sum : null;
  return { ...results[0], id, value, observed, pending, status: value == null ? ratio && complete ? "no_sample" : "unknown" : complete ? "complete" : "partial", evidenceEventIds: [...new Set(results.flatMap(r => r.evidenceEventIds))], ...(ratio ? { numerator, denominator } : {}), reason: "Muestra conjunta del mismo tramo de juego en los partidos seleccionados. Los porcentajes ponderan las oportunidades conocidas." };
}

/** Each half begins at its recorded boundary. A late whistle never moves second-half
 * actions into an assumed 25-minute split; without a boundary we keep a separate clock. */
export function buildInsightTimeline(matches: readonly NarratedMatch[], filters: AnalysisFilters = {}, metricId = "067", windowSeconds = 300): InsightTimeline {
  const selected = selectAnalysisMatches(matches, filters);
  const ctx = prepareNarrated(selected, filters);
  const guard = evaluateNarrated(selected, filters, [metricId])[0];
  const buckets = new Map<string, { segment: Omit<InsightSegment, "result">; results: MetricResult[] }>();
  let omittedMatches = 0;
  const step = Math.max(60, Math.min(900, windowSeconds));
  for (const prepared of ctx.matches) {
    const periods = filters.period != null ? [filters.period] : Array.from({ length: Math.min(8, Math.max(2, prepared.profile.periodMinutes.length, ...prepared.events.map(e => e.period ?? 0))) }, (_, i) => i + 1);
    let ranges = periods.flatMap(period => {
      const range = periodInterval({ ...ctx, filters: { ...filters, period } }, prepared);
      return range && range.to > range.from ? [{ period, ...range }] : [];
    });
    if (!ranges.length && filters.period == null && prepared.duration > 0) ranges = [{ period: 0, from: 0, to: prepared.duration }];
    if (!ranges.length) { omittedMatches++; continue; }
    for (const range of ranges) {
      const count = Math.min(120, Math.ceil((range.to - range.from) / step));
      for (let index = 0; index < count; index++) {
        const fromSecond = Math.max(range.from + index * step, filters.fromSecond ?? 0);
        const toSecond = Math.min(range.from + (index + 1) * step, range.to, filters.toSecond ?? Infinity);
        if (toSecond <= fromSecond) continue;
        // The final whistle belongs to this period. Coverage and exposure still end at
        // the real boundary; a later period's opening event is excluded by its period.
        const scope = { ...filters, ...(range.period ? { period: range.period } : {}), fromSecond, toSecond: toSecond === range.to ? toSecond + 0.001 : toSecond };
        const relevant = selectAnalysisMatches([prepared.match], scope);
        if (!relevant.length) continue;
        const result = evaluateNarrated(relevant, scope, [metricId])[0];
        const key = `${range.period}:${index}`;
        const bucket = buckets.get(key) ?? { segment: { key, period: range.period, from: index * step, to: (index + 1) * step, matches: 0, completeMatches: 0, playedSeconds: 0 }, results: [] };
        bucket.segment.matches++;
        bucket.segment.completeMatches += result.status === "complete" || result.status === "no_sample" ? 1 : 0;
        bucket.segment.playedSeconds += toSecond - fromSecond;
        bucket.results.push(result);
        buckets.set(key, bucket);
      }
    }
  }
  const relevant = (e: ScopedObservation) => {
    if (e.team !== ctx.team || filters.playerIds?.length && (!e.actorId || !filters.playerIds.includes(e.actorId))) return false;
    if (metricId === "067" || metricId === "070") return isPass(e, ctx.matches.find(m => m.match.id === e.matchId)!.profile);
    return metricId === "029" ? isShot(e) : metricId === "201" ? isKind(e, "loss") : isKind(e, "recovery");
  };
  const uncertain = new Map([...ctx.events.filter(e => !e.time || e.time.precision !== "exact"), ...(ctx.uncertainEvents ?? [])].filter(relevant).map(e => [e.evidenceId, e]));
  const uncertainActions = [...uncertain.values()].reduce((n, e) => n + quantity(e), 0);
  return { segments: [...buckets.values()].map(({ segment, results }) => ({ ...segment, result: ["not_configured", "not_applicable"].includes(guard.status) ? { ...guard, evidenceEventIds: [] } : pool(results, metricId) })).sort((a, b) => a.period - b.period || a.from - b.from), omittedMatches, uncertainActions, matchCount: selected.length };
}

/** Destination remains visible when filtering the sender. A failed delivery uses only
 * an explicitly named intended recipient; no recipient is inferred from possession. */
export function buildPassMatrix(matches: readonly NarratedMatch[], people: readonly WorkspacePerson[], filters: AnalysisFilters = {}): PassMatrix {
  const selected = selectAnalysisMatches(matches, filters);
  const ctx = prepareNarrated(selected, filters);
  const profiles = new Map(ctx.matches.map(m => [m.match.id, m.profile]));
  const passes = ctx.events.filter(e => isPass(e, profiles.get(e.matchId)!));
  const base = evaluateNarrated(selected, filters, ["067"])[0];
  const profileGuard = evaluateNarrated(selected, filters, ["070"])[0];
  const pending = base.pending;
  const pairs = new Map<string, { from: string; to: string; events: ScopedObservation[] }>();
  let unattributed = 0;
  const opponentMatches = new Map<string, string>();
  // Opponent identifiers belong to their acta (often just a shirt number). Only
  // our roster IDs identify the same player across different matches.
  const personKey = (event: ScopedObservation, id: string) => event.team === "opponent" && selected.length > 1 ? JSON.stringify([event.matchId, id]) : id;
  for (const event of passes) {
    const success = passComplete(event, profiles.get(event.matchId)!);
    const actor = event.team === "opponent" ? event.opponentId : event.actorId;
    const receiver = event.team === "opponent" ? typeof event.facts.opponentReceiverId === "string" ? event.facts.opponentReceiverId : undefined : success === true ? event.receiverId : event.intendedReceiverId ?? event.receiverId;
    if (!actor || !receiver) { unattributed += quantity(event); continue; }
    if (actor === receiver) { unattributed += quantity(event); continue; }
    const from = personKey(event, actor), to = personKey(event, receiver);
    if (event.team === "opponent") { opponentMatches.set(from, event.matchId); opponentMatches.set(to, event.matchId); }
    const key = JSON.stringify([from, to]);
    const pair = pairs.get(key) ?? { from, to, events: [] };
    pair.events.push(event); pairs.set(key, pair);
  }
  const participantIds = filters.team === "opponent" ? [] : buildAnalysisWorkspace(selected, people, filters, []).rows.map(r => r.person.id);
  const senderIds = new Set([...participantIds, ...[...pairs.values()].map(p => p.from)]);
  const receiverIds = new Set([...participantIds, ...[...pairs.values()].map(p => p.to)]);
  const allIds = [...new Set([...senderIds, ...receiverIds])].sort();
  const names = new Map(people.map(person => [person.id, person]));
  const person = (id: string): WorkspacePerson => filters.team !== "opponent" && names.has(id) ? names.get(id)! : { id, name: `${filters.team === "opponent" ? "Rival" : "Jugador sin ficha"} ${allIds.indexOf(id) + 1}` };
  const order = (a: WorkspacePerson, b: WorkspacePerson) => String(a.number ?? "").localeCompare(String(b.number ?? ""), "es", { numeric: true }) || a.name.localeCompare(b.name, "es");
  const fullyAssigned = base.status === "complete" && !unattributed && !pending;
  const cells: PassConnection[] = [];
  for (const from of senderIds) for (const to of receiverIds) {
    if (from === to || filters.team === "opponent" && selected.length > 1 && opponentMatches.get(from) !== opponentMatches.get(to)) continue;
    const events = pairs.get(JSON.stringify([from, to]))?.events ?? [];
    let completed = 0, failed = 0, unknown = 0;
    for (const e of events) { const success = passComplete(e, profiles.get(e.matchId)!); if (success === true) completed += quantity(e); else if (success === false) failed += quantity(e); else unknown += quantity(e); }
    const attempts = completed + failed + unknown;
    const evidenceEventIds = events.map(e => e.evidenceId);
    const complete = fullyAssigned && !unknown;
    const volumeKnown = completed + failed > 0 || fullyAssigned && !unknown;
    const volume: MetricResult = { ...empty("068"), value: volumeKnown ? completed : null, status: volumeKnown ? complete ? "complete" : "partial" : "unknown", observed: attempts, pending: unknown + pending, evidenceEventIds, reason: "Pases completados entre este emisor y este receptor, con las reglas de pase de cada acta." };
    const accuracy: MetricResult = { ...volume, id: "070", ruleId: "piti.070", unit: "%", value: completed + failed > 0 ? completed / (completed + failed) * 100 : null, numerator: completed, denominator: completed + failed, status: completed + failed > 0 ? complete ? "complete" : "partial" : unknown || !fullyAssigned ? "unknown" : "no_sample" };
    if (["not_configured", "not_applicable"].includes(profileGuard.status)) {
      for (const result of [volume, accuracy]) Object.assign(result, { value: null, status: profileGuard.status, reason: profileGuard.reason, numerator: undefined, denominator: undefined });
    }
    cells.push({ from, to, attempts, completed, failed, unknown, volume, accuracy });
  }
  return { senders: [...senderIds].map(person).sort(order), receivers: [...receiverIds].map(person).sort(order), cells, unattributed, pending, attempts: passes.reduce((n, e) => n + quantity(e), 0), matchCount: selected.length };
}

export function insightEvidence(matches: readonly NarratedMatch[], ids: readonly string[]): ScopedObservation[] {
  const wanted = new Set(ids);
  return prepareNarrated(matches).all.filter(event => wanted.has(event.evidenceId));
}
