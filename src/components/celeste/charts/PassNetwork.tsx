import { useId, useMemo, useState } from "react";
import { evaluateNarrated } from "../../../../functions/src/narrated/engine";
import type { MetricResult } from "../../../../functions/src/narrated/types";
import { buildPassingNetwork } from "../../../lib/statsCharts";
import { formatWorkspaceMetric, selectAnalysisMatches, workspaceMetricValue } from "../../../lib/analysisWorkspace";
import type { PassConnection } from "../../../lib/analysisInsights";
import { byPosition, chartPositions, type ChartPosition } from "../../../lib/chartPositions";
import { POSITIONS } from "../../../lib/positions";
import { autoThreshold, pitchLayout, ringLayout, strongestPair, type NetworkView } from "../../../lib/passNetworkLayout";
import { AnalysisInsightEvidence } from "../AnalysisInsights";
import { MetricState } from "../MetricState";
import { ChartHero, ChartHow, ChartKpis, ChartStage, ChartViews, type ChartProps } from "./parts";
import { chartNumber, chartPercent } from "./format";
import { NetShirt, PassNetworkDrawing, type DrawEdge, type DrawNode } from "./PassNetworkDrawing";
import "./pass-network.css";

const VIEWS = [{ value: "campo", label: "Sobre el campo" }, { value: "circulo", label: "En círculo" }] as const;
const HINTS: Record<NetworkView, string> = { campo: "Cada dorsal, en el sitio de sus puestos del acta.", circulo: "Todos en un círculo, por líneas: del portero al delantero." };
const LIST_LIMIT = 8;
const passes = (n: number) => `${n} ${n === 1 ? "pase" : "pases"}`;
const pairKey = (e: { from: string; to: string }) => JSON.stringify([e.from, e.to]);

type Edge = PassConnection & DrawEdge;

/** «Red de pases»: who finds whom, on the pitch at the spot of each player's puestos (or on a ring), with the pair
 *  ranking beside it and the chosen pair's plays below. */
export function PassNetworkView({ matches, people, filters = {}, onInspect }: ChartProps) {
  const uid = useId().replace(/[^a-zA-Z0-9_-]/g, "");
  const data = useMemo(() => buildPassingNetwork(matches, people, filters), [matches, people, filters]);
  const rival = filters.team === "opponent";
  const sample = useMemo(() => { const ids = new Set(selectAnalysisMatches(matches, filters).map(m => m.id)); return matches.filter(m => ids.has(m.id)); }, [matches, filters]);
  const positions = useMemo(() => rival ? new Map<string, ChartPosition>() : chartPositions(sample), [rival, sample]);
  const filterKey = JSON.stringify(filters);
  const [chosen, setChosen] = useState({ filterKey, pair: "" });
  const [picked, setPicked] = useState("");
  const [viewPick, setViewPick] = useState<NetworkView>("campo");
  const [thrPick, setThrPick] = useState<number | null>(null);
  const [allPairs, setAllPairs] = useState(false);

  const nodes = data.nodes;
  const byId = new Map(nodes.map(n => [n.id, n]));
  const nameOf = (id: string) => byId.get(id)?.name ?? "Jugador no identificado";
  const edges: Edge[] = useMemo(() => data.edges.map(e => ({ ...e, key: pairKey(e) })), [data.edges]);
  const hasPositions = nodes.some(n => positions.has(n.id));
  const view: NetworkView = hasPositions ? viewPick : "circulo";
  const node = byId.has(picked) ? picked : "";
  // A player's accuracy includes passes with an unidentified recipient. The network's
  // cells intentionally omit those passes, so they cannot supply his personal total.
  const playerMetrics = useMemo(() => {
    if (!node || rival) return new Map<string, MetricResult>();
    const scope = { ...filters, playerIds: [node] };
    return new Map(evaluateNarrated(selectAnalysisMatches(sample, scope), scope, ["001", "070"]).map(result => [result.id, result]));
  }, [node, rival, sample, filters]);
  const pair = chosen.filterKey === filterKey ? edges.find(e => e.key === chosen.pair) : undefined;
  const setPair = (key: string) => setChosen({ filterKey, pair: key });
  const pickNode = (id: string) => { setPicked(id); setPair(""); };

  const placed = useMemo(() => {
    const input = nodes.map(n => ({ id: n.id, involvement: n.involvement }));
    if (view === "campo") return pitchLayout(input, id => positions.get(id));
    const numberOf = (id: string) => nodes.find(n => n.id === id)?.number;
    return ringLayout([...input].sort((a, b) => byPosition(positions, numberOf)(a.id, b.id)));
  }, [nodes, positions, view]);

  const counts = edges.map(e => e.completed).sort((a, b) => b - a);
  const maxCompleted = Math.max(1, counts[0] ?? 1);
  const thr = Math.max(1, Math.min(maxCompleted, thrPick ?? autoThreshold(counts)));
  const shown = edges.filter(e => (node ? e.from === node || e.to === node : e.completed >= thr) || e === pair).sort((a, b) => a.completed - b.completed);
  const ranked = edges.filter(e => !node || e.from === node || e.to === node).sort((a, b) => b.completed - a.completed || nameOf(a.from).localeCompare(nameOf(b.from), "es") || nameOf(a.to).localeCompare(nameOf(b.to), "es"));
  const listed = allPairs ? ranked : ranked.slice(0, LIST_LIMIT);

  const kpis = [
    { label: "pases completados", value: data.totalCompleted == null ? "-" : chartNumber.format(data.totalCompleted) },
    { label: "representados en la red", value: chartNumber.format(data.completed) },
    ...(data.unrepresentedCompleted ? [{ label: "completados sin pareja", value: chartNumber.format(data.unrepresentedCompleted) }] : []),
    { label: "conexiones dirigidas", value: chartNumber.format(edges.length) },
    { label: data.matchCount === 1 ? "partido" : "partidos", value: chartNumber.format(data.matchCount) },
  ];
  const notes = <>
    {rival && data.matchCount > 1 && <p className="gc-note">Los jugadores rivales se mantienen separados por partido: un mismo dorsal no identifica a la misma persona en dos actas.</p>}
    {(data.unattributed > 0 || data.pending > 0) && <p className="gc-note">En total, {data.unattributed} intentos no tienen pareja identificable; pueden ser completados, fallidos o sin resultado. {data.pending} pendientes de clasificación. La red solo representa pases completados entre dos jugadores identificados.</p>}
  </>;

  if (!nodes.length) {
    const guard = data.cells.find(cell => ["not_configured", "not_applicable"].includes(cell.volume.status))?.volume;
    const why = guard?.reason ?? (rival ? "En las actas del rival no consta quién recibe cada pase, así que no hay parejas que unir. Sus pases siguen contando en los totales del equipo." : "Hace falta algún pase completado con quien lo da y quien lo recibe identificados. Los pases sin pareja siguen contando en los totales del equipo.");
    return <div className="pn">
      <ChartKpis items={kpis}/>
      <div className="gc-empty"><h4>Aún no se puede dibujar la red</h4><p>{why}</p></div>
      {notes}
      <ChartHow><p>Cuando la narración identifica a quien da y a quien recibe, cada pareja se dibuja como una línea.</p></ChartHow>
    </div>;
  }

  const best = strongestPair(edges);
  const topR = [...nodes].sort((a, b) => b.received - a.received)[0], topS = [...nodes].sort((a, b) => b.sent - a.sent)[0];
  const drawNodes: DrawNode[] = nodes.map(n => ({ id: n.id, name: n.name, num: n.number == null ? undefined : String(n.number), sent: n.sent, received: n.received }));
  const me = node ? byId.get(node) : undefined;

  return <div className="pn">
    {hasPositions ? <ChartViews opts={VIEWS} value={view} onPick={setViewPick} hint={HINTS[view]}/> : <p className="gc-note">Sin puestos en las actas de esta selección: la red se dibuja en círculo, por dorsal.</p>}
    {best && <ChartHero title={`${nameOf(best.a)} y ${nameOf(best.b)}, la pareja que más se encuentra`}>
      {passes(best.ab)} de {nameOf(best.a)} a {nameOf(best.b)}{best.ba ? ` y ${best.ba} de vuelta` : ""}. {topR.name} es quien más balones recibe ({topR.received}){topS.id === topR.id ? ` y también quien más da (${topS.sent}).` : `; ${topS.name}, quien más da (${topS.sent}).`}
    </ChartHero>}
    <ChartKpis items={kpis}/>
    <ChartStage
      chart={<>
        <PassNetworkDrawing uid={uid} view={view} nodes={drawNodes} placed={placed} edges={shown} maxCompleted={maxCompleted} node={node} pair={pair} rival={rival} onPick={id => pickNode(node === id ? "" : id)}/>
        <div className="pn-thr">
          {node ? <span>Con un jugador elegido se ven todas sus parejas</span> : <>
            <span>Parejas con al menos</span>
            <span className="pn-thr__ctl">
              <button type="button" className="vd-glass vd-btn vd-btn--sm vd-press pn-ico" aria-label="Menos pases por pareja" disabled={thr <= 1} onClick={() => setThrPick(Math.max(1, thr - 1))}><svg viewBox="0 0 24 24" aria-hidden="true"><path d="M6 12h12" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round"/></svg></button>
              <b aria-live="polite">{thr}</b>
              <button type="button" className="vd-glass vd-btn vd-btn--sm vd-press pn-ico" aria-label="Más pases por pareja" disabled={thr >= maxCompleted} onClick={() => setThrPick(Math.min(maxCompleted, thr + 1))}><svg viewBox="0 0 24 24" aria-hidden="true"><path d="M6 12h12M12 6v12" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round"/></svg></button>
            </span>
            <span>{thr === 1 ? "pase" : "pases"} · se ven {edges.filter(e => e.completed >= thr).length} de {edges.length}</span>
          </>}
        </div>
        <p className="pn-key">
          <span><i/>Grosor: pases completados de la pareja</span>
          <span><i className="k-grad"/>La línea se enciende hacia quien recibe</span>
          <span>Camiseta más grande: más pases dados y recibidos</span>
        </p>
        {notes}
      </>}
      side={<div className="pn-side">
        {me && <PlayerCard me={me} rival={rival} position={positions.get(me.id)} participation={playerMetrics.get("001")} accuracy={playerMetrics.get("070")} period={!!filters.period} edges={edges} cells={data.cells} nameOf={nameOf} onClear={() => pickNode("")}/>}
        <h4 className="gc-sh">{me ? `Conexiones de ${me.name}` : "Quién se encuentra"}</h4>
        <p className="gc-note">De quien pasa a quien recibe. Elige una pareja para ver sus jugadas.</p>
        <ol className="gc-rows pn-pairs" aria-label="Conexiones de la red">{listed.map(e => <li key={e.key}>
          <button type="button" className="gc-row" aria-pressed={e === pair} aria-label={`${nameOf(e.from)} a ${nameOf(e.to)}: ${e.completed} pases completados. Ver jugadas`} onClick={() => setPair(e === pair ? "" : e.key)}>
            <span className="gc-row__t">{nameOf(e.from)}<i className="pn-arrow" aria-hidden="true">→</i>{nameOf(e.to)}</span>
            <b className="gc-row__n">{e.completed}<small>{e.completed + e.failed ? `${e.completed}/${e.completed + e.failed} con resultado` : "pases"}</small></b>
            <span className="gc-row__bar" aria-hidden="true"><i style={{ width: `${Math.round(e.completed / maxCompleted * 100)}%` }}/></span>
          </button>
        </li>)}</ol>
        {ranked.length > LIST_LIMIT && <button type="button" className="vd-glass vd-btn vd-btn--sm vd-press pn-more" aria-expanded={allPairs} onClick={() => setAllPairs(!allPairs)}>{allPairs ? `Ver solo las ${LIST_LIMIT} primeras` : `${ranked.length - LIST_LIMIT} parejas más · Ver todas`}</button>}
        <label className="pn-pick">Resaltar conexiones de
          <select value={node} onChange={event => pickNode(event.target.value)}><option value="">Todos los jugadores de la red</option>{nodes.map(n => <option value={n.id} key={n.id}>{n.number != null ? `#${n.number} · ` : ""}{n.name}</option>)}</select>
        </label>
        {filters.playerIds?.length ? <p className="gc-note">El filtro general elige quién pasa. Sus receptores se mantienen para no perder conexiones.</p> : null}
      </div>}
    />
    {pair && <section className="gc-detail" aria-label="Jugadas de la conexión elegida">
      <header className="gc-detail__head">
        <div><p className="gc-detail__k">Pareja elegida</p><h4>{nameOf(pair.from)} → {nameOf(pair.to)}</h4></div>
        <div className="gc-detail__val"><strong>{formatWorkspaceMetric(pair.accuracy)}</strong><span className="gc-detail__k">de acierto</span></div>
      </header>
      <dl className="gc-dstats"><div><dt>Completados</dt><dd>{pair.completed}</dd></div><div><dt>Fallidos conocidos</dt><dd>{pair.failed}</dd></div><div><dt>Sin resultado</dt><dd>{pair.unknown}</dd></div><div><dt>Acierto de la pareja</dt><dd>{formatWorkspaceMetric(pair.accuracy)}</dd></div></dl>
      <p className="gc-note">{pair.completed}/{pair.completed + pair.failed} con resultado conocido. <MetricState status={pair.accuracy.status}/></p>
      <AnalysisInsightEvidence key={pair.key} matches={matches} people={[...people, ...nodes]} filters={filters} result={pair.volume}/>
      <div className="gc-actions">
        <button type="button" className="vd-glass vd-btn vd-btn--sm vd-press" onClick={() => setPair("")}>Cerrar detalle</button>
        {onInspect && <button type="button" className="vd-glass vd-btn vd-btn--sm vd-press" onClick={() => onInspect("068", rival ? undefined : pair.from)}>Ver todos los pases completados del emisor ↗</button>}
      </div>
    </section>}
    <ChartHow>
      {view === "campo"
        ? <p>Cada dorsal se coloca en el sitio medio de los puestos que ocupó según el acta, pesado por sus minutos en cada uno (un central que pasó 10′ de lateral se desplaza un poco hacia la banda). No es su posición real con balón: la narración no guarda coordenadas. Las posiciones se estiran para llenar el campo y se separan para que no se pisen.</p>
        : <p>Todos los jugadores de la red en un círculo, ordenados por líneas: del portero al delantero. Es un esquema, no sus posiciones en el campo. Las cuerdas que cruzan el centro unen líneas lejanas.</p>}
      <p>La camiseta crece con los pases completados que da y recibe; la línea, con los pases completados de la pareja, y la flecha marca la dirección: se enciende hacia quien recibe. Solo se representan pases completados entre dos jugadores identificados; los pases sin pareja siguen contando en los totales del equipo.</p>
    </ChartHow>
  </div>;
}

function PlayerCard({ me, rival, position, participation, accuracy, period, edges, cells, nameOf, onClear }: {
  me: { id: string; name: string; number?: number | string | null; sent: number; received: number }; rival: boolean; position: ChartPosition | undefined; participation: MetricResult | undefined; accuracy: MetricResult | undefined; period: boolean;
  edges: readonly Edge[]; cells: readonly PassConnection[]; nameOf: (id: string) => string; onClear: () => void;
}) {
  const own = cells.filter(c => c.from === me.id);
  const c = own.reduce((n, e) => n + e.completed, 0), x = own.reduce((n, e) => n + e.failed, 0);
  const partner = new Map<string, number>();
  for (const e of edges) { const other = e.from === me.id ? e.to : e.to === me.id ? e.from : ""; if (other) partner.set(other, (partner.get(other) ?? 0) + e.completed); }
  const best = [...partner].sort((a, b) => b[1] - a[1])[0];
  const minutes = workspaceMetricValue(participation);
  const role = `${position ? POSITIONS[position.main].name : rival ? "Rival" : "Jugador"}${minutes != null ? ` · ${chartNumber.format(minutes)}′ en el campo` : rival ? "" : " · Minutos sin determinar"}`;
  return <div className="pn-card">
    <div className="pn-card__top">
      <NetShirt num={me.number == null ? undefined : String(me.number)} size={46} rival={rival}/>
      <div><h4>{me.name}</h4><p>{role}</p></div>
      <button type="button" className="vd-glass vd-btn vd-btn--sm vd-press" onClick={onClear}>Ver a todos</button>
    </div>
    <dl className="pn-card__stats">
      <div><dt>Pases que da</dt><dd>{me.sent}</dd></div>
      <div><dt>Pases que recibe</dt><dd>{me.received}</dd></div>
      <div><dt>{rival ? "Acierto entre parejas identificadas" : "Acierto con resultado conocido"}</dt><dd>{rival ? chartPercent(c, c + x) : formatWorkspaceMetric(accuracy)}</dd></div>
      {period ? <div><dt>Pases dados en la parte</dt><dd>{me.sent}</dd></div> : <div><dt>Pases dados por cada 10′</dt><dd>{minutes != null && minutes > 0 ? chartNumber.format(me.sent / (minutes / 10)) : "-"}</dd></div>}
    </dl>
    <p className="pn-story">{best ? <>Su socio es <b>{nameOf(best[0])}</b>: {passes(best[1])} entre los dos, en las dos direcciones.</> : "Aún sin parejas con pases completados."}</p>
  </div>;
}
