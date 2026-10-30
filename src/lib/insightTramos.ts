// «Tramos y matriz»: the geometry and the reading of the 5-minute pulse. Both teams share one scale and one set of
// columns (the union of their tramos); a tramo without a backed value stays a gap, never a zero.
import { prepareNarrated } from "../../functions/src/narrated/engine";
import { isGoal, periodInterval } from "../../functions/src/narrated/operators";
import type { AnalysisFilters, NarratedMatch } from "../../functions/src/narrated/types";
import { workspaceMetricValue } from "./analysisWorkspace";
import type { InsightSegment } from "./analysisInsights";

export type TramoSide = "us" | "them";
export interface TramoCol { key: string; period: number; from: number; to: number; us?: InsightSegment; them?: InsightSegment; x: number; w: number }
export interface TramoLayout { cols: TramoCol[]; breaks: number[]; parts: { x: number; period: number }[]; width: number }
export interface GoalMark { key: string; side: TramoSide; x: number; label: string }

/** Short labels for the picker; the long name stays the button's accessible name. «Pérdidas»: fewer is better. */
export const TRAMO_METRICS: Record<string, { short: string; low?: boolean; pct?: boolean }> = {
  "067": { short: "Pases" }, "070": { short: "Precisión", pct: true }, "029": { short: "Remates" }, "201": { short: "Pérdidas", low: true }, "206": { short: "Recup." },
};

export const partLabel = (period: number) => period ? `${period}.ª parte` : "Tiempo de juego sin desglose por partes";
export const tramoValue = (col: TramoCol, side: TramoSide) => workspaceMetricValue(col[side]?.result);

/** Columns side by side, a 4 % gap (the half-time) between parts. x and w are percentages of the plot. */
export function layoutTramos(us: readonly InsightSegment[], them: readonly InsightSegment[]): TramoLayout {
  const map = new Map<string, Omit<TramoCol, "x" | "w">>();
  for (const s of us) map.set(s.key, { key: s.key, period: s.period, from: s.from, to: s.to, us: s });
  for (const s of them) map.set(s.key, { ...(map.get(s.key) ?? { key: s.key, period: s.period, from: s.from, to: s.to }), them: s });
  const sorted = [...map.values()].sort((a, b) => a.period - b.period || a.from - b.from);
  const periods = new Set(sorted.map(c => c.period)).size;
  const gap = periods > 1 ? 4 : 0;
  const width = (100 - gap * (periods - 1)) / Math.max(1, sorted.length);
  const breaks: number[] = [], parts: { x: number; period: number }[] = [];
  let x = 0, previous: number | null = null;
  const cols = sorted.map(c => {
    if (previous != null && c.period !== previous) { breaks.push(x + gap / 2); x += gap; }
    if (c.period !== previous) parts.push({ x, period: c.period });
    const col = { ...c, x, w: width }; x += width; previous = c.period;
    return col;
  });
  return { cols, breaks, parts, width };
}

const f2 = (n: number) => Math.round(n * 100) / 100;
/** One smooth area per run of known values (broken by a gap or a new part), from the axis at y = 50. */
export function ribbon(cols: readonly TramoCol[], side: TramoSide, max: number, height = 38): { d: string; l: string }[] {
  const sign = side === "us" ? 1 : -1;
  const runs: { pts: [number, number][]; x0: number; x1: number }[] = [];
  let run: (typeof runs)[number] | null = null, period: number | null = null;
  for (const c of cols) {
    const v = tramoValue(c, side);
    if (c.period !== period) { if (run) runs.push(run); run = null; period = c.period; }
    if (v == null) { if (run) runs.push(run); run = null; continue; }
    const y = 50 - sign * height * v / max;
    if (!run) run = { pts: [], x0: c.x, x1: c.x + c.w };
    run.pts.push([c.x + c.w / 2, y]); run.x1 = c.x + c.w;
  }
  if (run) runs.push(run);
  return runs.map(({ pts, x0, x1 }) => {
    let l = `M${f2(x0)} ${f2(pts[0][1])} L${f2(pts[0][0])} ${f2(pts[0][1])}`;
    for (let i = 1; i < pts.length; i++) {
      const [xa, ya] = pts[i - 1], [xb, yb] = pts[i], dx = (xb - xa) / 2;
      l += ` C${f2(xa + dx)} ${f2(ya)} ${f2(xb - dx)} ${f2(yb)} ${f2(xb)} ${f2(yb)}`;
    }
    l += ` L${f2(x1)} ${f2(pts[pts.length - 1][1])}`;
    return { l, d: `M${f2(x0)} 50 ${l.replace(/^M/, "L")} L${f2(x1)} 50 Z` };
  });
}

const clock = (second: number) => `${Math.floor(second / 60)}′${second % 60 ? ` ${Math.floor(second % 60)}″` : ""}`;

/** Goals in their tramo, on the part's own clock. Approximate times and windows longer than a tramo are left out. */
export function goalMarks(matches: readonly NarratedMatch[], filters: AnalysisFilters, cols: readonly TramoCol[], names: (id: string) => string | undefined, rivalOf: (matchId: string) => string): GoalMark[] {
  if (!cols.length) return [];
  const ctx = prepareNarrated(matches, { ...filters, team: undefined, playerIds: undefined });
  const byMatch = new Map(ctx.matches.map(m => [m.match.id, m]));
  const noParts = cols.every(c => c.period === 0);
  const stack = new Map<string, number>();
  const marks: GoalMark[] = [];
  for (const e of ctx.all) {
    if (!isGoal(e) || !e.time || e.time.precision === "approximate" || e.time.to - e.time.from > 300) continue;
    const prepared = byMatch.get(e.matchId); if (!prepared) continue;
    const period = noParts ? 0 : e.period; if (period == null) continue;
    const start = period === 0 ? 0 : periodInterval({ ...ctx, filters: { ...ctx.filters, period } }, prepared)?.from;
    if (start == null) continue;
    const t = e.time.from - start;
    const inPart = cols.filter(c => c.period === period);
    const col = inPart.find(c => t >= c.from && t < c.to) ?? [...inPart].reverse().find(c => t >= c.from);
    if (!col) continue;
    const side: TramoSide = e.facts.ownGoal === true ? e.team === "us" ? "them" : "us" : e.team === "us" ? "us" : "them";
    const k = (stack.get(col.key + side) ?? 0) + 1; stack.set(col.key + side, k);
    const frac = Math.min(.92, Math.max(.08, (t - col.from) / Math.max(1, col.to - col.from)));
    const scorer = side === "us" && e.team === "us" && e.facts.ownGoal !== true && e.actorId ? names(e.actorId) : undefined;
    const when = `${period ? `${period}.ª parte, ` : ""}${clock(t)}`;
    marks.push({ key: e.evidenceId, side, x: Math.min(99, col.x + col.w * frac + (k - 1) * Math.min(2.2, col.w / 4)), label: side === "us" ? `Gol del Piti${scorer ? `, de ${scorer}` : ""} · ${when}` : `Gol de ${rivalOf(e.matchId)} · ${when}` });
  }
  return marks;
}
