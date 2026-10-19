import { useMemo, useState } from "react";
import { Link } from "@tanstack/react-router";
import { evaluateNarrated } from "../../../functions/src/narrated/engine";
import { NARRATED_METRIC_BY_ID } from "../../../functions/src/narrated/catalog";
import type { AnalysisFilters, MetricResult, NarratedMatch } from "../../../functions/src/narrated/types";
import type { AnalysisSearch } from "../../lib/analysisSearch";
import { hasAnalysisActions } from "../../lib/technicalAnalysis";
import type { ClubMatch } from "../../lib/clubData";
import { TechnicalStatsPanel, type Person } from "./TechnicalStats";
import { AnalysisCatalog, MetricState } from "./AnalysisCatalog";
import { metricValue } from "../../lib/metricDisplay";
import { createAnalysisExport } from "../../lib/analysisExport";
import { ScopePicker } from "./AnalysisScope";
import "./analysis-panels.css";

const HIGHLIGHTS = ["015", "067", "070", "029", "105", "125"];
export interface AnalysisPanelsProps {
  matches: readonly ClubMatch[];
  people: Person[];
  seasonId?: string | null;
  filters?: AnalysisFilters;
  search?: AnalysisSearch;
  onSearchChange?: (patch: Partial<AnalysisSearch>) => void;
  /** Match hosts keep this scope fixed and link to the same selection in Números. */
  matchId?: string;
}

export function AnalysisPanels({ matches, people, seasonId, filters = {}, search: controlled, onSearchChange, matchId }: AnalysisPanelsProps) {
  const [local, setLocal] = useState<AnalysisSearch>({});
  const [exportStatus, setExportStatus] = useState("");
  const search = controlled ?? local;
  const update = (patch: Partial<AnalysisSearch>) => onSearchChange ? onSearchChange(patch) : setLocal(previous => ({ ...previous, ...patch }));
  const scopeKey = JSON.stringify({ ...filters, playerIds: search.players ?? filters.playerIds, team: search.team ?? filters.team, period: search.period ?? filters.period });
  const scope = useMemo<AnalysisFilters>(() => JSON.parse(scopeKey), [scopeKey]);
  const results = useMemo(() => evaluateNarrated(matches as readonly NarratedMatch[], scope), [matches, scope]);
  const byId = new Map(results.map(result => [result.id, result]));
  const view = search.analysis ?? "summary";
  const selected = scope.playerIds ?? [];
  const focused = selected.length > 0 || scope.team === "opponent" || scope.period != null;
  const individual = useMemo(() => (scope.playerIds ?? []).map(id => ({ id, values: new Map(evaluateNarrated(matches as readonly NarratedMatch[], { ...scope, playerIds: [id] }).map(result => [result.id, result])) })), [matches, scope]);
  const open = (metric: string) => update({ analysis: "catalog", metric, family: undefined, q: undefined });
  const exportSelection = () => {
    try {
      const now = new Date().toISOString();
      const data = createAnalysisExport({ matches, filters: scope, people, view: search, exportedAt: now });
      const url = URL.createObjectURL(new Blob([JSON.stringify(data, null, 2)], { type: "application/json;charset=utf-8" }));
      const link = document.createElement("a");
      link.href = url;
      link.download = `piti-estadisticas-${now.slice(0, 10)}.json`;
      link.rel = "noopener";
      document.body.appendChild(link);
      try { link.click(); } finally { link.remove(); setTimeout(() => URL.revokeObjectURL(url), 1000); }
      setExportStatus(`Exportación preparada: ${data.matches.length} ${data.matches.length === 1 ? "partido" : "partidos"}, resultados y evidencias públicas.`);
    } catch { setExportStatus("No se ha podido preparar la exportación. Inténtalo de nuevo."); }
  };
  return <section className="analysis-panels" aria-label="Análisis de las jugadas">
    <header className="an-head">
      <div><span className="an-eyebrow">{matchId ? "Este partido" : `${matches.length} ${matches.length === 1 ? "partido" : "partidos"} en la selección`}</span><h2>El juego, con sus datos</h2><p>{selected.length ? `${selected.length} ${selected.length === 1 ? "jugador seleccionado" : "jugadores seleccionados"}. Los porcentajes se calculan sobre su muestra conjunta.` : `${scope.team === "opponent" ? "El rival" : "El Piti"}. Cada cifra conserva el contexto de las jugadas.`}{scope.period != null ? ` Solo ${scope.period === 1 ? "la primera parte" : scope.period === 2 ? "la segunda parte" : `la parte ${scope.period}`}.` : ""}</p></div>
      <div className="an-head-actions">{matchId && <Link className="an-link" to="/stats" search={{ season: "all", view: "game", matches: [matchId], players: search.players, analysis: search.analysis, family: search.family, metric: search.metric, q: search.q, excluded: search.excluded, team: search.team, period: search.period }}>Abrir esta selección en Números ↗</Link>}<button type="button" className="an-export" onClick={exportSelection}>Exportar selección JSON</button></div>
    </header>
    {exportStatus && <p className="an-note" role="status" aria-label="Estado de la exportación">{exportStatus}</p>}
    {matchId && <div className="an-scopes"><ScopePicker label="Jugadores" options={people.map(person => ({ id: person.id, label: person.name }))} selected={search.players} onChange={players => update({ players: players.length ? players : undefined, team: "us" })}/></div>}
    <div className="an-context-filters" aria-label="Contexto de las jugadas"><label>Equipo<select value={scope.team ?? "us"} onChange={event => update({ team: event.target.value as "us" | "opponent", ...(event.target.value === "opponent" ? { players: undefined } : {}) })}><option value="us">Manchester Piti</option><option value="opponent">El rival</option></select></label><label>Parte<select value={scope.period ?? ""} onChange={event => update({ period: event.target.value ? Number(event.target.value) : undefined })}><option value="">Todo el partido</option>{Array.from({ length: Math.max(2, scope.period ?? 0, ...matches.map(match => (match as NarratedMatch).analysis?.profile.periodMinutes.length ?? 2)) }, (_, index) => <option key={index} value={index + 1}>{index === 0 ? "Primera parte" : index === 1 ? "Segunda parte" : `Parte ${index + 1}`}</option>)}</select></label></div>
    <nav className="an-nav" aria-label="Vistas del análisis">
      <button type="button" aria-pressed={view === "summary"} onClick={() => update({ analysis: "summary" })}>Resumen del juego</button>
      <button type="button" aria-pressed={view === "catalog"} onClick={() => update({ analysis: "catalog" })}>Catálogo de estadísticas</button>
    </nav>
    {view === "catalog" ? <AnalysisCatalog matches={matches} people={people} results={results} search={search} onChange={update}/> : <>
      <div className="an-highlights" aria-label="Indicadores de la selección">{HIGHLIGHTS.map(id => {
        const result = byId.get(id); const definition = NARRATED_METRIC_BY_ID.get(id);
        return result && definition ? <button key={id} type="button" onClick={() => open(id)} className="an-highlight"><span>{definition.name}</span><strong>{metricValue(result)}</strong><MetricState status={result.status}/><small>{result.denominator != null ? `${result.numerator ?? 0} de ${result.denominator}` : `${result.observed} observaciones`} · Ver detalle ↗</small></button> : null;
      })}</div>
      <p className="an-note">«—» indica que no se puede dar una cifra; «0» solo aparece cuando los datos permiten afirmar que no ocurrió. Los datos parciales cuentan únicamente lo registrado.</p>
      {selected.length > 0 && <section className="an-comparison" aria-label="Jugadores seleccionados"><h3>La misma muestra, jugador a jugador</h3><p>Los registros conservan a receptores y rivales para calcular cada intervención. No se suman porcentajes individuales.</p><div className="an-table-wrap"><table><caption>Estadísticas de los jugadores seleccionados</caption><thead><tr><th scope="col">Jugador</th>{HIGHLIGHTS.map(id => <th scope="col" key={id}>{NARRATED_METRIC_BY_ID.get(id)?.name}</th>)}</tr></thead><tbody>{individual.map(person => <tr key={person.id}><th scope="row">{people.find(player => player.id === person.id)?.name ?? "Jugador no disponible"}</th>{HIGHLIGHTS.map(id => { const value = person.values.get(id); return <td key={id}>{value ? <><b>{metricValue(value)}</b><MetricState status={value.status}/></> : "—"}</td>; })}</tr>)}</tbody></table></div></section>}
      {focused ? <ScopedMetricBars results={byId} onOpen={open}/> : hasAnalysisActions(matches) ? <TechnicalStatsPanel matches={matches} people={people} seasonId={seasonId}/> : <div className="an-empty"><h3>El análisis empieza con las jugadas</h3><p>Las actas ya pueden aportar goles o minutos. Para ver redes de pases, remates y duelos hacen falta sus acciones. El catálogo explica qué datos requiere cada estadística.</p><button type="button" onClick={() => update({ analysis: "catalog" })}>Explorar el catálogo</button></div>}
      <SummaryGroups results={results} names={new Map(people.map(person => [person.id, person.name]))} onOpen={open}/>
    </>}
  </section>;
}

function ScopedMetricBars({ results, onOpen }: { results: Map<string, MetricResult>; onOpen: (id: string) => void }) {
  return <div className="an-group-charts" aria-label="Gráficas de la selección">{[{ title: "El pase", ids: ["067", "068", "069"] }, { title: "Los remates", ids: ["029", "030", "031", "032", "033"] }].map(group => {
    const rows = group.ids.flatMap(id => results.get(id) ? [results.get(id)!] : []); const max = Math.max(1, ...rows.map(row => row.value ?? 0));
    return <section key={group.title}><h3>{group.title}</h3><p>Acciones registradas en esta selección. Abre una cifra para consultar su muestra.</p><ol>{rows.map(row => <li key={row.id}><button type="button" onClick={() => onOpen(row.id)}>{NARRATED_METRIC_BY_ID.get(row.id)?.name}</button><b>{metricValue(row)}</b>{row.value != null ? <meter min={0} max={max} value={row.value} aria-label={`${NARRATED_METRIC_BY_ID.get(row.id)?.name}: ${metricValue(row)}`}/> : <span className="an-missing-bar">Sin valor conocido</span>}<MetricState status={row.status}/></li>)}</ol></section>;
  })}</div>;
}

function SummaryGroups({ results, names, onOpen }: { results: MetricResult[]; names: Map<string, string>; onOpen: (id: string) => void }) {
  const groups = results.filter(result => result.groups?.length && HIGHLIGHTS.includes(result.id)).slice(0, 2);
  return groups.length ? <div className="an-group-charts">{groups.map(result => {
    const rows = [...(result.groups ?? [])].sort((a, b) => b.value - a.value).slice(0, 8); const max = Math.max(1, ...rows.map(row => row.value));
    return <section key={result.id}><h3>{NARRATED_METRIC_BY_ID.get(result.id)?.name}</h3><ol>{rows.map(row => <li key={row.key}><span>{names.get(row.key) ?? row.key}</span><b>{row.value}</b><meter min={0} max={max} value={row.value} aria-label={`${names.get(row.key) ?? row.key}: ${row.value}`}/></li>)}</ol><button type="button" onClick={() => onOpen(result.id)}>Ver muestra y jugadas</button></section>;
  })}</div> : null;
}
