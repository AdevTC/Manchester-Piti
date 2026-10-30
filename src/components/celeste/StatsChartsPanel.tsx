import { useId, useMemo, useState } from "react";
import type { AnalysisFilters } from "../../../functions/src/narrated/types";
import type { ClubMatch } from "../../lib/clubData";
import { buildPassingNetwork, buildShotChart } from "../../lib/statsCharts";
import { formatWorkspaceMetric, workspaceMetricValue, type WorkspacePerson } from "../../lib/analysisWorkspace";
import { AnalysisInsights, AnalysisInsightEvidence } from "./AnalysisInsights";
import { MetricState } from "./MetricState";
import "./stats-charts.css";

export interface StatsChartsPanelProps {
  matches: readonly ClubMatch[];
  people: readonly WorkspacePerson[];
  filters?: AnalysisFilters;
  onInspect?: (metricId: string, playerId?: string) => void;
}
const views = [{ id: "network", label: "Red de pases" }, { id: "insights", label: "Tramos y matriz" }, { id: "shots", label: "Remates" }] as const;
type View = typeof views[number]["id"];

/** Shared by Números and the match: chart controls change the view, never the page's sample. */
export function StatsChartsPanel({ matches, people, filters = {}, onInspect }: StatsChartsPanelProps) {
  const uid = useId();
  const [view, setView] = useState<View>("network");
  const key = JSON.stringify(filters);
  const scope = useMemo<AnalysisFilters>(() => JSON.parse(key), [key]);
  const props = { matches, people, filters: scope, onInspect };
  return <section className="sc-panel" aria-labelledby={`${uid}-title`}>
    <header className="sc-head"><div><h3 id={`${uid}-title`}>El juego, en gráficas</h3><p>Las mismas jugadas y filtros que las cifras de esta selección.</p></div><span className="sc-context">{scope.team === "opponent" ? "El rival" : scope.playerIds?.length ? "Jugadores elegidos" : "Manchester Piti"}{scope.period ? ` · ${scope.period}.ª parte` : ""}</span></header>
    <div className="sc-tabs" role="group" aria-label="Vistas de las gráficas">{views.map(item => <button type="button" key={item.id} aria-pressed={view === item.id} onClick={() => setView(item.id)}>{item.label}</button>)}</div>
    {view === "network" ? <PassingNetwork {...props}/> : view === "insights" ? <AnalysisInsights {...props}/> : <ShotChart {...props}/>}
  </section>;
}

function PassingNetwork({ matches, people, filters = {}, onInspect }: StatsChartsPanelProps) {
  const uid = useId();
  const data = useMemo(() => buildPassingNetwork(matches, people, filters), [matches, people, filters]);
  const [highlight, setHighlight] = useState("");
  const [pair, setPair] = useState("");
  const active = data.nodes.some(node => node.id === highlight) ? highlight : "";
  const nodes = data.nodes.map((node, index) => ({ ...node, x: 180 + 130 * Math.cos(-Math.PI / 2 + index * 2 * Math.PI / data.nodes.length), y: 180 + 130 * Math.sin(-Math.PI / 2 + index * 2 * Math.PI / data.nodes.length) }));
  const byId = new Map(nodes.map(node => [node.id, node]));
  const edges = data.edges.filter(edge => !active || edge.from === active || edge.to === active).sort((a, b) => b.completed - a.completed || a.from.localeCompare(b.from));
  const chosen = edges.find(edge => `${edge.from}>${edge.to}` === pair);
  const maxNode = Math.max(1, ...nodes.map(node => node.involvement));
  const maxEdge = Math.max(1, ...edges.map(edge => edge.completed));
  const chooseNode = (id: string) => { setHighlight(active === id ? "" : id); setPair(""); };
  const guard = data.cells.find(cell => ["not_configured", "not_applicable"].includes(cell.volume.status))?.volume;
  return <div className="sc-network-view">
    <p className="sc-note">Cada dorsal es un jugador. El círculo crece con los pases completados que da y recibe; la línea, con los pases de una pareja. Las flechas indican la dirección. Es un esquema, no sus posiciones en el campo.</p>
    {filters.team === "opponent" && data.matchCount > 1 && <p className="sc-note">Los jugadores rivales se mantienen separados por partido: un mismo dorsal no identifica a la misma persona en dos actas.</p>}
    <div className="sc-meta"><span><b>{data.totalCompleted ?? "—"}</b> pases completados</span><span><b>{data.completed}</b> representados en la red</span>{data.unrepresentedCompleted != null && data.unrepresentedCompleted > 0 && <span><b>{data.unrepresentedCompleted}</b> completados sin pareja identificada</span>}<span><b>{data.edges.length}</b> conexiones dirigidas</span><span>{data.matchCount} {data.matchCount === 1 ? "partido" : "partidos"}</span></div>
    {(data.unattributed > 0 || data.pending > 0) && <p className="sc-note">En total, {data.unattributed} intentos no tienen pareja identificable; pueden ser completados, fallidos o sin resultado. {data.pending} pendientes de clasificación. La red solo representa pases completados entre dos jugadores identificados.</p>}
    {!nodes.length ? <div className="sc-empty"><h4>Aún no se puede dibujar la red</h4><p>{guard?.reason ?? "Hace falta algún pase completado con quien lo da y quien lo recibe identificados. Los pases sin pareja siguen contando en los totales del equipo."}</p></div> : <>
      <div className="sc-network-layout">
        <div className="sc-drawing">
          <svg className="sc-network" viewBox="0 0 360 360" role="group" aria-label="Red dirigida de pases completados">
            <defs><marker id={`${uid}-arrow`} markerWidth="8" markerHeight="8" refX="7" refY="4" orient="auto" markerUnits="userSpaceOnUse"><path d="M0 0L8 4L0 8z" fill="currentColor"/></marker></defs>
            <circle className="sc-orbit" cx="180" cy="180" r="130"/>
            {edges.map(edge => {
              const a = byId.get(edge.from)!, b = byId.get(edge.to)!;
              const dx = b.x - a.x, dy = b.y - a.y, length = Math.hypot(dx, dy);
              const cx = (a.x + b.x) / 2 - dy / length * 22, cy = (a.y + b.y) / 2 + dx / length * 22;
              const start = Math.hypot(cx - a.x, cy - a.y), end = Math.hypot(cx - b.x, cy - b.y);
              const path = `M ${a.x + (cx - a.x) / start * 24} ${a.y + (cy - a.y) / start * 24} Q ${cx} ${cy} ${b.x + (cx - b.x) / end * 27} ${b.y + (cy - b.y) / end * 27}`;
              return <path key={`${edge.from}>${edge.to}`} className={`sc-edge${chosen === edge ? " is-selected" : ""}`} d={path} strokeWidth={1.5 + 5 * edge.completed / maxEdge} markerEnd={`url(#${uid}-arrow)`}><title>{a.name} → {b.name}: {edge.completed} pases completados</title></path>;
            })}
            {nodes.map(node => <g key={node.id} className={`sc-node${active === node.id ? " is-selected" : ""}`} role="button" tabIndex={0} aria-pressed={active === node.id} aria-label={`Resaltar a ${node.name}: ${node.sent} pases dados y ${node.received} recibidos`} onClick={() => chooseNode(node.id)} onKeyDown={event => { if (event.key === "Enter" || event.key === " ") { event.preventDefault(); chooseNode(node.id); } }}>
              <circle className="sc-node-hit" cx={node.x} cy={node.y} r="29"/>
              <circle className="sc-node-disc" cx={node.x} cy={node.y} r={14 + 7 * Math.sqrt(node.involvement / maxNode)}/>
              <text x={node.x} y={node.y} textAnchor="middle" dominantBaseline="central">{node.number ?? "·"}</text><title>{node.name}</title>
            </g>)}
          </svg>
          <label className="sc-picker">Resaltar conexiones de<select value={active} onChange={event => { setHighlight(event.target.value); setPair(""); }}><option value="">Todos los jugadores de la red</option>{nodes.map(node => <option value={node.id} key={node.id}>{node.number != null ? `#${node.number} · ` : ""}{node.name}</option>)}</select></label>
          {filters.playerIds?.length ? <p className="sc-note">El filtro general elige quién pasa. Sus receptores se mantienen para no perder conexiones.</p> : <p className="sc-note">Toca un dorsal para resaltar sus conexiones. El selector permite hacer lo mismo con teclado.</p>}
        </div>
        <div className="sc-pairs"><h4>{active ? `Conexiones de ${byId.get(active)?.name}` : "Quién se encuentra"}</h4><p className="sc-note">De quien pasa a quien recibe. Elige una pareja para ver sus jugadas.</p><ol aria-label="Conexiones de la red">{edges.map(edge => <li key={`${edge.from}>${edge.to}`}><button type="button" aria-pressed={chosen === edge} aria-label={`${byId.get(edge.from)?.name} a ${byId.get(edge.to)?.name}: ${edge.completed} pases completados. Ver jugadas`} onClick={() => setPair(`${edge.from}>${edge.to}`)}><span>{byId.get(edge.from)?.name}<i aria-hidden="true"> → </i><span className="vd-vh"> a </span>{byId.get(edge.to)?.name}</span><b>{edge.completed}<small>pases</small></b></button></li>)}</ol></div>
      </div>
      {chosen && <section className="sc-detail" aria-label="Jugadas de la conexión elegida"><header><h4>{byId.get(chosen.from)?.name} → {byId.get(chosen.to)?.name}</h4><button type="button" onClick={() => setPair("")}>Cerrar detalle</button></header><dl><div><dt>Completados</dt><dd>{chosen.completed}</dd></div><div><dt>Fallidos conocidos</dt><dd>{chosen.failed}</dd></div><div><dt>Sin resultado</dt><dd>{chosen.unknown}</dd></div><div><dt>Acierto de la pareja</dt><dd>{formatWorkspaceMetric(chosen.accuracy)}</dd></div></dl><p className="sc-note">{chosen.completed}/{chosen.completed + chosen.failed} con resultado conocido. <MetricState status={chosen.accuracy.status}/></p><AnalysisInsightEvidence key={`${chosen.from}:${chosen.to}`} matches={matches} people={[...people, ...data.nodes]} filters={filters} result={chosen.volume}/>{onInspect && <button className="sc-link" type="button" onClick={() => onInspect("068", filters.team === "opponent" ? undefined : chosen.from)}>Ver todos los pases completados del emisor ↗</button>}</section>}
    </>}
  </div>;
}

function ShotChart({ matches, people, filters = {}, onInspect }: StatsChartsPanelProps) {
  const data = useMemo(() => buildShotChart(matches, filters), [matches, filters]);
  const [metric, setMetric] = useState("029");
  const selected = data.bars.find(bar => bar.id === metric)!;
  const max = Math.max(1, ...data.bars.map(bar => workspaceMetricValue(bar.result) ?? 0));
  return <div className="sc-shots">
    <h4>Cómo terminan los remates</h4><p className="sc-note">Selecciona una barra para revisar sus jugadas. Las categorías se solapan: un gol que toca el palo cuenta como gol, a puerta y a la madera, pero sigue siendo un único remate. No se dibujan posiciones que la narración no indica.</p>
    <ol className="sc-shot-bars" aria-label="Remates por resultado">{data.bars.map(bar => { const value = workspaceMetricValue(bar.result); return <li key={bar.id}><button type="button" aria-pressed={metric === bar.id} onClick={() => setMetric(bar.id)}><span>{bar.label}</span><strong>{formatWorkspaceMetric(bar.result)}</strong><i className={value == null ? "is-missing" : ""} aria-hidden="true"><em style={{ width: `${value == null ? 0 : value / max * 100}%` }}/></i><MetricState status={bar.result.status}/></button></li>; })}</ol>
    <section className="sc-detail" aria-label="Jugadas del resultado de remate"><header><h4>{selected.label}</h4><strong>{formatWorkspaceMetric(selected.result, true)}</strong></header><p className="sc-note">{selected.result.reason}</p><AnalysisInsightEvidence key={metric} matches={matches} people={people} filters={filters} result={selected.result}/>{onInspect && <button type="button" className="sc-link" onClick={() => onInspect(metric)}>Ver cómo se calcula ↗</button>}</section>
  </div>;
}
