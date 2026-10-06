// Pure logic of the Celeste Estadísticas page (Design canvas "Estadísticas · elegida"): the Pichichi
// race replayed jornada by jornada, the goal clock, the pass constellation, the radar, the minutes
// heatmap, rivals with their games, the season collection and the ticker. Everything is computed from
// the finished matches already loaded (clubAnalytics' PlayerAnalysis rows), no extra reads.
import type { ClubMatch } from "./clubData";
import type { MatchEvent } from "../../functions/src/matchEngine";
import { competitionRanks, milestoneSteps, milestones, opponentInitials, teamAnalysis, type PlayerAnalysis } from "./clubAnalytics";

const OURS = new Set(["goal", "goal_penalty", "goal_freekick", "opponent_own_goal"]);
const THEIRS = new Set(["opponent_goal", "own_goal"]);
const SCORED = new Set(["goal", "goal_penalty", "goal_freekick"]);
const nameOf = (p: Pick<PlayerAnalysis, "shirtName" | "firstName" | "lastName">) => p.shirtName || [p.firstName, p.lastName].filter(Boolean).join(" ") || "Jugador";

// ---------- team
export const points = (games: ClubMatch[]) => {
  const t = teamAnalysis(games);
  return t.wins * 3 + t.draws;
};

// ---------- the race
export type RaceMetric = "goals" | "assists" | "ga";
export interface RaceRow {
  id: string;
  value: number;
  /** What this jornada added. */
  delta: number;
  rank: number;
  /** Position in the list (0-based, ties broken by name) — where the row sits on the board. */
  pos: number;
}
export interface RaceFrame {
  match: ClubMatch;
  rows: RaceRow[];
}
/** Cumulative standings after each game; only players with something to show. */
export function raceFrames(rows: PlayerAnalysis[], metric: RaceMetric): RaceFrame[] {
  const n = rows[0]?.series.length ?? 0;
  const names = new Map(rows.map((p) => [p.id, nameOf(p)]));
  return Array.from({ length: n }, (_, i) => {
    const standing = rows
      .map((p) => ({ id: p.id, value: p.series.slice(0, i + 1).reduce((s, g) => s + g[metric], 0), delta: p.series[i][metric] }))
      .filter((r) => r.value > 0)
      .sort((a, b) => b.value - a.value || names.get(a.id)!.localeCompare(names.get(b.id)!));
    const ranks = competitionRanks(standing, (r) => r.value);
    return { match: rows[0].series[i].match, rows: standing.map((r, pos) => ({ ...r, rank: ranks.get(r.id)!, pos })) };
  });
}
/** Jornadas each player spent top of the race (ties share it). */
export function framesInLead(frames: RaceFrame[]) {
  const lead = new Map<string, number>();
  for (const f of frames) for (const r of f.rows) if (r.rank === 1) lead.set(r.id, (lead.get(r.id) ?? 0) + 1);
  return lead;
}

// ---------- the goal clock
export interface ClockSlice {
  from: number;
  to: number;
  us: number;
  them: number;
}
/** Goals for/against by 5′ slice of the match (the longest duration among the games, 50′ by default). */
export function goalClock(games: ClubMatch[], playerId?: string) {
  const duration = Math.max(50, ...games.map((m) => m.duration ?? 0));
  const slices: ClockSlice[] = Array.from({ length: Math.ceil(duration / 5) }, (_, i) => ({ from: i * 5, to: i * 5 + 5, us: 0, them: 0 }));
  let unknown = 0;
  const at = (minute: number) => slices[Math.min(slices.length - 1, Math.max(0, Math.ceil(minute / 5) - 1))];
  for (const m of games)
    for (const e of m.events ?? []) {
      const ours = playerId ? SCORED.has(e.type) && e.playerId === playerId : OURS.has(e.type);
      const theirs = !playerId && THEIRS.has(e.type);
      if (!ours && !theirs) continue;
      if (typeof e.minute !== "number") {
        unknown++;
        continue;
      }
      if (ours) at(e.minute).us++;
      else at(e.minute).them++;
    }
  const peak = (k: "us" | "them") => slices.reduce<ClockSlice | null>((best, s) => (s[k] > (best?.[k] ?? 0) ? s : best), null);
  return { slices, duration, unknown, peakUs: peak("us"), peakThem: peak("them") };
}

// ---------- the constellation
export interface StarNode {
  id: string;
  name: string;
  number?: number | string;
  ga: number;
  /** % of the pitch, attacking upwards. */
  x: number;
  y: number;
  r: number;
}
export interface StarLink {
  from: string;
  to: string;
  n: number;
}
const ZONE_Y: Record<string, number> = { DEL: 18, MED: 46, DEF: 72, POR: 90 };
/** Assister → scorer pairs from the goal events. */
export function goalLinks(games: ClubMatch[]): StarLink[] {
  const count = new Map<string, StarLink>();
  for (const m of games)
    for (const e of m.events ?? [])
      if (SCORED.has(e.type) && e.playerId && e.assistPlayerId) {
        const k = e.assistPlayerId + ">" + e.playerId;
        const l = count.get(k) ?? { from: e.assistPlayerId, to: e.playerId, n: 0 };
        l.n++;
        count.set(k, l);
      }
  return [...count.values()].sort((a, b) => b.n - a.n || a.from.localeCompare(b.from) || a.to.localeCompare(b.to));
}
/** Players placed on a pitch-shaped sky by their position, sized by goals + assists. */
export function constellation(rows: PlayerAnalysis[], links: StarLink[]) {
  const linked = new Set(links.flatMap((l) => [l.from, l.to]));
  const shown = rows.filter((p) => p.ga > 0 || linked.has(p.id));
  const zone = (p: PlayerAnalysis) => (ZONE_Y[String(p.naturalPosition ?? "").toUpperCase()] !== undefined ? String(p.naturalPosition).toUpperCase() : "MED");
  const byZone = new Map<string, PlayerAnalysis[]>();
  for (const p of shown) byZone.set(zone(p), [...(byZone.get(zone(p)) ?? []), p]);
  const maxGa = Math.max(1, ...shown.map((p) => p.ga));
  const nodes: StarNode[] = [];
  for (const [z, ps] of byZone) {
    ps.sort((a, b) => b.ga - a.ga || nameOf(a).localeCompare(nameOf(b)));
    // Leader in the middle, then alternate left/right; rows with many stars zig-zag so labels breathe.
    const order = ps.map((p, i) => ({ p, slot: i === 0 ? 0 : i % 2 ? -Math.ceil(i / 2) : Math.ceil(i / 2) }));
    const span = Math.max(1, ...order.map((o) => Math.abs(o.slot)));
    for (const { p, slot } of order)
      nodes.push({
        id: p.id,
        name: nameOf(p),
        number: p.number,
        ga: p.ga,
        x: 50 + (slot / span) * Math.min(38, 12 * span),
        y: ZONE_Y[z] + (Math.abs(slot) % 2 ? 6 : 0),
        r: 1.6 + 2.6 * Math.sqrt(p.ga / maxGa),
      });
  }
  return { nodes, links: links.filter((l) => nodes.some((n) => n.id === l.from) && nodes.some((n) => n.id === l.to)) };
}

// ---------- radar
export const RADAR_AXES = ["Goleador", "Asistente", "G+A", "Presencia", "Disciplina", "Especialista"] as const;
const special = (p: PlayerAnalysis) => p.goalPenalty + p.goalFreekick + p.penaltySaved + p.woodwork;
/** Six 0–1 scores relative to the best of the squad in the period (Presencia: share of the games). */
export function radarScores(p: PlayerAnalysis, rows: PlayerAnalysis[], games: number) {
  const max = (f: (r: PlayerAnalysis) => number) => Math.max(1e-9, ...rows.map(f));
  const per = (v: number) => (p.matchesPlayed ? v / p.matchesPlayed : 0);
  const perOf = (r: PlayerAnalysis, v: number) => (r.matchesPlayed ? v / r.matchesPlayed : 0);
  const cards = (r: PlayerAnalysis) => r.yellowCards + 2 * r.redCards;
  return [
    per(p.goals) / max((r) => perOf(r, r.goals)),
    per(p.assists) / max((r) => perOf(r, r.assists)),
    p.ga / max((r) => r.ga),
    games ? p.matchesPlayed / games : 0,
    p.matchesPlayed ? Math.max(0, 1 - cards(p) / p.matchesPlayed) : 0,
    special(p) / max(special),
  ].map((v) => Math.round(Math.min(1, v) * 100) / 100);
}
/** The squad's average radar (players who played). */
export function radarAverage(rows: PlayerAnalysis[], games: number) {
  const played = rows.filter((r) => r.matchesPlayed > 0);
  if (!played.length) return RADAR_AXES.map(() => 0);
  const all = played.map((r) => radarScores(r, rows, games));
  return RADAR_AXES.map((_, i) => Math.round((all.reduce((s, v) => s + v[i], 0) / all.length) * 100) / 100);
}
/** SVG polygon points for scores on a radar of radius r centred at (c, c). */
export function radarPoints(scores: number[], c: number, r: number) {
  return scores
    .map((v, i) => {
      const a = -Math.PI / 2 + (i * 2 * Math.PI) / scores.length;
      return `${(c + Math.cos(a) * r * Math.max(0.04, v)).toFixed(1)},${(c + Math.sin(a) * r * Math.max(0.04, v)).toFixed(1)}`;
    })
    .join(" ");
}

// ---------- per player extras
/** G+A every 50′, over the games with minutes recorded (null when none). */
export function per50(p: PlayerAnalysis) {
  const tracked = p.series.filter((g) => g.minutes !== null);
  const minutes = tracked.reduce((s, g) => s + (g.minutes ?? 0), 0);
  return minutes ? Math.round((tracked.reduce((s, g) => s + g.ga, 0) / minutes) * 50 * 100) / 100 : null;
}
/** Share of the games he played that the team won (null when he hasn't played). */
export function winRateWith(p: PlayerAnalysis) {
  const played = p.series.filter((g) => g.played);
  return played.length ? Math.round((played.filter((g) => (g.match.goalsFor ?? 0) > (g.match.goalsAgainst ?? 0)).length / played.length) * 100) : null;
}
/** Share of the other players who played that he beats on `value` (0–100). */
export function percentile(p: PlayerAnalysis, rows: PlayerAnalysis[], value: (r: PlayerAnalysis) => number | null) {
  const mine = value(p);
  const others = rows.filter((r) => r.id !== p.id && r.matchesPlayed > 0).map(value).filter((v): v is number => v !== null);
  if (mine === null || !others.length) return null;
  return Math.round((others.filter((v) => v < mine).length / others.length) * 100);
}

// ---------- minutes heatmap
export interface HeatCell {
  matchId: string;
  minutes: number | null;
  played: boolean;
  goals: number;
  /** 0–1 share of the match duration. */
  level: number;
}
export function minutesHeat(rows: PlayerAnalysis[]) {
  return rows.map((p) => ({
    id: p.id,
    cells: p.series.map<HeatCell>((g) => ({
      matchId: g.match.id,
      minutes: g.minutes,
      played: g.played,
      goals: g.goals,
      level: g.minutes === null ? (g.played ? 0.5 : 0) : Math.min(1, g.minutes / (g.match.duration || 50)),
    })),
  }));
}

// ---------- rivals
const rivalKey = (name: string) =>
  name
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .trim()
    .toLowerCase()
    .replace(/\s+/g, " ");
/** One row per rival (names normalised), with its games newest first. */
export function rivalTable(games: ClubMatch[]) {
  const groups = new Map<string, ClubMatch[]>();
  for (const m of games) groups.set(rivalKey(m.rival || "Rival"), [...(groups.get(rivalKey(m.rival || "Rival")) ?? []), m]);
  return [...groups.entries()]
    .map(([key, g]) => ({
      key,
      name: g[0].rival || "Rival",
      logo: g.find((m) => m.rivalLogoUrl)?.rivalLogoUrl,
      initials: g.find((m) => m.rivalInitials)?.rivalInitials ?? opponentInitials(g[0].rival || "Rival"),
      games: [...g].reverse(),
      ...teamAnalysis(g),
    }))
    .sort((a, b) => b.played - a.played || a.name.localeCompare(b.name));
}
/** Minutes of the goals of one match: ours and theirs, for the drill-down timeline. */
export function goalMinutes(events: MatchEvent[] | undefined) {
  const list = (set: Set<string>) => (events ?? []).filter((e) => set.has(e.type) && typeof e.minute === "number").map((e) => e.minute as number).sort((a, b) => a - b);
  return { us: list(OURS), them: list(THEIRS) };
}

// ---------- the season collection (milestones as stickers)
export interface Sticker {
  id: string;
  playerId: string;
  metric: "goals" | "assists" | "matchesPlayed";
  value: number;
  /** Reached in this match… */
  match?: ClubMatch;
  /** …or still missing this many. */
  left?: number;
}
/** Reached milestones (newest first) plus, per player, the next one in each metric they've started. */
export function collection(rows: PlayerAnalysis[]) {
  const got: Sticker[] = milestones(rows).map((m) => ({ ...m }));
  const next: Sticker[] = [];
  for (const p of rows)
    for (const metric of ["goals", "assists", "matchesPlayed"] as const) {
      const v = p[metric];
      if (!v) continue;
      const step = milestoneSteps.find((s) => s > v);
      if (step) next.push({ id: `${p.id}:${metric}:${step}`, playerId: p.id, metric, value: step, left: step - v });
    }
  next.sort((a, b) => a.left! - b.left! || b.value - a.value || a.id.localeCompare(b.id));
  return { got, next };
}

// ---------- the ticker
/** Short headline lines from the period: streaks alive, leaders, records. */
export function tickerLines(rows: PlayerAnalysis[], games: ClubMatch[]) {
  const t = teamAnalysis(games);
  const lines: string[] = [];
  if (t.winStreak.current.count >= 2) lines.push(`${t.winStreak.current.count} victorias seguidas`);
  else if (t.unbeatenStreak.current.count >= 3) lines.push(`${t.unbeatenStreak.current.count} partidos sin perder`);
  const top = (k: "goals" | "assists") => [...rows].sort((a, b) => b[k] - a[k])[0];
  const scorer = top("goals");
  if (scorer?.goals) lines.push(`Pichichi: ${nameOf(scorer)} con ${scorer.goals}`);
  const assister = top("assists");
  if (assister?.assists) lines.push(`Más asistencias: ${nameOf(assister)} con ${assister.assists}`);
  for (const p of rows) if (p.goalStreak.current.count >= 2) lines.push(`${nameOf(p)} marca en ${p.goalStreak.current.count} seguidos`);
  const big = [...games].sort((a, b) => b.goalsFor! - b.goalsAgainst! - (a.goalsFor! - a.goalsAgainst!))[0];
  if (big && big.goalsFor! > big.goalsAgainst!) lines.push(`Mayor victoria: ${big.goalsFor}–${big.goalsAgainst} a ${big.rival ?? "rival"}`);
  if (t.played) lines.push(`${t.gf} goles en ${t.played} ${t.played === 1 ? "partido" : "partidos"}`);
  return lines;
}
