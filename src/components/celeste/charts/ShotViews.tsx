import { useMemo, useState } from "react";
import type { MetricResult } from "../../../../functions/src/narrated/types";
import { formatWorkspaceMetric, workspaceMetricValue } from "../../../lib/analysisWorkspace";
import { SHOT_OUTCOME_MANY, SHOT_OUTCOME_METRIC, SHOT_OUTCOME_ONE, UNKNOWN_SHOOTER, buildShotOutcomes, buildShotTimeline, funnelFigures, funnelOutcome, rivalLabel, shotsByPlayer, totalShots, type ShotRow } from "../../../lib/shotOutcomes";
import { AnalysisInsightEvidence } from "../AnalysisInsights";
import { MetricState } from "../MetricState";
import { ChartHero, ChartHow, ChartKpis, ChartStage, ChartViews, type ChartProps, type ChartSegOpt } from "./parts";
import { ShotFunnel, ShotGoal, ShotMinutes, ShotWho } from "./ShotCharts";
import { shooterName, shotTime, type ShotPick } from "./shotText";
import { chartNumber, chartPercent } from "./format";
import "./shots.css";

type View = "porteria" | "embudo" | "minutos" | "quien";
const VIEWS: readonly ChartSegOpt<View>[] = [{ value: "porteria", label: "Portería" }, { value: "embudo", label: "Embudo" }, { value: "minutos", label: "Minutos" }, { value: "quien", label: "Quién" }];
const HINTS: Record<View, string> = {
  porteria: "Cada punto es un remate, en la zona de cómo acabó. Toca uno para ver la jugada.",
  embudo: "De todos los remates a los goles: qué se queda por el camino.",
  minutos: "Los dos equipos en el mismo reloj: arriba el Piti, abajo el rival.",
  quien: "Quién remata y cómo terminan sus remates.",
};
const DEFAULT_PICK: ShotPick = { kind: "metric", id: "029" };
const fmt = (v: number | null) => v == null ? "-" : chartNumber.format(v);
const plural = (n: number, one: string, many: string) => `${n} ${n === 1 ? one : many}`;

/** «Remates» of «Gráficas del juego»: the goal, the funnel, both teams' minutes and who shoots, all on the
 *  catalogue's shot figures (029–033, 015) of the page's selection. */
export function ShotViews({ matches, people, filters = {}, onInspect }: ChartProps) {
  const [view, setView] = useState<View>("porteria");
  const [rawPick, setPick] = useState<ShotPick>(DEFAULT_PICK);
  const them = filters.team === "opponent";
  const data = useMemo(() => buildShotOutcomes(matches, filters), [matches, filters]);
  const rival = useMemo(() => rivalLabel(matches, filters), [matches, filters]);
  const timeline = useMemo(() => view === "minutos" ? buildShotTimeline(matches, filters) : null, [view, matches, filters]);
  const shooters = useMemo(() => shotsByPlayer(data.rows, people, them, rival), [data.rows, people, them, rival]);
  const pool: readonly ShotRow[] = timeline ? [...timeline.us, ...timeline.them] : data.rows;
  // A choice that the new sample no longer holds falls back to all the shots instead of leaking old plays.
  const pick: ShotPick = rawPick.kind === "shot" && !pool.some(row => row.event.evidenceId === rawPick.id) || (rawPick.kind === "cat" && !data.counts[rawPick.cat] || rawPick.kind === "funnel" && !data.rows.some(row => funnelOutcome(row) === rawPick.cat)) || rawPick.kind === "who" && !shooters.some(row => row.key === rawPick.key) ? DEFAULT_PICK : rawPick;
  const choose = (next: View) => { setView(next); setPick(previous => previous.kind === "metric" ? previous : DEFAULT_PICK); };

  const total = data.value("029") ?? data.total;
  const goals = data.counts.gol;
  const top = shooters.filter(row => row.key !== UNKNOWN_SHOOTER);
  const rivalLower = rival === "Los rivales" ? "los rivales" : rival;
  let hero: { title: string; text?: string } | null = null;
  if (view === "minutos" && timeline) {
    const u = totalShots(timeline.us), o = totalShots(timeline.them);
    const gu = totalShots(timeline.us.filter(row => row.outcome === "gol")), go = totalShots(timeline.them.filter(row => row.outcome === "gol"));
    hero = { title: u > o ? `El Piti remata más: ${u} a ${o}` : u < o ? `${rival === "Los rivales" ? "Los rivales rematan" : `${rival} remata`} más: ${o} a ${u}` : `Los dos rematan lo mismo: ${u} a ${o}`, text: `Goles: ${gu} del Piti y ${go} de ${rivalLower}. Cada punto es un remate en su minuto; el dorado, nuestros goles.` };
  } else if (data.rows.length) {
    if (view === "quien" && !them && top.length) hero = { title: `${top[0].name}, el que más remata: ${plural(top[0].total, "remate", "remates")}`, text: top[1] ? `Detrás, ${top[1].name} con ${top[1].total}${top[2] ? ` y ${top[2].name} con ${top[2].total}` : ""}.` : undefined };
    else {
      const head = `${plural(goals, "gol", "goles")} en ${plural(total, "remate", "remates")}${goals ? `: uno de cada ${chartNumber.format(total / goals)}` : ""}`;
      const onTarget = data.value("030");
      hero = { title: them ? `${rival}: ${head}` : head, text: `${fmt(onTarget)} a puerta (${onTarget == null ? "sin precisar" : chartPercent(onTarget, total)}), ${fmt(data.value("032"))} bloqueados y ${fmt(data.value("031"))} fuera.${!them && top.length ? ` ${top[0].name} remata ${top[0].total === 1 ? "una vez" : `${top[0].total} veces`}.` : ""}` };
    }
  }
  const kpis = view === "minutos" && timeline ? [
    { label: "remates del Piti", value: String(totalShots(timeline.us)) }, { label: `remates de ${rivalLower}`, value: String(totalShots(timeline.them)) },
    ...filters.period == null ? [{ label: "del Piti antes del descanso", value: String(totalShots(timeline.us.filter(row => row.event.period === 1))) }, { label: "del Piti después", value: String(totalShots(timeline.us.filter(row => (row.event.period ?? 0) > 1))) }] : [],
  ] : [];

  const empty = view === "minutos" ? !timeline?.us.length && !timeline?.them.length : !data.rows.length;
  const chart = empty ? <div className="gc-empty"><h4>Sin remates en esta selección</h4><p>{workspaceMetricValue(data.result("029")) === 0 ? "La cobertura respalda este cero: no hay remates narrados para este equipo y esta parte." : "No hay remates narrados con resultado para este equipo y esta parte."}</p></div>
    : view === "porteria" ? <ShotGoal rows={data.rows} counts={data.counts} people={people} rival={rival} pick={pick} onPick={setPick} them={them}/>
    : view === "embudo" ? <ShotFunnel figures={funnelFigures(data)} pick={pick} onPick={setPick} them={them}/>
    : view === "minutos" ? <ShotMinutes timeline={timeline!} people={people} rival={rival} pick={pick} onPick={setPick} them={them}/>
    : <ShotWho rows={shooters} pick={pick} onPick={setPick} them={them}/>;

  const maxBar = Math.max(1, ...data.chart.bars.map(bar => workspaceMetricValue(bar.result) ?? 0));
  const outside = totalShots(data.rows.filter(row => row.outside));
  const located = totalShots(data.rows.filter(row => row.outside != null));
  const side = <>
    <h4 className="gc-sh">Cómo terminan</h4>
    <ol className="gc-rows gs-mlist" aria-label="Remates por resultado">{data.chart.bars.map(bar => { const value = workspaceMetricValue(bar.result); return <li key={bar.id}>
      <button type="button" className={`gc-row gs-mrow${bar.id === "015" && !them ? " is-gold" : ""}${them ? " is-them" : ""}`} aria-pressed={pick.kind === "metric" && pick.id === bar.id} onClick={() => setPick({ kind: "metric", id: bar.id })}>
        <span className="gc-row__t">{bar.label}</span><strong className="gc-row__n">{formatWorkspaceMetric(bar.result)}</strong>
        <span className={`gc-row__bar${value == null ? " is-missing" : ""}`} aria-hidden="true"><i style={{ width: `${value == null ? 0 : value / maxBar * 100}%` }}/></span><MetricState status={bar.result.status}/>
      </button></li>; })}</ol>
    <p className="gc-note">Las categorías se solapan: un gol que toca el palo cuenta como gol, a puerta y a la madera, pero sigue siendo un único remate.</p>
    <dl className="gs-rates">
      <div className="gs-rate"><dt>de los remates, a puerta</dt><dd>{data.value("030") == null ? "-" : chartPercent(data.value("030")!, total)}</dd></div>
      <div className="gs-rate"><dt>de los remates, gol</dt><dd>{data.rows.length ? chartPercent(goals, total) : "-"}</dd></div>
      <div className="gs-rate"><dt>desde fuera, con zona conocida</dt><dd>{chartPercent(outside, located)}</dd></div>
    </dl>
    {located < data.total && <p className="gc-note">Zona registrada en {located} de {data.total} remates; los demás no se suponen dentro del área.</p>}
  </>;

  return <div className="gs">
    <ChartViews opts={VIEWS} value={view} onPick={choose} hint={HINTS[view]}/>
    {hero && <ChartHero title={hero.title}>{hero.text}</ChartHero>}
    <ChartKpis items={kpis} label="Remates de los dos equipos"/>
    <ChartStage chart={chart} side={view === "minutos" ? undefined : side}/>
    <ShotDetail pick={pick} data={data} pool={pool} shooters={shooters} them={them} rival={rival} matches={matches} people={people} filters={filters} onInspect={onInspect} onClose={() => setPick(DEFAULT_PICK)}/>
    <ChartHow>{view === "porteria" ? <><p>Cada punto es un remate, colocado en la zona de cómo acabó: dentro de la red los goles, abajo los parados, sobre los palos los que dieron en la madera, delante el muro de los bloqueados y fuera de la portería los que se fueron fuera.</p><p>La zona dice cómo acabó, no por dónde entró: la narración no guarda el punto exacto. Un remate que tocó la madera y acabó en gol se dibuja como gol. Los puntos sin resultado claro van abajo a la izquierda, como «sin precisar».</p></>
      : view === "embudo" ? <p>De arriba abajo, cómo se va quedando por el camino cada remate: primero si va a puerta, da en la madera sin ir a puerta, sale fuera o lo bloquean; después, de los que van a puerta, cuántos acaban en gol. El ancho de cada bloque es su parte del total. Cada remate ocupa una sola rama: un gol o una parada que toca el palo sigue en «a puerta».</p>
      : view === "minutos" ? <p>Los dos equipos en la misma línea de tiempo: arriba los remates del Piti, abajo los del rival. Cada punto se coloca en la mitad del intervalo que dio la narración (un remate entre el 3′ y el 4′ va en el 3′ 30″), contado desde el inicio de su parte. Con varios partidos se superponen en el mismo reloj. Solo se dibujan tiempos fiables dentro de partes con límites registrados. Los del rival incluyen esos mismos partidos, sin restringir quién remata.</p>
      : <p>{them ? "En las actas del rival casi nunca consta quién remata: sus remates se agrupan en una sola fila." : "Los remates de cada jugador, partidos por cómo acabaron. La barra más larga es quien más remata; el dorado, los goles. Toca un jugador para ver sus remates uno a uno."}</p>}
      <p>Las cifras de «Cómo terminan» son las del catálogo y se solapan; en la portería y las barras por jugador cada remate cuenta una sola vez, con este orden: gol, madera, parado, bloqueado y fuera.</p>
    </ChartHow>
  </div>;
}

interface DetailProps extends Pick<ChartProps, "matches" | "people" | "onInspect"> {
  pick: ShotPick; data: ReturnType<typeof buildShotOutcomes>; pool: readonly ShotRow[]; shooters: ReturnType<typeof shotsByPlayer>;
  them: boolean; rival: string; filters: NonNullable<ChartProps["filters"]>; onClose: () => void;
}

/** The chosen metric's plays, or the chosen shot / category / shooter, always with the same plays list. */
function ShotDetail({ pick, data, pool, shooters, them, rival, matches, people, filters, onInspect, onClose }: DetailProps) {
  if (pick.kind === "metric") {
    const bar = data.chart.bars.find(item => item.id === pick.id) ?? data.chart.bars[0];
    return <section className="gc-detail" aria-label="Jugadas del resultado de remate">
      <header className="gc-detail__head"><div><p className="gc-detail__k">{them ? rival : "Manchester Piti"}</p><h4>{bar.label}</h4></div><div className="gc-detail__val"><strong>{formatWorkspaceMetric(bar.result, true)}</strong><MetricState status={bar.result.status}/></div></header>
      {bar.result.reason && <p className="gc-note">{bar.result.reason}</p>}
      <AnalysisInsightEvidence key={bar.id} matches={matches} people={people} filters={filters} result={bar.result}/>
      {onInspect && <div className="gc-actions"><button type="button" className="vd-glass vd-btn vd-btn--sm vd-press" onClick={() => onInspect(bar.id)}>Ver cómo se calcula ↗</button></div>}
    </section>;
  }
  const base = data.result("029");
  const rows = pick.kind === "shot" ? pool.filter(row => row.event.evidenceId === pick.id) : pick.kind === "cat" ? data.rows.filter(row => row.outcome === pick.cat) : pick.kind === "funnel" ? data.rows.filter(row => funnelOutcome(row) === pick.cat) : shooters.find(row => row.key === pick.key)?.rows ?? [];
  const n = totalShots(rows);
  const result: MetricResult = { ...base, value: n, status: "complete", observed: n, pending: 0, evidenceEventIds: rows.map(row => row.event.evidenceId) };
  const first = rows[0];
  const head = pick.kind === "shot" && first ? { k: "Remate elegido", title: `${SHOT_OUTCOME_ONE[first.outcome]}${first.outside ? " · desde fuera del área" : ""}`, value: shotTime(first), why: `${shooterName(first, people, rival)}. La zona del dibujo es cómo acabó, no por dónde fue.` }
    : pick.kind === "cat" || pick.kind === "funnel" ? { k: them ? rival : "Manchester Piti", title: SHOT_OUTCOME_MANY[pick.cat], value: String(n), why: "Remates dibujados en esta zona. Un remate cuenta una sola vez en el dibujo, aunque en las cifras del catálogo pueda estar en varias categorías." }
    : { k: "Remates de", title: shooters.find(row => row.key === (pick.kind === "who" ? pick.key : ""))?.name ?? "", value: String(n), why: "" };
  const metric = pick.kind === "cat" || pick.kind === "funnel" ? SHOT_OUTCOME_METRIC[pick.cat] : undefined;
  const player = pick.kind === "who" && !them && pick.key !== UNKNOWN_SHOOTER ? pick.key : undefined;
  return <section className="gc-detail" aria-label="Remates elegidos">
    <header className="gc-detail__head"><div><p className="gc-detail__k">{head.k}</p><h4>{head.title}</h4></div><div className="gc-detail__val"><strong>{head.value}</strong></div></header>
    {head.why && <p className="gc-note">{head.why}</p>}
    <AnalysisInsightEvidence key={JSON.stringify(pick)} matches={matches} people={people} filters={filters} result={result}/>
    <div className="gc-actions">
      <button type="button" className="vd-glass vd-btn vd-btn--sm vd-press" onClick={onClose}>Cerrar detalle</button>
      {onInspect && (metric ? <button type="button" className="vd-glass vd-btn vd-btn--sm vd-press" onClick={() => onInspect(metric)}>Ver cómo se calcula ↗</button>
        : <button type="button" className="vd-glass vd-btn vd-btn--sm vd-press" onClick={() => onInspect("029", player)}>{player ? "Ver sus remates en la tabla ↗" : "Ver todos los remates ↗"}</button>)}
    </div>
  </section>;
}
