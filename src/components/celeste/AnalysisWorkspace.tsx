import { useEffect, useId, useMemo, useState, type CSSProperties } from "react";
import type { AnalysisFilters, MetricResult } from "../../../functions/src/narrated/types";
import type { NarratedMetricDefinition } from "../../../functions/src/narrated/catalog";
import type { ClubMatch } from "../../lib/clubData";
import {
  ANALYSIS_WORKSPACE_METRICS, ANALYSIS_WORKSPACE_PRESETS, analysisMetricSupportsPlayer,
  buildAnalysisWorkspace, formatWorkspaceMetric, rankAnalysisRows, sortAnalysisRows, workspaceMetricValue,
  type AnalysisSortDirection, type AnalysisWorkspaceRow, type WorkspacePerson,
} from "../../lib/analysisWorkspace";
import "./analysis-workspace.css";

const METRICS = new Map(ANALYSIS_WORKSPACE_METRICS.map(metric => [metric.id, metric]));
const FAMILIES = [...new Set(ANALYSIS_WORKSPACE_METRICS.map(metric => metric.category))];
const STATUS: Record<MetricResult["status"], string> = { complete: "Completo", partial: "Parcial", unknown: "Sin información", not_configured: "Falta criterio", not_applicable: "No aplicable", no_sample: "Sin muestra" };
const normal = (value: string) => value.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLocaleLowerCase("es");
type Inspect = (metricId: string, playerId?: string) => void;
type View = "table" | "ranking" | "compare";
const PREFERENCE_KEY = "piti-analysis-workspace-v1";
interface Preferences { columns: string[]; view: View; sort: { metric: string; direction: AnalysisSortDirection }; rankingId: string; rankingDirection: AnalysisSortDirection; rankingLimit: number; secondId: string }
const defaults = (): Preferences => ({ columns: [...ANALYSIS_WORKSPACE_PRESETS[0].metricIds], view: "table", sort: { metric: "001", direction: "desc" }, rankingId: "067", rankingDirection: "desc", rankingLimit: 10, secondId: "029" });
function readPreferences(): Preferences {
  const initial = defaults();
  try {
    if (typeof window === "undefined" || typeof window.sessionStorage?.getItem !== "function") return initial;
    const saved = JSON.parse(window.sessionStorage.getItem(PREFERENCE_KEY) ?? "null") as Partial<Preferences> | null;
    if (!saved || typeof saved !== "object") return initial;
    return { columns: Array.isArray(saved.columns) ? [...new Set(saved.columns.filter(id => typeof id === "string" && METRICS.has(id)))] : initial.columns,
      view: saved.view === "ranking" || saved.view === "compare" ? saved.view : "table",
      sort: { metric: METRICS.has(saved.sort?.metric ?? "") ? saved.sort!.metric : initial.sort.metric, direction: saved.sort?.direction === "asc" ? "asc" : "desc" },
      rankingId: METRICS.has(saved.rankingId ?? "") ? saved.rankingId! : initial.rankingId,
      secondId: METRICS.has(saved.secondId ?? "") ? saved.secondId! : initial.secondId,
      rankingDirection: saved.rankingDirection === "asc" ? "asc" : "desc",
      rankingLimit: [0, 5, 10, 20].includes(saved.rankingLimit ?? -1) ? saved.rankingLimit! : initial.rankingLimit,
    };
  } catch { return initial; }
}
export interface AnalysisWorkspaceProps {
  matches: readonly ClubMatch[];
  people: readonly WorkspacePerson[];
  filters?: AnalysisFilters;
  onInspect: Inspect;
}

/** Presentation choices stay local; the match/season/player sample always comes from the host. */
export function AnalysisWorkspace({ matches, people, filters = {}, onInspect }: AnalysisWorkspaceProps) {
  const labelId = useId(), hintId = useId();
  const [initial] = useState(readPreferences);
  const [view, setView] = useState<View>(initial.view);
  const [columns, setColumns] = useState<string[]>(initial.columns);
  const [name, setName] = useState("");
  const [sort, setSort] = useState(initial.sort);
  const [rankingId, setRankingId] = useState(initial.rankingId);
  const [rankingDirection, setRankingDirection] = useState<AnalysisSortDirection>(initial.rankingDirection);
  const [rankingLimit, setRankingLimit] = useState(initial.rankingLimit);
  const [secondId, setSecondId] = useState(initial.secondId);
  const [csvStatus, setCsvStatus] = useState("");
  useEffect(() => {
    try { if (typeof window !== "undefined" && typeof window.sessionStorage?.setItem === "function") window.sessionStorage.setItem(PREFERENCE_KEY, JSON.stringify({ columns, view, sort, rankingId, rankingDirection, rankingLimit, secondId } satisfies Preferences)); } catch { /* Presentation still works when browser storage is unavailable. */ }
  }, [columns, view, sort, rankingId, rankingDirection, rankingLimit, secondId]);
  const scopeKey = JSON.stringify(filters);
  const scope = useMemo<AnalysisFilters>(() => JSON.parse(scopeKey), [scopeKey]);
  const metricKey = [...new Set([...columns, rankingId, secondId])].join(",");
  const workspace = useMemo(() => buildAnalysisWorkspace(matches, people, scope, metricKey.split(",")), [matches, people, scope, metricKey]);
  const visibleColumns = columns.flatMap(id => METRICS.get(id) ? [METRICS.get(id)!] : []);
  const filteredRows = workspace.rows.filter(row => normal(`${row.person.name} ${row.person.number ?? ""}`).includes(normal(name.trim())));
  const orderMetric = columns.includes(sort.metric) ? sort.metric : columns[0] ?? rankingId;
  const rows = sortAnalysisRows(filteredRows, orderMetric, sort.direction);
  const totalLabel = scope.team === "opponent" ? "Total del rival" : scope.playerIds?.length ? "Total de la selección" : "Total del Piti";
  const tableCaption = "Estadísticas por jugador";
  const selectPreset = (ids: readonly string[]) => { setColumns([...ids]); setSort({ metric: ids[0], direction: "desc" }); };
  const toggleColumn = (id: string) => setColumns(previous => previous.includes(id) ? previous.filter(value => value !== id) : [...previous, id]);
  const exportTable = () => {
    const quote = (value: string) => `"${(/^[=+\-@\t\r]/.test(value) ? `'${value}` : value).replaceAll('"', '""')}"`;
    const cells = (values: string[]) => values.map(quote).join(";");
    const resultCells = (results: Map<string, MetricResult>) => visibleColumns.flatMap(metric => { const result = results.get(metric.id); return [formatWorkspaceMetric(result, true), result ? STATUS[result.status] : "Sin información"]; });
    const csv = [cells(["Jugador", "Dorsal", ...visibleColumns.flatMap(metric => [metric.name, `${metric.name} · estado`])]), ...rows.map(row => cells([row.person.name, String(row.person.number ?? ""), ...resultCells(row.results)])), cells([`${totalLabel} (filtros de la página; sin búsqueda de nombre)`, "", ...resultCells(workspace.total)])].join("\r\n");
    try {
      const url = URL.createObjectURL(new Blob(["\uFEFF", csv], { type: "text/csv;charset=utf-8" }));
      const link = document.createElement("a"); link.href = url; link.download = "piti-tabla-estadisticas.csv"; link.rel = "noopener";
      document.body.appendChild(link);
      try { link.click(); } finally { link.remove(); setTimeout(() => URL.revokeObjectURL(url), 1000); }
      setCsvStatus(`Tabla preparada: ${rows.length} filas de jugadores y el total contextual.`);
    } catch { setCsvStatus("No se ha podido preparar la tabla. Inténtalo de nuevo."); }
  };
  return <section id="an-workspace" className="aw" aria-labelledby={labelId}>
    <header className="aw-head"><div><span className="aw-eyebrow">{workspace.matchIds.length} {workspace.matchIds.length === 1 ? "partido" : "partidos"} · {workspace.rows.length} {workspace.rows.length === 1 ? "jugador" : "jugadores"}</span><h3 id={labelId}>Todos los números, a tu medida</h3><p>Elige qué comparar. Cada cifra abre su cálculo y las jugadas que la sostienen.</p></div><span className="aw-scope">{scope.team === "opponent" ? "El rival" : scope.playerIds?.length ? "Jugadores seleccionados" : "Manchester Piti"}{scope.period != null ? ` · Parte ${scope.period}` : ""}</span></header>
    <div className="aw-toolbar"><div className="aw-views" role="group" aria-label="Presentación de las estadísticas">{([["table", "Tabla"], ["ranking", "Ranking"], ["compare", "Dos métricas"]] as const).map(([id, label]) => <button key={id} type="button" aria-pressed={view === id} onClick={() => setView(id)}>{label}</button>)}</div><label className="aw-search">Buscar jugador o dorsal<input type="search" value={name} onChange={event => setName(event.target.value)} placeholder="Nombre o dorsal" aria-describedby={hintId}/></label></div>
    <p id={hintId} className="aw-note">{name.trim() ? `${filteredRows.length} de ${workspace.rows.length} jugadores visibles. ` : ""}La búsqueda solo oculta filas; el total conserva los filtros de la página. «-» es un dato no disponible; un 0 sí está respaldado por la muestra.</p>
    {view === "table" ? <>
      <div className="aw-table-tools"><div className="aw-presets" role="group" aria-label="Columnas habituales">{ANALYSIS_WORKSPACE_PRESETS.map(preset => <button type="button" key={preset.id} aria-pressed={columns.join(",") === preset.metricIds.join(",")} onClick={() => selectPreset(preset.metricIds)}>{preset.label}</button>)}</div><button className="aw-action" type="button" disabled={!visibleColumns.length || !workspace.matchIds.length} onClick={exportTable}>Descargar tabla CSV</button></div>
      <ColumnPicker selected={columns} onToggle={toggleColumn} onChange={setColumns}/>
      {csvStatus && <p className="aw-note" role="status">{csvStatus}</p>}
      {!visibleColumns.length ? <div className="aw-empty"><h4>Elige las columnas que quieres ver</h4><p>Puedes empezar con una combinación habitual o buscar cualquier estadística del catálogo.</p><button type="button" className="aw-action" onClick={() => selectPreset(ANALYSIS_WORKSPACE_PRESETS[0].metricIds)}>Recuperar columnas de resumen</button></div> : <>
        <div className="aw-table-scroll" role="region" aria-label="Tabla de estadísticas con desplazamiento horizontal" tabIndex={0}>
          <table aria-label={tableCaption}><caption>{tableCaption} · {visibleColumns.length} columnas</caption><thead><tr><th scope="col" className="aw-player">Jugador</th>{visibleColumns.map(metric => <th key={metric.id} scope="col" aria-sort={orderMetric === metric.id ? sort.direction === "desc" ? "descending" : "ascending" : "none"}><button type="button" className="aw-sort" onClick={() => setSort({ metric: metric.id, direction: orderMetric === metric.id && sort.direction === "desc" ? "asc" : "desc" })} aria-label={`Ordenar por ${metric.name}, ${orderMetric === metric.id && sort.direction === "desc" ? "de menor a mayor" : "de mayor a menor"}`}><span>{metric.name}</span><span aria-hidden="true">{orderMetric === metric.id ? sort.direction === "desc" ? "↓" : "↑" : "↕"}</span></button><small>{!analysisMetricSupportsPlayer(metric) ? "Solo contexto" : workspace.total.get(metric.id)?.unit || "Por jugador"}</small></th>)}</tr></thead>
            <tbody>{rows.map(row => <tr key={row.person.id}><th scope="row" className="aw-player"><PlayerName person={row.person}/></th>{visibleColumns.map(metric => <td key={metric.id}><Cell metric={metric} result={row.results.get(metric.id)} label={row.person.name} playerId={row.person.id} onInspect={onInspect}/></td>)}</tr>)}{!rows.length && <tr><td className="aw-table-empty" colSpan={visibleColumns.length + 1}>{scope.team === "opponent" ? "El rival se consulta como equipo. Sus cifras están en el total contextual." : name.trim() ? "Ningún jugador coincide con esta búsqueda." : "Aún no hay participación registrada para esta selección."}</td></tr>}</tbody>
            <tfoot><tr><th scope="row" className="aw-player">{totalLabel}<small>Muestra conjunta</small></th>{visibleColumns.map(metric => <td key={metric.id}><Cell metric={metric} result={workspace.total.get(metric.id)} label={totalLabel} onInspect={onInspect}/></td>)}</tr></tfoot>
          </table>
        </div><p className="aw-note aw-table-foot">Desliza la tabla para ver más columnas. El total se recalcula sobre las jugadas; los porcentajes no son la suma ni la media simple de los jugadores.</p>
      </>}
    </> : <>
      <div className="aw-chart-controls"><MetricPicker label={view === "ranking" ? "Estadística del ranking" : "Primera métrica"} value={rankingId} onChange={setRankingId}/>{view === "compare" ? <MetricPicker label="Segunda métrica" value={secondId} onChange={setSecondId}/> : <label>Orden del ranking<select value={rankingDirection} onChange={event => setRankingDirection(event.target.value as AnalysisSortDirection)}><option value="desc">Mayor primero</option><option value="asc">Menor primero</option></select></label>}{view === "ranking" && <label>Mostrar<select value={rankingLimit} onChange={event => setRankingLimit(Number(event.target.value))}><option value={5}>5 jugadores</option><option value={10}>10 jugadores</option><option value={20}>20 jugadores</option><option value={0}>Todos</option></select></label>}</div>
      {view === "ranking" ? <Ranking rows={filteredRows} total={workspace.total} metric={METRICS.get(rankingId)!} direction={rankingDirection} limit={rankingLimit} totalLabel={totalLabel} opponent={scope.team === "opponent"} onInspect={onInspect}/> : <Comparison rows={filteredRows} total={workspace.total} first={METRICS.get(rankingId)!} second={METRICS.get(secondId)!} totalLabel={totalLabel} opponent={scope.team === "opponent"} onInspect={onInspect}/>}
    </>}
  </section>;
}

function PlayerName({ person }: { person: WorkspacePerson }) {
  return <span className="aw-person">{person.number != null && person.number !== "" && <span className="aw-shirt" aria-label={`Dorsal ${person.number}`}>{person.number}</span>}<span>{person.name}</span></span>;
}

function Cell({ metric, result, label, playerId, onInspect, includeUnit = false }: { metric: NarratedMetricDefinition; result?: MetricResult; label: string; playerId?: string; onInspect: Inspect; includeUnit?: boolean }) {
  const contextOnly = !!playerId && !analysisMetricSupportsPlayer(metric);
  const status = contextOnly ? "Solo contexto" : result ? STATUS[result.status] : "Sin información";
  const sample = result?.numerator != null && result.denominator != null && result.denominator > 0 ? `${result.numerator}/${result.denominator}` : null;
  return <button type="button" className={`aw-cell${result?.status === "partial" ? " is-partial" : ""}`} onClick={() => onInspect(metric.id, contextOnly ? undefined : playerId)} aria-label={`${label}: ${metric.name}, ${formatWorkspaceMetric(result, true)}.${sample ? ` Muestra ${result!.numerator} de ${result!.denominator}.` : ""} ${status}. Ver detalle`}><strong>{formatWorkspaceMetric(result, includeUnit)}</strong>{sample && <small>{sample}</small>}{status !== "Completo" && <small>{status}</small>}</button>;
}

function ColumnPicker({ selected, onToggle, onChange }: { selected: string[]; onToggle: (id: string) => void; onChange: (ids: string[]) => void }) {
  const [query, setQuery] = useState(""), [family, setFamily] = useState("");
  const available = ANALYSIS_WORKSPACE_METRICS.filter(metric => (!family || metric.category === family) && normal(`${metric.id} ${metric.name} ${metric.category}`).includes(normal(query.trim())));
  return <details className="aw-columns"><summary><span>Personalizar columnas</span><b>{selected.length} seleccionadas</b><span aria-hidden="true">+</span></summary><div className="aw-columns-body"><div className="aw-column-filters"><label>Buscar columna<input type="search" value={query} onChange={event => setQuery(event.target.value)} placeholder="Pases, pérdidas, presión…"/></label><label>Familia de columnas<select value={family} onChange={event => setFamily(event.target.value)}><option value="">Todas las familias</option>{FAMILIES.map(value => <option key={value}>{value}</option>)}</select></label></div><div className="aw-column-actions"><span>{available.length} disponibles · {selected.length} seleccionadas</span><button type="button" onClick={() => onChange([...new Set([...selected, ...available.map(metric => metric.id)])])} disabled={!available.length}>Añadir resultados</button><button type="button" onClick={() => onChange([])} disabled={!selected.length}>Quitar todas</button></div><fieldset><legend className="aw-sr">Columnas del catálogo de estadísticas</legend>{available.map(metric => <label key={metric.id}><input type="checkbox" checked={selected.includes(metric.id)} onChange={() => onToggle(metric.id)}/><span><b>{metric.name}</b><small>{metric.category}{!analysisMetricSupportsPlayer(metric) ? " · Solo contexto del equipo" : ""}</small></span></label>)}{!available.length && <p>No hay columnas que coincidan. Prueba otra búsqueda o familia.</p>}</fieldset></div></details>;
}

function MetricPicker({ label, value, onChange }: { label: string; value: string; onChange: (id: string) => void }) {
  return <label>{label}<select value={value} onChange={event => onChange(event.target.value)}>{FAMILIES.map(family => <optgroup key={family} label={family}>{ANALYSIS_WORKSPACE_METRICS.filter(metric => metric.category === family).map(metric => <option key={metric.id} value={metric.id}>{metric.name}{!analysisMetricSupportsPlayer(metric) ? " · Equipo" : ""}</option>)}</optgroup>)}</select></label>;
}

function Bar({ result, min, max, series = "a" }: { result?: MetricResult; min: number; max: number; series?: "a" | "b" }) {
  const value = workspaceMetricValue(result);
  if (value == null) return <span className="aw-bar aw-bar--missing" aria-hidden="true"/>;
  const extent = max - min || 1, zero = -min / extent * 100;
  const left = value < 0 ? (value - min) / extent * 100 : zero;
  return <span className={`aw-bar aw-bar--${series}`} aria-hidden="true" style={{ "--aw-zero": `${zero}%`, "--aw-left": `${left}%`, "--aw-width": `${Math.abs(value) / extent * 100}%` } as CSSProperties}><i/></span>;
}

function Ranking({ rows, total, metric, direction, limit, totalLabel, opponent, onInspect }: { rows: AnalysisWorkspaceRow[]; total: Map<string, MetricResult>; metric: NarratedMetricDefinition; direction: AnalysisSortDirection; limit: number; totalLabel: string; opponent: boolean; onInspect: Inspect }) {
  const contextual = opponent || !analysisMetricSupportsPlayer(metric);
  const ranked = rankAnalysisRows(rows, metric.id, direction);
  const known = ranked.filter(row => row.rank != null), unknown = ranked.filter(row => row.rank == null);
  const visible = limit ? known.slice(0, limit) : known;
  const values = known.map(row => workspaceMetricValue(row.results.get(metric.id))!);
  const min = Math.min(0, ...values), max = Math.max(0, ...values);
  return <section className="aw-chart" aria-label={`Ranking de ${metric.name}`}><header><div><h4>{metric.name}</h4><p>{contextual ? "Esta cifra describe al equipo; no se reparte entre jugadores." : `${known.length} jugadores con cifra · ${direction === "desc" ? "de mayor a menor" : "de menor a mayor"}. Los empates comparten puesto.`}</p></div><button type="button" className="aw-action" onClick={() => onInspect(metric.id)}>Ver cálculo</button></header>{contextual ? <div className="aw-context-number"><span>{totalLabel}</span><Cell metric={metric} result={total.get(metric.id)} label={totalLabel} onInspect={onInspect} includeUnit/></div> : !known.length ? <div className="aw-empty"><h4>Aún no hay cifras comparables</h4><p>Prueba otra estadística o amplía la selección. No se asignan puestos a datos desconocidos.</p></div> : <ol className="aw-ranking">{visible.map(row => <li key={row.person.id}><button type="button" onClick={() => onInspect(metric.id, row.person.id)} aria-label={`Puesto ${row.rank}, ${row.person.name}: ${formatWorkspaceMetric(row.results.get(metric.id), true)}. Ver ${metric.name}`}><span className="aw-rank">{row.rank}</span><span className="aw-ranking-body"><span><PlayerName person={row.person}/><b>{formatWorkspaceMetric(row.results.get(metric.id), true)}</b></span><Bar result={row.results.get(metric.id)} min={min} max={max}/><small>{STATUS[row.results.get(metric.id)!.status]}{row.results.get(metric.id)?.denominator != null ? ` · ${row.results.get(metric.id)?.numerator ?? 0} de ${row.results.get(metric.id)?.denominator}` : ""}</small></span></button></li>)}</ol>}{!contextual && unknown.length > 0 && <p className="aw-note">Sin cifra, fuera del ranking: {unknown.map(row => row.person.name).join(", ")}.</p>}{!contextual && visible.length < known.length && <p className="aw-note">Mostrando {visible.length} de {known.length}. Selecciona «Todos» para ver el ranking completo.</p>}</section>;
}

function Comparison({ rows, total, first, second, totalLabel, opponent, onInspect }: { rows: AnalysisWorkspaceRow[]; total: Map<string, MetricResult>; first: NarratedMetricDefinition; second: NarratedMetricDefinition; totalLabel: string; opponent: boolean; onInspect: Inspect }) {
  const contextual = opponent || !analysisMetricSupportsPlayer(first) || !analysisMetricSupportsPlayer(second);
  const ordered = sortAnalysisRows(rows, first.id);
  const comparison = contextual ? [{ person: { id: "", name: totalLabel }, results: total }] : ordered;
  const ranges = [first, second].map(metric => { const values = comparison.flatMap(row => { const value = workspaceMetricValue(row.results.get(metric.id)); return value == null ? [] : [value]; }); return { min: Math.min(0, ...values), max: Math.max(0, ...values) }; });
  return <section className="aw-chart" aria-label="Comparación de dos métricas"><header><div><h4>Dos lecturas del mismo juego</h4><p>{contextual ? "Hay una métrica de equipo: se compara el total contextual, sin atribuirlo a cada jugador. " : ""}Cada serie utiliza su propia escala. Compara jugadores dentro de la misma serie.</p></div></header><div className="aw-legend"><span><i className="aw-series-a"/>A · {first.name}</span><span><i className="aw-series-b"/>B · {second.name}</span></div>{!comparison.length ? <div className="aw-empty"><h4>No hay jugadores en esta selección</h4><p>Amplía los filtros o borra la búsqueda de nombre para compararlos.</p></div> : <ol className="aw-comparison">{comparison.map(row => <li key={row.person.id || "total"}><PlayerName person={row.person}/><div>{[first, second].map((metric, index) => <button type="button" key={`${index}-${metric.id}`} onClick={() => onInspect(metric.id, row.person.id || undefined)} aria-label={`${row.person.name}, ${metric.name}: ${formatWorkspaceMetric(row.results.get(metric.id), true)}. Ver detalle`}><span className="aw-series-letter">{index === 0 ? "A" : "B"}</span><Bar result={row.results.get(metric.id)} {...ranges[index]} series={index === 0 ? "a" : "b"}/><span className="aw-pair-value"><b>{formatWorkspaceMetric(row.results.get(metric.id), true)}</b><small>{row.results.get(metric.id) ? STATUS[row.results.get(metric.id)!.status] : "Sin información"}</small></span></button>)}</div></li>)}</ol>}</section>;
}
