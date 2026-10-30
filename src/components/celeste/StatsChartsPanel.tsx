import { useDeferredValue, useId, useMemo, useState, type CSSProperties } from "react";
import type { AnalysisFilters } from "../../../functions/src/narrated/types";
import type { WorkspacePerson } from "../../lib/analysisWorkspace";
import type { ClubMatch } from "../../lib/clubData";
import { AnalysisInsights } from "./AnalysisInsights";
import { ChartLoading, type ChartProps } from "./charts/parts";
import { PassNetworkView } from "./charts/PassNetwork";
import { ShotViews } from "./charts/ShotViews";
import "./charts/charts.css";
import "./stats-charts.css";

export interface StatsChartsPanelProps extends ChartProps {
  /** The page's data is still on its way: the stage says so instead of «no data». */
  loading?: boolean;
}
const views = [
  { id: "network", label: "Red de pases", icon: "M4.5 7.5a2.5 2.5 0 1 0 5 0a2.5 2.5 0 1 0 -5 0M14.5 6a2.5 2.5 0 1 0 5 0a2.5 2.5 0 1 0 -5 0M9.5 17.5a2.5 2.5 0 1 0 5 0a2.5 2.5 0 1 0 -5 0M9.6 7.2l4.8-.9M8.4 9.8l2.4 5.2M15.8 8.4l-2.6 6.6" },
  { id: "insights", label: "Tramos y matriz", icon: "M3 12h18M6 12V7M10 12V4M14 12V8M18 12V6M8 12v4M12 12v6M16 12v3" },
  { id: "shots", label: "Remates", icon: "M3 19V6h18v13M9.5 15a2.5 2.5 0 1 0 5 0a2.5 2.5 0 1 0 -5 0" },
] as const;
type View = typeof views[number]["id"];

const sameMatches = (a: readonly ClubMatch[], b: readonly ClubMatch[]) => a.length === b.length && a.every((m, i) => m === b[i]);
const samePeople = (a: readonly WorkspacePerson[], b: readonly WorkspacePerson[]) => a.length === b.length && a.every((p, i) => p.id === b[i].id && p.name === b[i].name && p.number === b[i].number);
/** The last value while the page hands an equal one: the pages build a new array of the same matches and people on
 *  every render, and the charts memoise on identity, so a sheet opening or the clock ticking rebuilt every chart. */
function useSame<T>(value: T, same: (a: T, b: T) => boolean): T {
  const [kept, keep] = useState(value);
  if (kept === value || same(kept, value)) return kept;
  keep(value);
  return value;
}

/** What part of the play the sample covers: the moviola's cut, a half, whole matches. */
const span = (scope: AnalysisFilters, matchCount: number) =>
  scope.toSecond != null ? ` · hasta el ${Math.floor(scope.toSecond / 60)}′` : scope.period ? ` · ${scope.period}.ª parte` : matchCount > 1 ? " · partidos enteros" : " · todo el partido";

/** Shared by Números and the match: chart controls change the view, never the page's sample. */
export function StatsChartsPanel({ matches: given, people: cast, filters = {}, onInspect, loading = false }: StatsChartsPanelProps) {
  const uid = useId();
  const [view, setView] = useState<View>("network");
  // the tab lights up at once; the chart it opens is drawn right after, so the tap never waits for the drawing
  const shown = useDeferredValue(view);
  const key = JSON.stringify(filters);
  const scope = useMemo<AnalysisFilters>(() => JSON.parse(key), [key]);
  const matches = useSame(given, sameMatches);
  const people = useSame(cast, samePeople);
  // a new sample (another season, a filter) is drawn after the page has answered the tap that asked for it
  const sample = useMemo(() => ({ matches, people, filters: scope }), [matches, people, scope]);
  const drawn = useDeferredValue(sample);
  const props = { ...drawn, onInspect };
  const index = views.findIndex(item => item.id === view);
  return <section className="sc-panel gc-root" aria-labelledby={`${uid}-title`} aria-busy={loading && !matches.length || shown !== view || drawn !== sample}>
    <header className="sc-head"><div><h3 id={`${uid}-title`}>El juego, en gráficas</h3><p>Las mismas jugadas y filtros que las cifras de esta selección. Toca un dorsal, una barra o un remate para ver las jugadas que hay detrás.</p></div><span className="sc-context"><b>{scope.team === "opponent" ? "El rival" : scope.playerIds?.length ? "Jugadores elegidos" : "Manchester Piti"}</b>{span(scope, matches.length)}</span></header>
    <div className="vd-glass vd-seg gc-tabs" role="group" aria-label="Vistas de las gráficas" style={{ "--n": views.length, "--i": index } as CSSProperties}>
      <span className="vd-shelf__bead" aria-hidden="true"/>
      {views.map(item => <button type="button" key={item.id} className="vd-seg__b" aria-pressed={view === item.id} onClick={() => setView(item.id)}><svg viewBox="0 0 24 24" aria-hidden="true"><path d={item.icon} fill="none" stroke="currentColor" strokeWidth="1.9" strokeLinecap="round" strokeLinejoin="round"/></svg>{item.label}</button>)}
    </div>
    {loading && !matches.length ? <ChartLoading/> : shown === "network" ? <PassNetworkView {...props}/> : shown === "insights" ? <AnalysisInsights embedded {...props}/> : <ShotViews {...props}/>}
  </section>;
}
