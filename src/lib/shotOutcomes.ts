import { prepareNarrated } from "../../functions/src/narrated/engine";
import { periodInterval, quantity, type ScopedObservation } from "../../functions/src/narrated/operators";
import type { AnalysisFilters, MetricResult, NarratedMatch } from "../../functions/src/narrated/types";
import { insightEvidence } from "./analysisInsights";
import { selectAnalysisMatches, workspaceMetricValue, type WorkspacePerson } from "./analysisWorkspace";
import { buildShotChart } from "./statsCharts";

/** How each shot ended, ONE per shot: the catalogue's categories overlap (a goal off the post is a goal,
 *  on target and woodwork), the drawing does not. Order of precedence: gol > madera > parado > bloqueado > fuera. */
export const SHOT_OUTCOMES = ["gol", "madera", "parado", "bloqueado", "fuera", "nd"] as const;
export type ShotOutcome = typeof SHOT_OUTCOMES[number];
export const SHOT_OUTCOME_ONE: Record<ShotOutcome, string> = { gol: "Gol", madera: "A la madera", parado: "Parado", bloqueado: "Bloqueado", fuera: "Fuera", nd: "Sin precisar" };
export const SHOT_OUTCOME_MANY: Record<ShotOutcome, string> = { gol: "Goles", madera: "A la madera", parado: "Parados", bloqueado: "Bloqueados", fuera: "Fuera", nd: "Sin precisar" };
/** The catalogue metric behind each drawn category (parado is «a puerta» minus goals, so it points at 030). */
export const SHOT_OUTCOME_METRIC: Partial<Record<ShotOutcome, string>> = { gol: "015", madera: "033", parado: "030", bloqueado: "032", fuera: "031" };

export interface ShotRow { event: ScopedObservation; outcome: ShotOutcome; outside: boolean; count: number; shooter?: string }
export type ShotCounts = Record<ShotOutcome, number>;
type ShotChart = ReturnType<typeof buildShotChart>;

export function classifyShot(id: string, sets: ReadonlyMap<string, ReadonlySet<string>>): ShotOutcome {
  const has = (metric: string) => sets.get(metric)?.has(id) ?? false;
  return has("015") ? "gol" : has("033") ? "madera" : has("030") ? "parado" : has("032") ? "bloqueado" : has("031") ? "fuera" : "nd";
}

export const emptyCounts = (): ShotCounts => ({ gol: 0, madera: 0, parado: 0, bloqueado: 0, fuera: 0, nd: 0 });
export function countShots(rows: readonly ShotRow[]): ShotCounts {
  const counts = emptyCounts();
  for (const row of rows) counts[row.outcome] += row.count;
  return counts;
}
export const totalShots = (rows: readonly ShotRow[]) => rows.reduce((n, row) => n + row.count, 0);

export interface ShotOutcomes { chart: ShotChart; rows: ShotRow[]; counts: ShotCounts; total: number; value: (metricId: string) => number | null; result: (metricId: string) => MetricResult }

/** The sample is the evidence of 029 (remates) under the page's filters; each shot gets its category from the
 *  evidence of the other bars, so the drawing and the figures read the same plays. */
export function buildShotOutcomes(matches: readonly NarratedMatch[], filters: AnalysisFilters = {}): ShotOutcomes {
  const chart = buildShotChart(matches, filters);
  const results = new Map(chart.bars.map(bar => [bar.id as string, bar.result]));
  const sets = new Map(chart.bars.map(bar => [bar.id as string, new Set(bar.result.evidenceEventIds)]));
  const shots = results.get("029")!;
  const events = shots.evidenceEventIds.length ? insightEvidence(selectAnalysisMatches(matches, filters), shots.evidenceEventIds) : [];
  const rows = events.map(event => ({ event, outcome: classifyShot(event.evidenceId, sets), outside: event.facts.outsideArea === true, count: quantity(event), shooter: event.team === "us" ? event.actorId : undefined }));
  return { chart, rows, counts: countShots(rows), total: totalShots(rows), value: id => workspaceMetricValue(results.get(id)), result: id => results.get(id)! };
}

/** «Orduña» for one match, «Los rivales» for several. */
export function rivalLabel(matches: readonly (NarratedMatch & { rival?: string })[], filters: AnalysisFilters = {}): string {
  const sample = selectAnalysisMatches(matches, { ...filters, playerIds: undefined });
  if (sample.length !== 1) return "Los rivales";
  return matches.find(match => match.id === sample[0].id)?.rival?.trim() || "El rival";
}

/* ---------- Portería: a dot per shot in the zone of how it ended (never where it went) ---------- */

export interface GoalDot { key: string; row: ShotRow; x: number; y: number }
/** Zones in the 600 × 340 goal drawing: [x, y, width, height]. */
const ZONES: Partial<Record<ShotOutcome, [number, number, number, number]>> = { gol: [176, 104, 248, 66], parado: [176, 196, 248, 60], bloqueado: [168, 298, 264, 30], nd: [24, 290, 110, 40] };
const POSTS: [number, number][] = [[154, 140], [446, 140], [300, 70], [154, 200], [446, 200], [230, 70], [370, 70], [154, 110], [446, 110], [262, 70], [338, 70], [154, 240], [446, 240]];
const r1 = (n: number) => Math.round(n * 10) / 10;
const byTime = (a: ShotRow, b: ShotRow) => a.event.matchId.localeCompare(b.event.matchId) || (a.event.period ?? 0) - (b.event.period ?? 0) || (a.event.time?.from ?? 0) - (b.event.time?.from ?? 0) || a.event.order - b.event.order;

function grid(n: number, [x0, y0, w, h]: [number, number, number, number]) {
  const step = n * 22 * 22 > w * h ? Math.max(9, Math.sqrt(w * h / n)) : 22;
  const cols = Math.max(1, Math.floor(w / step)), rows = Math.ceil(n / cols), used = Math.min(n, cols);
  const ox = x0 + (w - used * step) / 2 + step / 2, oy = y0 + Math.max(0, (h - rows * step) / 2) + step / 2;
  return (i: number): [number, number] => [ox + i % cols * step, oy + Math.floor(i / cols) * step];
}

export function goalDots(rows: readonly ShotRow[]): GoalDot[] {
  const dots: GoalDot[] = [];
  for (const outcome of SHOT_OUTCOMES) {
    const units = rows.filter(row => row.outcome === outcome).sort(byTime).flatMap(row => Array.from({ length: row.count }, (_, i) => ({ row, key: `${row.event.evidenceId}:${i}` })));
    const place = ZONES[outcome] ? grid(units.length, ZONES[outcome]!) : undefined;
    units.forEach(({ row, key }, i) => {
      let p: [number, number];
      if (outcome === "fuera") { const side = i % 3, k = Math.floor(i / 3); p = side === 0 ? [44 + k % 4 * 22, 62 + Math.floor(k / 4) * 24] : side === 1 ? [490 + k % 4 * 22, 62 + Math.floor(k / 4) * 24] : [186 + k % 11 * 22, 20 + Math.floor(k / 11) * 20]; }
      else if (outcome === "madera") p = POSTS[i % POSTS.length];
      else p = place!(i);
      dots.push({ key, row, x: r1(p[0]), y: r1(p[1]) });
    });
  }
  return dots;
}

/* ---------- Embudo ---------- */

export interface FunnelFigures { total: number; onTarget: number; off: number; blocked: number; unknown: number; goals: number; saved: number }
/** The funnel uses the catalogue's figures (029, 030, 031, 032); goals are the shots that ended in goal (015's evidence
 *  inside the sample, so an own goal of theirs, which is no shot of ours, stays out); «sin precisar» is what none explains. */
export function funnelFigures(data: ShotOutcomes): FunnelFigures {
  const v = (id: string) => data.value(id) ?? 0;
  const total = data.value("029") ?? data.total, onTarget = v("030"), off = v("031"), blocked = v("032"), goals = data.counts.gol;
  return { total, onTarget, off, blocked, unknown: Math.max(0, total - onTarget - off - blocked), goals, saved: Math.max(0, onTarget - goals) };
}

/* ---------- Minutos: both teams on one clock ---------- */

export type ShotTeam = "us" | "opponent";
export interface TimelineDot { key: string; row: ShotRow; team: ShotTeam; period: number; second: number; x: number; stack: number }
export interface ShotTimeline {
  dots: TimelineDot[]; bands: { period: number; x: number; w: number; label: string }[]; ticks: { x: number; second: number }[];
  us: ShotRow[]; them: ShotRow[]; skipped: number; maxStack: number;
}
const MAX_INTERVAL = 600;

/** Each shot sits at the middle of its narrated interval, measured from its own period's start; intervals longer
 *  than ten minutes are not drawn (they are counted in `skipped`). The rival side drops the page's player filter. */
export function buildShotTimeline(matches: readonly NarratedMatch[], filters: AnalysisFilters = {}): ShotTimeline {
  const usFilters: AnalysisFilters = { ...filters, team: "us" };
  const themFilters: AnalysisFilters = { ...filters, team: "opponent", playerIds: undefined };
  const us = buildShotOutcomes(matches, usFilters).rows, them = buildShotOutcomes(matches, themFilters).rows;
  const ctx = prepareNarrated(selectAnalysisMatches(matches, { ...filters, playerIds: undefined }), { ...filters, playerIds: undefined });
  const starts = new Map<string, number>(); const lens = new Map<number, number>();
  const nominal = (period: number) => (ctx.matches[0]?.profile.periodMinutes[period - 1] ?? 25) * 60;
  const seen = [...us, ...them].map(row => row.event.period).filter((p): p is number => typeof p === "number" && p > 0);
  const periods = filters.period != null ? [filters.period] : [...new Set([1, 2, ...seen])].sort((a, b) => a - b).slice(0, 8);
  for (const prepared of ctx.matches) for (const period of periods) {
    const range = periodInterval({ ...ctx, filters: { ...ctx.filters, period } }, prepared);
    const start = range?.from ?? prepared.profile.periodMinutes.slice(0, period - 1).reduce((s, m) => s + m * 60, 0);
    starts.set(`${prepared.match.id}:${period}`, start);
    lens.set(period, Math.max(lens.get(period) ?? nominal(period), range ? range.to - range.from : 0));
  }
  for (const period of periods) if (!lens.has(period)) lens.set(period, nominal(period));
  const gap = periods.length > 1 ? 3 : 0;
  const totalLen = periods.reduce((s, p) => s + lens.get(p)!, 0) || 1;
  const span = new Map<number, [number, number]>(); let x0 = 0;
  for (const p of periods) { const w = (100 - gap * (periods.length - 1)) * lens.get(p)! / totalLen; span.set(p, [x0, w]); x0 += w + gap; }
  const stacks = new Map<string, number>(); let skipped = 0, maxStack = 1;
  const dots: TimelineDot[] = [];
  const place = (rows: readonly ShotRow[], team: ShotTeam) => {
    for (const row of [...rows].sort(byTime)) {
      const { period, time } = row.event; const sp = period != null ? span.get(period) : undefined;
      if (!sp || !time || time.to - time.from > MAX_INTERVAL) { skipped += row.count; continue; }
      const second = Math.max(0, (time.from + time.to) / 2 - (starts.get(`${row.event.matchId}:${period}`) ?? 0));
      const x = r1(sp[0] + sp[1] * Math.min(1, second / lens.get(period!)!));
      for (let i = 0; i < row.count; i++) {
        const bin = `${team}:${Math.round(x / 2.2)}`; const stack = (stacks.get(bin) ?? 0) + 1; stacks.set(bin, stack); maxStack = Math.max(maxStack, stack);
        dots.push({ key: `${team}:${row.event.evidenceId}:${i}`, row, team, period: period!, second, x, stack });
      }
    }
  };
  place(us, "us"); place(them, "opponent");
  const bands = periods.map(p => ({ period: p, x: r1(span.get(p)![0]), w: r1(span.get(p)![1]), label: `${p}.ª parte` }));
  const ticks = periods.flatMap(p => { const [sx, sw] = span.get(p)!; const len = lens.get(p)!; return Array.from({ length: Math.floor(len / 300) + 1 }, (_, i) => ({ x: r1(sx + sw * i * 300 / len), second: i * 300 })); });
  return { dots, bands, ticks, us, them, skipped, maxStack };
}

/* ---------- Quién ---------- */

export interface ShooterRow { key: string; name: string; number?: number | string | null; total: number; counts: ShotCounts; rows: ShotRow[] }
export const UNKNOWN_SHOOTER = "_";
/** One row per shooter. Rival shots rarely name the shooter: they go in one row with the rival's name. */
export function shotsByPlayer(rows: readonly ShotRow[], people: readonly WorkspacePerson[], opponent: boolean, rival: string): ShooterRow[] {
  const names = new Map(people.map(person => [person.id, person]));
  const groups = new Map<string, ShotRow[]>();
  for (const row of rows) { const key = !opponent && row.shooter ? row.shooter : UNKNOWN_SHOOTER; groups.set(key, [...groups.get(key) ?? [], row]); }
  return [...groups].map(([key, list]) => {
    const person = key === UNKNOWN_SHOOTER ? undefined : names.get(key);
    return { key, name: key === UNKNOWN_SHOOTER ? opponent ? rival : "Sin identificar" : person?.name ?? "Jugador sin ficha", number: person?.number, total: totalShots(list), counts: countShots(list), rows: list };
  }).sort((a, b) => b.total - a.total || (a.key === UNKNOWN_SHOOTER ? 1 : b.key === UNKNOWN_SHOOTER ? -1 : a.name.localeCompare(b.name, "es")));
}
