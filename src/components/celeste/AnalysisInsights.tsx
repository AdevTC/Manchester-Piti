import { useId, useMemo, useState } from "react";
import type { AnalysisFilters } from "../../../functions/src/narrated/types";
import type { WorkspacePerson } from "../../lib/analysisWorkspace";
import type { ClubMatch } from "../../lib/clubData";
import { partLabel } from "../../lib/insightTramos";
import { ChartViews } from "./charts/parts";
import { TramosChart } from "./charts/TramosChart";
import { PassMatrixChart, type MatrixMode, type MatrixOrder } from "./charts/PassMatrixChart";
import "./analysis-insights.css";

export { AnalysisInsightEvidence } from "./AnalysisInsightEvidence";

export interface AnalysisInsightsProps {
  matches: readonly ClubMatch[];
  people: readonly WorkspacePerson[];
  filters?: AnalysisFilters;
  onInspect?: (metricId: string, playerId?: string) => void;
  /** Inside «Gráficas del juego» (.gc-root): the panel gives the title, so this one drops its own header. */
  embedded?: boolean;
}
type View = "pulse" | "bars" | "matrix";
const VIEWS = [{ value: "pulse", label: "Pulso" }, { value: "bars", label: "Barras" }, { value: "matrix", label: "Matriz" }] as const;
const HINTS: Record<View, string> = { pulse: "Arriba el Piti, abajo el rival, tramo a tramo.", bars: "Un equipo, con la media de sus tramos.", matrix: "Quién conecta con quién: fila pasa, columna recibe." };

/** Local chart selections reveal their own evidence; they never silently replace the page scope. */
export function AnalysisInsights({ matches, people, filters = {}, onInspect, embedded = false }: AnalysisInsightsProps) {
  const uid = useId();
  const [view, setView] = useState<View>("pulse");
  const [metric, setMetric] = useState("067");
  const [mode, setMode] = useState<MatrixMode>("volume");
  const [order, setOrder] = useState<MatrixOrder>("position");
  const scopeKey = JSON.stringify(filters);
  const scope = useMemo<AnalysisFilters>(() => JSON.parse(scopeKey), [scopeKey]);
  const props = { matches, people, filters: scope, onInspect };
  const body = <>
    <ChartViews opts={VIEWS} value={view} onPick={setView} hint={HINTS[view]}/>
    {view === "matrix" ? <PassMatrixChart {...props} mode={mode} onMode={setMode} order={order} onOrder={setOrder}/> : <TramosChart {...props} view={view} metric={metric} onMetric={setMetric}/>}
  </>;
  if (embedded) return <div className="ai-embedded">{body}</div>;
  return <section className="gc-root ai" aria-labelledby={`${uid}-title`}>
    <header className="ai-head"><div><h3 id={`${uid}-title`}>Dónde cambia el juego</h3><p>Busca momentos y conexiones. Toca un tramo o una pareja para revisar las jugadas que hay detrás.</p></div><p className="ai-ctx"><b>{scope.team === "opponent" ? "El rival" : scope.playerIds?.length ? "Jugadores seleccionados" : "Manchester Piti"}</b>{scope.period ? ` · ${partLabel(scope.period)}` : ""}</p></header>
    {body}
  </section>;
}
