// Pure logic for the Partidos page (Celeste, "Noche de focos"): the season of one team as the page
// tells it — the tile strip, the numbers, the next/live match and the calendar rows — plus the live
// score read from the acta while a match is being played (goals are only stored once it's finished).
import { dateMillis, EVENT_LABELS, isCompleted, matchPhase, type MatchEvent } from "../../functions/src/matchEngine";
import type { ClubMatch } from "./clubData";

export type Result = "G" | "E" | "P";
export type Filter = "all" | "next" | "results";
const OURS = new Set(["goal", "goal_penalty", "goal_freekick", "opponent_own_goal"]);
const THEIRS = new Set(["opponent_goal", "own_goal"]);
const TZ = "Europe/Madrid";

const byDate = (a: ClubMatch, b: ClubMatch) => dateMillis(a.date) - dateMillis(b.date);

/** Goals for/against: the stored score once finished, otherwise counted from the acta's events. */
export function scoreOf(m: Pick<ClubMatch, "goalsFor" | "goalsAgainst" | "events">) {
  if (typeof m.goalsFor === "number" && typeof m.goalsAgainst === "number") return { gf: m.goalsFor, ga: m.goalsAgainst };
  let gf = 0, ga = 0;
  for (const e of m.events ?? []) {
    if (OURS.has(e.type)) gf++;
    else if (THEIRS.has(e.type)) ga++;
  }
  return { gf, ga };
}

export function resultOf(m: Pick<ClubMatch, "goalsFor" | "goalsAgainst" | "events">): Result {
  const { gf, ga } = scoreOf(m);
  return gf > ga ? "G" : gf === ga ? "E" : "P";
}

/** Our scorers in a match, most goals first: "ADRIÁN T.C. ×2, HUBEROSKI". */
export function scorersLine(events: MatchEvent[] | undefined, nameOf: (id: string) => string) {
  const count = new Map<string, number>();
  for (const e of events ?? []) if (OURS.has(e.type) && e.type !== "opponent_own_goal" && e.playerId) count.set(e.playerId, (count.get(e.playerId) ?? 0) + 1);
  const own = (events ?? []).filter((e) => e.type === "opponent_own_goal").length;
  const parts = [...count.entries()].sort((a, b) => b[1] - a[1]).map(([id, n]) => (n > 1 ? `${nameOf(id)} ×${n}` : nameOf(id)));
  if (own) parts.push(own > 1 ? `autogol rival ×${own}` : "autogol rival");
  return parts.join(", ");
}

export type TileState = "played" | "live" | "next" | "future";
export interface Tile {
  id: string;
  j: number;
  rival: string;
  state: TileState;
  result?: Result;
}

/** One season as the page tells it. `now` decides what is live, next and played. */
export function seasonView(matches: ClubMatch[], seasonId: string, now: number) {
  const season = matches.filter((m) => m.seasonId === seasonId && matchPhase(m, now) !== "cancelled").sort(byDate);
  const live = season.find((m) => matchPhase(m, now) === "playing");
  const next = season.find((m) => matchPhase(m, now) === "scheduled");
  const played = season.filter((m) => isCompleted(m));
  const results = played.map(resultOf);
  const tiles: Tile[] = season.map((m, i) => ({
    id: m.id,
    j: i + 1,
    rival: m.rival ?? "Rival",
    state: m === live ? "live" : m === next ? "next" : isCompleted(m) ? "played" : "future",
    result: isCompleted(m) ? resultOf(m) : undefined,
  }));
  return {
    season,
    live,
    next,
    played,
    tiles,
    /** Jornada number (1-based, by date) of each match in the season. */
    jornada: new Map(season.map((m, i) => [m.id, i + 1])),
    wins: results.filter((r) => r === "G").length,
    draws: results.filter((r) => r === "E").length,
    losses: results.filter((r) => r === "P").length,
    gf: played.reduce((s, m) => s + scoreOf(m).gf, 0),
    ga: played.reduce((s, m) => s + scoreOf(m).ga, 0),
  };
}
export type SeasonView = ReturnType<typeof seasonView>;

/** Calendar rows: upcoming first (soonest first), then results (latest first), by filter and rival search. */
export function calendarRows(matches: ClubMatch[], filter: Filter, search: string, now: number) {
  const q = search.trim().toLocaleLowerCase("es");
  const upcoming = (m: ClubMatch) => ["scheduled", "playing", "postponed", "unscheduled"].includes(matchPhase(m, now));
  return matches
    .filter((m) => !q || (m.rival ?? "").toLocaleLowerCase("es").includes(q))
    .filter((m) => filter === "all" || (filter === "next" ? upcoming(m) : isCompleted(m)))
    .sort((a, b) => {
      const ua = upcoming(a), ub = upcoming(b);
      if (ua !== ub) return ua ? -1 : 1;
      return ua ? byDate(a, b) : byDate(b, a);
    });
}

/** Days/hours/minutes/seconds until `target` (zeros once it has passed), as two-digit strings. */
export function countdownParts(target: number, now: number) {
  const left = Math.max(0, Math.floor((target - now) / 1000));
  const pad = (n: number) => String(n).padStart(2, "0");
  return { d: pad(Math.floor(left / 86400)), h: pad(Math.floor((left % 86400) / 3600)), m: pad(Math.floor((left % 3600) / 60)), s: pad(left % 60), done: left === 0 };
}

/** The minute being played (1–duration), from the kickoff time; null when not live. */
export function liveMinute(m: Pick<ClubMatch, "date" | "duration">, now: number) {
  const start = dateMillis(m.date);
  if (!Number.isFinite(start) || now < start) return null;
  return Math.min(m.duration ?? 50, Math.floor((now - start) / 60_000) + 1);
}

const fmt = (ms: number, o: Intl.DateTimeFormatOptions) => new Intl.DateTimeFormat("es-ES", { timeZone: TZ, ...o }).format(ms);
/** Date pieces for a calendar row: "DOM", "8", "NOV", "12:00", "domingo, 8 nov". */
export function dateParts(date: unknown) {
  const ms = dateMillis(date);
  if (!Number.isFinite(ms)) return { wd: "—", day: "?", mon: "", time: "—", long: "Fecha por confirmar" };
  return {
    wd: fmt(ms, { weekday: "short" }).replace(".", "").toUpperCase(),
    day: fmt(ms, { day: "numeric" }),
    mon: fmt(ms, { month: "short" }).replace(".", "").toUpperCase(),
    time: fmt(ms, { hour: "2-digit", minute: "2-digit" }),
    long: fmt(ms, { weekday: "long", day: "numeric", month: "short" }).replace(".", ""),
  };
}

/** The latest thing that happened in the acta (by minute), as one line: "19′ · ERIK · Gol". */
export function lastEvent(events: MatchEvent[] | undefined, nameOf: (id: string) => string, rival: string) {
  const list = (events ?? []).filter((e) => e.type !== "match_played" && e.type !== "assist" && typeof e.minute === "number");
  const e = list.sort((a, b) => (a.minute ?? 0) - (b.minute ?? 0)).at(-1);
  if (!e) return null;
  const who = e.type === "opponent_goal" || e.type === "opponent_own_goal" ? rival : e.type === "substitution" && e.inPlayerId ? nameOf(e.inPlayerId) : e.playerId ? nameOf(e.playerId) : rival;
  return { minute: e.minute as number, who, label: EVENT_LABELS[e.type] ?? e.type, goal: OURS.has(e.type) };
}
