import { useId, useMemo, useState, type CSSProperties } from "react";
import { Link } from "@tanstack/react-router";
import type { AnalysisFilters, MetricResult } from "../../../functions/src/narrated/types";
import { buildInsightTimeline, buildPassMatrix, insightEvidence, INSIGHT_METRICS, type InsightSegment } from "../../lib/analysisInsights";
import { formatWorkspaceMetric, workspaceMetricValue, type WorkspacePerson } from "../../lib/analysisWorkspace";
import { formatDate, type ClubMatch } from "../../lib/clubData";
import { MetricState } from "./AnalysisCatalog";
import "./analysis-insights.css";

export interface AnalysisInsightsProps {
  matches: readonly ClubMatch[];
  people: readonly WorkspacePerson[];
  filters?: AnalysisFilters;
  onInspect?: (metricId: string, playerId?: string) => void;
}
const minutes = new Intl.NumberFormat("es-ES", { maximumFractionDigits: 1 });
const clock = (second: number) => `${Math.floor(second / 60)}′${second % 60 ? ` ${Math.floor(second % 60)}″` : ""}`;
const partLabel = (period: number) => period ? `${period}.ª parte` : "Tiempo de juego sin desglose por partes";
const segmentLabel = (segment: InsightSegment) => `${partLabel(segment.period)} · ${clock(segment.from)}–${clock(segment.to)}`;

/** Local chart selections reveal their own evidence; they never silently replace the page scope. */
export function AnalysisInsights({ matches, people, filters = {}, onInspect }: AnalysisInsightsProps) {
  const uid = useId();
  const [view, setView] = useState<"timeline" | "matrix">("timeline");
  const scopeKey = JSON.stringify(filters);
  const scope = useMemo<AnalysisFilters>(() => JSON.parse(scopeKey), [scopeKey]);
  return <section className="ai" aria-labelledby={`${uid}-title`}>
    <header className="ai-head"><div><span className="ai-eyebrow">Leer el partido</span><h3 id={`${uid}-title`}>Dónde cambia el juego</h3><p>Busca momentos y conexiones. Toca una barra o una pareja para revisar las jugadas que hay detrás.</p></div><span className="ai-context">{scope.team === "opponent" ? "El rival" : scope.playerIds?.length ? "Jugadores seleccionados" : "Manchester Piti"}{scope.period ? ` · ${partLabel(scope.period)}` : ""}</span></header>
    <div className="ai-tabs" role="group" aria-label="Gráficas interactivas"><button type="button" aria-pressed={view === "timeline"} onClick={() => setView("timeline")}>Evolución por tramos</button><button type="button" aria-pressed={view === "matrix"} onClick={() => setView("matrix")}>Quién conecta con quién</button></div>
    {view === "timeline" ? <Timeline matches={matches} people={people} filters={scope} onInspect={onInspect}/> : <Matrix matches={matches} people={people} filters={scope} onInspect={onInspect}/>}
  </section>;
}

function Timeline({ matches, people, filters = {}, onInspect }: AnalysisInsightsProps) {
  const [metric, setMetric] = useState("067");
  const [selection, setSelection] = useState("");
  const data = useMemo(() => buildInsightTimeline(matches, filters, metric), [matches, filters, metric]);
  const selected = data.segments.find(segment => segment.key === selection) ?? data.segments[0];
  const max = metric === "070" ? 100 : Math.max(1, ...data.segments.map(segment => workspaceMetricValue(segment.result) ?? 0));
  const periods = [...new Set(data.segments.map(segment => segment.period))];
  return <div className="ai-timeline">
    <div className="ai-controls"><label>Qué ver por tramos<select value={metric} onChange={event => setMetric(event.target.value)}>{INSIGHT_METRICS.map(item => <option key={item.id} value={item.id}>{item.label}</option>)}</select></label><p>Tramos de 5 minutos de juego, desde el inicio real de cada parte. El descanso queda fuera.</p></div>
    <p className="ai-note">Localiza cuándo aumentan las pérdidas o baja el acierto y revisa qué pasó. {data.matchCount > 1 ? `Acumulado de ${data.matchCount} partidos, no la evolución de un único encuentro. Cada tramo indica cuántos aportan datos; los más cortos pueden tener menos tiempo observado.` : "Cada barra cuenta solo las acciones de ese tramo."} El acierto divide los pases completados entre los intentos con resultado conocido.</p>
    {data.omittedMatches > 0 && <p className="ai-warning">{data.omittedMatches} {data.omittedMatches === 1 ? "partido sin límites de tiempo suficientes: no se le asignan tramos." : "partidos sin límites de tiempo suficientes: no se les asignan tramos."}</p>}
    {data.uncertainActions > 0 && <p className="ai-note">Hay {data.uncertainActions} acciones sin un instante exacto. Las que no pueden ubicarse dentro de un tramo quedan pendientes; no se reparten entre barras.</p>}
    {!data.segments.length ? <div className="ai-empty"><h4>No hay tramos comparables en esta selección</h4><p>Hace falta conocer los límites de juego y la participación en el período elegido. No se sustituyen por minutos estimados.</p></div> : <>
      {periods.map(period => <section className="ai-period" key={period} aria-label={partLabel(period)}><h4>{partLabel(period)}</h4>{period === 0 && <p className="ai-note">Estas actas tienen duración total, pero no el inicio de cada parte. Se muestran aparte para no mezclar relojes distintos.</p>}<div className="ai-trend-scroll" role="region" tabIndex={0} aria-label={`Barras de ${partLabel(period)}`}><ol className="ai-trend">{data.segments.filter(segment => segment.period === period).map(segment => {
        const value = workspaceMetricValue(segment.result);
        return <li key={segment.key}><button type="button" aria-pressed={selected?.key === segment.key} aria-label={`${segmentLabel(segment)}: ${formatWorkspaceMetric(segment.result, true)}. ${segment.completeMatches} de ${segment.matches} partidos completos. Ver jugadas`} onClick={() => setSelection(segment.key)}><strong>{formatWorkspaceMetric(segment.result)}</strong><span className={`ai-column${value == null ? " is-missing" : ""}`} aria-hidden="true"><i style={{ height: `${value == null ? 0 : value / max * 100}%` }}/></span><b>{clock(segment.from)}–{clock(segment.to)}</b><small>{segment.matches} {segment.matches === 1 ? "partido" : "partidos"}</small><MetricState status={segment.result.status}/></button></li>;
      })}</ol></div></section>)}
      {selected && <section className="ai-detail" aria-label="Detalle del tramo"><header><div><span className="ai-eyebrow">Tramo seleccionado</span><h4>{segmentLabel(selected)}</h4></div><div className="ai-value"><strong>{formatWorkspaceMetric(selected.result, true)}</strong><MetricState status={selected.result.status}/></div></header><dl className="ai-sample"><div><dt>Partidos del tramo</dt><dd>{selected.matches}</dd></div><div><dt>Cobertura completa</dt><dd>{selected.completeMatches}/{selected.matches}</dd></div><div><dt>Tiempo acumulado del tramo</dt><dd>{minutes.format(selected.playedSeconds / 60)} min</dd></div>{selected.result.denominator != null && <div><dt>Pases con resultado conocido</dt><dd>{selected.result.numerator}/{selected.result.denominator}</dd></div>}</dl><p className="ai-note">{selected.result.reason}</p><p className="ai-note">El último tramo de una parte puede ser más corto. Un tramo sin participación del jugador seleccionado no cuenta como cero.</p><Evidence key={`${selected.key}:${metric}`} matches={matches} people={people} filters={filters} result={selected.result}/>{onInspect && <button className="ai-link" type="button" onClick={() => onInspect(metric)}>Ver el cálculo de esta estadística en toda la selección ↗</button>}</section>}
    </>}
  </div>;
}

function Matrix({ matches, people, filters = {}, onInspect }: AnalysisInsightsProps) {
  const [mode, setMode] = useState<"volume" | "accuracy">("volume");
  const [selection, setSelection] = useState("");
  const data = useMemo(() => buildPassMatrix(matches, people, filters), [matches, people, filters]);
  const byPair = new Map(data.cells.map(cell => [JSON.stringify([cell.from, cell.to]), cell]));
  const chosen = byPair.get(selection) ?? [...data.cells].sort((a, b) => b.attempts - a.attempts)[0];
  const names = new Map([...data.senders, ...data.receivers].map(person => [person.id, person.name]));
  const max = mode === "accuracy" ? 100 : Math.max(1, ...data.cells.map(cell => workspaceMetricValue(cell.volume) ?? 0));
  return <div className="ai-matrix">
    <div className="ai-controls"><label>Color y cifra de la matriz<select value={mode} onChange={event => setMode(event.target.value as "volume" | "accuracy")}><option value="volume">Pases completados</option><option value="accuracy">Acierto de pase</option></select></label><p>Lee de la fila a la columna: quien pasa → quien recibe. Cada dirección se cuenta por separado.</p></div>
    <p className="ai-note">Encuentra los socios habituales y quién recibe menos conexiones; compara también sus minutos antes de sacar conclusiones. {data.matchCount} {data.matchCount === 1 ? "partido" : "partidos"} · {data.attempts} pases registrados en esta selección. El filtro de jugadores elige emisores; conserva a sus destinatarios. Los fallidos solo se atribuyen a una pareja si consta a quién iban dirigidos.</p>
    {(data.unattributed > 0 || data.pending > 0) && <p className="ai-warning">{data.unattributed} pases sin pareja identificable · {data.pending} pendientes de clasificación. No se asignan a una conexión ni se convierten en ceros.</p>}
    {!data.senders.length || !data.receivers.length ? <div className="ai-empty"><h4>Aún no se pueden dibujar las conexiones</h4><p>Hacen falta pases con emisor y receptor identificados{filters.team === "opponent" ? " del rival" : ""}. Las acciones anónimas siguen en los totales del equipo.</p></div> : <>
      <div className="ai-matrix-scroll" role="region" tabIndex={0} aria-label="Matriz de pases con desplazamiento horizontal"><table aria-label="Matriz dirigida de pases"><caption>Emisor ↓ · Receptor → · {mode === "volume" ? "Completados" : "Acierto sobre resultados conocidos"}</caption><thead><tr><th scope="col">Pasa ↓ / recibe →</th>{data.receivers.map(person => <th scope="col" key={person.id}>{person.number != null && <b>#{person.number}</b>}<span>{person.name}</span></th>)}</tr></thead><tbody>{data.senders.map(sender => <tr key={sender.id}><th scope="row">{sender.number != null && <b>#{sender.number}</b>}<span>{sender.name}</span></th>{data.receivers.map(receiver => {
        const key = JSON.stringify([sender.id, receiver.id]); const cell = byPair.get(key); const result = cell?.[mode]; const value = workspaceMetricValue(result);
        return <td key={receiver.id}>{!cell ? <span className="ai-diagonal" aria-label="Mismo jugador">·</span> : <button type="button" aria-pressed={chosen?.from === cell.from && chosen?.to === cell.to} aria-label={`${sender.name} a ${receiver.name}: ${formatWorkspaceMetric(result, true)}. ${cell.completed} completados, ${cell.failed} fallidos, ${cell.unknown} sin resultado. Ver jugadas`} onClick={() => setSelection(key)} style={{ "--ai-heat": value == null ? 0 : value / max } as CSSProperties}><strong>{formatWorkspaceMetric(result)}</strong><small>{mode === "volume" ? `${cell.attempts} intentos` : `${cell.completed}/${cell.completed + cell.failed}`}</small>{result?.status !== "complete" && <span className="ai-cell-state">{result?.status === "partial" ? "Parcial" : value == null ? "Sin muestra" : ""}</span>}</button>}</td>;
      })}</tr>)}</tbody></table></div>
      <p className="ai-note">Desliza para ver más receptores. «-» indica que no hay una cifra respaldada; 0 solo aparece con una muestra conocida. El sombreado acompaña al número.</p>
      {chosen && <section className="ai-detail" aria-label="Detalle de la conexión"><header><div><span className="ai-eyebrow">Conexión seleccionada</span><h4>{names.get(chosen.from)} → {names.get(chosen.to)}</h4></div><div className="ai-value"><strong>{formatWorkspaceMetric(chosen.accuracy)}</strong><MetricState status={chosen.accuracy.status}/></div></header><dl className="ai-sample"><div><dt>Completados</dt><dd>{formatWorkspaceMetric(chosen.volume)}</dd></div><div><dt>Fallidos registrados</dt><dd>{chosen.completed + chosen.failed ? chosen.failed : "-"}</dd></div><div><dt>Sin resultado</dt><dd>{chosen.unknown}</dd></div><div><dt>Base del acierto</dt><dd>{chosen.completed}/{chosen.completed + chosen.failed}</dd></div></dl><p className="ai-note">{chosen.volume.reason}</p><Evidence key={`${chosen.from}:${chosen.to}`} matches={matches} people={[...people, ...data.senders, ...data.receivers]} filters={filters} result={chosen.volume}/>{onInspect && <button className="ai-link" type="button" onClick={() => onInspect("070", filters.team === "opponent" ? undefined : chosen.from)}>Ver el cálculo del emisor con todos sus destinatarios ↗</button>}</section>}
    </>}
  </div>;
}

function Evidence({ matches, people, result }: { matches: readonly ClubMatch[]; people: readonly WorkspacePerson[]; filters: AnalysisFilters; result: MetricResult }) {
  const [limit, setLimit] = useState(12);
  const rows = useMemo(() => insightEvidence(matches, result.evidenceEventIds), [matches, result.evidenceEventIds]);
  const names = new Map(people.map(person => [person.id, person.name]));
  const games = new Map(matches.map(match => [match.id, match]));
  const labels: Record<string, string> = { pass: "Pase", distribution: "Distribución", shot: "Remate", goal: "Gol", loss: "Pérdida", recovery: "Recuperación" };
  const outcomes: Record<string, string> = { complete: "Completado", completed: "Completado", success: "Completado", failed: "Fallido", incomplete: "Fallido", intercepted: "Interceptado", saved: "Parado", off_target: "Fuera", on_target: "A puerta", blocked: "Bloqueado", woodwork: "Al palo" };
  return <div className="ai-evidence"><h5>Jugadas de esta muestra ({rows.length})</h5>{!rows.length ? <p className="ai-note">{workspaceMetricValue(result) === 0 ? "La cobertura respalda este cero; no hay jugadas que listar." : "No hay jugadas atribuibles con suficiente precisión en esta muestra."}</p> : <ol>{rows.slice(0, limit).map(event => {
    const match = games.get(event.matchId); const actor = event.team === "opponent" ? event.opponentId : event.actorId; const destination = event.team === "opponent" ? String(event.facts.opponentReceiverId ?? "") : event.receiverId ?? event.intendedReceiverId;
    return <li key={event.evidenceId}><span className="ai-event-time">{event.period ? `${event.period}.ª · ` : ""}{event.time ? `${event.time.precision === "approximate" ? "≈" : ""}${clock(event.time.from)}${event.time.to !== event.time.from ? `–${clock(event.time.to)}` : ""}` : "Sin minuto"}</span><div><b>{labels[event.aggregate?.kind ?? event.kind] ?? "Jugada"} · {actor ? names.get(actor) ?? "Jugador no identificado" : event.team === "opponent" ? "El rival" : "El Piti"}{destination ? ` → ${names.get(destination) ?? "Receptor no identificado"}` : ""}</b><small>{outcomes[String(event.facts.outcome)] ?? "Resultado sin precisar"}{event.quantity && event.quantity > 1 ? ` · ${event.quantity} acciones agrupadas` : ""}</small>{match && <Link to="/partidos/$matchId/numeros" params={{ matchId: match.id }} search={{}}>Abrir partido · {formatDate(match.date)} · {match.rival ?? "Rival"} ↗</Link>}</div></li>;
  })}</ol>}{rows.length > limit && <button type="button" className="ai-link" onClick={() => setLimit(previous => previous + 12)}>Ver más jugadas ({limit}/{rows.length})</button>}</div>;
}
