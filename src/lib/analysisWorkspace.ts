import { NARRATED_METRICS, NARRATED_METRIC_BY_ID, type NarratedMetricSummary } from "../../functions/src/narrated/catalogIndex";
import { evaluateNarrated, prepareNarrated } from "../../functions/src/narrated/engine";
import { clipIntervals, hasKnownParticipation, isKind, periodInterval, playerIntervals, type MetricContext } from "../../functions/src/narrated/operators";
import type { AnalysisFilters, MetricResult, NarratedMatch } from "../../functions/src/narrated/types";

export interface WorkspacePerson { id: string; name: string; number?: number | string | null }
export interface AnalysisWorkspaceRow { person: WorkspacePerson; results: Map<string, MetricResult> }
export interface AnalysisWorkspace { rows: AnalysisWorkspaceRow[]; total: Map<string, MetricResult>; metrics: NarratedMetricSummary[]; matchIds: string[] }
export interface WorkspacePreset { id: string; label: string; metricIds: readonly string[] }
export type AnalysisSortDirection = "asc" | "desc";
export const ANALYSIS_WORKSPACE_METRICS = NARRATED_METRICS.filter(metric => metric.audio.viability !== "excluded");
export const ANALYSIS_WORKSPACE_PRESETS = [
  { id: "general", label: "Resumen", metricIds: ["001", "015", "105", "029", "067", "070", "201", "206"] },
  { id: "passes", label: "Pases y creación", metricIds: ["067", "068", "069", "070", "125", "105", "106", "114", "115", "090"] },
  { id: "shots", label: "Remates", metricIds: ["029", "030", "031", "032", "033", "034", "015", "035"] },
  { id: "defence", label: "Defensa", metricIds: ["165", "166", "169", "170", "171", "173", "206", "151", "152", "154"] },
  { id: "keeper", label: "Portería", metricIds: ["001", "271", "272", "273", "274", "275", "276"] },
  { id: "rotation", label: "Rotaciones", metricIds: ["001", "002", "004", "005", "006", "007", "008", "009", "010", "011"] },
  { id: "discipline", label: "Disciplina", metricIds: ["295", "296", "298", "299", "300", "301", "302", "303", "304", "305"] },
] as const satisfies readonly WorkspacePreset[];

/** Pair and seven-player-combination metrics remain available in the contextual total.
 * Their group values must never be repeated as if each person had earned them. */
export function analysisMetricSupportsPlayer(metric: NarratedMetricSummary): boolean {
  return !["384", "385", "388", "389"].includes(metric.id) && (/jugador|portero/i.test(metric.scope) || /^A\d{2}$/.test(metric.id));
}
export function workspaceMetricIds(metricIds: readonly string[]): string[] {
  return [...new Set(metricIds)].filter(id => { const metric = NARRATED_METRIC_BY_ID.get(id); return metric && metric.audio.viability !== "excluded"; });
}
function contextualOnly(metric: NarratedMetricSummary): MetricResult {
  return { id: metric.id, value: null, unit: "", status: "not_applicable", observed: 0, pending: 0, evidenceEventIds: [], ruleId: `piti.${metric.id}`, ruleVersion: 1, parameters: {}, reason: "Esta estadística describe al equipo, una pareja o una alineación. Consulta el total contextual; no se atribuye a cada jugador." };
}
function visible(match: NarratedMatch): boolean {
  return !match.archived && !match.individuallyArchived && !match.deleting && match.status !== "cancelled";
}
/** The selection is a set: a repeated input match must not double its actions. */
function scopedMatches(matches: readonly NarratedMatch[], filters: AnalysisFilters): NarratedMatch[] {
  const seen = new Set<string>();
  return matches.filter(match => {
    if (!visible(match) || seen.has(match.id) || filters.matchIds?.length && !filters.matchIds.includes(match.id) || filters.seasonIds?.length && (!match.seasonId || !filters.seasonIds.includes(match.seasonId))) return false;
    seen.add(match.id); return true;
  });
}
function participatingMatches(ctx: MetricContext): Map<string, Set<string>> {
  const result = new Map<string, Set<string>>();
  const record = (id: string | undefined, matchId: string) => {
    if (!id) return;
    const selected = result.get(id) ?? new Set<string>(); selected.add(matchId); result.set(id, selected);
  };
  for (const m of ctx.matches) {
    const ids = new Set([...Object.keys(m.match.ledger ?? {}), ...(m.match.starters ?? []), ...(m.match.bench ?? []), ...m.events.filter(e => e.team === "us" && isKind(e, "lineup", "substitution")).flatMap(e => [e.actorId, typeof e.facts.inPlayerId === "string" ? e.facts.inPlayerId : undefined]).filter((id): id is string => !!id)]);
    for (const id of ids) {
      if (m.match.notCalled?.includes(id) || m.match.ledger?.[id]?.notCalled) continue;
      const ledger = m.match.ledger?.[id];
      const historicalTotal = ledger && !ledger.stints.length && Number.isFinite(ledger.minutes) && ledger.minutes > 0;
      const wholeMatch = ctx.filters.period == null && ctx.filters.fromSecond == null && ctx.filters.toSecond == null;
      if (wholeMatch && historicalTotal || clipIntervals(ctx, playerIntervals(m, id), m.duration, m.match.id).length) record(id, m.match.id);
    }
  }
  // Historical actions may identify a participant even when the old acta omitted the seven.
  // Known substitutions still take precedence: actions outside a known playing interval
  // cannot turn an unused substitute or an absent player into a participant.
  for (const e of ctx.all) {
    if (isKind(e, "lineup", "tactical", "substitution", "context", "control", "gap")) continue;
    const m = ctx.matches.find(m => m.match.id === e.matchId)!;
    const ownIds = e.team === "us" ? [e.actorId, e.receiverId, e.intendedReceiverId, e.facts.assistPlayerId] : [e.facts.keeperId, e.facts.defenderId];
    for (const id of ownIds) {
      if (typeof id !== "string" || m.match.notCalled?.includes(id) || m.match.ledger?.[id]?.notCalled) continue;
      const ledger = m.match.ledger?.[id];
      const periodWithoutBounds = ctx.filters.period != null && !periodInterval(ctx, m);
      // A labelled action proves participation in that half, even when its real
      // boundary is missing. It does not certify minutes or revive an unused bench player.
      const presentWithoutPeriodBounds = periodWithoutBounds && playerIntervals(m, id).some(interval => !e.time || e.time.from >= interval.from && (e.time.to < interval.to || e.time.to === m.duration && interval.to === m.duration));
      if (!hasKnownParticipation(m, id) || ledger && !ledger.stints.length && ledger.minutes > 0 || presentWithoutPeriodBounds) record(id, e.matchId);
    }
  }
  return result;
}

/** Shared by cards, detail and exports: a player's sample contains the matches in
 * which their participation is evidenced, using the same period and time limits. */
export function selectAnalysisMatches(matches: readonly NarratedMatch[], filters: AnalysisFilters = {}): NarratedMatch[] {
  const selected = scopedMatches(matches, filters);
  if (!filters.playerIds?.length || filters.team === "opponent") return selected;
  const participants = participatingMatches(prepareNarrated(selected, { ...filters, playerIds: undefined }));
  return selected.filter(match => filters.playerIds!.some(id => participants.get(id)?.has(match.id)));
}

/** Calculate every displayed column over its real sample, never by adding percentages
 * or averaging per-player rates. Opponent totals have no fabricated home-player rows. */
export function buildAnalysisWorkspace(matches: readonly NarratedMatch[], people: readonly WorkspacePerson[], filters: AnalysisFilters = {}, metricIds: readonly string[] = ANALYSIS_WORKSPACE_PRESETS[0].metricIds): AnalysisWorkspace {
  const ids = workspaceMetricIds(metricIds), metrics = ids.map(id => NARRATED_METRIC_BY_ID.get(id)!);
  const selected = scopedMatches(matches, filters);
  if (filters.team === "opponent") {
    const total = new Map(evaluateNarrated(selected, filters, ids).map(result => [result.id, result]));
    return { rows: [], total, metrics, matchIds: selected.map(match => match.id) };
  }
  const ctx = prepareNarrated(selected, { ...filters, playerIds: undefined });
  const participants = participatingMatches(ctx), byId = new Map(people.map(person => [person.id, person]));
  const totalMatches = selectAnalysisMatches(selected, filters);
  const total = new Map(evaluateNarrated(totalMatches, filters, ids).map(result => [result.id, result]));
  const individualIds = metrics.filter(analysisMetricSupportsPlayer).map(metric => metric.id);
  const rows = [...participants].filter(([id]) => !filters.playerIds?.length || filters.playerIds.includes(id)).map(([id, matchIds]) => {
    const person = byId.get(id) ?? { id, name: "Jugador sin ficha" };
    const results = new Map(evaluateNarrated(selected.filter(match => matchIds.has(match.id)), { ...filters, playerIds: [id] }, individualIds).map(result => [result.id, result]));
    for (const metric of metrics) if (!analysisMetricSupportsPlayer(metric)) results.set(metric.id, contextualOnly(metric));
    return { person, results };
  }).sort((a, b) => comparePeople(a.person, b.person));
  return { rows, total, metrics, matchIds: selected.map(match => match.id) };
}

const numbers = new Intl.NumberFormat("es-ES", { maximumFractionDigits: 2 });
const names = new Intl.Collator("es", { sensitivity: "base", numeric: true });
function comparePeople(a: WorkspacePerson, b: WorkspacePerson): number { return names.compare(a.name, b.name) || a.id.localeCompare(b.id); }
export function workspaceMetricValue(result: MetricResult | undefined): number | null {
  return result && ["complete", "partial"].includes(result.status) && result.value != null && Number.isFinite(result.value) ? result.value : null;
}
export function formatWorkspaceMetric(result: MetricResult | undefined, includeUnit = false): string {
  const value = workspaceMetricValue(result); if (value == null) return "-";
  const unit = result!.unit;
  return `${numbers.format(value)}${unit === "%" ? "%" : includeUnit && unit && !["count", "acciones"].includes(unit) ? ` ${unit}` : ""}`;
}
/** Missing values always follow known values, including when sorting ascending. */
export function sortAnalysisRows(rows: readonly AnalysisWorkspaceRow[], metricId: string, direction: AnalysisSortDirection = "desc"): AnalysisWorkspaceRow[] {
  return [...rows].sort((a, b) => {
    const av = workspaceMetricValue(a.results.get(metricId)), bv = workspaceMetricValue(b.results.get(metricId));
    if (av == null || bv == null) return av == null && bv == null ? comparePeople(a.person, b.person) : av == null ? 1 : -1;
    return (direction === "asc" ? av - bv : bv - av) || comparePeople(a.person, b.person);
  });
}
/** Competition ranks: 1, 2, 2, 4. Unknowns never receive a rank. */
export function rankAnalysisRows(rows: readonly AnalysisWorkspaceRow[], metricId: string, direction: AnalysisSortDirection = "desc"): (AnalysisWorkspaceRow & { rank: number | null })[] {
  let previous: number | null = null, rank = 0;
  return sortAnalysisRows(rows, metricId, direction).map((row, index) => {
    const value = workspaceMetricValue(row.results.get(metricId));
    if (value == null) return { ...row, rank: null };
    if (previous == null || value !== previous) rank = index + 1;
    previous = value; return { ...row, rank };
  });
}
