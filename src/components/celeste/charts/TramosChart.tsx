import { useId, useMemo, useState, type CSSProperties, type ReactNode } from "react";
import type { AnalysisFilters } from "../../../../functions/src/narrated/types";
import { buildInsightTimeline, INSIGHT_METRICS, type InsightSegment } from "../../../lib/analysisInsights";
import { formatWorkspaceMetric, selectAnalysisMatches } from "../../../lib/analysisWorkspace";
import { goalMarks, layoutTramos, partLabel, ribbon, TRAMO_METRICS, tramoValue, type TramoCol, type TramoSide } from "../../../lib/insightTramos";
import type { ClubMatch } from "../../../lib/clubData";
import { AnalysisInsightEvidence } from "../AnalysisInsightEvidence";
import { MetricState } from "../MetricState";
import { chartClock as clock, chartNumber } from "./format";
import { ChartHero, ChartHow, ChartKpis, ChartSeg, ChartStage, type ChartProps } from "./parts";
import "./tramos.css";

export type TramosView = "pulse" | "bars";
const minutes = new Intl.NumberFormat("es-ES", { maximumFractionDigits: 1 });
const segLabel = (c: { period: number; from: number; to: number }) => `${partLabel(c.period)} · ${clock(c.from)}–${clock(c.to)}`;
const metricOpts = INSIGHT_METRICS.map(m => ({ value: m.id as string, label: TRAMO_METRICS[m.id].short, ariaLabel: m.label }));
const H = 38;

/** Pulso (both teams, one ribbon) and Barras (one team with its mean), with the chosen tramo's reading and plays. */
export function TramosChart({ matches, people, filters = {}, onInspect, view, metric, onMetric }: ChartProps & { view: TramosView; metric: string; onMetric: (id: string) => void }) {
  const uid = useId().replace(/[^a-zA-Z0-9_-]/g, "");
  const [selection, setSelection] = useState("");
  const [sidePick, setSidePick] = useState<TramoSide | null>(null);
  const meta = TRAMO_METRICS[metric] ?? TRAMO_METRICS["067"];
  const long = INSIGHT_METRICS.find(m => m.id === metric)?.label ?? "Pases intentados";
  const ourFilters = useMemo<AnalysisFilters>(() => ({ ...filters, team: filters.team === "opponent" ? undefined : filters.team }), [filters]);
  const theirFilters = useMemo<AnalysisFilters>(() => ({ ...filters, team: "opponent", playerIds: undefined }), [filters]);
  // The rival is read in the same matches as the Piti side, so a player's selection never compares other games.
  const sample = useMemo(() => selectAnalysisMatches(matches, ourFilters) as ClubMatch[], [matches, ourFilters]);
  const us = useMemo(() => buildInsightTimeline(sample, ourFilters, metric), [sample, ourFilters, metric]);
  const them = useMemo(() => buildInsightTimeline(sample, theirFilters, metric), [sample, theirFilters, metric]);
  const layout = useMemo(() => layoutTramos(us.segments, them.segments), [us, them]);
  const plural = new Set(sample.map(m => m.id)).size !== 1;
  const rival = plural ? "Los rivales" : sample[0]?.rival ?? "El rival";
  const names = useMemo(() => new Map(people.map(p => [p.id, p.name])), [people]);
  const rivals = useMemo(() => new Map(sample.map(m => [m.id, m.rival ?? "el rival"])), [sample]);
  const goals = useMemo(() => view === "pulse" ? goalMarks(sample, filters, layout.cols, id => names.get(id), id => rivals.get(id) ?? "el rival") : [], [view, sample, filters, layout, names, rivals]);
  const { cols } = layout;
  const selected = cols.find(c => c.key === selection) ?? cols[0];
  const barSide: TramoSide = filters.team === "opponent" ? "them" : "us";
  const side: TramoSide = view === "bars" ? barSide : sidePick ?? barSide;
  const fmt = (v: number | null) => v == null ? "-" : `${chartNumber.format(v)}${meta.pct ? "%" : ""}`;
  const better = (a: number, b: number) => meta.low ? a < b : a > b;
  const teamName = (s: TramoSide) => s === "us" ? "Manchester Piti" : rival;
  const timeline = side === "us" ? us : them;

  const picker = <ChartSeg label="Qué ver por tramos" opts={metricOpts} value={metric} onPick={onMetric} className="gt-metrics"/>;
  const notes = <>{us.omittedMatches > 0 && <p className="gc-note">{us.omittedMatches} {us.omittedMatches === 1 ? "partido sin límites de tiempo suficientes: no se le asignan tramos." : "partidos sin límites de tiempo suficientes: no se les asignan tramos."}</p>}{timeline.uncertainActions > 0 && <p className="gc-note">Hay {timeline.uncertainActions} acciones sin un instante exacto. Las que no pueden ubicarse dentro de un tramo quedan pendientes; no se reparten entre tramos.</p>}</>;
  if (!cols.length || !selected) return <>{picker}{notes}<div className="gc-empty"><h4>No hay tramos comparables en esta selección</h4><p>Hace falta conocer los límites de juego y la participación en el período elegido. No se sustituyen por minutos estimados.</p></div></>;

  const total = (s: TramoSide) => {
    let any = false, sum = 0, n = 0, d = 0;
    for (const c of cols) { const r = c[s]?.result; const v = tramoValue(c, s); if (!r || v == null) continue; any = true; sum += v; n += r.numerator ?? 0; d += r.denominator ?? 0; }
    return !any ? "-" : meta.pct ? d ? `${chartNumber.format(n / d * 100)}%` : "-" : chartNumber.format(sum);
  };
  const kpis = [{ label: `${long} · Manchester Piti`, value: total("us") }, { label: `${long} · ${rival}`, value: total("them") }, { label: "Tramos de 5 minutos", value: String(cols.length) }, { label: us.matchCount === 1 ? "Partido" : "Partidos", value: String(us.matchCount) }];
  const peak = (s: TramoSide) => cols.filter(c => tramoValue(c, s) != null).reduce<TramoCol | null>((p, c) => !p || better(tramoValue(c, s)!, tramoValue(p, s)!) ? c : p, null);

  let hero: string, heroP: string, story: string;
  if (view === "bars") {
    const known = cols.flatMap(c => { const v = tramoValue(c, barSide); return v == null ? [] : [{ c, v }]; });
    const avg = known.length ? known.reduce((n, k) => n + k.v, 0) / known.length : null;
    const hi = known.reduce<(typeof known)[number] | null>((p, k) => !p || k.v > p.v ? k : p, null), lo = known.reduce<(typeof known)[number] | null>((p, k) => !p || k.v < p.v ? k : p, null);
    hero = avg == null ? `${long}, tramo a tramo` : `${barSide === "us" ? "El Piti" : rival}: ${fmt(avg)} de media por tramo`;
    heroP = hi && lo ? `Pico en ${segLabel(hi.c)} (${fmt(hi.v)}); el tramo más bajo, ${segLabel(lo.c)} (${fmt(lo.v)}).` : "";
    story = avg == null ? "Ningún tramo tiene un dato respaldado todavía." : `Media de los tramos con dato: ${fmt(avg)}. El último tramo de cada parte puede ser más corto.`;
  } else {
    const both = cols.filter(c => tramoValue(c, "us") != null && tramoValue(c, "them") != null);
    const wins = both.filter(c => better(tramoValue(c, "us")!, tramoValue(c, "them")!)).length;
    const pkA = peak("us"), pkB = peak("them");
    hero = both.length ? meta.low ? `El Piti pierde menos balones en ${wins} de ${both.length} tramos` : `El Piti gana ${wins} de ${both.length} tramos en ${long.toLowerCase()}` : `${long}, tramo a tramo`;
    const press = meta.low ? plural ? "cuidan más el balón en" : "cuida más el balón en" : plural ? "aprietan más en" : "aprieta más en";
    heroP = `${pkA ? `Su mejor momento: ${segLabel(pkA)} (${fmt(tramoValue(pkA, "us"))}). ` : ""}${pkB ? `${rival} ${press} ${segLabel(pkB)} (${fmt(tramoValue(pkB, "them"))}).` : ""}`;
    const a = tramoValue(selected, "us"), b = tramoValue(selected, "them");
    story = a != null && b != null ? a === b ? `Empate en este tramo: ${fmt(a)} cada uno.` : `${better(a, b) ? "Este tramo es del Piti" : `Este tramo es de ${rival}`}: ${fmt(a)} contra ${fmt(b)}.` : "Este tramo no tiene dato respaldado de los dos equipos.";
  }

  const shown = selected[side];
  const sample0 = shown ?? selected.us ?? selected.them;
  const readout = <section className="gt-readout" aria-label="Lectura del tramo">
    <div className="gt-ro__head"><p>Tramo elegido · {long}</p><h4>{segLabel(selected)}</h4></div>
    <div className="gt-vs">{(["us", "them"] as const).map(s => <div key={s} className={`gt-vs__c gt-vs__c--${s}`}><span>{teamName(s)}</span><strong>{formatWorkspaceMetric(selected[s]?.result)}</strong>{selected[s] ? <MetricState status={selected[s]!.result.status}/> : <MetricState status="no_sample"/>}</div>)}</div>
    {sample0 && <dl className="gt-dl"><div><dt>Partidos del tramo</dt><dd>{sample0.matches}</dd></div><div><dt>Cobertura completa</dt><dd>{sample0.completeMatches}/{sample0.matches}</dd></div><div><dt>Tiempo acumulado</dt><dd>{minutes.format(sample0.playedSeconds / 60)} min</dd></div>{meta.pct && <div><dt>Pases con resultado conocido</dt><dd>{sample0.result.denominator != null ? `${sample0.result.numerator ?? 0}/${sample0.result.denominator}` : "-"}</dd></div>}</dl>}
    <p className="gt-story">{story}</p>
    {view === "pulse" && <ChartSeg label="De quién son las jugadas" opts={[{ value: "us", label: "Jugadas del Piti" }, { value: "them", label: "Del rival" }] as const} value={side} onPick={setSidePick}/>}
  </section>;

  const chart = <>{picker}{notes}{view === "pulse" ? <Pulse uid={uid} layout={layout} cols={cols} selected={selected} goals={goals} pct={!!meta.pct} long={long} rival={rival} metric={metric} onPick={setSelection}/> : <Bars uid={uid} layout={layout} cols={cols} selected={selected} side={barSide} pct={!!meta.pct} long={long} team={teamName(barSide)} metric={metric} fmt={fmt} onPick={setSelection}/>}</>;

  return <>
    <ChartHero title={hero}>{heroP || undefined}</ChartHero>
    <ChartKpis items={kpis} label="Cifras de los tramos"/>
    <ChartStage chart={chart} side={readout}/>
    {shown ? <Detail segment={shown} side={side} team={teamName(side)} long={long} pct={!!meta.pct} matches={matches} people={people} filters={side === "us" ? ourFilters : theirFilters} metric={metric} onInspect={onInspect}/> : <section className="gc-detail" aria-label="Detalle del tramo"><p className="gc-note">{teamName(side)} no tiene este tramo en la selección: no se cuenta como cero.</p></section>}
    <ChartHow>
      <p>{view === "pulse" ? "El pulso enfrenta a los dos equipos tramo a tramo: hacia arriba el Piti, hacia abajo el rival, en la misma escala. Los balones marcan los goles en su tramo (dorados los nuestros); los de minuto aproximado no se dibujan." : "Las barras muestran un equipo, el de la selección de la página, con la media de los tramos que tienen dato."}</p>
      <p>Tramos de 5 minutos de juego, desde el inicio real de cada parte; el descanso queda fuera. {us.matchCount > 1 ? "Con varios partidos es un acumulado del mismo tramo, no la evolución de un único encuentro; cada tramo indica cuántos partidos aportan datos y los más cortos pueden tener menos tiempo observado." : "Cada tramo cuenta solo las acciones de ese tramo."}</p>
      <p>La precisión divide los pases completados entre los intentos con resultado conocido. En pérdidas, menos es mejor. Un tramo rayado no tiene un dato respaldado; un cero solo aparece con una muestra conocida.</p>
      <p>El último tramo de una parte puede ser más corto. Un tramo sin participación del jugador seleccionado no cuenta como cero.</p>
      {cols.some(c => c.period === 0) && <p>Algunas actas tienen duración total, pero no el inicio de cada parte. Sus tramos se muestran aparte para no mezclar relojes distintos.</p>}
    </ChartHow>
  </>;
}

interface PlotProps { uid: string; layout: ReturnType<typeof layoutTramos>; cols: TramoCol[]; selected: TramoCol; pct: boolean; long: string; metric: string; onPick: (key: string) => void }

/** Below 44 px a column the plot scrolls sideways instead of shrinking its targets. */
const plotStyle = (layout: PlotProps["layout"]) => ({ "--gt-min": `${Math.ceil(4400 / Math.max(1, layout.width))}px` }) as CSSProperties;
function Frame({ layout, children }: { layout: PlotProps["layout"]; children: ReactNode }) {
  return <>{layout.breaks.map(x => <span key={x} className="gt-break" style={{ left: `${x}%` }} aria-hidden="true"><span>Descanso</span></span>)}{layout.parts.map(p => <span key={p.x} className="gt-plab" style={{ left: `${p.x}%` }} aria-hidden="true">{p.period ? `${p.period}.ª parte` : "Sin partes"}</span>)}{children}</>;
}
const Ticks = ({ cols }: { cols: TramoCol[] }) => <div className="gt-ticks" aria-hidden="true">{cols.map(c => <span key={c.key} style={{ left: `${c.x + c.w / 2}%` }}>{clock(c.from)}</span>)}</div>;
const Hatch = ({ id }: { id: string }) => <pattern id={id} width="4" height="4" patternUnits="userSpaceOnUse" patternTransform="rotate(45)"><line className="gt-hatch-line" x1="0" y1="0" x2="0" y2="4"/></pattern>;
const Ball = () => <svg viewBox="0 0 24 24" aria-hidden="true"><circle cx="12" cy="12" r="9" fill="none" stroke="currentColor" strokeWidth="2"/><path d="M12 7.5l3.6 2.6-1.4 4.2H9.8L8.4 10.1z" fill="currentColor"/><path d="M12 3v4.5M15.6 10.1l4.6-1.6M14.2 14.3l2.7 3.9M9.8 14.3l-2.7 3.9M8.4 10.1L3.8 8.5" fill="none" stroke="currentColor" strokeWidth="1.5"/></svg>;

function Pulse({ uid, layout, cols, selected, goals, pct, long, rival, metric, onPick }: PlotProps & { goals: ReturnType<typeof goalMarks>; rival: string }) {
  const max = pct ? 100 : Math.max(1, ...cols.flatMap(c => [tramoValue(c, "us") ?? 0, tramoValue(c, "them") ?? 0]));
  const y = (v: number, s: TramoSide) => 50 - (s === "us" ? 1 : -1) * H * v / max;
  return <>
    <div className="gt-scroll" role="region" tabIndex={0} aria-label="Pulso por tramos; desliza si no cabe">
      <div className="gt-plotwrap" style={plotStyle(layout)}>
        <div className="gt-pulse" role="group" aria-label={`${long} por tramos de 5 minutos: arriba el Piti, abajo ${rival}`}>
          <svg className="gt-svg" viewBox="0 0 100 100" preserveAspectRatio="none" aria-hidden="true">
            <defs><Hatch id={`${uid}-h`}/>
              <linearGradient id={`${uid}-gu`} x1="0" y1="0" x2="0" y2="1"><stop offset="0" className="gt-gu0"/><stop offset="1" className="gt-gu1"/></linearGradient>
              <linearGradient id={`${uid}-gt`} x1="0" y1="0" x2="0" y2="1"><stop offset="0" className="gt-gt0"/><stop offset="1" className="gt-gt1"/></linearGradient></defs>
            {[10, 30, 70, 90].map(g => <line key={g} className="gt-grid" x1="0" y1={g} x2="100" y2={g}/>)}
            <rect className="gt-selband" x={selected.x} y="0" width={selected.w} height="100"/>
            <g key={metric}>{(["us", "them"] as const).flatMap(s => ribbon(cols, s, max, H).map((a, i) => <g key={`${s}${i}`}><path d={a.d} className={`gt-area gt-area--${s}`} fill={`url(#${uid}-${s === "us" ? "gu" : "gt"})`}/><path d={a.l} className={`gt-aline gt-aline--${s}`}/></g>))}</g>
            {cols.flatMap(c => (["us", "them"] as const).filter(s => tramoValue(c, s) == null).map(s => <rect key={c.key + s} className="gt-miss" fill={`url(#${uid}-h)`} x={c.x + c.w * .3} width={c.w * .4} y={s === "us" ? 46 : 50} height="4"/>))}
            <line className="gt-axis" x1="0" y1="50" x2="100" y2="50"/>
          </svg>
          {cols.flatMap(c => (["us", "them"] as const).flatMap(s => { const v = tramoValue(c, s); return v == null ? [] : [<span key={c.key + s} className={`gt-pdot gt-pdot--${s}${c === selected ? " is-on" : ""}`} style={{ left: `${c.x + c.w / 2}%`, top: `${y(v, s)}%` }} aria-hidden="true"/>]; }))}
          <Frame layout={layout}>{cols.map(c => {
            const a = tramoValue(c, "us"), b = tramoValue(c, "them");
            return <button key={c.key} type="button" className="gt-pcol" style={{ left: `${c.x}%`, width: `${c.w}%` }} aria-pressed={c === selected} aria-label={`${segLabel(c)}: Manchester Piti ${formatWorkspaceMetric(c.us?.result, true)}, ${rival} ${formatWorkspaceMetric(c.them?.result, true)}. Ver jugadas`} onClick={() => onPick(c.key)}><strong className="gt-pcol__u" style={{ top: `calc(${a == null ? 46 : y(a, "us")}% - 20px)` }}>{formatWorkspaceMetric(c.us?.result)}</strong><span className="gt-pcol__t" style={{ top: `calc(${b == null ? 54 : y(b, "them")}% + 2px)` }}>{formatWorkspaceMetric(c.them?.result)}</span></button>;
          })}</Frame>
          {goals.map(g => <span key={g.key} className={`gt-goal gt-goal--${g.side}`} style={{ left: `${g.x}%` }} role="img" aria-label={g.label}><Ball/></span>)}
        </div>
        <Ticks cols={cols}/>
      </div>
    </div>
    <p className="gc-legend"><span><i className="gc-sw gt-sw--us"/>Manchester Piti, hacia arriba</span><span><i className="gc-sw gt-sw--them"/>{rival}, hacia abajo</span><span><i className="gc-sw gt-sw--gold"/>Gol nuestro</span><span><i className="gc-sw gt-sw--goalthem"/>Gol del rival</span><span><i className="gc-sw gt-sw--miss"/>Sin dato respaldado</span></p>
  </>;
}

function Bars({ uid, layout, cols, selected, side, pct, long, team, metric, fmt, onPick }: PlotProps & { side: TramoSide; team: string; fmt: (v: number | null) => string }) {
  const values = cols.map(c => tramoValue(c, side));
  const known = values.filter((v): v is number => v != null);
  const max = pct ? 100 : Math.max(1, ...known);
  const top = 6, base = 96, span = base - top;
  const ticks = pct ? [25, 50, 75, 100] : max <= 4 ? Array.from({ length: Math.ceil(max) }, (_, i) => i + 1) : [...new Set([.25, .5, .75, 1].map(f => Math.round(max * f)))];
  const avg = known.length > 1 ? known.reduce((n, v) => n + v, 0) / known.length : null;
  const at = (v: number) => base - span * v / max;
  return <>
    <div className="gt-scroll" role="region" tabIndex={0} aria-label="Barras por tramos; desliza si no cabe">
      <div className="gt-plotwrap gt-plotwrap--bars" style={plotStyle(layout)}>
        <div className="gt-bars" role="group" aria-label={`${long} por tramos de 5 minutos: ${team}`}>
          <svg className="gt-svg" viewBox="0 0 100 100" preserveAspectRatio="none" aria-hidden="true">
            <defs><Hatch id={`${uid}-h2`}/><linearGradient id={`${uid}-gb`} x1="0" y1="0" x2="0" y2="1"><stop offset="0" className={`gt-gb0 gt-gb0--${side}`}/><stop offset="1" className={`gt-gb1 gt-gb1--${side}`}/></linearGradient></defs>
            {ticks.map(t => <line key={t} className="gt-grid" x1="0" y1={at(t)} x2="100" y2={at(t)}/>)}
            <g key={metric}>{cols.map((c, i) => { const v = values[i]; const h = v == null ? 4 : Math.max(.6, span * v / max); return <rect key={c.key} className={`gt-bar${v == null ? " is-missing" : ""}`} fill={v == null ? `url(#${uid}-h2)` : `url(#${uid}-gb)`} x={c.x + c.w * .18} width={c.w * .64} y={base - h} height={h}/>; })}</g>
            <line className="gt-axis" x1="0" y1={base} x2="100" y2={base}/>
            {avg != null && <line className="gt-avg" x1="0" y1={at(avg)} x2="100" y2={at(avg)}/>}
          </svg>
          {ticks.map(t => <span key={t} className="gt-ylab" style={{ top: `${at(t)}%` }} aria-hidden="true">{fmt(t)}</span>)}
          {avg != null && <span className="gt-avglab" style={{ top: `${at(avg)}%` }} aria-hidden="true">Media · {fmt(avg)}</span>}
          <Frame layout={layout}>{cols.map((c, i) => {
            const v = values[i]; const seg: InsightSegment | undefined = c[side];
            return <button key={c.key} type="button" className="gt-pcol" style={{ left: `${c.x}%`, width: `${c.w}%` }} aria-pressed={c === selected} aria-label={`${segLabel(c)}: ${formatWorkspaceMetric(seg?.result, true)}. ${seg ? `${seg.completeMatches} de ${seg.matches} partidos completos` : "Sin tramo en la selección"}. Ver jugadas`} onClick={() => onPick(c.key)}><strong className="gt-pcol__u" style={{ top: `calc(${v == null ? base - 4 : at(v)}% - 20px)` }}>{formatWorkspaceMetric(seg?.result)}</strong></button>;
          })}</Frame>
        </div>
        <Ticks cols={cols}/>
      </div>
    </div>
    <p className="gc-legend"><span><i className={`gc-sw gt-sw--${side}`}/>{team}</span><span><i className="gc-sw gt-sw--miss"/>Sin dato respaldado</span>{avg != null && <span>La línea discontinua es la media de los tramos con dato</span>}</p>
  </>;
}

function Detail({ segment, side, team, long, pct, matches, people, filters, metric, onInspect }: { segment: InsightSegment; side: TramoSide; team: string; long: string; pct: boolean; matches: ChartProps["matches"]; people: ChartProps["people"]; filters: AnalysisFilters; metric: string; onInspect?: ChartProps["onInspect"] }) {
  const r = segment.result;
  return <section className="gc-detail" aria-label="Detalle del tramo">
    <header className="gc-detail__head"><div><p className="gc-detail__k">{team} · {long}</p><h4>{segLabel(segment)}</h4></div><div className="gc-detail__val"><strong>{formatWorkspaceMetric(r, true)}</strong><MetricState status={r.status}/></div></header>
    {pct && r.denominator != null && <p className="gc-note">{r.numerator ?? 0}/{r.denominator} pases con resultado conocido.</p>}
    <p className="gc-note">{r.reason}</p>
    <AnalysisInsightEvidence key={`${side}:${segment.key}:${metric}`} matches={matches} people={people} filters={filters} result={r}/>
    {onInspect && <div className="gc-actions"><button className="vd-glass vd-btn vd-press ai-btn" type="button" onClick={() => onInspect(metric)}>Ver el cálculo de esta estadística en toda la selección ↗</button></div>}
  </section>;
}
