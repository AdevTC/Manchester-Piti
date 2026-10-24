import { dateMillis } from "../../functions/src/matchEngine";
import { NARRATED_CATALOG_SOURCE_SHA256, NARRATED_METRIC_BY_ID } from "../../functions/src/narrated/catalogIndex";
import { evaluateNarrated } from "../../functions/src/narrated/engine";
import type { AnalysisFilters, NarratedMatch } from "../../functions/src/narrated/types";
import type { ClubMatch } from "./clubData";
import type { AnalysisSearch } from "./analysisSearch";
import { selectAnalysisMatches } from "./analysisWorkspace";

/** A second privacy boundary: old cached actas can still contain legacy narration sources. */
const PRIVATE_KEY = /^(?:sources|narrationSources|sourceRef|quote|quotes|transcript|transcription|byUid|editedByUid|uid)$/i;
function publicCopy<T>(value: T): T {
  return JSON.parse(JSON.stringify(value, (key, item) => PRIVATE_KEY.test(key) ? undefined : item)) as T;
}

function publicMatch(match: ClubMatch) {
  const date = dateMillis(match.date);
  const analysis = match.analysis;
  // Explicit allowlist keeps account metadata, editor drafts and private narration issues out.
  return publicCopy({
    id: match.id, version: match.version, revision: match.revision, seasonId: match.seasonId,
    rival: match.rival, competition: match.competition, date: Number.isFinite(date) ? date : null,
    home: match.home, status: match.status, duration: match.duration, durationSeconds: match.durationSeconds,
    clock: match.clock, goalsFor: match.goalsFor, goalsAgainst: match.goalsAgainst,
    starters: match.starters, bench: match.bench, notCalled: match.notCalled, guests: match.guests,
    events: match.events ?? [], ledger: match.ledger, system: match.system, analysisCoverage: match.analysisCoverage,
    ...(analysis ? { analysis: { version: analysis.version, revision: analysis.revision, profile: analysis.profile, observations: analysis.observations, coverage: analysis.coverage } } : {}),
  });
}

/** Filters select the result sample; full public actas preserve receivers, rivals and linked plays. */
export function createAnalysisExport({ matches, filters = {}, people = [], view = {}, exportedAt }: {
  matches: readonly ClubMatch[];
  filters?: AnalysisFilters;
  people?: readonly { id: string; name: string; number?: string | number | null }[];
  view?: Pick<AnalysisSearch, "analysis" | "family" | "metric" | "q" | "excluded">;
  exportedAt: string;
}) {
  const selected = selectAnalysisMatches(matches, filters) as ClubMatch[];
  const records = selected.map(publicMatch);
  const results = evaluateNarrated(records as readonly NarratedMatch[], filters);
  return {
    format: "piti-statistics/v1", schemaVersion: 1, exportedAt,
    metadata: {
      catalogSourceSha256: NARRATED_CATALOG_SOURCE_SHA256,
      metricCount: results.length, matchIds: selected.map(match => match.id),
      factsScope: "Actas públicas completas de los partidos seleccionados. Los filtros de jugador, equipo, parte y contexto se aplican a los resultados; los hechos conservan receptores, rivales y jugadas vinculadas.",
      privacy: "Sin fragmentos de narración, fuentes privadas ni datos de cuenta. Los identificadores de evidencia y las reglas se conservan.",
    },
    filters: publicCopy({ ...filters, team: filters.team ?? "us" }),
    view: publicCopy({ analysis: view.analysis, family: view.family, metric: view.metric, q: view.q, excluded: view.excluded }),
    people: people.map(({ id, name, number }) => ({ id, name, ...(number != null ? { number } : {}) })),
    coverage: records.map(match => ({ matchId: match.id, legacy: match.analysisCoverage ?? null, families: match.analysis?.coverage ?? [] })),
    matches: records,
    results: results.map(result => ({ ...result, name: NARRATED_METRIC_BY_ID.get(result.id)?.name, category: NARRATED_METRIC_BY_ID.get(result.id)?.category })),
  };
}
