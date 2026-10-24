import { evaluateNarrated } from "../../functions/src/narrated/engine";
import type { AnalysisFilters, NarratedMatch } from "../../functions/src/narrated/types";
import { buildPassMatrix } from "./analysisInsights";
import { selectAnalysisMatches, workspaceMetricValue, type WorkspacePerson } from "./analysisWorkspace";

/** The diagram is a different view of the directed matrix, not another pass counter.
 * Node size is completed deliveries sent + received inside the current selection. */
export function buildPassingNetwork(matches: readonly NarratedMatch[], people: readonly WorkspacePerson[], filters: AnalysisFilters = {}) {
  const matrix = buildPassMatrix(matches, people, filters);
  const total = evaluateNarrated(selectAnalysisMatches(matches, filters), filters, ["068"])[0];
  const edges = matrix.cells.filter(cell => (workspaceMetricValue(cell.volume) ?? 0) > 0);
  const connected = new Set(edges.flatMap(edge => [edge.from, edge.to]));
  const allPeople = new Map([...matrix.senders, ...matrix.receivers].map(person => [person.id, person]));
  const nodes = [...allPeople.values()].filter(person => connected.has(person.id)).map(person => {
    const sent = edges.filter(edge => edge.from === person.id).reduce((n, edge) => n + edge.completed, 0);
    const received = edges.filter(edge => edge.to === person.id).reduce((n, edge) => n + edge.completed, 0);
    return { ...person, sent, received, involvement: sent + received };
  }).sort((a, b) => String(a.number ?? "").localeCompare(String(b.number ?? ""), "es", { numeric: true }) || a.name.localeCompare(b.name, "es"));
  const completed = edges.reduce((n, edge) => n + edge.completed, 0);
  const totalCompleted = workspaceMetricValue(total);
  return { ...matrix, edges, nodes, completed, totalCompleted, unrepresentedCompleted: totalCompleted == null ? null : Math.max(0, totalCompleted - completed) };
}

export const SHOT_CHART_METRICS = [
  { id: "029", label: "Remates" },
  { id: "030", label: "A puerta" },
  { id: "031", label: "Fuera" },
  { id: "032", label: "Bloqueados" },
  { id: "033", label: "A la madera" },
  { id: "015", label: "Goles" },
] as const;

/** Categories overlap on purpose: a goal off the post is a goal, on target and woodwork.
 * Each bar uses the catalogue's own denominator, missing-data state and evidence. */
export function buildShotChart(matches: readonly NarratedMatch[], filters: AnalysisFilters = {}) {
  const sample = selectAnalysisMatches(matches, filters);
  const results = new Map(evaluateNarrated(sample, filters, SHOT_CHART_METRICS.map(metric => metric.id)).map(result => [result.id, result]));
  return { matchCount: sample.length, bars: SHOT_CHART_METRICS.map(metric => ({ ...metric, result: results.get(metric.id)! })) };
}
