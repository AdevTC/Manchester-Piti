import { evaluateNarrated, prepareNarrated } from "../../../../functions/src/narrated/engine";
import { technicalEvents } from "../../../../functions/src/narrated/compatibility";
import { analyseActions, eventSide, isAnalysisAction } from "../../../../functions/src/matchAnalysis";
import type { AnalysisFilters, MetricResult } from "../../../../functions/src/narrated/types";
import type { ClubMatch } from "../../../lib/clubData";
import type { NMatch, Tramo } from "./nd";
import { periodInterval } from "../../../../functions/src/narrated/operators";
import { NARRATED_METRIC_BY_ID } from "../../../../functions/src/narrated/catalogIndex";
import { remember } from "../../../lib/remember";

const cache = new WeakMap<ClubMatch, Map<string, { matches: readonly ClubMatch[]; results: Map<string, MetricResult> }>>();
/** Results accumulate on demand for each immutable sample and scope. Opening another
 * catalogue page only evaluates its missing IDs; filters and new actas never share results. */
export function numerosMetrics(matches: readonly ClubMatch[], filters: AnalysisFilters, metricIds?: readonly string[]): Map<string, MetricResult> {
  const first = matches[0];
  if (!first) return new Map();
  const key = JSON.stringify(filters);
  const bucket = cache.get(first) ?? new Map();
  const previous = bucket.get(key);
  const valid = previous && matches.length === previous.matches.length && matches.every((m, i) => m === previous.matches[i]);
  const results = valid ? previous.results : new Map<string, MetricResult>();
  const wanted = metricIds ?? [...NARRATED_METRIC_BY_ID.keys()];
  const missing = [...new Set(wanted)].filter(id => NARRATED_METRIC_BY_ID.has(id) && !results.has(id));
  if (!missing.length && valid) return results;
  for (const result of missing.length ? evaluateNarrated(matches, filters, missing) : []) results.set(result.id, result);
  if (!valid && bucket.size >= 12) bucket.delete(bucket.keys().next().value!);
  bucket.set(key, { matches: [...matches], results }); cache.set(first, bucket);
  return results;
}

export function numerosMatches(matches: readonly NMatch[]): ClubMatch[] {
  const seen = new Set<string>();
  return matches.flatMap(m => {
    if (!m.source || seen.has(m.id)) return [];
    seen.add(m.id); return [m.source];
  });
}

/** Shared compatibility rules handle void actions, linked canonicals, aggregates and each pass profile. Kept by
 *  matches and filters (lib/remember): every match of the season and the page's own scope ask for theirs again on
 *  each visit and on each change of address; read only. */
export const numerosActions = remember(computeNumerosActions, 64);
function computeNumerosActions(matches: readonly ClubMatch[], filters: AnalysisFilters = {}) {
  const context = prepareNarrated(matches, filters);
  const scopedIds = new Set(context.all.map(e => e.evidenceId));
  const events = context.matches.flatMap(m => technicalEvents(m.match).filter(e => scopedIds.has(`${m.match.id}:${e.id}`)).map(e => ({ ...e, id: `${m.match.id}:${e.id}` })));
  const selected = events.filter(e => (!filters.team || eventSide(e) === filters.team) && (!filters.playerIds?.length || !!e.playerId && filters.playerIds.includes(e.playerId)));
  const summary = analyseActions(selected);
  const tramos: Tramo[] = Array.from({ length: 10 }, () => ({ pas: 0, pok: 0, sh: 0, rec: 0, loss: 0, tsh: 0 }));
  const goalBins = { us: Array<number>(10).fill(0), opponent: Array<number>(10).fill(0) };
  const eventById = new Map(selected.map(e => [e.id, e]));
  let unplaced = 0;
  for (const o of context.all) {
    const event = eventById.get(o.evidenceId);
    if (!event || !isAnalysisAction(event.type) && !["goal", "goal_penalty", "goal_freekick", "opponent_goal"].includes(event.type)) continue;
    // A narrated minute interval fits one five-minute bar; an interval crossing bars does not.
    const start = o.time && Math.floor(o.time.from / 300);
    const end = o.time && Math.floor(Math.max(o.time.from, o.time.to - (o.time.to > o.time.from ? 0.001 : 0)) / 300);
    if (start == null || start !== end || start > 9 || o.time?.precision === "approximate") { unplaced += event.quantity ?? 1; continue; }
    const row = tramos[Math.max(0, start)];
    const one = analyseActions([event]).teams[eventSide(event)];
    goalBins[eventSide(event)][Math.max(0, start)] += one.shotGoals;
    row.pas += one.passes; row.pok += one.passesCompleted; row.rec += one.recoveries; row.loss += one.turnovers;
    if (eventSide(event) === "us") row.sh += one.shots; else row.tsh += one.shots;
  }
  return { ...summary, events: selected, observations: context.all, tramos, goalBins, unplaced,
    periodWindows: context.matches.flatMap(m => { const bounds = periodInterval(context, m); return bounds ? [bounds] : []; }),
    narrated: context.matches.filter(m => m.match.analysis?.observations.length || technicalEvents(m.match).some(e => isAnalysisAction(e.type))).length };
}
