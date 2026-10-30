import { useId, useMemo, useState, type CSSProperties } from "react";
import type { AnalysisFilters } from "../../../functions/src/narrated/types";
import { AnalysisInsights } from "./AnalysisInsights";
import type { ChartProps } from "./charts/parts";
import { PassNetworkView } from "./charts/PassNetwork";
import { ShotViews } from "./charts/ShotViews";
import "./charts/charts.css";
import "./stats-charts.css";

export type StatsChartsPanelProps = ChartProps;
const views = [
  { id: "network", label: "Red de pases", icon: "M4.5 7.5a2.5 2.5 0 1 0 5 0a2.5 2.5 0 1 0 -5 0M14.5 6a2.5 2.5 0 1 0 5 0a2.5 2.5 0 1 0 -5 0M9.5 17.5a2.5 2.5 0 1 0 5 0a2.5 2.5 0 1 0 -5 0M9.6 7.2l4.8-.9M8.4 9.8l2.4 5.2M15.8 8.4l-2.6 6.6" },
  { id: "insights", label: "Tramos y matriz", icon: "M3 12h18M6 12V7M10 12V4M14 12V8M18 12V6M8 12v4M12 12v6M16 12v3" },
  { id: "shots", label: "Remates", icon: "M3 19V6h18v13M9.5 15a2.5 2.5 0 1 0 5 0a2.5 2.5 0 1 0 -5 0" },
] as const;
type View = typeof views[number]["id"];

/** Shared by Números and the match: chart controls change the view, never the page's sample. */
export function StatsChartsPanel({ matches, people, filters = {}, onInspect }: StatsChartsPanelProps) {
  const uid = useId();
  const [view, setView] = useState<View>("network");
  const key = JSON.stringify(filters);
  const scope = useMemo<AnalysisFilters>(() => JSON.parse(key), [key]);
  const props = { matches, people, filters: scope, onInspect };
  const index = views.findIndex(item => item.id === view);
  return <section className="sc-panel gc-root" aria-labelledby={`${uid}-title`}>
    <header className="sc-head"><div><h3 id={`${uid}-title`}>El juego, en gráficas</h3><p>Las mismas jugadas y filtros que las cifras de esta selección. Toca un dorsal, una barra o un remate para ver las jugadas que hay detrás.</p></div><span className="sc-context"><b>{scope.team === "opponent" ? "El rival" : scope.playerIds?.length ? "Jugadores elegidos" : "Manchester Piti"}</b>{scope.period ? ` · ${scope.period}.ª parte` : " · todo el partido"}</span></header>
    <div className="vd-glass vd-seg gc-tabs" role="group" aria-label="Vistas de las gráficas" style={{ "--n": views.length, "--i": index } as CSSProperties}>
      <span className="vd-shelf__bead" aria-hidden="true"/>
      {views.map(item => <button type="button" key={item.id} className="vd-seg__b" aria-pressed={view === item.id} onClick={() => setView(item.id)}><svg viewBox="0 0 24 24" aria-hidden="true"><path d={item.icon} fill="none" stroke="currentColor" strokeWidth="1.9" strokeLinecap="round" strokeLinejoin="round"/></svg>{item.label}</button>)}
    </div>
    {view === "network" ? <PassNetworkView {...props}/> : view === "insights" ? <AnalysisInsights embedded {...props}/> : <ShotViews {...props}/>}
  </section>;
}
