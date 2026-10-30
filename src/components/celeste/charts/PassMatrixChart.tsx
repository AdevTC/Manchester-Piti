import { useMemo, useState, type CSSProperties } from "react";
import { buildPassMatrix, type PassConnection } from "../../../lib/analysisInsights";
import { formatWorkspaceMetric, selectAnalysisMatches, workspaceMetricValue, type WorkspacePerson } from "../../../lib/analysisWorkspace";
import { byPosition, chartPositions } from "../../../lib/chartPositions";
import type { ClubMatch } from "../../../lib/clubData";
import { AnalysisInsightEvidence } from "../AnalysisInsightEvidence";
import { MetricState } from "../MetricState";
import { chartNumber } from "./format";
import { ChartHero, ChartHow, ChartKpis, ChartSeg, type ChartProps } from "./parts";
import "./tramos.css";

export type MatrixMode = "volume" | "accuracy";
export type MatrixOrder = "position" | "volume";
const MODES = [{ value: "volume", label: "Pases completados" }, { value: "accuracy", label: "Acierto de pase" }] as const;
const ORDERS = [{ value: "position", label: "Por puesto" }, { value: "volume", label: "Por volumen" }] as const;

/** Who passes to whom: rows give, columns receive, each direction on its own. The shade goes with the number. */
export function PassMatrixChart({ matches, people, filters = {}, onInspect, mode, onMode, order, onOrder }: ChartProps & { mode: MatrixMode; onMode: (m: MatrixMode) => void; order: MatrixOrder; onOrder: (o: MatrixOrder) => void }) {
  const [selection, setSelection] = useState("");
  const data = useMemo(() => buildPassMatrix(matches, people, filters), [matches, people, filters]);
  const positions = useMemo(() => chartPositions(selectAnalysisMatches(matches, filters) as ClubMatch[]), [matches, filters]);
  const byPair = new Map(data.cells.map(cell => [JSON.stringify([cell.from, cell.to]), cell]));
  const person = new Map<string, WorkspacePerson>([...data.senders, ...data.receivers].map(p => [p.id, p]));
  const give = new Map<string, number>(), get = new Map<string, number>();
  for (const c of data.cells) { give.set(c.from, (give.get(c.from) ?? 0) + c.completed); get.set(c.to, (get.get(c.to) ?? 0) + c.completed); }
  const sheet = byPosition(positions, id => person.get(id)?.number);
  const sortBy = (totals: Map<string, number>) => (a: WorkspacePerson, b: WorkspacePerson) => order === "volume" ? (totals.get(b.id) ?? 0) - (totals.get(a.id) ?? 0) || sheet(a.id, b.id) : sheet(a.id, b.id);
  const senders = [...data.senders].sort(sortBy(give)), receivers = [...data.receivers].sort(sortBy(get));
  const chosen: PassConnection | undefined = byPair.get(selection) ?? [...data.cells].sort((a, b) => b.attempts - a.attempts)[0];
  const name = (id: string) => person.get(id)?.name ?? "Jugador no identificado";
  const max = mode === "accuracy" ? 100 : Math.max(1, ...data.cells.map(cell => workspaceMetricValue(cell.volume) ?? 0));
  const opponent = filters.team === "opponent";

  const toolbar = <div className="gt-mtools"><ChartSeg label="Color y cifra de la matriz" opts={MODES} value={mode} onPick={onMode}/><ChartSeg label="Orden" opts={ORDERS} value={order} onPick={onOrder}/><p className="gc-viewhint">Lee de la fila a la columna: quien pasa → quien recibe. El sombreado acompaña al número.</p></div>;
  if (!data.senders.length || !data.receivers.length) return <>{toolbar}<div className="gc-empty"><h4>Aún no se pueden dibujar las conexiones</h4><p>Hacen falta pases con emisor y receptor identificados{opponent ? " del rival" : ""}. Las acciones anónimas siguen en los totales del equipo.</p></div></>;

  const top = (totals: Map<string, number>) => [...totals].filter(([, n]) => n > 0).sort((a, b) => b[1] - a[1] || sheet(a[0], b[0]))[0];
  const giver = top(give), receiver = top(get);
  const pair = [...data.cells].filter(c => c.completed > 0).sort((a, b) => b.completed - a.completed)[0];
  const hero = giver ? `${name(giver[0])} es quien más reparte: ${giver[1]} ${giver[1] === 1 ? "pase completado" : "pases completados"}` : "Aún no hay pases completados entre jugadores identificados";
  const heroP = giver ? `${pair ? `La conexión más repetida es ${name(pair.from)} → ${name(pair.to)} (${pair.completed}). ` : ""}${receiver ? `${name(receiver[0])} es quien más recibe (${receiver[1]}).` : ""}` : "";
  const head = (p: WorkspacePerson) => <><b>{p.number ?? "·"}</b><span>{p.name}</span></>;

  return <>
    <ChartHero title={hero}>{heroP || undefined}</ChartHero>
    <ChartKpis label="Cifras de la matriz" items={[{ label: "Pases registrados", value: chartNumber.format(data.attempts) }, { label: "Emisores", value: String(senders.length) }, { label: "Receptores", value: String(receivers.length) }, { label: "Sin pareja identificable", value: chartNumber.format(data.unattributed) }]}/>
    <div className="gt-matrix">
      {toolbar}
      {(data.unattributed > 0 || data.pending > 0) && <p className="gc-note">{data.unattributed} pases sin pareja identificable · {data.pending} pendientes de clasificación. No se asignan a una conexión ni se convierten en ceros.</p>}
      <div className="gt-mscroll" role="region" tabIndex={0} aria-label="Matriz de pases; desliza para ver más receptores">
        <table className="gt-mt" aria-label="Matriz dirigida de pases">
          <caption className="vd-vh">Emisor en filas, receptor en columnas · {mode === "volume" ? "pases completados" : "acierto sobre resultados conocidos"}</caption>
          <thead><tr><th scope="col" className="gt-mt__corner">Pasa ↓ · recibe →</th>{receivers.map(p => <th scope="col" key={p.id} className={chosen?.to === p.id ? "is-cross" : undefined}>{head(p)}</th>)}<th scope="col"><b>Da</b><span>total</span></th></tr></thead>
          <tbody>{senders.map(sender => <tr key={sender.id}><th scope="row" className={chosen?.from === sender.id ? "is-cross" : undefined}>{head(sender)}</th>{receivers.map(receiver => {
            const key = JSON.stringify([sender.id, receiver.id]); const cell = byPair.get(key); const result = cell?.[mode]; const value = workspaceMetricValue(result);
            const cross = !!chosen && (chosen.from === sender.id || chosen.to === receiver.id); const heat = value == null ? 0 : value / max;
            return <td key={receiver.id} className={cross ? "is-cross" : undefined}>{!cell ? <span className="gt-diag" aria-label={sender.id === receiver.id ? "Mismo jugador" : "Jugadores de actas distintas"}>{sender.id === receiver.id ? "·" : "-"}</span> : <button type="button" className={`gt-cell${heat > .55 ? " is-hot" : ""}${value === 0 ? " gt-cell--zero" : ""}`} style={{ "--h": heat } as CSSProperties} aria-pressed={chosen === cell} aria-label={`${sender.name} a ${receiver.name}: ${formatWorkspaceMetric(result, true)}${mode === "volume" ? " completados" : " de acierto"}. ${cell.completed} completados, ${cell.failed} fallidos, ${cell.unknown} sin resultado. Ver jugadas`} onClick={() => setSelection(key)}><strong>{formatWorkspaceMetric(result)}</strong><small>{mode === "volume" ? `${cell.attempts} int.` : `${cell.completed}/${cell.completed + cell.failed}`}</small>{result && result.status === "partial" && <em className="gt-cell__st">Parcial</em>}</button>}</td>;
          })}<td className="gt-mt__tot">{give.get(sender.id) ?? 0}</td></tr>)}</tbody>
          <tfoot><tr><th scope="row">Recibe</th>{receivers.map(p => <td key={p.id} className="gt-mt__tot">{get.get(p.id) ?? 0}</td>)}<td/></tr></tfoot>
        </table>
      </div>
      {opponent && data.matchCount > 1 && <p className="gc-note">Los jugadores rivales se mantienen separados por partido: un mismo dorsal no identifica a la misma persona en dos actas.</p>}
    </div>
    {chosen && <section className="gc-detail" aria-label="Detalle de la conexión">
      <header className="gc-detail__head"><div><p className="gc-detail__k">Conexión elegida</p><h4>{name(chosen.from)} → {name(chosen.to)}</h4></div><div className="gc-detail__val"><strong>{formatWorkspaceMetric(chosen.accuracy)}</strong><MetricState status={chosen.accuracy.status}/></div></header>
      <dl className="gc-dstats"><div><dt>Completados</dt><dd>{formatWorkspaceMetric(chosen.volume)}</dd></div><div><dt>Fallidos registrados</dt><dd>{chosen.completed + chosen.failed ? chosen.failed : "-"}</dd></div><div><dt>Sin resultado</dt><dd>{chosen.unknown}</dd></div><div><dt>Base del acierto</dt><dd>{chosen.completed}/{chosen.completed + chosen.failed}</dd></div></dl>
      <p className="gc-note">{chosen.volume.reason}</p>
      <AnalysisInsightEvidence key={`${chosen.from}:${chosen.to}`} matches={matches} people={[...people, ...data.senders, ...data.receivers]} filters={filters} result={chosen.volume}/>
      {onInspect && <div className="gc-actions"><button className="vd-glass vd-btn vd-press ai-btn" type="button" onClick={() => onInspect("070", opponent ? undefined : chosen.from)}>Ver el cálculo del emisor con todos sus destinatarios ↗</button></div>}
    </section>}
    <ChartHow>
      <p>Cada fila es quien pasa y cada columna quien recibe; cada dirección se cuenta por separado. «Da» y «Recibe» suman los pases completados de cada jugador. Ordénala por puesto (del portero al delantero, según los minutos de cada puesto en las actas) o por volumen para ver los socios habituales, y compara sus minutos antes de sacar conclusiones.</p>
      <p>{data.matchCount} {data.matchCount === 1 ? "partido" : "partidos"} · {data.attempts} pases registrados en esta selección. El filtro de jugadores elige emisores; conserva a sus destinatarios. Los fallidos solo se atribuyen a una pareja si consta a quién iban dirigidos.</p>
      <p>«-» indica que no hay una cifra respaldada; 0 solo aparece con una muestra conocida. El sombreado acompaña al número.</p>
    </ChartHow>
  </>;
}
