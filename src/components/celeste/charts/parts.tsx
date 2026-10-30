import type { CSSProperties, ReactNode } from "react";
import type { AnalysisFilters } from "../../../../functions/src/narrated/types";
import type { WorkspacePerson } from "../../../lib/analysisWorkspace";
import type { ClubMatch } from "../../../lib/clubData";
import "./charts.css";

/** What every chart view receives from the page (Números or the match): its sample and its filters. */
export interface ChartProps {
  matches: readonly ClubMatch[];
  people: readonly WorkspacePerson[];
  filters?: AnalysisFilters;
  onInspect?: (metricId: string, playerId?: string) => void;
}

/** «Gráficas del juego»: the pieces every chart view shares, so the three tabs read as one place
 *  (the Vidrio segmented control, the data headline, the figures row and «Cómo leer esta gráfica»). */
export interface ChartSegOpt<V extends string> { value: V; label: string; ariaLabel?: string }

/** The kit's segmented control (.vd-seg with its bead) as a group of pressed buttons. */
export function ChartSeg<V extends string>({ label, opts, value, onPick, className }: { label: string; opts: readonly ChartSegOpt<V>[]; value: V; onPick: (value: V) => void; className?: string }) {
  const i = Math.max(0, opts.findIndex(o => o.value === value));
  return <div className={`vd-glass vd-seg gc-seg${className ? ` ${className}` : ""}`} role="group" aria-label={label} style={{ "--n": opts.length, "--i": i } as CSSProperties}>
    <span className="vd-shelf__bead" aria-hidden="true"/>
    {opts.map(o => <button key={o.value} type="button" className="vd-seg__b" aria-pressed={o.value === value} aria-label={o.ariaLabel} onClick={() => onPick(o.value)}>{o.label}</button>)}
  </div>;
}

/** A view switcher with its one-line hint beside it. */
export function ChartViews<V extends string>({ opts, value, onPick, hint }: { opts: readonly ChartSegOpt<V>[]; value: V; onPick: (value: V) => void; hint?: string }) {
  return <div className="gc-viewbar">
    <ChartSeg label="Vistas de esta gráfica" opts={opts} value={value} onPick={onPick} className="gc-views"/>
    {hint && <p className="gc-viewhint">{hint}</p>}
  </div>;
}

/** The sentence the data tells, set straight on the glass. */
export function ChartHero({ title, children }: { title: string; children?: ReactNode }) {
  return <div className="gc-hero"><h4 className="gc-hero__h">{title}</h4>{children && <p className="gc-hero__p">{children}</p>}</div>;
}

export interface ChartKpi { label: string; value: string }
export function ChartKpis({ items, label = "Cifras de la selección" }: { items: readonly ChartKpi[]; label?: string }) {
  if (!items.length) return null;
  return <ul className="gc-kpis" aria-label={label}>{items.map(k => <li className="gc-kpi" key={k.label}><strong>{k.value}</strong> <span>{k.label}</span></li>)}</ul>;
}

/** The honest notes of each chart, one tap away instead of a wall of text. */
export function ChartHow({ children }: { children: ReactNode }) {
  return <details className="gc-how"><summary>Cómo leer esta gráfica</summary><div className="gc-how__body">{children}</div></details>;
}

/** Chart on the left, its reading on the right from the container's 860 px; one column below. */
export function ChartStage({ chart, side, wide = false }: { chart: ReactNode; side?: ReactNode; wide?: boolean }) {
  return <div className={`gc-stage${wide || !side ? " gc-stage--wide" : ""}`}><div className="gc-chart">{chart}</div>{side && <div className="gc-side">{side}</div>}</div>;
}
